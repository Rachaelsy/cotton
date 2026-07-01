// server/index.js — Express 入口
require('dotenv').config()

const express = require('express')
const cors    = require('cors')
const path    = require('path')

const app = express()

// ── 中间件 ──────────────────────────────────
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 请求日志
app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`)
  next()
})

// ── 静态文件 ─────────────────────────────────
// HTML 文件禁止缓存，确保每次加载最新版本
const noCache = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}
app.use('/admin',    noCache, express.static(path.join(__dirname, 'public/admin')))
app.use('/merchant', noCache, express.static(path.join(__dirname, 'public/merchant')))
app.use('/operator', noCache, express.static(path.join(__dirname, 'public/operator')))
app.use('/portal',   noCache, express.static(path.join(__dirname, 'public/portal')))
app.use('/uploads',  express.static(path.join(__dirname, 'public/uploads')))

// ── 路由 ────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'))
app.use('/api/products', require('./routes/products'))
app.use('/api/orders',   require('./routes/orders'))
app.use('/api/plots',    require('./routes/plots'))
app.use('/api/farm-records', require('./routes/farm-records'))
app.use('/api/weather',  require('./routes/weather'))
app.use('/api/operator',       require('./routes/operator'))
app.use('/api/machines',       require('./routes/machines'))
app.use('/api/machine-orders', require('./routes/machine-orders'))
app.use('/api/ai',       require('./routes/ai'))
app.use('/api/admin',    require('./routes/admin'))
app.use('/api/merchant', require('./routes/merchant'))
app.use('/api/upload',  require('./routes/upload'))

// 健康检查
app.get('/api/ping', (_req, res) => res.json({ code: 200, msg: 'pong' }))

// 404
app.use((_req, res) => res.status(404).json({ code: 404, msg: '接口不存在' }))

// 全局错误捕获
app.use((err, _req, res, _next) => {
  console.error('[uncaught]', err)
  res.status(500).json({ code: 500, msg: '服务器内部错误' })
})

// ── 启动 ────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 棉花智能体后端启动成功 → http://localhost:${PORT}`)
  require('./scheduler').startScheduler()
})
