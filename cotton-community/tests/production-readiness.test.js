const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')
const {
  assertRuntimeConfig,
  createApiErrorHandler,
  createCorsOptionsDelegate,
  securityHeaders,
  createLoginRateLimiter
} = require('../middleware/request-safety')
const { isProductionDefaultCredential } = require('../utils/default-credentials')

const root = path.join(__dirname, '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const databasePath = require.resolve('../db/database')
require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: { query: async () => [[{ connected: 1 }]] }
}
const app = require('../server')

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

async function run() {
  const shell = read('public/site/index.html')
  const runtime = read('public/site/runtime.js')
  const siteApp = read('public/site/app.js')
  const learning = read('public/site/learning.js')
  const admin = read('public/knowledge/admin.js')
  const adminPage = read('public/knowledge/admin.html')
  const knowledgeRoute = read('routes/knowledge.js')
  const serverSource = read('server.js')
  const compose = read('../docker-compose.yml')

  assert(shell.indexOf('/knowledge/site/runtime.js') < shell.indexOf('/knowledge/site/learning.js'))
  assert(shell.indexOf('/knowledge/site/runtime.js') < shell.indexOf('/knowledge/site/app.js'))
  assert(adminPage.includes('/knowledge/site/runtime.js'))
  assert(runtime.includes('AbortController') && runtime.includes('请求超时'))
  assert(runtime.includes("addEventListener('offline'") && runtime.includes("addEventListener('online'"))
  assert(siteApp.includes('runtime.requestJson') && learning.includes('runtime.requestJson'))
  assert(siteApp.includes('function renderPrivacy()'))
  assert(siteApp.includes("publicServiceApi('/privacy-requests'"))
  assert(learning.includes("publicLink('/privacy')"))
  assert(learning.includes("localStorage.removeItem('knowledge_token')"))
  assert(admin.includes("location.replace('/admin/login.html?role=admin')"))
  assert(!fs.existsSync(path.join(root, 'public/knowledge/admin-login.html')))
  assert(knowledgeRoute.includes('allowedUploadTypes'))
  assert(!knowledgeRoute.includes("file.mimetype.startsWith('image/')"))
  assert(!knowledgeRoute.includes("'image/svg+xml'"))
  assert(compose.includes('max-size: "10m"') && compose.includes('max-file: "3"'))
  assert(compose.includes('NODE_ENV: ${APP_NODE_ENV:-production}'))
  assert(serverSource.includes("process.once('SIGTERM'"))
  assert.equal(isProductionDefaultCredential('13800000001', 'test123', 'production'), true)
  assert.equal(isProductionDefaultCredential('13800000001', 'test123', 'development'), false)
  assert.throws(() => assertRuntimeConfig({
    NODE_ENV: 'production',
    JWT_SECRET: 'replace-with-the-same-secret-as-cotton-app',
    DB_HOST: 'db',
    DB_NAME: 'cotton'
  }), /JWT_SECRET/)

  const headerRes = new MockResponse()
  let headerNext = false
  securityHeaders({ path: '/api/knowledge/home' }, headerRes, () => { headerNext = true })
  assert(headerNext)
  assert.equal(headerRes.headers['x-content-type-options'], 'nosniff')
  assert.equal(headerRes.headers['cache-control'], 'no-store')

  const cors = createCorsOptionsDelegate({ NODE_ENV: 'production' })
  cors({
    protocol: 'https',
    get(name) {
      return {
        origin: 'https://untrusted.example.com',
        host: 'xjsmartcotton.cn',
        'x-forwarded-host': 'xjsmartcotton.cn',
        'x-forwarded-proto': 'https'
      }[name]
    }
  }, (_error, options) => assert.equal(options.origin, false))

  const limiter = createLoginRateLimiter({ maxAttempts: 2, windowMs: 60000 })
  const request = {
    path: '/api/community-auth/login',
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    body: { phone: '13800138000' }
  }
  for (let index = 0; index < 2; index += 1) {
    const res = new MockResponse()
    let nextCalled = false
    limiter(request, res, () => {
      nextCalled = true
      res.statusCode = 401
      res.emit('finish')
    })
    assert(nextCalled)
  }
  const blockedRes = new MockResponse()
  limiter(request, blockedRes, () => assert.fail('blocked login should not reach the route'))
  assert.equal(blockedRes.statusCode, 429)

  const malformedRes = new MockResponse()
  createApiErrorHandler({ logger: { error: () => assert.fail('malformed JSON is a client error') } })(
    { type: 'entity.parse.failed' },
    {},
    malformedRes,
    () => {}
  )
  assert.equal(malformedRes.statusCode, 400)
  assert.equal(malformedRes.body.code, 400)

  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    const platformLogin = await fetch(`${baseUrl}/platform/admin`, { redirect: 'manual' })
    assert.equal(platformLogin.status, 302)
    const platformLocation = new URL(platformLogin.headers.get('location'))
    assert.equal(platformLocation.port, '3000')
    assert.equal(platformLocation.pathname, '/admin/login.html')

    const communityRoot = await fetch(`${baseUrl}/knowledge/`, { redirect: 'manual' })
    assert.equal(communityRoot.status, 302)
    assert.equal(communityRoot.headers.get('location'), '/public/')

    const legacyAdminLogin = await fetch(`${baseUrl}/knowledge/admin-login.html`, { redirect: 'manual' })
    assert.equal(legacyAdminLogin.status, 302)
    assert.equal(legacyAdminLogin.headers.get('location'), '/admin/login.html?role=admin')

    const html404 = await fetch(`${baseUrl}/public/not-a-real-page`, {
      headers: { Accept: 'text/html' }
    })
    assert.equal(html404.status, 404)
    assert((await html404.text()).includes('id="mainContent"'))
    assert.equal(html404.headers.get('x-content-type-options'), 'nosniff')

    const api404 = await fetch(`${baseUrl}/api/not-a-real-endpoint`, {
      headers: { Accept: 'application/json' }
    })
    assert.equal(api404.status, 404)
    assert.equal((await api404.json()).code, 404)

    const malformed = await fetch(`${baseUrl}/api/community-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{'
    })
    assert.equal(malformed.status, 400)
    assert.equal((await malformed.json()).code, 400)
  } finally {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }

  console.log('community production readiness tests passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
