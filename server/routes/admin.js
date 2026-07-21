// server/routes/admin.js — 后台管理 API
const express  = require('express')
const router   = express.Router()
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const multer   = require('multer')
const path     = require('path')
const fs       = require('fs')
const db       = require('../db/database')
const wxpay    = require('../utils/wechat-pay')
const profitSharing = require('../utils/profit-sharing')
const commissionRequests = require('../utils/commission-requests')
const applymentRegistration = require('../utils/applyment-registration')
const identityData = require('../utils/identity-data')
const { broadcastAnnouncement } = require('../utils/notify')
const supportMessages = require('../utils/support-messages')
const supportRealtime = require('../utils/support-realtime')

// ── 图片上传配置 ─────────────────────────────────────────
const uploadDir = path.join(__dirname, '../public/uploads/products')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => cb(null, `prod_${Date.now()}${path.extname(file.originalname)}`)
})
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('只允许上传图片'))
    cb(null, true)
  }
})

const supportUploadDir = path.join(__dirname, '../public/uploads/support')
if (!fs.existsSync(supportUploadDir)) fs.mkdirSync(supportUploadDir, { recursive: true })
const supportUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, supportUploadDir),
    filename: (_req, file, cb) => cb(null, `support_${Date.now()}_${Math.floor(Math.random() * 10000)}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('只允许上传图片'))
    cb(null, true)
  }
})

const expertUploadDir = path.join(__dirname, '../public/uploads/expert')
if (!fs.existsSync(expertUploadDir)) fs.mkdirSync(expertUploadDir, { recursive: true })
const expertStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, expertUploadDir),
  filename: (_req, file, cb) => cb(null, `expert_${Date.now()}_${Math.floor(Math.random() * 10000)}${path.extname(file.originalname)}`)
})
const expertUpload = multer({
  storage: expertStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      return cb(new Error('只允许上传图片或视频'))
    }
    cb(null, true)
  }
})

const JWT_SECRET  = process.env.JWT_SECRET
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'

function parsePayload(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return null }
}

function makeBusinessCode(prefix, ownerId) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${prefix}_${ownerId}_${stamp}_${Math.floor(Math.random() * 9000 + 1000)}`
}

async function buildMerchantApplymentPayload(merchant, cfg) {
  const draft = parsePayload(merchant.wechat_applyment_payload) || {}
  const businessCode = merchant.wechat_business_code || draft.business_code || makeBusinessCode('COTTON_MERCHANT', merchant.id)
  if (draft.source === 'portal_register') return applymentRegistration.prepareApplymentPayload(cfg, draft, businessCode)
  if (draft.raw_applyment && typeof draft.raw_applyment === 'object') return { business_code: businessCode, ...draft.raw_applyment }
  const { business_code, ...rest } = draft
  if (rest && (rest.contact_info || rest.subject_info || rest.business_info || rest.settlement_info || rest.bank_account_info)) {
    return { business_code: businessCode, ...rest }
  }
  return null
}

async function submitMerchantApplyment(merchant) {
  const cfg = wxpay.getNotifyConfig()
  if (!cfg) throw new Error('微信支付服务商未配置，无法自动提交进件')
  const payload = await buildMerchantApplymentPayload(merchant, cfg)
  if (!payload) throw new Error('商户尚未保存可提交的进件资料')
  const result = await wxpay.submitApplyment(cfg, payload)
  const state = result.applyment_state || result.state || (result.sub_mchid ? 'APPLYMENT_STATE_FINISHED' : 'APPLYMENT_STATE_AUDITING')
  const message = result.applyment_state_msg || result.applyment_state_desc || result.reject_reason || result.message || ''
  await db.query(
    `UPDATE merchants SET wechat_applyment_id=?, wechat_business_code=?,
     wechat_applyment_state=?, wechat_applyment_msg=?, sub_mchid=COALESCE(?, sub_mchid),
     wechat_applyment_updated_at=NOW() WHERE id=?`,
    [
      result.applyment_id || null,
      payload.business_code || null,
      state,
      message,
      result.sub_mchid || null,
      merchant.id
    ]
  )
  return { payload, result, state, message }
}

async function submitOperatorApplyment(operator) {
  const cfg = wxpay.getNotifyConfig()
  if (!cfg) throw new Error('微信支付服务商未配置，无法自动提交进件')
  const draft = parsePayload(operator.wechat_applyment_payload) || {}
  const businessCode = operator.wechat_business_code || draft.business_code || makeBusinessCode('COTTON_OPERATOR', operator.id)
  const payload = draft.source === 'portal_register'
    ? await applymentRegistration.prepareApplymentPayload(cfg, draft, businessCode)
    : await buildMerchantApplymentPayload(operator, cfg)
  if (!payload) throw new Error('农机手尚未保存可提交的进件资料')
  const result = await wxpay.submitApplyment(cfg, payload)
  const state = result.applyment_state || result.state || (result.sub_mchid ? 'APPLYMENT_STATE_FINISHED' : 'APPLYMENT_STATE_AUDITING')
  const message = result.applyment_state_msg || result.applyment_state_desc || result.reject_reason || result.message || ''
  await db.query(
    `UPDATE operators SET wechat_applyment_id=?,wechat_business_code=?,wechat_applyment_state=?,
     wechat_applyment_msg=?,sub_mchid=COALESCE(?,sub_mchid),wechat_applyment_updated_at=NOW() WHERE id=?`,
    [result.applyment_id || null, payload.business_code, state, message, result.sub_mchid || null, operator.id]
  )
  return { payload, result, state, message }
}

function splitTags(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean)
  return String(value || '')
    .split(/[,，、\n]/)
    .map(v => v.trim())
    .filter(Boolean)
}

function parseQuiz(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  const raw = String(value).trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(part => part.trim()).filter(Boolean)
      if (parts.length < 4) return null
      const question = parts[0]
      const answerRaw = parts.length >= 5 ? parts[parts.length - 2] : '1'
      const explanation = parts.length >= 5 ? parts[parts.length - 1] : ''
      const optionEnd = parts.length >= 5 ? parts.length - 2 : parts.length
      const options = parts.slice(1, optionEnd)
      const answer = Math.max(0, Math.min(options.length - 1, (parseInt(answerRaw, 10) || 1) - 1))
      return { question, options, answer, explanation }
    }).filter(Boolean)
  }
}

