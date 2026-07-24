// Expert console API. Expert accounts are independent from platform admins.
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const db = require('../db/database')

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'

const uploadDir = path.join(__dirname, '../public/uploads/expert')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const expertUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '')
      cb(null, `expert_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`)
    }
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      return cb(new Error('Only image and video files are allowed'))
    }
    cb(null, true)
  }
})

const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })

function expertAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return fail(res, 'Unauthorized', 401)

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (payload.role !== 'expert' || !payload.is_expert) return fail(res, 'Forbidden', 403)
    req.expert = payload
    next()
  } catch (error) {
    return fail(res, 'Invalid or expired token', 401)
  }
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
    return raw.split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split('|').map(part => part.trim()).filter(Boolean)
        if (parts.length < 4) return null
        const answerRaw = parts.length >= 5 ? parts[parts.length - 2] : '1'
        const explanation = parts.length >= 5 ? parts[parts.length - 1] : ''
        const optionEnd = parts.length >= 5 ? parts.length - 2 : parts.length
        const options = parts.slice(1, optionEnd)
        const answer = Math.max(0, Math.min(options.length - 1, (parseInt(answerRaw, 10) || 1) - 1))
        return { question: parts[0], options, answer, explanation }
      })
      .filter(Boolean)
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback
  if (Array.isArray(value)) return value
  try { return JSON.parse(value) } catch { return fallback }
}

function normalizeContentBody(body = {}, expert = {}) {
  const priceType = body.price_type === 'paid' ? 'paid' : 'free'
  const price = priceType === 'paid' ? Math.max(0, Number(body.price || 0)) : 0
  const type = ['video', 'article', 'qa'].includes(body.type) ? body.type : 'video'

  return {
    type,
    title: String(body.title || '').trim(),
    subtitle: String(body.subtitle || '').trim(),
    category_key: String(body.category_key || 'planting').trim(),
    category_name: String(body.category_name || '种植技术').trim(),
    teacher: String(body.teacher || expert.name || expert.real_name || '平台专家').trim(),
    teacher_title: String(body.teacher_title || '棉花平台答疑').trim(),
    org: String(body.org || 'Cotton 棉花平台').trim(),
    expert_avatar: String(body.expert_avatar || '问').trim(),
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

function normalizeQuestion(row = {}) {
  const statusMap = { pending: '待回复', replied: '已回复', closed: '已关闭' }
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
    statusLabel: statusMap[row.status] || '待回复',
    reply: row.reply || '',
    repliedAt: row.replied_at,
    createdAt: row.created_at
  }
}

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body
    if (!phone || !password) return fail(res, '请输入账号和密码')

    const [rows] = await db.query('SELECT * FROM experts WHERE phone=?', [phone])
    const expert = rows[0]
    if (!expert) return fail(res, '专家账号不存在', 404)
    if (!expert.is_active) return fail(res, '专家账号已停用', 403)

    const matched = await bcrypt.compare(password, expert.password)
    if (!matched) return fail(res, '密码错误', 401)

    const token = jwt.sign(
      { id: expert.id, phone: expert.phone, name: expert.name, role: 'expert', is_expert: true },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    )
    return ok(res, {
      token,
      id: expert.id,
      name: expert.name,
      title: expert.title || '',
      org: expert.org || ''
    }, '登录成功')
  } catch (error) {
    console.error('[expert-admin-login]', error)
    return fail(res, '服务器错误', 500)
  }
})

router.post('/upload', expertAuth, expertUpload.single('file'), (req, res) => {
  if (!req.file) return fail(res, '未选择文件')
  return ok(res, { url: `/uploads/expert/${req.file.filename}` }, '上传成功')
})

router.get('/contents', expertAuth, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM expert_contents ORDER BY sort_order ASC, id DESC')
    return ok(res, rows)
  } catch (error) {
    console.error('[expert-admin-contents]', error)
    return fail(res, '内容加载失败', 500)
  }
})

