const jwt = require('jsonwebtoken')
const { WebSocketServer, WebSocket } = require('ws')

let socketServer = null

function actorFromToken(token) {
  const actor = jwt.verify(token, process.env.JWT_SECRET)
  if (actor.is_admin) return { type: 'admin', id: Number(actor.id) }
  if (actor.role === 'farmer') return { type: 'farmer', id: Number(actor.id) }
  throw new Error('unsupported actor')
}

function attachSupportRealtime(server) {
  if (socketServer) return socketServer
  socketServer = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    let url
    try { url = new URL(request.url, 'http://localhost') } catch { socket.destroy(); return }
    if (url.pathname !== '/api/support/socket') return
    try {
      request.supportActor = actorFromToken(url.searchParams.get('token') || '')
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    socketServer.handleUpgrade(request, socket, head, ws => socketServer.emit('connection', ws, request))
  })

  socketServer.on('connection', (ws, request) => {
    ws.supportActor = request.supportActor
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })
    ws.send(JSON.stringify({ type: 'ready', actor: ws.supportActor.type }))
  })

  const heartbeat = setInterval(() => {
    socketServer.clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate()
      ws.isAlive = false
      ws.ping()
    })
  }, 30000)
  server.on('close', () => clearInterval(heartbeat))
  return socketServer
}

function publish(payload, predicate) {
  if (!socketServer) return
  const message = JSON.stringify(payload)
  socketServer.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN && predicate(ws.supportActor)) ws.send(message)
  })
}

function notifyFarmer(userId, payload) {
  publish(payload, actor => actor && actor.type === 'farmer' && actor.id === Number(userId))
}

function notifyAdmins(payload) {
  publish(payload, actor => actor && actor.type === 'admin')
}

module.exports = { attachSupportRealtime, notifyFarmer, notifyAdmins }
