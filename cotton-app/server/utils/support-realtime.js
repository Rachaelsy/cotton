const jwt = require('jsonwebtoken')
const { WebSocketServer, WebSocket } = require('ws')

let socketServer = null

async function actorFromToken(token, options = {}) {
  const database = options.database || require('../db/database')
  const jwtLib = options.jwtLib || jwt
  const secret = options.secret || process.env.JWT_SECRET
  const actor = jwtLib.verify(token, secret)
  const actorId = Number(actor.id)
  if (!actorId) throw new Error('invalid actor')

  const [[account]] = await database.query(
    'SELECT id,role,is_admin,is_active,admin_auth_version FROM users WHERE id=? LIMIT 1',
    [actorId]
  )
  if (!account || !Number(account.is_active)) throw new Error('inactive actor')

  if (actor.is_admin) {
    if (!Number(account.is_admin)) throw new Error('admin permission revoked')
    if (Number(actor.auth_version || 0) !== Number(account.admin_auth_version || 0)) {
      throw new Error('admin session revoked')
    }
    if (actor.must_change_password) throw new Error('password change required')
    return { type: 'admin', id: actorId }
  }
  if (actor.role === 'farmer') return { type: 'farmer', id: actorId }
  throw new Error('unsupported actor')
}

function attachSupportRealtime(server, options = {}) {
  if (socketServer) return socketServer
  socketServer = new WebSocketServer({ noServer: true, maxPayload: 4096 })
  const authenticationTimeoutMs = Math.max(100, Number(options.authenticationTimeoutMs) || 5000)

  server.on('upgrade', (request, socket, head) => {
    let url
    try { url = new URL(request.url, 'http://localhost') } catch { socket.destroy(); return }
    if (url.pathname !== '/api/support/socket') return
    socketServer.handleUpgrade(request, socket, head, ws => socketServer.emit('connection', ws, request))
  })

  socketServer.on('connection', ws => {
    ws.supportActor = null
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })

    let authenticating = false
    const authenticationTimeout = setTimeout(() => {
      if (!ws.supportActor) ws.close(1008, 'authentication required')
    }, authenticationTimeoutMs)

    ws.on('message', async rawMessage => {
      if (ws.supportActor || authenticating) return
      authenticating = true
      try {
        const message = JSON.parse(rawMessage.toString())
        if (message.type !== 'auth' || typeof message.token !== 'string' || !message.token) {
          throw new Error('authentication message required')
        }
        ws.supportActor = await actorFromToken(message.token, options)
        clearTimeout(authenticationTimeout)
        ws.send(JSON.stringify({ type: 'ready', actor: ws.supportActor.type }))
      } catch {
        clearTimeout(authenticationTimeout)
        ws.close(1008, 'authentication failed')
      } finally {
        authenticating = false
      }
    })
    ws.on('close', () => clearTimeout(authenticationTimeout))
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
