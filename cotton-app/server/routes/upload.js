// server/routes/upload.js — 文件上传接口
const express = require('express')
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const crypto  = require('crypto')
const jwt     = require('jsonwebtoken')
const {
  APPLYMENT_IMAGE_TYPES,
  IMAGE_TYPES,
  makeFileFilter,
  safeExtension
} = require('../utils/upload-policy')
const { createIpRateLimiter } = require('../middleware/request-safety')

const router    = express.Router()
const uploadDir = path.join(__dirname, '../public/uploads')
const privateApplymentDir = path.join(__dirname, '../private/applyments')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
if (!fs.existsSync(privateApplymentDir)) fs.mkdirSync(privateApplymentDir, { recursive: true, mode: 0o700 })
try { fs.chmodSync(privateApplymentDir, 0o700) } catch {}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext = safeExtension(file, IMAGE_TYPES)
    cb(null, Date.now() + '_' + Math.random().toString(36).slice(2) + ext)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: makeFileFilter({
    types: IMAGE_TYPES,
    message: '仅支持 JPG、PNG、WebP、GIF、AVIF 或 BMP 图片'
  })
})
const publicApplymentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, privateApplymentDir),
    filename: (_req, file, cb) => {
      const nonce = crypto.randomBytes(12).toString('hex')
      cb(null, `applyment_${Date.now()}_${nonce}${safeExtension(file, APPLYMENT_IMAGE_TYPES)}`)
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: makeFileFilter({
    types: APPLYMENT_IMAGE_TYPES,
    message: '进件材料仅支持 JPG、PNG 或 BMP，且单张不超过 5MB'
  })
})
const publicUploadRateLimit = createIpRateLimiter({
  namespace: 'public-applyment-upload',
  windowMs: 30 * 60 * 1000,
  maxRequests: 20,
  message: '上传次数过多，请稍后再试'
})

function anyAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ code: 401, msg: '请先登录' })
  try { jwt.verify(auth.slice(7), process.env.JWT_SECRET); next() }
  catch { res.status(401).json({ code: 401, msg: '登录已过期' }) }
}

router.post('/', anyAuth, (req, res) => {
  upload.single('file')(req, res, error => {
    if (error) return res.status(400).json({ code: 400, msg: error.message, data: null })
    if (!req.file) return res.status(400).json({ code: 400, msg: '未收到文件', data: null })
    res.json({ code: 200, msg: 'ok', data: { url: '/uploads/' + req.file.filename } })
  })
})

router.post('/public', publicUploadRateLimit, (req, res) => {
  publicApplymentUpload.single('file')(req, res, error => {
    if (error) return res.status(400).json({ code: 400, msg: error.message, data: null })
    if (!req.file) return res.status(400).json({ code: 400, msg: '未收到文件', data: null })
    try {
      fs.chmodSync(req.file.path, 0o600)
    } catch {
      try { fs.unlinkSync(req.file.path) } catch {}
      return res.status(500).json({ code: 500, msg: '入驻材料保存失败', data: null })
    }
    res.json({
      code: 200,
      msg: 'ok',
      data: { url: '/private/applyments/' + req.file.filename }
    })
  })
})

module.exports = router
