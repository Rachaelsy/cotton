const express = require('express')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const db = require('../db/database')
const identityData = require('../utils/identity-data')

const router = express.Router()
const privateDir = path.join(__dirname, '../private/identity')
fs.mkdirSync(privateDir, { recursive: true })

function farmerAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ code: 401, msg: '请先登录' })
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    if (req.user.role !== 'farmer') return res.status(403).json({ code: 403, msg: '仅农户可提交实名认证' })
    next()
  } catch {
    res.status(401).json({ code: 401, msg: '登录已过期' })
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, privateDir),
  filename: (req, file, cb) => cb(null,
    `farmer_${req.user.id}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
})
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(file.mimetype.startsWith('image/') ? null : new Error('只允许上传图片'), file.mimetype.startsWith('image/'))
})

function validIdNumber(value) {
  const id = String(value || '').toUpperCase()
  if (!/^\d{17}[\dX]$/.test(id)) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checks = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  return checks[id.slice(0, 17).split('').reduce((sum, n, i) => sum + Number(n) * weights[i], 0) % 11] === id[17]
}

router.get('/', farmerAuth, async (req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT id,real_name,id_number_mask,status,reject_reason,created_at,updated_at,reviewed_at
         FROM farmer_verifications WHERE user_id=? ORDER BY id DESC LIMIT 1`, [req.user.id]
    )
    return res.json({ code: 200, msg: 'ok', data: row || { status: 'not_submitted' } })
  } catch (error) {
    console.error('[verification-status]', error)
    return res.status(500).json({ code: 500, msg: '实名认证状态加载失败' })
  }
})

router.post('/upload', farmerAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ code: 400, msg: '请选择证件图片' })
  return res.json({ code: 200, msg: '上传成功', data: { fileToken: req.file.filename } })
})

router.post('/', farmerAuth, async (req, res) => {
  const realName = String(req.body.realName || '').trim()
  const idNumber = String(req.body.idNumber || '').trim().toUpperCase()
  const frontToken = path.basename(String(req.body.frontToken || ''))
  const backToken = path.basename(String(req.body.backToken || ''))
  if (!/^[\u4e00-\u9fa5·]{2,32}$/.test(realName)) return res.status(400).json({ code: 400, msg: '请填写身份证上的真实姓名' })
  if (!validIdNumber(idNumber)) return res.status(400).json({ code: 400, msg: '身份证号码格式或校验位不正确' })
  const expectedPrefix = `farmer_${req.user.id}_`
  if (!frontToken.startsWith(expectedPrefix) || !backToken.startsWith(expectedPrefix) ||
      !fs.existsSync(path.join(privateDir, frontToken)) || !fs.existsSync(path.join(privateDir, backToken))) {
    return res.status(400).json({ code: 400, msg: '请重新上传身份证正反面照片' })
  }
  try {
    const [[latest]] = await db.query(
      'SELECT id,status FROM farmer_verifications WHERE user_id=? ORDER BY id DESC LIMIT 1',
      [req.user.id]
    )
    if (latest && latest.status === 'pending') {
      return res.status(409).json({ code: 409, msg: '实名认证正在审核中，请勿重复提交' })
    }
    if (latest && latest.status === 'approved') {
      return res.status(409).json({ code: 409, msg: '实名认证已经通过，无需重复提交' })
    }
    await db.query(
      `INSERT INTO farmer_verifications
        (user_id,real_name,id_number,id_number_mask,id_front_path,id_back_path,status)
       VALUES (?,?,?,?,?,?,'pending')`,
      [req.user.id, realName, identityData.encrypt(idNumber), identityData.maskIdNumber(idNumber), frontToken, backToken]
    )
    return res.json({ code: 200, msg: '实名认证已提交，等待管理员审核', data: { status: 'pending' } })
  } catch (error) {
    console.error('[verification-submit]', error)
    return res.status(error.statusCode || 500).json({ code: error.statusCode || 500, msg: error.message || '实名认证提交失败' })
  }
})

module.exports = router