function normalizeExpertContentBody(body = {}) {
  const priceType = body.price_type === 'paid' ? 'paid' : 'free'
  const price = priceType === 'paid' ? Math.max(0, Number(body.price || 0)) : 0
  const type = ['video', 'article', 'qa'].includes(body.type) ? body.type : 'video'
  return {
    type,
    title: String(body.title || '').trim(),
    subtitle: String(body.subtitle || '').trim(),
    category_key: String(body.category_key || 'planting').trim(),
    category_name: String(body.category_name || '').trim(),
    teacher: String(body.teacher || '').trim(),
    teacher_title: String(body.teacher_title || '').trim(),
    org: String(body.org || '').trim(),
    expert_avatar: String(body.expert_avatar || '👨‍🌾').trim(),
    expert_tags: JSON.stringify(splitTags(body.expert_tags)),
    intro: String(body.intro || '').trim(),
    content: String(body.content || '').trim(),
    cover_url: String(body.cover_url || '').trim(),
    video_url: String(body.video_url || '').trim(),
    duration: String(body.duration || '').trim(),
    price_type: priceType,
    price,
    quiz_json: JSON.stringify(parseQuiz(body.quiz_text || body.quiz_json || body.quiz)),
    ai_prompt: String(body.ai_prompt || '').trim(),
    students: Math.max(0, parseInt(body.students, 10) || 0),
    sort_order: parseInt(body.sort_order, 10) || 0,
    is_published: body.is_published === false || body.is_published === '0' || body.is_published === 0 ? 0 : 1
  }
}

const EXPERT_QUESTION_STATUS = {
  pending: '待回复',
  replied: '已回复',
  closed: '已关闭'
}

function parseJson(value, fallback) {
  if (!value) return fallback
  if (Array.isArray(value)) return value
  try { return JSON.parse(value) } catch { return fallback }
}

function normalizeExpertQuestion(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    farmerName: row.farmer_name || '农户',
    farmerPhone: row.farmer_phone || '',
    category: row.category || '种植咨询',
    cropStage: row.crop_stage || '',
    plotId: row.plot_id || null,
    plotName: row.plot_name || '',
    question: row.question || '',
    images: parseJson(row.images, []),
    status: row.status || 'pending',
    statusLabel: EXPERT_QUESTION_STATUS[row.status] || '待回复',
    reply: row.reply || '',
    repliedBy: row.replied_by || null,
    repliedAt: row.replied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ── 管理员身份验证中间件 ──────────────────────────────────
const R_OK   = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const R_FAIL = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function adminAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ code: 401, msg: '未授权' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (!payload.is_admin) return res.status(403).json({ code: 403, msg: '无管理员权限' })
    req.admin = payload
    next()
  } catch {
    res.status(401).json({ code: 401, msg: 'Token 无效或已过期' })
  }
}

// ── POST /api/admin/login ────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body
    if (!phone || !password) return res.status(400).json({ code: 400, msg: '请填写账号和密码' })
    const [rows] = await db.query('SELECT * FROM users WHERE phone=?', [phone])
    const user = rows[0]
    if (!user) return res.status(404).json({ code: 404, msg: '账号不存在' })
    if (!user.is_admin) return res.status(403).json({ code: 403, msg: '非管理员账号' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ code: 401, msg: '密码错误' })
    const token = jwt.sign(
      { id: user.id, phone: user.phone, real_name: user.real_name, is_admin: true },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    )
    res.json({ code: 200, msg: '登录成功', data: { token, real_name: user.real_name } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/upload（图片上传）────────────────────
router.post('/upload', adminAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ code: 400, msg: '未选择图片' })
  res.json({ code: 200, data: { url: `/uploads/products/${req.file.filename}` } })
})

router.post('/support-upload', adminAuth, supportUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ code: 400, msg: '未选择图片' })
  res.json({ code: 200, data: { url: `/uploads/support/${req.file.filename}` } })
})

// ── 专家账号管理：管理员只管理账号，不直接处理专家业务 ─────────
function parseExpertSpecialties(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean)
  return String(value || '')
    .split(/[,，、\n]/)
    .map(v => v.trim())
    .filter(Boolean)
}

// Farmer identity verification review.
router.get('/farmer-verifications', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT v.id,v.user_id,v.real_name,v.id_number_mask,v.status,v.reject_reason,
              v.created_at,v.reviewed_at,u.phone
         FROM farmer_verifications v JOIN users u ON u.id=v.user_id
        ORDER BY (v.status='pending') DESC,v.created_at DESC LIMIT 200`
    )
    return R_OK(res, rows)
  } catch (error) {
    console.error('[admin-verifications]', error)
    return R_FAIL(res, '实名认证列表加载失败', 500)
  }
})

router.get('/farmer-verifications/:id/file/:side', adminAuth, async (req, res) => {
  if (!['front', 'back'].includes(req.params.side)) return R_FAIL(res, '证件面参数错误')
  try {
    const [[row]] = await db.query(
      'SELECT id_front_path,id_back_path FROM farmer_verifications WHERE id=?', [req.params.id]
    )
    if (!row) return R_FAIL(res, '审核记录不存在', 404)
    const filename = path.basename(req.params.side === 'front' ? row.id_front_path : row.id_back_path)
    const filePath = path.join(__dirname, '../private/identity', filename)
    if (!fs.existsSync(filePath)) return R_FAIL(res, '证件图片不存在', 404)
    res.set('Cache-Control', 'no-store')
    return res.sendFile(filePath)
  } catch (error) {
    console.error('[admin-verification-file]', error)
    return R_FAIL(res, '证件图片读取失败', 500)
  }
})

router.patch('/farmer-verifications/:id/review', adminAuth, async (req, res) => {
  const action = req.body.action === 'approve' ? 'approved' : 'rejected'
  const reason = String(req.body.reason || '').trim()
  if (action === 'rejected' && !reason) return R_FAIL(res, '拒绝时必须填写原因')
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [[row]] = await connection.query(
      "SELECT * FROM farmer_verifications WHERE id=? AND status='pending' FOR UPDATE", [req.params.id]
    )
    if (!row) {
      await connection.rollback()
      return R_FAIL(res, '该申请不存在或已处理', 409)
    }
    // Decryption verifies that the stored sensitive data is intact before approval.
    if (action === 'approved') identityData.decrypt(row.id_number)
    await connection.query(
      `UPDATE farmer_verifications SET status=?,reject_reason=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?`,
      [action, action === 'rejected' ? reason : '', req.admin.id, row.id]
    )
    if (action === 'approved') {
      await connection.query('UPDATE users SET real_name=?,is_verified=1 WHERE id=?', [row.real_name, row.user_id])
    }
    await connection.commit()
    return R_OK(res, { status: action }, action === 'approved' ? '实名认证已通过' : '实名认证已拒绝')
  } catch (error) {
    await connection.rollback()
    console.error('[admin-verification-review]', error)
    return R_FAIL(res, error.message || '实名认证审核失败', 500)
  } finally { connection.release() }
})

router.get('/commission-change-requests', adminAuth, async (req, res) => {
  try {
    return R_OK(res, await commissionRequests.list(String(req.query.status || '')))
  } catch (error) { return R_FAIL(res, error.message || '佣金申请加载失败', 500) }
})

router.patch('/commission-change-requests/:id', adminAuth, async (req, res) => {
  try {
    const data = await commissionRequests.review(
      Number(req.params.id), String(req.body.decision || ''), req.body.review_note, req.admin.id
    )
    return R_OK(res, data, req.body.decision === 'approved' ? '佣金比例已审核生效' : '佣金调整申请已拒绝')
  } catch (error) { return R_FAIL(res, error.message || '审核失败', 400) }
})

router.get('/experts', adminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,phone,name,title,org,avatar,specialties,bio,is_active,created_at,updated_at
       FROM experts ORDER BY id DESC`
    )
    return R_OK(res, rows)
  } catch (e) {
    console.error('[admin-experts-list]', e)
    return R_FAIL(res, '专家账号加载失败', 500)
  }
})

