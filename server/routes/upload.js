// server/routes/upload.js — 文件上传接口
const express = require('express')
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const jwt     = require('jsonwebtoken')

const router    = express.Router()
const uploadDir = path.join(__dirname, '../public/uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, Date.now() + '_' + Math.random().toString(36).slice(2) + ext)
  }
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })
const publicApplymentUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/bmp'])
    if (allowed.has(file.mimetype)) return cb(null, true)
    cb(new Error('进件材料仅支持 JPG、PNG、BMP，且单张不超过 5MB'))
  }
})

function anyAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ code: 401, msg: '请先登录' })
  try { jwt.verify(auth.slice(7), process.env.JWT_SECRET); next() }
  catch { res.status(401).json({ code: 401, msg: '登录已过期' }) }
}

router.post('/', anyAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ code: 400, msg: '未收到文件', data: null })
  res.json({ code: 200, msg: 'ok', data: { url: '/uploads/' + req.file.filename } })
})

router.post('/public', (req, res) => {
  publicApplymentUpload.single('file')(req, res, error => {
    if (error) return res.status(400).json({ code: 400, msg: error.message, data: null })
    if (!req.file) return res.status(400).json({ code: 400, msg: '未收到文件', data: null })
    res.json({ code: 200, msg: 'ok', data: { url: '/uploads/' + req.file.filename } })
  })
})

module.exports = router
