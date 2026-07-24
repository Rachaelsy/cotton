require('dotenv').config()

const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
app.set('trust proxy', true)
app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`)
  next()
})

const noCache = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}

app.use('/knowledge/site', express.static(path.join(__dirname, 'public/site')))
app.use('/knowledge', noCache, require('./routes/site'))
app.use('/knowledge', noCache, express.static(path.join(__dirname, 'public/knowledge')))
app.use('/assets', express.static(path.join(__dirname, 'public/assets')))
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')))

app.get(['/', '/index.html'], (_req, res) => res.redirect('/knowledge/'))

const platformBaseUrl = String(process.env.PLATFORM_BASE_URL || '').replace(/\/+$/, '')
const platformUrl = pathname => platformBaseUrl ? `${platformBaseUrl}${pathname}` : pathname
app.get('/platform', (_req, res) => res.redirect(platformUrl('/')))
app.get('/platform/admin', (_req, res) => res.redirect(platformUrl('/admin/dashboard.html')))

app.use('/api/community-auth', require('./routes/auth'))
app.use('/api/knowledge', require('./routes/knowledge'))
app.use('/api/community-ai', require('./routes/ai'))

app.get('/api/community-health', async (_req, res) => {
  try {
    const [[row]] = await require('./db/database').query('SELECT 1 AS connected')
    res.json({ code: 200, msg: 'ok', data: { service: 'cotton-community', database: row.connected === 1 } })
  } catch (error) {
    res.status(503).json({ code: 503, msg: '数据库连接失败', data: null })
  }
})

app.use((_req, res) => res.status(404).json({ code: 404, msg: '接口不存在', data: null }))
app.use((error, _req, res, _next) => {
  console.error('[uncaught]', error)
  res.status(500).json({ code: 500, msg: '服务器内部错误', data: null })
})

if (require.main === module) {
  const port = Number(process.env.PORT) || 3100
  app.listen(port, () => console.log(`棉知农业服务网站已启动：http://localhost:${port}/knowledge/`))
}

module.exports = app