router.post('/experts', adminAuth, async (req, res) => {
  try {
    const phone = String(req.body.phone || '').trim()
    const password = String(req.body.password || '').trim()
    const name = String(req.body.name || '').trim()
    const title = String(req.body.title || '').trim()
    const org = String(req.body.org || 'Cotton 棉花平台').trim()
    const avatar = String(req.body.avatar || '专').trim()
    const specialties = JSON.stringify(parseExpertSpecialties(req.body.specialties))
    const bio = String(req.body.bio || '').trim()
    if (!/^1\d{10}$/.test(phone)) return R_FAIL(res, '请填写正确的专家手机号')
    if (!password || password.length < 6) return R_FAIL(res, '专家密码不能少于6位')
    if (!name) return R_FAIL(res, '请填写专家姓名')
    const [exist] = await db.query('SELECT id FROM experts WHERE phone=?', [phone])
    if (exist.length) return R_FAIL(res, '该专家手机号已存在')
    const hash = await bcrypt.hash(password, 10)
    await db.query(
      `INSERT INTO experts (phone,password,name,title,org,avatar,specialties,bio,is_active)
       VALUES (?,?,?,?,?,?,?,?,1)`,
      [phone, hash, name, title, org, avatar, specialties, bio]
    )
    return R_OK(res, null, '专家账号已创建')
  } catch (e) {
    console.error('[admin-experts-create]', e)
    return R_FAIL(res, '专家账号创建失败', 500)
  }
})

router.put('/experts/:id', adminAuth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const title = String(req.body.title || '').trim()
    const org = String(req.body.org || 'Cotton 棉花平台').trim()
    const avatar = String(req.body.avatar || '专').trim()
    const specialties = JSON.stringify(parseExpertSpecialties(req.body.specialties))
    const bio = String(req.body.bio || '').trim()
    const password = String(req.body.password || '').trim()
    if (!name) return R_FAIL(res, '请填写专家姓名')
    const fields = ['name=?', 'title=?', 'org=?', 'avatar=?', 'specialties=?', 'bio=?']
    const params = [name, title, org, avatar, specialties, bio]
    if (password) {
      if (password.length < 6) return R_FAIL(res, '专家密码不能少于6位')
      fields.push('password=?')
      params.push(await bcrypt.hash(password, 10))
    }
    params.push(req.params.id)
    const [result] = await db.query(`UPDATE experts SET ${fields.join(',')} WHERE id=?`, params)
    if (!result.affectedRows) return R_FAIL(res, '专家账号不存在', 404)
    return R_OK(res, null, '专家账号已保存')
  } catch (e) {
    console.error('[admin-experts-update]', e)
    return R_FAIL(res, '专家账号保存失败', 500)
  }
})

router.patch('/experts/:id/status', adminAuth, async (req, res) => {
  try {
    const isActive = req.body.is_active ? 1 : 0
    const [result] = await db.query('UPDATE experts SET is_active=? WHERE id=?', [isActive, req.params.id])
    if (!result.affectedRows) return R_FAIL(res, '专家账号不存在', 404)
    return R_OK(res, null, isActive ? '专家账号已启用' : '专家账号已停用')
  } catch (e) {
    console.error('[admin-experts-status]', e)
    return R_FAIL(res, '专家账号状态更新失败', 500)
  }
})

function expertMoved(req, res) {
  return R_FAIL(res, '专家回复和课程上架已迁移到专家后台，请使用专家账号登录 /expert/login.html', 410)
}
router.all('/expert-upload', adminAuth, expertMoved)
router.all('/expert-contents', adminAuth, expertMoved)
router.all('/expert-contents/:id', adminAuth, expertMoved)
router.all('/expert-contents/:id/toggle', adminAuth, expertMoved)
router.all('/expert-questions', adminAuth, expertMoved)
router.all('/expert-questions/:id/reply', adminAuth, expertMoved)
router.all('/expert-questions/:id/status', adminAuth, expertMoved)

// ── POST /api/admin/expert-upload（专家讲堂素材上传）────────
router.post('/expert-upload', adminAuth, expertUpload.single('file'), (req, res) => {
  if (!req.file) return R_FAIL(res, '未选择文件')
  res.json({ code: 200, data: { url: `/uploads/expert/${req.file.filename}` } })
})

// ── 专家讲堂内容管理 ───────────────────────────────────
router.get('/expert-contents', adminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM expert_contents ORDER BY sort_order ASC, id DESC')
    return R_OK(res, rows)
  } catch (e) {
    console.error('[admin-expert-list]', e)
    return R_FAIL(res, '专家讲堂内容加载失败', 500)
  }
})

