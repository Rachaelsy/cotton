const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const submissionWindows = new Map()
const businessCategories = new Set(['产品资料', '供货服务', '农机服务', '渠道合作', '公司合作', '其他商务需求'])
const privacyCategories = new Set(['查阅个人信息', '更正个人信息', '删除账号与数据', '撤回服务申请', '其他个人信息问题'])
const requestMessages = {
  business: {
    duplicate: '相同需求已提交，请勿重复发送',
    success: '商务需求已提交，工作人员会根据填写的联系方式与您沟通'
  },
  activity: {
    duplicate: '相同参与意向已提交，请勿重复发送',
    success: '参与意向已提交，活动信息确认后工作人员会与您联系'
  },
  privacy: {
    duplicate: '相同的个人信息申请已提交，请勿重复发送',
    success: '个人信息申请已提交，管理员核验账号后会更新处理状态'
  }
}

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
  if (!req.viewer || !req.viewer.id) return fail(res, '请先登录后再使用此功能', 401)
  next()
}

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max)
}

function validPhone(value) {
  const phone = String(value || '').replace(/[\s-]/g, '')
  return /^(?:\+?86)?1\d{10}$/.test(phone) || /^0\d{9,11}$/.test(phone)
}

function allowSubmission(req, kind) {
  const now = Date.now()
  const key = `${kind}:${req.ip || req.socket.remoteAddress || 'unknown'}`
  const recent = (submissionWindows.get(key) || []).filter(timestamp => now - timestamp < 10 * 60 * 1000)
  if (recent.length >= 5) return false
  recent.push(now)
  submissionWindows.set(key, recent)
  if (submissionWindows.size > 2000) {
    for (const [itemKey, timestamps] of submissionWindows) {
      if (!timestamps.some(timestamp => now - timestamp < 10 * 60 * 1000)) submissionWindows.delete(itemKey)
    }
  }
  return true
}

async function insertServiceRequest(req, res, kind, fields) {
  if (req.body.website) return ok(res, null, '提交成功')
  if (!fields.contactName) return fail(res, '请填写姓名或称呼')
  if (!validPhone(fields.contactPhone)) return fail(res, '请填写正确的联系电话')
  if (!allowSubmission(req, kind)) return fail(res, '提交过于频繁，请稍后再试', 429)

  try {
    const normalizedPhone = String(fields.contactPhone).replace(/[\s-]/g, '')
    const [[duplicate]] = await db.query(
      `SELECT id FROM community_service_requests
       WHERE kind=? AND contact_phone=? AND reference_id=? AND category=?
         AND created_at>=DATE_SUB(NOW(),INTERVAL 2 MINUTE)
       ORDER BY id DESC LIMIT 1`,
      [kind, normalizedPhone, fields.referenceId, fields.category]
    )
    if (duplicate) {
      return ok(res, { id: Number(duplicate.id) }, requestMessages[kind].duplicate)
    }
    const [result] = await db.query(
      `INSERT INTO community_service_requests
       (kind,reference_id,reference_name,contact_name,contact_phone,region,category,message,source_path)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        kind,
        fields.referenceId,
        fields.referenceName,
        fields.contactName,
        normalizedPhone,
        fields.region,
        fields.category,
        fields.message,
        fields.sourcePath
      ]
    )
    return ok(res, { id: Number(result.insertId) }, requestMessages[kind].success)
  } catch (error) {
    console.error(`[public-service-${kind}-request]`, error)
    return fail(res, '提交失败，请稍后重试', 500)
  }
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

router.post('/business-inquiries', async (req, res) => {
  const category = cleanText(req.body.type, 64)
  const message = cleanText(req.body.message, 1200)
  if (!businessCategories.has(category)) return fail(res, '请选择有效的需求类型')
  if (message.length < 10) return fail(res, '请把需求描述得更完整一些')
  return insertServiceRequest(req, res, 'business', {
    referenceId: cleanText(req.body.referenceId || req.body.productId, 120),
    referenceName: cleanText(req.body.referenceName || req.body.productName, 160),
    contactName: cleanText(req.body.name, 64),
    contactPhone: cleanText(req.body.phone, 32),
    region: cleanText(req.body.region, 100),
    category,
    message,
    sourcePath: cleanText(req.body.sourcePath, 255)
  })
})

router.post('/activity-interests', async (req, res) => {
  const referenceId = cleanText(req.body.activityId, 120)
  const referenceName = cleanText(req.body.activityName, 160)
  if (!referenceId || !referenceName) return fail(res, '活动信息无效，请刷新页面后重试')
  return insertServiceRequest(req, res, 'activity', {
    referenceId,
    referenceName,
    contactName: cleanText(req.body.name, 64),
    contactPhone: cleanText(req.body.phone, 32),
    region: cleanText(req.body.region, 100),
    category: '公益活动意向',
    message: cleanText(req.body.message, 1200),
    sourcePath: cleanText(req.body.sourcePath, 255)
  })
})

router.post('/privacy-requests', userAuth, async (req, res) => {
  const category = cleanText(req.body.type, 64)
  const message = cleanText(req.body.message, 1200)
  if (!privacyCategories.has(category)) return fail(res, '请选择有效的申请类型')
  if (message.length < 5) return fail(res, '请补充需要处理的具体内容')
  try {
    const [[user]] = await db.query(
      `SELECT u.id,u.phone,u.real_name,f.location
       FROM users u
       LEFT JOIN farmers f ON f.user_id=u.id
       WHERE u.id=?
       LIMIT 1`,
      [req.viewer.id]
    )
    if (!user) return fail(res, '账号不存在或已停用', 404)
    return insertServiceRequest(req, res, 'privacy', {
      referenceId: String(user.id),
      referenceName: user.real_name || `账号 ${user.id}`,
      contactName: user.real_name || '平台用户',
      contactPhone: user.phone,
      region: user.location || '',
      category,
      message,
      sourcePath: cleanText(req.body.sourcePath, 255)
    })
  } catch (error) {
    console.error('[public-service-privacy-request]', error)
    return fail(res, '申请提交失败，请稍后重试', 500)
  }
})

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
