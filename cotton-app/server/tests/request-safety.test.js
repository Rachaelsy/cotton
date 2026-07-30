const assert = require('assert')
const { EventEmitter } = require('events')
const fs = require('fs')
const path = require('path')
const {
  assertRuntimeConfig,
  createApiErrorHandler,
  createCorsOptionsDelegate,
  securityHeaders,
  createLoginRateLimiter,
  createIpRateLimiter
} = require('../middleware/request-safety')

const serverSource = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8')

class MockResponse extends EventEmitter {
  constructor() {
    super()
    this.headers = {}
    this.statusCode = 200
    this.body = null
  }

  setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = String(value)
  }

  status(code) {
    this.statusCode = code
    return this
  }

  json(body) {
    this.body = body
    this.emit('finish')
    return this
  }
}

function runLimiter(limiter, statusCode = 401) {
  const req = {
    path: '/api/auth/login',
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    body: { phone: '13800138000' }
  }
  const res = new MockResponse()
  let nextCalled = false
  limiter(req, res, () => {
    nextCalled = true
    res.statusCode = statusCode
    res.emit('finish')
  })
  return { res, nextCalled }
}

{
  const req = { path: '/api/orders' }
  const res = new MockResponse()
  let nextCalled = false
  securityHeaders(req, res, () => { nextCalled = true })
  assert(nextCalled, 'security middleware should continue the request')
  assert.equal(res.headers['x-content-type-options'], 'nosniff')
  assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN')
  assert.equal(res.headers['cache-control'], 'no-store')
  assert(res.headers['permissions-policy'].includes('geolocation=(self)'))
}

{
  const delegate = createCorsOptionsDelegate({
    NODE_ENV: 'production',
    CORS_ALLOWED_ORIGINS: 'https://admin.example.com'
  })
  const request = origin => ({
    protocol: 'https',
    get(name) {
      const headers = {
        origin,
        host: 'cyaia.cn',
        'x-forwarded-host': 'cyaia.cn',
        'x-forwarded-proto': 'https'
      }
      return headers[name]
    }
  })
  delegate(request('https://cyaia.cn'), (_error, options) => assert.equal(options.origin, true))
  delegate(request('https://admin.example.com'), (_error, options) => assert.equal(options.origin, true))
  delegate(request('https://untrusted.example.com'), (_error, options) => assert.equal(options.origin, false))
}

{
  const limiter = createLoginRateLimiter({ maxAttempts: 3, windowMs: 60000 })
  for (let index = 0; index < 3; index += 1) {
    assert(runLimiter(limiter).nextCalled, 'allowed failures should reach the login route')
  }
  const blocked = runLimiter(limiter)
  assert.equal(blocked.nextCalled, false)
  assert.equal(blocked.res.statusCode, 429)
  assert.equal(blocked.res.body.code, 429)
  assert(Number(blocked.res.headers['retry-after']) > 0)
}

{
  const limiter = createLoginRateLimiter({ maxAttempts: 2, windowMs: 60000 })
  runLimiter(limiter, 401)
  runLimiter(limiter, 200)
  assert(runLimiter(limiter, 401).nextCalled, 'a successful login should clear earlier failures')
}

{
  const limiter = createIpRateLimiter({
    namespace: 'upload-test',
    maxRequests: 2,
    windowMs: 60000
  })
  const run = ip => {
    const req = { ip, socket: { remoteAddress: ip } }
    const res = new MockResponse()
    let nextCalled = false
    limiter(req, res, () => { nextCalled = true })
    return { res, nextCalled }
  }
  assert(run('127.0.0.1').nextCalled)
  assert(run('127.0.0.1').nextCalled)
  const blocked = run('127.0.0.1')
  assert.equal(blocked.nextCalled, false)
  assert.equal(blocked.res.statusCode, 429)
  assert(run('127.0.0.2').nextCalled, 'rate limit should be isolated by client IP')
}

{
  const handler = createApiErrorHandler({ logger: { error: () => assert.fail('client JSON error should not be logged as a server crash') } })
  const res = new MockResponse()
  handler({ type: 'entity.parse.failed' }, {}, res, () => {})
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.code, 400)
  assert.match(res.body.msg, /JSON/)
}

{
  const handler = createApiErrorHandler({ logger: { error: () => assert.fail('oversized request should not be logged as a server crash') } })
  const res = new MockResponse()
  handler({ type: 'entity.too.large', status: 413 }, {}, res, () => {})
  assert.equal(res.statusCode, 413)
  assert.equal(res.body.code, 413)
}

assert(serverSource.includes("db.query('SELECT 1 AS connected')"), 'health check should verify MySQL')
assert(serverSource.includes("process.once('SIGTERM'"), 'service should close gracefully on container shutdown')
assert.throws(() => assertRuntimeConfig({
  NODE_ENV: 'production',
  JWT_SECRET: 'cotton_jwt_secret_change_in_production',
  DB_HOST: 'db',
  DB_NAME: 'cotton',
  IDENTITY_DATA_KEY: 'y'.repeat(48)
}), /JWT_SECRET/)
assert.throws(() => assertRuntimeConfig({
  NODE_ENV: 'production',
  JWT_SECRET: 'x'.repeat(48),
  DB_HOST: 'db',
  DB_NAME: 'cotton',
  IDENTITY_DATA_KEY: 'TODO_IDENTITY_KEY'
}), /IDENTITY_DATA_KEY/)
assert.doesNotThrow(() => assertRuntimeConfig({
  NODE_ENV: 'production',
  JWT_SECRET: 'x'.repeat(48),
  DB_HOST: 'db',
  DB_NAME: 'cotton',
  IDENTITY_DATA_KEY: 'y'.repeat(48)
}))

console.log('request safety tests passed')
