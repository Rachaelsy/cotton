// server/routes/expert.js — 专家讲堂公开接口
const express = require('express')
const router = express.Router()
const db = require('../db/database')

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
    teacher: row.teacher || '平台专家',
    titleName: row.teacher_title || '',
    org: row.org || '',
    expertId: row.teacher || row.id,
    expertName: row.teacher || '平台专家',
    expertAvatar: row.expert_avatar || '👨‍🌾',
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

function buildExperts(contents) {
  const map = new Map()
  contents.forEach(item => {
    const key = item.teacher || item.expertName || `expert-${item.id}`
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: item.teacher || item.expertName || '平台专家',
        titleName: item.titleName || '',
        org: item.org || '',
        avatar: item.expertAvatar || '👨‍🌾',
        tags: item.tags || [],
        online: true,
        bio: item.intro || ''
      })
    }
  })
  return [...map.values()]
}

router.get('/', async (req, res) => {
  try {
    const params = []
    let sql = 'SELECT * FROM expert_contents WHERE is_published=1'
    if (req.query.type) {
      sql += ' AND type=?'
      params.push(req.query.type)
    }
    if (req.query.category && req.query.category !== 'all') {
      sql += ' AND category_key=?'
      params.push(req.query.category)
    }
    sql += ' ORDER BY sort_order ASC, id DESC'
    const [rows] = await db.query(sql, params)
    const contents = rows.map(row => normalizeContent(row, req))
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        contents,
        categories: buildCategories(contents),
        experts: buildExperts(contents)
      }
    })
  } catch (error) {
    console.error('[expert-list]', error)
    res.status(500).json({ code: 500, msg: '专家讲堂加载失败', data: null })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM expert_contents WHERE id=? AND is_published=1 LIMIT 1',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ code: 404, msg: '内容不存在或未上架', data: null })
    const content = normalizeContent(rows[0], req)
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        content,
        expert: buildExperts([content])[0]
      }
    })
  } catch (error) {
    console.error('[expert-detail]', error)
    res.status(500).json({ code: 500, msg: '专家内容加载失败', data: null })
  }
})

module.exports = router
