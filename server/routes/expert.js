// server/routes/expert.js — 专家讲堂公开接口
const express = require('express')
const jwt = require('jsonwebtoken')
const router = express.Router()
const db = require('../db/database')
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i

const PLATFORM_EXPERT = {
  id: 'platform',
  name: '平台专家',
  titleName: '棉花平台答疑',
  org: 'Cotton 棉花平台',
  avatar: '专',
  tags: ['平台答疑', '种植培训', '农事指导'],
  online: true,
  bio: '平台专家负责专家讲堂内容维护和农户问题答复。'
}

const TYPE_META = {
  video: { label: '视频课', icon: '▶️' },
  article: { label: '图文课', icon: '📖' },
  qa: { label: '问答课', icon: '💬' }
}

function parseJson(value, fallback) {
  if (!value) return fallback
  if (Array.isArray(value)) return value
  try { return JSON.parse(value) } catch { return fallback }
}

function parsePositiveId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function cleanImages(value) {
  const source = Array.isArray(value) ? value : []
  return [...new Set(source
    .map(item => String(item || '').trim())
    .filter(url => url.startsWith('/uploads/') && IMAGE_EXT_RE.test(url))
  )].slice(0, 3)
}

function farmerAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ code: 401, msg: '请先登录后再向专家提问', data: null })
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    if (payload.role && payload.role !== 'farmer') {
      return res.status(403).json({ code: 403, msg: '仅农户可以向专家提问', data: null })
    }
    req.user = payload
    next()
  } catch {
    res.status(401).json({ code: 401, msg: '登录已过期，请重新登录', data: null })
  }
}

function getPublicOrigin(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
  if (process.env.WECHAT_PAY_NOTIFY_URL) {
    try { return new URL(process.env.WECHAT_PAY_NOTIFY_URL).origin } catch {}
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return host ? `${proto}://${host}` : ''
}

function toPublicUrl(value, req) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const origin = getPublicOrigin(req)
  const path = value.startsWith('/') ? value : `/${value}`
  return origin ? `${origin}${path}` : value
}

