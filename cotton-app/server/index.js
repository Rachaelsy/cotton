// server/index.js — Express 入口
require('dotenv').config()

const express = require('express')
const cors    = require('cors')
const path    = require('path')
const http    = require('http')
const { attachSupportRealtime } = require('./utils/support-realtime')
const {
  assertRuntimeConfig,
  createApiErrorHandler,
  createCorsOptionsDelegate,
  securityHeaders,
  createLoginRateLimiter
} = require('./middleware/request-safety')
const db = require('./db/database')
const { createActiveSessionGuard } = require('./middleware/active-session')

assertRuntimeConfig()

const app = express()
app.set('trust proxy', true)

// ── 中间件 ──────────────────────────────────
app.use(securityHeaders)
app.use(cors(createCorsOptionsDelegate()))
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => {
    if (req.originalUrl && (
      req.originalUrl.startsWith('/api/pay/wechat/notify') ||
      req.originalUrl.startsWith('/api/pay/wechat/refund-notify')
    )) {
      req.rawBody = Buffer.from(buf)
    }
  }
}))
app.use(express.urlencoded({ extended: true }))
app.get('/favicon.ico', (_req, res) => {
  res.redirect(302, '/admin/assets/cotton-field-sky.png')
})
app.post([
  '/api/auth/login',
  '/api/admin/login',
  '/api/merchant/login',
  '/api/operator/login',
  '/api/expert-admin/login'
], createLoginRateLimiter())
app.use('/api', createActiveSessionGuard())

// 请求日志
app.use((req, _res, next) => {
  if (req.path !== '/api/ping') {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`)
  }
  next()
})

// ── 静态文件 ─────────────────────────────────
// HTML 文件禁止缓存，确保每次加载最新版本
const noCache = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}
app.use('/admin',    noCache, express.static(path.join(__dirname, 'public/admin')))
app.use('/expert',   noCache, express.static(path.join(__dirname, 'public/expert')))
app.use('/merchant', noCache, express.static(path.join(__dirname, 'public/merchant')))
app.use('/operator', noCache, express.static(path.join(__dirname, 'public/operator')))
app.use('/portal',   noCache, express.static(path.join(__dirname, 'public/portal')))
app.use('/uploads',  express.static(path.join(__dirname, 'public/uploads')))

// 访问 xjsmartcotton.cn 或首页文件时，进入统一身份登录页。
app.get(['/', '/index.html'], (_req, res) => res.redirect('/admin/login.html'))
const communityBaseUrl = String(process.env.COMMUNITY_BASE_URL || '').replace(/\/+$/, '')
function communityUrl(req, pathname) {
  if (communityBaseUrl) return `${communityBaseUrl}${pathname}`

  // Nginx already routes these paths by service name. A direct local request
  // to port 3000 needs an absolute URL so it does not fall back into cotton-app.
  const forwardedPort = String(req.get('x-forwarded-port') || '')
  const host = String(req.get('host') || '')
  if (!forwardedPort && host) {
    try {
      const target = new URL(`${req.protocol}://${host}`)
      if (target.port === String(process.env.PORT || 3000)) {
        target.port = String(process.env.COMMUNITY_DIRECT_PORT || 3100)
        target.pathname = pathname
        target.search = ''
        target.hash = ''
        return target.toString()
      }
    } catch {}
  }
  return pathname
}
const redirectCommunity = pathname => (req, res) => res.redirect(communityUrl(req, pathname))
app.get('/community', redirectCommunity('/knowledge/'))
app.get('/community/public', redirectCommunity('/public/'))
app.get('/community/business', redirectCommunity('/business/'))

// ── 路由 ────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'))
app.use('/api/products', require('./routes/products'))
app.use('/api/orders',   require('./routes/orders'))
app.use('/api/logistics', require('./routes/logistics'))
app.use('/api/plots',    require('./routes/plots'))
app.use('/api/farm-records', require('./routes/farm-records'))
app.use('/api/feedback', require('./routes/feedback'))
app.use('/api/weather',  require('./routes/weather'))
app.use('/api/marketing', require('./routes/marketing'))
app.use('/api/points',   require('./routes/points'))
app.use('/api/verification', require('./routes/verification'))
app.use('/api/expert',   require('./routes/expert'))
app.use('/api/pay',      require('./routes/payments'))
app.use('/api/wechat-applyment', require('./routes/wechat-applyment'))
app.use('/api/operator',       require('./routes/operator'))
app.use('/api/machines',       require('./routes/machines'))
app.use('/api/machine-orders', require('./routes/machine-orders'))
app.use('/api/ai',       require('./routes/ai'))
app.use('/api/admin',    require('./routes/admin'))
app.use('/api/expert-admin', require('./routes/expert-admin'))
app.use('/api/merchant', require('./routes/merchant'))
app.use('/api/upload',  require('./routes/upload'))

// 健康检查
app.get('/api/ping', async (_req, res) => {
  try {
    const [[row]] = await db.query('SELECT 1 AS connected')
    return res.json({
      code: 200,
      msg: 'pong',
      data: { service: 'cotton-app', database: row.connected === 1 }
    })
  } catch (error) {
    return res.status(503).json({ code: 503, msg: '数据库连接失败', data: null })
  }
})

// 404
app.use((_req, res) => res.status(404).json({ code: 404, msg: '接口不存在' }))

// 全局错误捕获
app.use(createApiErrorHandler())

// ── 启动 ────────────────────────────────────
const PORT = process.env.PORT || 3000
const server = http.createServer(app)
attachSupportRealtime(server)
server.listen(PORT, () => {
  console.log(`🚀 棉花智能体后端启动成功 → http://localhost:${PORT}`)
  require('./scheduler').startScheduler()
})

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[shutdown] received ${signal}`)
  const forceExit = setTimeout(() => process.exit(1), 10000)
  forceExit.unref()
  server.close(async () => {
    try { await db.end() } catch (error) { console.error('[shutdown-db]', error.message) }
    clearTimeout(forceExit)
    process.exit(0)
  })
}

process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))
