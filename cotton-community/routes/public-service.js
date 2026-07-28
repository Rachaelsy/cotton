const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })

function parseJson(value, fallback = []) {
  if (Array.isArray(value)) return value
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function tokenPayload(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    return jwt.verify(auth.slice(7), process.env.JWT_SECRET)
  } catch {
    return null
  }
}

function userAuth(req, res, next) {
  req.viewer = tokenPayload(req)
  if (!req.viewer || !req.viewer.id) return fail(res, '请先登录后再向专家提问', 401)
  next()
}

function normalizeExpert(row) {
  return {
    id: Number(row.id),
    name: row.name || '平台专家',
    title: row.title || '棉花种植顾问',
    org: row.org || 'Cotton 棉花平台',
    avatar: row.avatar || '专',
    specialties: parseJson(row.specialties),
    bio: row.bio || ''
  }
}

function normalizeQuestion(row) {
  const statusText = {
    pending: '等待回复',
    replied: '已回复',
    closed: '已结束'
  }
  return {
    id: Number(row.id),
    category: row.category || '',
    cropStage: row.crop_stage || '',
    question: row.question || '',
    status: row.status || 'pending',
    statusText: statusText[row.status] || '等待回复',
    reply: row.reply || '',
    repliedAt: row.replied_at || null,
    createdAt: row.created_at
  }
}

router.get('/experts', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,name,title,org,avatar,specialties,bio
       FROM experts
       WHERE is_active=1
       ORDER BY id DESC
       LIMIT 30`
    )
    return ok(res, { experts: rows.map(normalizeExpert) })
  } catch (error) {
    console.error('[public-service-experts]', error)
    return fail(res, '专家信息暂时无法加载，请稍后重试', 500)
  }
})

router.post('/expert-questions', userAuth, async (req, res) => {
  const question = String(req.body.question || '').trim()
  const category = String(req.body.category || '').trim().slice(0, 64)
  const cropStage = String(req.body.cropStage || req.body.crop_stage || '').trim().slice(0, 64)

  if (question.length < 5) return fail(res, '请把问题描述得更完整一些')
  if (question.length > 1000) return fail(res, '问题内容不能超过 1000 字')

  try {
    const [[user]] = await db.query(
      'SELECT id,real_name,phone,is_active FROM users WHERE id=? LIMIT 1',
      [req.viewer.id]
    )
    if (!user) return fail(res, '账号不存在，请重新登录', 401)
    if (!user.is_active) return fail(res, '账号已停用，请联系平台管理员', 403)

    const [result] = await db.query(
      `INSERT INTO expert_questions
       (user_id,farmer_name,farmer_phone,category,crop_stage,question,images)
       VALUES (?,?,?,?,?,?,?)`,
      [
        user.id,
        user.real_name || req.viewer.real_name || '',
        user.phone || req.viewer.phone || '',
        category,
        cropStage,
        question,
        JSON.stringify([])
      ]
    )
    return ok(res, { id: result.insertId }, '问题已提交，专家会在平台后台查看并回复')
  } catch (error) {
    console.error('[public-service-question-submit]', error)
    return fail(res, '问题提交失败，请稍后重试', 500)
  }
})

router.get('/my-expert-questions', userAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,category,crop_stage,question,status,reply,replied_at,created_at
       FROM expert_questions
       WHERE user_id=?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.viewer.id]
    )
    return ok(res, { questions: rows.map(normalizeQuestion) })
  } catch (error) {
    console.error('[public-service-my-questions]', error)
    return fail(res, '咨询记录暂时无法加载，请稍后重试', 500)
  }
})

module.exports = router