function normalizeContent(row, req) {
  const typeMeta = TYPE_META[row.type] || TYPE_META.video
  const tags = parseJson(row.expert_tags, [])
  const quiz = parseJson(row.quiz_json, [])
  const price = Number(row.price || 0)
  const isPaid = row.price_type === 'paid' && price > 0
  return {
    id: row.id,
    type: row.type,
    typeLabel: typeMeta.label,
    icon: typeMeta.icon,
    title: row.title,
    subtitle: row.subtitle || '',
    categoryKey: row.category_key || 'planting',
    category: row.category_name || '种植技术',
    teacher: row.teacher || row.expert_name || PLATFORM_EXPERT.name,
    titleName: row.teacher_title || row.expert_title || PLATFORM_EXPERT.titleName,
    org: row.org || row.expert_org || PLATFORM_EXPERT.org,
    expertId: row.expert_id || PLATFORM_EXPERT.id,
    expertName: row.expert_name || row.teacher || PLATFORM_EXPERT.name,
    expertAvatar: row.expert_profile_avatar || row.expert_avatar || PLATFORM_EXPERT.avatar,
    tags,
    intro: row.intro || '',
    content: row.content || '',
    coverUrl: toPublicUrl(row.cover_url, req),
    videoUrl: toPublicUrl(row.video_url, req),
    duration: row.duration || '',
    priceType: row.price_type || 'free',
    price,
    isPaid,
    tag: isPaid ? `¥${price.toFixed(2)}` : '免费',
    quiz,
    aiPrompt: row.ai_prompt || '',
    students: row.students || 0,
    sortOrder: row.sort_order || 0,
    isPublished: !!row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function buildCategories(contents) {
  const defaults = [{ key: 'all', label: '全部' }]
  const map = new Map()
  contents.forEach(item => {
    if (!item.categoryKey) return
    map.set(item.categoryKey, item.category || item.categoryKey)
  })
  return defaults.concat([...map.entries()].map(([key, label]) => ({ key, label })))
}

function buildExperts(experts, contents) {
  const categoryTags = [...new Set((contents || []).map(item => item.category).filter(Boolean))].slice(0, 3)
  if (Array.isArray(experts) && experts.length) {
    return experts.map(item => {
      const tags = parseJson(item.specialties, [])
      return {
        id: item.id,
        name: item.name,
        titleName: item.title || '',
        org: item.org || 'Cotton 棉花平台',
        avatar: item.avatar || '专',
        tags: tags.length ? tags : (categoryTags.length ? categoryTags : PLATFORM_EXPERT.tags),
        online: !!item.is_active,
        bio: item.bio || ''
      }
    })
  }
  return [{ ...PLATFORM_EXPERT, tags: categoryTags.length ? categoryTags : PLATFORM_EXPERT.tags }]
}

function statusLabel(status) {
  const map = { pending: '待回复', replied: '已回复', closed: '已关闭' }
  return map[status] || status || '待回复'
}

function normalizeQuestion(row) {
  const images = parseJson(row.images, [])
  return {
    id: row.id,
    userId: row.user_id,
    farmerName: row.farmer_name || '',
    farmerPhone: row.farmer_phone || '',
    category: row.category || '',
    cropStage: row.crop_stage || '',
    plotId: row.plot_id || null,
    plotName: row.plot_name || '',
    question: row.question || '',
    images,
    status: row.status || 'pending',
    statusLabel: statusLabel(row.status),
    reply: row.reply || '',
    repliedAt: row.replied_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

router.get('/', async (req, res) => {
  try {
    const params = []
    let sql = `SELECT ec.*, e.name AS expert_name, e.title AS expert_title,
      e.org AS expert_org, e.avatar AS expert_profile_avatar, e.specialties AS expert_specialties
      FROM expert_contents ec
      LEFT JOIN experts e ON ec.expert_id = e.id
      WHERE ec.is_published=1`
    if (req.query.type) {
      sql += ' AND ec.type=?'
      params.push(req.query.type)
    }
    if (req.query.category && req.query.category !== 'all') {
      sql += ' AND ec.category_key=?'
      params.push(req.query.category)
    }
    sql += ' ORDER BY ec.sort_order ASC, ec.id DESC'
    const [rows] = await db.query(sql, params)
    const [expertRows] = await db.query(
      'SELECT id,name,title,org,avatar,specialties,bio,is_active FROM experts WHERE is_active=1 ORDER BY id DESC LIMIT 20'
    )
    const contents = rows.map(row => normalizeContent(row, req))
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        contents,
        categories: buildCategories(contents),
        experts: buildExperts(expertRows, contents),
        quickQuestions: [
          '棉花叶片发黄怎么办？',
          '什么时候该滴水追肥？',
          '棉蚜和红蜘蛛怎么区分？',
          '打药后多久可以再浇水？'
        ]
      }
    })
  } catch (error) {
    console.error('[expert-list]', error)
    res.status(500).json({ code: 500, msg: '专家讲堂加载失败', data: null })
  }
})

router.post('/questions', farmerAuth, async (req, res) => {
  try {
    const question = String(req.body.question || '').trim()
    if (question.length < 5) return res.status(400).json({ code: 400, msg: '请把问题描述得更完整一点', data: null })
    if (question.length > 1000) return res.status(400).json({ code: 400, msg: '问题内容过长，请控制在1000字以内', data: null })

    const [[user]] = await db.query('SELECT real_name, phone FROM users WHERE id=?', [req.user.id])
    const plotId = parsePositiveId(req.body.plotId || req.body.plot_id)
    let plotName = ''
    if (plotId) {
      const [plots] = await db.query('SELECT id, name FROM plots WHERE id=? AND user_id=? LIMIT 1', [plotId, req.user.id])
      if (!plots.length) return res.status(400).json({ code: 400, msg: '请选择自己的有效地块', data: null })
      plotName = plots[0].name || ''
    }
    const images = cleanImages(req.body.images)
    const [result] = await db.query(
      `INSERT INTO expert_questions
       (user_id, farmer_name, farmer_phone, category, crop_stage, plot_id, plot_name, question, images)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id,
        user?.real_name || req.user.real_name || '',
        user?.phone || req.user.phone || '',
        String(req.body.category || '').trim().slice(0, 64),
        String(req.body.cropStage || req.body.crop_stage || '').trim().slice(0, 64),
        plotId,
        plotName,
        question,
        JSON.stringify(images)
      ]
    )
    res.json({ code: 200, msg: '问题已提交，专家会在后台查看并回复', data: { id: result.insertId } })
  } catch (error) {
    console.error('[expert-question-submit]', error)
    res.status(500).json({ code: 500, msg: '提交问题失败', data: null })
  }
})

router.get('/my-questions', farmerAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM expert_questions WHERE user_id=? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    )
    res.json({ code: 200, msg: 'ok', data: rows.map(normalizeQuestion) })
  } catch (error) {
    console.error('[expert-my-questions]', error)
    res.status(500).json({ code: 500, msg: '获取提问记录失败', data: null })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ec.*, e.name AS expert_name, e.title AS expert_title,
        e.org AS expert_org, e.avatar AS expert_profile_avatar, e.specialties AS expert_specialties
       FROM expert_contents ec
       LEFT JOIN experts e ON ec.expert_id = e.id
       WHERE ec.id=? AND ec.is_published=1 LIMIT 1`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ code: 404, msg: '内容不存在或未上架', data: null })
    const content = normalizeContent(rows[0], req)
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        content,
        expert: buildExperts(rows[0].expert_id ? [{
          id: rows[0].expert_id,
          name: rows[0].expert_name || content.teacher,
          title: rows[0].expert_title || content.titleName,
          org: rows[0].expert_org || content.org,
          avatar: rows[0].expert_profile_avatar || content.expertAvatar,
          specialties: rows[0].expert_specialties || JSON.stringify(content.tags || []),
          bio: ''
        }] : [], [content])[0]
      }
    })
  } catch (error) {
    console.error('[expert-detail]', error)
    res.status(500).json({ code: 500, msg: '专家内容加载失败', data: null })
  }
})

module.exports = router