router.post('/contents', expertAuth, async (req, res) => {
  try {
    const data = normalizeContentBody(req.body, req.expert)
    if (!data.title) return fail(res, '请填写内容标题')
    await db.query(
      `INSERT INTO expert_contents
       (expert_id,type,title,subtitle,category_key,category_name,teacher,teacher_title,org,expert_avatar,expert_tags,
        intro,content,cover_url,video_url,duration,price_type,price,quiz_json,ai_prompt,students,sort_order,is_published)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.expert.id, data.type, data.title, data.subtitle, data.category_key, data.category_name, data.teacher,
        data.teacher_title, data.org, data.expert_avatar, data.expert_tags, data.intro, data.content,
        data.cover_url, data.video_url, data.duration, data.price_type, data.price, data.quiz_json,
        data.ai_prompt, data.students, data.sort_order, data.is_published
      ]
    )
    return ok(res, null, '内容已新增')
  } catch (error) {
    console.error('[expert-admin-content-create]', error)
    return fail(res, '保存失败', 500)
  }
})

router.put('/contents/:id', expertAuth, async (req, res) => {
  try {
    const data = normalizeContentBody(req.body, req.expert)
    if (!data.title) return fail(res, '请填写内容标题')
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
    return ok(res, null, '内容已保存')
  } catch (error) {
    console.error('[expert-admin-content-update]', error)
    return fail(res, '保存失败', 500)
  }
})

router.post('/contents/:id/toggle', expertAuth, async (req, res) => {
  try {
    const isPublished = req.body.is_published ? 1 : 0
    await db.query('UPDATE expert_contents SET is_published=? WHERE id=?', [isPublished, req.params.id])
    return ok(res, null, isPublished ? '已上架' : '已下架')
  } catch (error) {
    console.error('[expert-admin-content-toggle]', error)
    return fail(res, '上下架失败', 500)
  }
})

router.delete('/contents/:id', expertAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM expert_contents WHERE id=?', [req.params.id])
    return ok(res, null, '已删除')
  } catch (error) {
    console.error('[expert-admin-content-delete]', error)
    return fail(res, '删除失败', 500)
  }
})

router.get('/questions', expertAuth, async (req, res) => {
  try {
    const status = ['pending', 'replied', 'closed'].includes(req.query.status) ? req.query.status : ''
    const sql = status
      ? 'SELECT * FROM expert_questions WHERE status=? ORDER BY created_at DESC LIMIT 200'
      : 'SELECT * FROM expert_questions ORDER BY created_at DESC LIMIT 200'
    const [rows] = await db.query(sql, status ? [status] : [])
    return ok(res, rows.map(normalizeQuestion))
  } catch (error) {
    console.error('[expert-admin-questions]', error)
    return fail(res, '提问加载失败', 500)
  }
})

router.patch('/questions/:id/reply', expertAuth, async (req, res) => {
  try {
    const reply = String(req.body.reply || '').trim()
    if (reply.length < 2) return fail(res, '请填写回复内容')
    const [result] = await db.query(
      `UPDATE expert_questions
       SET reply=?, status='replied', replied_by=?, replied_at=NOW()
       WHERE id=?`,
      [reply, req.expert.id, req.params.id]
    )
    if (!result.affectedRows) return fail(res, '提问不存在', 404)
    return ok(res, null, '已回复农户')
  } catch (error) {
    console.error('[expert-admin-question-reply]', error)
    return fail(res, '回复失败', 500)
  }
})

router.patch('/questions/:id/status', expertAuth, async (req, res) => {
  try {
    const status = ['pending', 'replied', 'closed'].includes(req.body.status) ? req.body.status : ''
    if (!status) return fail(res, '状态不正确')
    const [result] = await db.query('UPDATE expert_questions SET status=? WHERE id=?', [status, req.params.id])
    if (!result.affectedRows) return fail(res, '提问不存在', 404)
    return ok(res, null, '状态已更新')
  } catch (error) {
    console.error('[expert-admin-question-status]', error)
    return fail(res, '状态更新失败', 500)
  }
})

module.exports = router