router.post('/expert-contents', adminAuth, async (req, res) => {
  try {
    const data = normalizeExpertContentBody(req.body)
    if (!data.title) return R_FAIL(res, '请填写内容标题')
    await db.query(
      `INSERT INTO expert_contents
       (type,title,subtitle,category_key,category_name,teacher,teacher_title,org,expert_avatar,expert_tags,
        intro,content,cover_url,video_url,duration,price_type,price,quiz_json,ai_prompt,students,sort_order,is_published)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.type, data.title, data.subtitle, data.category_key, data.category_name, data.teacher,
        data.teacher_title, data.org, data.expert_avatar, data.expert_tags, data.intro, data.content,
        data.cover_url, data.video_url, data.duration, data.price_type, data.price, data.quiz_json,
        data.ai_prompt, data.students, data.sort_order, data.is_published
      ]
    )
    return R_OK(res, null, '专家内容已新增')
  } catch (e) {
    console.error('[admin-expert-create]', e)
    return R_FAIL(res, '专家内容保存失败', 500)
  }
})

router.put('/expert-contents/:id', adminAuth, async (req, res) => {
  try {
    const data = normalizeExpertContentBody(req.body)
    if (!data.title) return R_FAIL(res, '请填写内容标题')
    await db.query(
      `UPDATE expert_contents SET
       type=?, title=?, subtitle=?, category_key=?, category_name=?, teacher=?, teacher_title=?, org=?,
       expert_avatar=?, expert_tags=?, intro=?, content=?, cover_url=?, video_url=?, duration=?,
       price_type=?, price=?, quiz_json=?, ai_prompt=?, students=?, sort_order=?, is_published=?
       WHERE id=?`,
      [
        data.type, data.title, data.subtitle, data.category_key, data.category_name, data.teacher,
        data.teacher_title, data.org, data.expert_avatar, data.expert_tags, data.intro, data.content,
        data.cover_url, data.video_url, data.duration, data.price_type, data.price, data.quiz_json,
        data.ai_prompt, data.students, data.sort_order, data.is_published, req.params.id
      ]
    )
    return R_OK(res, null, '专家内容已保存')
  } catch (e) {
    console.error('[admin-expert-update]', e)
    return R_FAIL(res, '专家内容保存失败', 500)
  }
})

router.post('/expert-contents/:id/toggle', adminAuth, async (req, res) => {
  try {
    const isPublished = req.body.is_published ? 1 : 0
    await db.query('UPDATE expert_contents SET is_published=? WHERE id=?', [isPublished, req.params.id])
    return R_OK(res, null, isPublished ? '已上架' : '已下架')
  } catch (e) {
    return R_FAIL(res, '上下架失败', 500)
  }
})

router.delete('/expert-contents/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM expert_contents WHERE id=?', [req.params.id])
    return R_OK(res, null, '已删除')
  } catch (e) {
    return R_FAIL(res, '删除失败', 500)
  }
})

router.get('/expert-questions', adminAuth, async (req, res) => {
  try {
    const status = ['pending', 'replied', 'closed'].includes(req.query.status) ? req.query.status : ''
    const sql = status
      ? 'SELECT * FROM expert_questions WHERE status=? ORDER BY created_at DESC LIMIT 200'
      : 'SELECT * FROM expert_questions ORDER BY created_at DESC LIMIT 200'
    const params = status ? [status] : []
    const [rows] = await db.query(sql, params)
    return R_OK(res, rows.map(normalizeExpertQuestion))
  } catch (e) {
    console.error('[admin-expert-question-list]', e)
    return R_FAIL(res, '专家提问加载失败', 500)
  }
})

router.patch('/expert-questions/:id/reply', adminAuth, async (req, res) => {
  try {
    const reply = String(req.body.reply || '').trim()
    if (reply.length < 2) return R_FAIL(res, '请填写回复内容')
    const [result] = await db.query(
      `UPDATE expert_questions
       SET reply=?, status='replied', replied_by=?, replied_at=NOW()
       WHERE id=?`,
      [reply, req.admin.id, req.params.id]
    )
    if (!result.affectedRows) return R_FAIL(res, '提问不存在', 404)
    return R_OK(res, null, '已回复农户')
  } catch (e) {
    console.error('[admin-expert-question-reply]', e)
    return R_FAIL(res, '回复失败', 500)
  }
})

router.patch('/expert-questions/:id/status', adminAuth, async (req, res) => {
  try {
    const status = ['pending', 'replied', 'closed'].includes(req.body.status) ? req.body.status : ''
    if (!status) return R_FAIL(res, '状态不正确')
    const [result] = await db.query('UPDATE expert_questions SET status=? WHERE id=?', [status, req.params.id])
    if (!result.affectedRows) return R_FAIL(res, '提问不存在', 404)
    return R_OK(res, null, '状态已更新')
  } catch (e) {
    console.error('[admin-expert-question-status]', e)
    return R_FAIL(res, '状态更新失败', 500)
  }
})

// ── GET /api/admin/stats ─────────────────────────────────
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [[{ totalUsers }]]       = await db.query('SELECT COUNT(*) AS totalUsers FROM users WHERE is_admin=0')
    const [[{ totalFarmers }]]     = await db.query('SELECT COUNT(*) AS totalFarmers FROM farmers')
    const [[{ totalMerchants }]]   = await db.query('SELECT COUNT(*) AS totalMerchants FROM merchants')
    const [[{ pendingApps }]]      = await db.query('SELECT COUNT(*) AS pendingApps FROM merchants WHERE apply_status="pending"')
    const [[{ totalProducts }]]    = await db.query('SELECT COUNT(*) AS totalProducts FROM products')
    const [[{ onSaleProducts }]]   = await db.query('SELECT COUNT(*) AS onSaleProducts FROM products WHERE status="on"')
    res.json({ code: 200, data: { totalUsers, totalFarmers, totalMerchants, pendingApps, totalProducts, onSaleProducts } })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/farmers（手动新增农户）──────────────
router.post('/farmers', adminAuth, async (req, res) => {
  try {
    const { phone, password, real_name, location, land_size, is_verified } = req.body
    if (!/^1\d{10}$/.test(phone))        return res.status(400).json({ code: 400, msg: '手机号格式不正确' })
    if (!password || password.length < 6) return res.status(400).json({ code: 400, msg: '密码不能少于6位' })
    if (!real_name || !real_name.trim())  return res.status(400).json({ code: 400, msg: '请填写姓名' })
    const [exist] = await db.query('SELECT id FROM users WHERE phone=?', [phone])
    if (exist.length > 0) return res.status(400).json({ code: 400, msg: '该手机号已注册' })
    const hash = await bcrypt.hash(password, 10)
    const [r] = await db.query(
      'INSERT INTO users (phone,password,role,real_name,is_verified) VALUES (?,?,?,?,?)',
      [phone, hash, 'farmer', real_name.trim(), is_verified ? 1 : 0]
    )
    await db.query(
      'INSERT INTO farmers (user_id,location,land_size) VALUES (?,?,?)',
      [r.insertId, location || '', parseFloat(land_size) || 0]
    )
    res.json({ code: 200, msg: '农户已创建' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── GET /api/admin/farmers ───────────────────────────────
router.get('/farmers', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.phone, u.real_name, u.is_verified, u.is_active, u.created_at,
             f.id AS farmer_id, f.location, f.land_size
      FROM farmers f JOIN users u ON u.id = f.user_id
      ORDER BY u.created_at DESC
    `)
    res.json({ code: 200, data: rows })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PUT /api/admin/farmers/:id ───────────────────────────
router.put('/farmers/:id', adminAuth, async (req, res) => {
  try {
    const { real_name, location, land_size, is_verified } = req.body
    const userId = req.params.id
    if (real_name !== undefined)
      await db.query('UPDATE users SET real_name=? WHERE id=?', [real_name, userId])
    if (is_verified !== undefined)
      await db.query('UPDATE users SET is_verified=? WHERE id=?', [is_verified ? 1 : 0, userId])
    await db.query(
      'UPDATE farmers SET location=?, land_size=? WHERE user_id=?',
      [location, parseFloat(land_size) || 0, userId]
    )
    res.json({ code: 200, msg: '农户信息已更新' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/merchants（手动新增商户，自动批准）──
router.post('/merchants', adminAuth, async (req, res) => {
  try {
    const { phone, password, real_name, company_name, business_license, product_category, is_verified } = req.body
    if (!/^1\d{10}$/.test(phone))         return res.status(400).json({ code: 400, msg: '手机号格式不正确' })
    if (!password || password.length < 6)  return res.status(400).json({ code: 400, msg: '密码不能少于6位' })
    if (!real_name || !real_name.trim())   return res.status(400).json({ code: 400, msg: '请填写联系人姓名' })
    if (!company_name || !company_name.trim()) return res.status(400).json({ code: 400, msg: '请填写店铺名称' })
    const [exist] = await db.query('SELECT id FROM users WHERE phone=?', [phone])
    if (exist.length > 0) return res.status(400).json({ code: 400, msg: '该手机号已注册' })
    const hash = await bcrypt.hash(password, 10)
    const [r] = await db.query(
      'INSERT INTO users (phone,password,role,real_name,is_verified,is_active) VALUES (?,?,?,?,?,1)',
      [phone, hash, 'merchant', real_name.trim(), is_verified ? 1 : 0]
    )
    await db.query(
      'INSERT INTO merchants (user_id,company_name,business_license,product_category,apply_status) VALUES (?,?,?,?,?)',
      [r.insertId, company_name.trim(), business_license || '', product_category || '', 'approved']
    )
    res.json({ code: 200, msg: '商户已创建并自动批准' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── GET /api/admin/merchants ─────────────────────────────
router.get('/merchants', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.phone, u.real_name, u.is_verified, u.is_active, u.created_at,
             m.id AS merchant_id, m.company_name, m.business_license, m.product_category,
             m.apply_status, m.reject_reason, m.commission_rate,
             (SELECT COUNT(*) FROM products p WHERE p.merchant_id = m.id) AS product_count
      FROM users u LEFT JOIN merchants m ON m.user_id = u.id
      WHERE u.role = 'merchant'
      ORDER BY u.created_at DESC
    `)
    res.json({ code: 200, data: rows })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PUT /api/admin/merchants/:id ─────────────────────────
router.put('/merchants/:id', adminAuth, async (req, res) => {
  try {
    const { real_name, company_name, business_license, product_category, is_verified } = req.body
    const userId = req.params.id
    if (real_name !== undefined)
      await db.query('UPDATE users SET real_name=? WHERE id=?', [real_name, userId])
    if (is_verified !== undefined)
      await db.query('UPDATE users SET is_verified=? WHERE id=?', [is_verified ? 1 : 0, userId])
    await db.query(
      'UPDATE merchants SET company_name=?, business_license=?, product_category=? WHERE user_id=?',
      [company_name, business_license || '', product_category || '', userId]
    )
    res.json({ code: 200, msg: '商户信息已更新' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PATCH /api/admin/merchants/:id/commission ────────────
router.patch('/merchants/:id/commission', adminAuth, async (req, res) => {
  const rate = parseFloat(req.body.commission_rate)
  if (isNaN(rate) || rate < 0 || rate > 100)
    return R_FAIL(res, '佣金费率需在 0 ~ 100 之间')
  try {
    await db.query('UPDATE merchants SET commission_rate=? WHERE user_id=?', [rate, req.params.id])
    R_OK(res, { commission_rate: rate }, '佣金费率已更新')
  } catch (e) {
    console.error(e); R_FAIL(res, '更新失败')
  }
})

// ── GET /api/admin/applications ──────────────────────────
router.get('/applications', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.phone, u.real_name, u.created_at,
             m.id AS merchant_id, m.company_name, m.business_license,
             m.product_category, m.apply_status, m.reject_reason,
             m.sub_mchid, m.wechat_applyment_state, m.wechat_applyment_payload
      FROM users u LEFT JOIN merchants m ON m.user_id = u.id
      WHERE u.role = 'merchant' AND m.apply_status = 'pending'
      ORDER BY u.created_at ASC
    `)
    res.json({ code: 200, data: rows })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/applications/:id/approve ─────────────
router.post('/applications/:id/approve', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id
    const [[merchant]] = await db.query(
      'SELECT id, sub_mchid, wechat_applyment_state, wechat_applyment_payload, wechat_business_code FROM merchants WHERE user_id=? LIMIT 1',
      [userId]
    )
    if (!merchant) return res.status(404).json({ code: 404, msg: '申请不存在' })
    await db.query('UPDATE merchants SET apply_status="approved" WHERE user_id=?', [userId])
    await db.query('UPDATE users SET is_active=1 WHERE id=?', [userId])
    let submitMsg = ''
    try {
      const submitResult = await submitMerchantApplyment(merchant)
      submitMsg = submitResult.result.applyment_state_msg || submitResult.message || '已自动提交微信进件'
    } catch (submitErr) {
      submitMsg = submitErr.message || '已批准入驻，但微信进件尚未自动提交'
      await db.query(
        `UPDATE merchants SET wechat_applyment_state='SUBMIT_FAILED',wechat_applyment_msg=?,
         wechat_applyment_updated_at=NOW() WHERE id=?`, [submitMsg.slice(0, 500), merchant.id]
      )
    }
    res.json({ code: 200, msg: submitMsg || '已批准入驻申请' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

router.post('/applications/:id/submit-applyment', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id
    const [[merchant]] = await db.query(
      'SELECT id, company_name, business_license, product_category, sub_mchid, wechat_applyment_state, wechat_applyment_payload, wechat_business_code FROM merchants WHERE user_id=? LIMIT 1',
      [userId]
    )
    if (!merchant) return res.status(404).json({ code: 404, msg: '申请不存在' })
    const submitResult = await submitMerchantApplyment(merchant)
    res.json({ code: 200, msg: '微信进件已提交', data: submitResult.result })
  } catch (e) {
    console.error('[admin-submit-applyment]', e)
    res.status(500).json({ code: 500, msg: e.message || '微信进件提交失败' })
  }
})

// ── POST /api/admin/applications/:id/reject ──────────────
router.post('/applications/:id/reject', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id
    const { reason } = req.body
    await db.query(
      'UPDATE merchants SET apply_status="rejected", reject_reason=? WHERE user_id=?',
      [reason || '不符合入驻条件', userId]
    )
    res.json({ code: 200, msg: '已拒绝入驻申请' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── GET /api/admin/operator-applications — 待审批农机手 ──
router.get('/operator-applications', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.phone, u.real_name, u.created_at,
             o.id AS operator_id, o.org_name, o.contact, o.id_card,
             o.service_area, o.location_name, o.apply_status, o.reject_reason,
             o.sub_mchid, o.wechat_applyment_state, o.wechat_applyment_msg
      FROM users u JOIN operators o ON o.user_id = u.id
      WHERE u.role = 'operator' AND o.apply_status = 'pending'
      ORDER BY u.created_at ASC
    `)
    res.json({ code: 200, data: rows })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/operator-applications/:id/approve ────
router.post('/operator-applications/:id/approve', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id
    const [[operator]] = await db.query(
      `SELECT id,org_name AS company_name,id_card AS business_license,wechat_applyment_payload,
              wechat_business_code,sub_mchid,wechat_applyment_state
       FROM operators WHERE user_id=? LIMIT 1`, [userId]
    )
    if (!operator) return res.status(404).json({ code: 404, msg: '申请不存在' })
    await db.query('UPDATE operators SET apply_status="approved" WHERE user_id=?', [userId])
    await db.query('UPDATE users SET is_active=1 WHERE id=?', [userId])
    let submitMsg = ''
    try {
      const submitResult = await submitOperatorApplyment(operator)
      submitMsg = submitResult.result.applyment_state_msg || submitResult.message || '已自动提交微信进件'
    } catch (submitErr) {
      submitMsg = submitErr.message || '已批准入驻，但微信进件尚未自动提交'
      await db.query(
        `UPDATE operators SET wechat_applyment_state='SUBMIT_FAILED',wechat_applyment_msg=?,
         wechat_applyment_updated_at=NOW() WHERE id=?`, [submitMsg.slice(0, 500), operator.id]
      )
    }
    res.json({ code: 200, msg: submitMsg || '已批准农机手入驻' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

router.post('/operator-applications/:id/submit-applyment', adminAuth, async (req, res) => {
  try {
    const [[operator]] = await db.query(
      `SELECT id,org_name AS company_name,id_card AS business_license,wechat_applyment_payload,
              wechat_business_code,sub_mchid,wechat_applyment_state
       FROM operators WHERE user_id=? LIMIT 1`, [req.params.id]
    )
    if (!operator) return res.status(404).json({ code: 404, msg: '申请不存在' })
    const submitted = await submitOperatorApplyment(operator)
    res.json({ code: 200, msg: '农机手微信进件已提交', data: submitted.result })
  } catch (e) {
    console.error('[admin-operator-submit-applyment]', e)
    res.status(500).json({ code: 500, msg: e.message || '微信进件提交失败' })
  }
})

// ── POST /api/admin/operator-applications/:id/reject ─────
router.post('/operator-applications/:id/reject', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id
    const { reason } = req.body
    await db.query(
      'UPDATE operators SET apply_status="rejected", reject_reason=? WHERE user_id=?',
      [reason || '不符合入驻条件', userId]
    )
    res.json({ code: 200, msg: '已拒绝农机手入驻' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/products（手动新增商品）─────────────
router.post('/products', adminAuth, async (req, res) => {
  try {
    const { merchant_id, name, category, icon, price, unit, stock, status, image_url, description, detail } = req.body
    if (!merchant_id) return res.status(400).json({ code: 400, msg: '请选择所属商户' })
    if (!name || !name.trim()) return res.status(400).json({ code: 400, msg: '请填写商品名称' })
    await db.query(
      'INSERT INTO products (merchant_id,name,category,icon,price,unit,stock,status,image_url,description,detail) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [merchant_id, name.trim(), category || '', icon || '', parseFloat(price) || 0, unit || '', parseInt(stock) || 0, status || 'on', image_url || null, description || '', detail || '']
    )
    res.json({ code: 200, msg: '商品已创建' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── GET /api/admin/products ──────────────────────────────
router.get('/products', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, m.company_name
      FROM products p LEFT JOIN merchants m ON m.id = p.merchant_id
      ORDER BY p.created_at DESC
    `)
    res.json({ code: 200, data: rows })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── DELETE /api/admin/products/:id ───────────────────────
router.delete('/products/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id=?', [req.params.id])
    res.json({ code: 200, msg: '商品已删除' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PUT /api/admin/products/:id ──────────────────────────
router.put('/products/:id', adminAuth, async (req, res) => {
  try {
    const { name, category, icon, price, unit, stock, status, image_url, description, detail } = req.body
    await db.query(
      'UPDATE products SET name=?, category=?, icon=?, price=?, unit=?, stock=?, status=?, image_url=?, description=?, detail=? WHERE id=?',
      [name, category, icon || '', parseFloat(price) || 0, unit || '', parseInt(stock) || 0, status || 'on', image_url || null, description || '', detail || '', req.params.id]
    )
    res.json({ code: 200, msg: '商品信息已更新' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── GET /api/admin/orders ────────────────────────────────
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const { status } = req.query
    let sql = `
      SELECT o.id, o.order_no, o.farmer_name, o.farmer_phone,
             o.receiver_name, o.receiver_phone, o.address,
             o.subtotal, o.delivery_fee, o.total,
             o.pay_method, o.status, o.logistics_no, o.note,
             o.created_at,
             GROUP_CONCAT(
               CONCAT(i.icon,'|',i.name,'|',i.spec,'|',i.price,'|',i.qty)
               SEPARATOR ';;'
             ) AS items_raw
      FROM orders o
      LEFT JOIN order_items i ON i.order_id = o.id
    `
    const params = []
    if (status && status !== 'all') { sql += ' WHERE o.status = ?'; params.push(status) }
    sql += ' GROUP BY o.id ORDER BY o.created_at DESC'

    const [rows] = await db.query(sql, params)
    const orders = rows.map(o => ({
      ...o,
      items: (o.items_raw || '').split(';;').filter(Boolean).map(s => {
        const [icon, name, spec, price, qty] = s.split('|')
        return { icon, name, spec, price: parseFloat(price), qty: parseInt(qty) }
      })
    }))
    res.json({ code: 200, data: orders })
  } catch (e) {
    console.error('[admin-orders]', e)
    res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PATCH /api/admin/orders/:id/status ──────────────────
router.patch('/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { status, logistics_no } = req.body
    const valid = ['pending_ship', 'shipped', 'completed', 'refund']
    if (!valid.includes(status)) return res.status(400).json({ code: 400, msg: '状态无效' })
    const fields = ['status=?']
    const params = [status]
    if (logistics_no) { fields.push('logistics_no=?'); params.push(logistics_no) }
    params.push(req.params.id)
    await db.query(`UPDATE orders SET ${fields.join(',')} WHERE id=?`, params)
    res.json({ code: 200, msg: '已更新' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PATCH /api/admin/users/:id/status ───────────────────
router.patch('/users/:id/status', adminAuth, async (req, res) => {
  try {
    const { is_active } = req.body
    await db.query('UPDATE users SET is_active=? WHERE id=?', [is_active ? 1 : 0, req.params.id])
    res.json({ code: 200, msg: is_active ? '已启用账号' : '已禁用账号' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/apply（公开）商户入驻申请 ─────────────
router.post('/apply', async (req, res) => {
  try {
    const {
      phone, password, real_name, company_name, business_license, product_category,
      contact_mobile, contact_email, subject_type, legal_person, id_card_name, id_card_number,
      card_period_begin, card_period_end, merchant_shortname, service_phone, settlement_id,
      qualification_type, bank_account_type, account_bank, bank_address_code, bank_branch_id,
      bank_name, account_name, account_number,
      license_copy_url, id_card_copy_url, id_card_national_url, mini_program_pic_url
    } = req.body
    if (!/^1\d{10}$/.test(phone))        return res.status(400).json({ code: 400, msg: '手机号格式不正确' })
    if (!password || password.length < 6) return res.status(400).json({ code: 400, msg: '密码不能少于6位' })
    if (!real_name || !real_name.trim())  return res.status(400).json({ code: 400, msg: '请填写联系人姓名' })
    if (!company_name || !company_name.trim()) return res.status(400).json({ code: 400, msg: '请填写店铺/企业名称' })
    if (!/^1\d{10}$/.test(String(contact_mobile || '').trim())) return res.status(400).json({ code: 400, msg: '请填写正确的联系人手机号' })
    if (!String(merchant_shortname || '').trim()) return res.status(400).json({ code: 400, msg: '请填写商户简称' })
    if (!String(service_phone || '').trim()) return res.status(400).json({ code: 400, msg: '请填写客服电话' })
    if (!String(business_license || '').trim()) return res.status(400).json({ code: 400, msg: '请填写营业执照号' })
    if (!String(id_card_number || '').trim()) return res.status(400).json({ code: 400, msg: '请填写身份证号' })
    if (!String(card_period_begin || '').trim() || !String(card_period_end || '').trim()) return res.status(400).json({ code: 400, msg: '请填写身份证有效期' })
    if (!String(account_bank || '').trim()) return res.status(400).json({ code: 400, msg: '请填写开户银行' })
    if (!String(account_name || '').trim()) return res.status(400).json({ code: 400, msg: '请填写开户人' })
    if (!String(account_number || '').trim()) return res.status(400).json({ code: 400, msg: '请填写结算账号' })
    if (!String(license_copy_url || '').trim()) return res.status(400).json({ code: 400, msg: '请上传营业执照图片' })
    if (!String(id_card_copy_url || '').trim()) return res.status(400).json({ code: 400, msg: '请上传身份证人像面图片' })
    if (!String(id_card_national_url || '').trim()) return res.status(400).json({ code: 400, msg: '请上传身份证国徽面图片' })
    if (!String(mini_program_pic_url || '').trim()) return res.status(400).json({ code: 400, msg: '请上传经营页面截图' })

    const [exist] = await db.query('SELECT id FROM users WHERE phone=?', [phone])
    if (exist.length > 0) return res.status(400).json({ code: 400, msg: '该手机号已注册' })

    const hash = await bcrypt.hash(password, 10)
    const [result] = await db.query(
      'INSERT INTO users (phone,password,role,real_name,is_active) VALUES (?,?,?,?,0)',
      [phone, hash, 'merchant', real_name.trim()]
    )
    const userId = result.insertId
    const applymentDraft = applymentRegistration.buildRegistrationDraft(req.body, {
      qualificationType: '零售批发/生活娱乐/其他'
    })
    await db.query(
      'INSERT INTO merchants (user_id,company_name,business_license,product_category,apply_status,wechat_applyment_state,wechat_applyment_payload) VALUES (?,?,?,?,?,?,?)',
      [userId, company_name.trim(), business_license || '', product_category || '', 'pending', 'DRAFT', JSON.stringify(applymentDraft)]
    )
    res.json({ code: 200, msg: '申请已提交，请等待管理员审核（1-3个工作日）' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── 客服反馈 ──────────────────────────────────────────────
router.get('/feedbacks', adminAuth, async (req, res) => {
  const status = String(req.query.status || '').trim()
  const allowedStatuses = new Set(['pending', 'replied', 'closed'])
  const where = allowedStatuses.has(status) ? 'WHERE f.status=?' : ''
  const params = allowedStatuses.has(status) ? [status] : []
  try {
    const [rows] = await db.query(
      `SELECT f.id,f.user_id,f.content,f.contact,f.images_json,f.status,f.admin_reply,
              f.replied_by,f.replied_at,f.created_at,f.updated_at,
              u.real_name,u.phone
         FROM feedbacks f
         JOIN users u ON u.id=f.user_id
         ${where}
        ORDER BY CASE f.status WHEN 'pending' THEN 0 WHEN 'replied' THEN 1 ELSE 2 END,
                 f.created_at DESC
        LIMIT 200`,
      params
    )
    return R_OK(res, rows.map(row => ({
      ...row,
      images: supportMessages.normalizeImages(row.images_json),
      images_json: undefined
    })))
  } catch (error) {
    console.error('[admin-feedback-list]', error)
    return R_FAIL(res, '客服反馈加载失败', 500)
  }
})

router.patch('/feedbacks/:id/reply', adminAuth, async (req, res) => {
  const id = Number(req.params.id)
  const reply = String(req.body.reply || '').trim()
  const status = req.body.status === 'closed' ? 'closed' : 'replied'
  if (!Number.isInteger(id) || id <= 0) return R_FAIL(res, '反馈编号无效')
  if (reply.length < 2) return R_FAIL(res, '请填写管理员回复')
  if (reply.length > 1000) return R_FAIL(res, '回复不能超过1000字')
  try {
    const [result] = await db.query(
      `UPDATE feedbacks
          SET admin_reply=?,status=?,replied_by=?,replied_at=NOW(),user_read_at=NULL
        WHERE id=?`,
      [reply, status, req.admin.id, id]
    )
    if (!result.affectedRows) return R_FAIL(res, '反馈不存在', 404)
    return R_OK(res, { id, status }, status === 'closed' ? '回复已发送并标记完成' : '回复已发送')
  } catch (error) {
    console.error('[admin-feedback-reply]', error)
    return R_FAIL(res, '回复保存失败', 500)
  }
})

router.get('/support-chats', adminAuth, async (_req, res) => {
  try {
    return R_OK(res, await supportMessages.listConversations())
  } catch (error) {
    console.error('[admin-support-chats]', error)
    return R_FAIL(res, '客服会话加载失败', 500)
  }
})

router.delete('/support-chats/:userId', adminAuth, async (req, res) => {
  const userId = Number(req.params.userId)
  if (!Number.isInteger(userId) || userId <= 0) return R_FAIL(res, '农户编号无效')
  try {
    const result = await supportMessages.hideConversationForAdmin(userId)
    supportRealtime.notifyAdmins({
      type: 'support_conversation_deleted',
      userId,
      viewerType: 'admin'
    })
    return R_OK(res, result, '会话已从管理员端删除')
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error('[admin-support-conversation-delete]', error)
    return R_FAIL(res, error.message || '会话删除失败', error.statusCode || 500)
  }
})

router.get('/support-chats/:userId/messages', adminAuth, async (req, res) => {
  const userId = Number(req.params.userId)
  if (!Number.isInteger(userId) || userId <= 0) return R_FAIL(res, '农户编号无效')
  try {
    const messages = await supportMessages.listMessages(userId, req.query.after, 'admin')
    const readCount = await supportMessages.markRead(userId, 'admin')
    if (readCount) supportRealtime.notifyFarmer(userId, { type: 'support_read', userId })
    return R_OK(res, messages)
  } catch (error) {
    console.error('[admin-support-messages]', error)
    return R_FAIL(res, '聊天记录加载失败', 500)
  }
})

router.post('/support-chats/:userId/messages', adminAuth, async (req, res) => {
  const userId = Number(req.params.userId)
  if (!Number.isInteger(userId) || userId <= 0) return R_FAIL(res, '农户编号无效')
  try {
    if (!(await supportMessages.farmerExists(userId))) return R_FAIL(res, '农户不存在', 404)
    const message = await supportMessages.createMessage({
      userId,
      senderType: 'admin',
      senderId: req.admin.id,
      content: req.body.content,
      imageUrl: req.body.image_url,
      replyToId: req.body.reply_to_id
    })
    supportRealtime.notifyFarmer(userId, {
      type: 'support_message',
      userId,
      messageId: message.id,
      senderType: 'admin'
    })
    supportRealtime.notifyAdmins({
      type: 'support_message',
      userId,
      messageId: message.id,
      senderType: 'admin'
    })
    return R_OK(res, message, '消息已发送')
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error('[admin-support-message-create]', error)
    return R_FAIL(res, error.message || '消息发送失败', error.statusCode || 500)
  }
})

router.patch('/support-chats/:userId/messages/:messageId/recall', adminAuth, async (req, res) => {
  const userId = Number(req.params.userId)
  const messageId = Number(req.params.messageId)
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(messageId) || messageId <= 0) {
    return R_FAIL(res, '消息编号无效')
  }
  try {
    const message = await supportMessages.recallMessage({
      userId,
      messageId,
      actorType: 'admin',
      actorId: req.admin.id
    })
    const payload = { type: 'support_message_changed', userId, messageId }
    supportRealtime.notifyFarmer(userId, payload)
    supportRealtime.notifyAdmins(payload)
    return R_OK(res, message, '消息已撤回')
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error('[admin-support-recall]', error)
    return R_FAIL(res, error.message || '消息撤回失败', error.statusCode || 500)
  }
})

router.delete('/support-chats/:userId/messages/:messageId', adminAuth, async (req, res) => {
  const userId = Number(req.params.userId)
  const messageId = Number(req.params.messageId)
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(messageId) || messageId <= 0) {
    return R_FAIL(res, '消息编号无效')
  }
  try {
    const result = await supportMessages.hideMessage({ userId, messageId, viewerType: 'admin' })
    supportRealtime.notifyAdmins({
      type: 'support_message_deleted',
      userId,
      messageId,
      viewerType: 'admin'
    })
    return R_OK(res, result, '消息已从管理员会话删除')
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error('[admin-support-delete]', error)
    return R_FAIL(res, error.message || '消息删除失败', error.statusCode || 500)
  }
})

// ─────────────────────────────────────────────────────────────
// GET  /api/admin/announcements — 公告列表
// POST /api/admin/announcements — 发布公告（广播给所有商户）
// DELETE /api/admin/announcements/:id — 删除公告
// ─────────────────────────────────────────────────────────────
router.get('/announcements', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100')
    return R_OK(res, rows)
  } catch(e) { console.error('[admin-announcements]', e); return R_FAIL(res, '服务器错误', 500) }
})

router.post('/announcements', adminAuth, async (req, res) => {
  const { title, content } = req.body
  if (!title?.trim()) return R_FAIL(res, '请填写公告标题')
  if (!content?.trim()) return R_FAIL(res, '请填写公告内容')
  try {
    const [r] = await db.query(
      'INSERT INTO announcements (title, content) VALUES (?,?)',
      [title.trim(), content.trim()]
    )
    const count = await broadcastAnnouncement(r.insertId, title.trim(), content.trim())
    return R_OK(res, { id: r.insertId, merchant_count: count },
      `公告已发布，已通知 ${count} 家商户`)
  } catch(e) { console.error('[admin-announcement-post]', e); return R_FAIL(res, '服务器错误', 500) }
})

router.delete('/announcements/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM announcements WHERE id=?', [req.params.id])
    return R_OK(res, null, '已删除')
  } catch(e) { return R_FAIL(res, '服务器错误', 500) }
})

// ── GET /api/admin/aftersales — 全平台售后申请列表 ──────────
router.get('/aftersales', adminAuth, async (req, res) => {
  try {
    const { status } = req.query
    let sql = `
      SELECT ar.id, ar.order_no, ar.farmer_name, ar.aftersale_type,
             ar.reason, ar.other_reason, ar.description, ar.images,
             ar.status, ar.handle_note, ar.created_at, ar.updated_at,
             m.company_name
      FROM aftersale_requests ar
      LEFT JOIN merchants m ON m.id = ar.merchant_id
    `
    const params = []
    if (status && status !== 'all') { sql += ' WHERE ar.status = ?'; params.push(status) }
    sql += ' ORDER BY ar.created_at DESC'
    const [rows] = await db.query(sql, params)
    return R_OK(res, rows)
  } catch (e) {
    console.error('[admin-aftersales]', e); return R_FAIL(res, '服务器错误', 500)
  }
})

// ── GET /api/admin/finance — 各商户财务汇总 ─────────────────
router.get('/finance', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        m.id AS merchant_id, m.company_name, m.commission_rate, u.phone,
        COALESCE(fin.total_sales, 0) AS total_sales,
        COALESCE(fin.total_commission, 0) AS total_commission,
        COALESCE(fin.available_amount, 0) AS available_amount,
        COALESCE(fin.frozen_amount, 0) AS frozen_amount
      FROM merchants m
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN (
        SELECT q.merchant_id,
          SUM(CASE WHEN q.status='completed' THEN q.paid_amount ELSE 0 END) AS total_sales,
          SUM(CASE WHEN q.status='completed' THEN LEAST(q.paid_amount, q.commission_base * q.commission_rate / 100) ELSE 0 END) AS total_commission,
          SUM(CASE WHEN q.fund_status='available' THEN GREATEST(q.paid_amount - LEAST(q.paid_amount, q.commission_base * q.commission_rate / 100), 0) ELSE 0 END) AS available_amount,
          SUM(CASE WHEN q.fund_status='frozen' THEN GREATEST(q.paid_amount - LEAST(q.paid_amount, q.commission_base * q.commission_rate / 100), 0) ELSE 0 END) AS frozen_amount
        FROM (
          SELECT oi.merchant_id, o.id AS order_id, o.status, o.fund_status,
                 SUM(oi.subtotal) AS paid_amount,
                 SUM(COALESCE(NULLIF(oi.original_price,0),oi.price) * oi.qty) AS commission_base,
                 m2.commission_rate
            FROM order_items oi
            JOIN orders o ON o.id=oi.order_id
            JOIN merchants m2 ON m2.id=oi.merchant_id
           GROUP BY oi.merchant_id,o.id,o.status,o.fund_status,m2.commission_rate
        ) q
        GROUP BY q.merchant_id
      ) fin ON fin.merchant_id=m.id
      WHERE m.apply_status = 'approved'
      ORDER BY total_sales DESC
    `)
    const freezeDays = profitSharing.getProfitSharingFreezeDays()
    return R_OK(res, rows.map(row => ({ ...row, settlement_freeze_days: freezeDays })))
  } catch (e) {
    console.error('[admin-finance]', e); return R_FAIL(res, '服务器错误', 500)
  }
})

// ── GET /api/admin/withdrawals — 已停用：提现统一在微信支付商户平台处理 ─────────
router.get('/withdrawals', adminAuth, async (req, res) => {
  return R_OK(res, [])
})

// ── PATCH /api/admin/withdrawals/:id/handle — 已停用 ──────
router.patch('/withdrawals/:id/handle', adminAuth, async (req, res) => {
  return R_FAIL(res, '平台内提现已停用，请到微信支付商户平台处理', 410)
})

module.exports = router
