require('dotenv').config()

const express = require('express')
const cors = require('cors')
const path = require('path')
const {
  assertRuntimeConfig,
  createApiErrorHandler,
  createCorsOptionsDelegate,
  securityHeaders,
  createLoginRateLimiter
} = require('./middleware/request-safety')
const { createActiveSessionGuard } = require('./middleware/active-session')

assertRuntimeConfig()

const app = express()
app.set('trust proxy', true)
app.use(securityHeaders)
app.use(cors(createCorsOptionsDelegate()))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.post([
  '/api/community-auth/login',
  '/api/community-auth/admin/login'
], createLoginRateLimiter())
app.use('/api', createActiveSessionGuard())

app.use((req, _res, next) => {
  if (req.path !== '/api/community-health') {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`)
  }
  next()
})

app.get('/knowledge/admin-login.html', (_req, res) => res.redirect(302, '/admin/login.html?role=admin'))

const noCache = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}

app.use('/knowledge/site', express.static(path.join(__dirname, 'public/site')))
const siteRouter = require('./routes/site')
app.use('/knowledge', noCache, siteRouter)
app.use('/knowledge', noCache, express.static(path.join(__dirname, 'public/knowledge')))
app.use('/assets', express.static(path.join(__dirname, 'public/assets')))
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')))
app.use('/', noCache, siteRouter)

const platformBaseUrl = String(process.env.PLATFORM_BASE_URL || '').replace(/\/+$/, '')
function platformUrl(req, pathname) {
  if (platformBaseUrl) return `${platformBaseUrl}${pathname}`

  // Same-domain traffic can use a relative path and be routed by Nginx.
  // A direct request to the local community port must switch back to cotton-app.
  const forwardedPort = String(req.get('x-forwarded-port') || '')
  const host = String(req.get('host') || '')
  if (!forwardedPort && host) {
    try {
      const target = new URL(`${req.protocol}://${host}`)
      if (target.port) {
        target.port = String(process.env.PLATFORM_DIRECT_PORT || 3000)
        target.pathname = pathname
        target.search = ''
        target.hash = ''
        return target.toString()
      }
    } catch {}
  }
  return pathname
}
app.get('/platform', (req, res) => res.redirect(platformUrl(req, '/admin/login.html')))
app.get('/platform/admin', (req, res) => res.redirect(platformUrl(req, '/admin/login.html')))

app.use('/api/community-auth', require('./routes/auth'))
app.use('/api/knowledge', require('./routes/knowledge'))
app.use('/api/community-ai', require('./routes/ai'))
app.use('/api/public-service', require('./routes/public-service'))
app.use('/api/policies', require('./routes/policies'))
app.use('/api/service-products', require('./routes/service-products'))
app.use('/api/pest-knowledge', require('./routes/pest-knowledge'))
app.use('/api/cotton-varieties', require('./routes/cotton-varieties'))
app.use('/api/processing-factories', require('./routes/processing-factories'))
app.use('/api/expert-studio', require('./routes/expert-studio'))
app.use('/api/plot-daily-work', require('./routes/plot-daily-work'))
app.use('/api/voice-briefings', require('./routes/voice-briefings'))
app.use('/api/commerce', require('./routes/commerce'))

app.get('/api/community-health', async (_req, res) => {
  try {
    const [[row]] = await require('./db/database').query('SELECT 1 AS connected')
    res.json({ code: 200, msg: 'ok', data: { service: 'cotton-community', database: row.connected === 1 } })
  } catch (error) {
    res.status(503).json({ code: 503, msg: '数据库连接失败', data: null })
  }
})

app.use((req, res) => {
  const acceptsHtml = req.method === 'GET' && String(req.headers.accept || '').includes('text/html')
  if (acceptsHtml && !req.path.startsWith('/api/')) {
    return res.status(404).sendFile(path.join(__dirname, 'public/site/index.html'))
  }
  return res.status(404).json({ code: 404, msg: '接口不存在', data: null })
})
app.use(createApiErrorHandler())

if (require.main === module) {
  const port = Number(process.env.PORT) || 3100
  const server = app.listen(port, () => console.log(`棉知农业服务网站已启动：http://localhost:${port}/public/`))
  let shuttingDown = false
  const shutdown = signal => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[shutdown] received ${signal}`)
    const forceExit = setTimeout(() => process.exit(1), 10000)
    forceExit.unref()
    server.close(async () => {
      try { await require('./db/database').end() } catch (error) { console.error('[shutdown-db]', error.message) }
      clearTimeout(forceExit)
      process.exit(0)
    })
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
}

module.exports = app
