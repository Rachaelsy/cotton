const assert = require('assert')
const express = require('express')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'knowledge-auth-bridge-test-secret'
delete process.env.WECHAT_WEB_APPID
delete process.env.WECHAT_WEB_SECRET
delete process.env.WECHAT_WEB_REDIRECT_URI

const dbPath = require.resolve('../db/database')

async function run() {
  const user = {
    id: 42,
    phone: '13800000042',
    role: 'farmer',
    real_name: '测试棉农',
    is_verified: 0,
    is_active: 1,
    avatar_url: null,
    openid: 'mini-openid'
  }
  const profile = { location: '喀什地区', land_size: 80, crop_type: '棉花' }
  let ticketRecord = null
  let nextId = 1

  const execute = async (sql, params = []) => {
    const compact = String(sql).replace(/\s+/g, ' ').trim()
    if (/SELECT id,openid FROM users WHERE id=\?/i.test(compact)) return [[{ id: user.id, openid: user.openid }], []]
    if (/SELECT \* FROM users WHERE id=\? AND is_active=1/i.test(compact)) return [[{ ...user }], []]
    if (/FROM farmers WHERE user_id=\?/i.test(compact)) return [[{ ...profile }], []]
    if (/INSERT INTO knowledge_web_login_tickets/i.test(compact)) {
      ticketRecord = {
        id: nextId++,
        token_hash: params[0],
        user_id: params[1],
        expires_at: new Date(Date.now() + 120000),
        used_at: null
      }
      return [{ insertId: ticketRecord.id, affectedRows: 1 }]
    }
    if (/DELETE FROM knowledge_web_login_tickets/i.test(compact)) return [{ affectedRows: 0 }]
    if (/FROM knowledge_web_login_tickets WHERE token_hash=\? FOR UPDATE/i.test(compact)) {
      return [[ticketRecord && ticketRecord.token_hash === params[0] ? { ...ticketRecord } : undefined].filter(Boolean), []]
    }
    if (/UPDATE knowledge_web_login_tickets SET used_at=NOW\(\)/i.test(compact)) {
      ticketRecord.used_at = new Date()
      return [{ affectedRows: 1 }]
    }
    throw new Error(`Unexpected SQL in knowledge auth bridge test: ${compact}`)
  }

  const connection = {
    query: execute,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {}
  }
  const mockDb = { query: execute, getConnection: async () => connection }
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }

  const authRouter = require('../routes/auth')
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const farmerToken = jwt.sign({ id: user.id, phone: user.phone, role: 'farmer' }, process.env.JWT_SECRET)

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    })
    return { status: response.status, body: await response.json() }
  }

  try {
    const status = await request('/api/auth/wechat-web/status')
    assert.strictEqual(status.status, 200)
    assert.strictEqual(status.body.data.enabled, false)

    const issued = await request('/api/auth/web-bridge', {
      method: 'POST',
      token: farmerToken,
      body: {}
    })
    assert.strictEqual(issued.status, 200)
    assert.match(issued.body.data.ticket, /^[A-Za-z0-9_-]{40,80}$/)

    const exchanged = await request('/api/auth/web-bridge/exchange', {
      method: 'POST',
      body: { ticket: issued.body.data.ticket }
    })
    assert.strictEqual(exchanged.status, 200)
    assert.strictEqual(exchanged.body.data.role, 'farmer')
    assert.strictEqual(exchanged.body.data.real_name, user.real_name)
    assert.strictEqual(jwt.verify(exchanged.body.data.token, process.env.JWT_SECRET).id, user.id)

    const reused = await request('/api/auth/web-bridge/exchange', {
      method: 'POST',
      body: { ticket: issued.body.data.ticket }
    })
    assert.strictEqual(reused.status, 401)
    assert.match(reused.body.msg, /已使用|已过期/)

    console.log('knowledge auth bridge tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
