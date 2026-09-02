const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const CATEGORIES = new Set(['pest', 'disease', 'physiological'])
const CATEGORY_NAMES = { pest: '虫害', disease: '病害', physiological: '生理性' }

function tokenPayload(req) {
  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ')) return null
  try { return jwt.verify(authorization.slice(7), process.env.JWT_SECRET) } catch { return null }
}

async function adminAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload) return fail(res, '管理员登录已过期', 401)
  try {
    if (payload.is_community_admin && ['public_admin', 'policy_editor'].includes(payload.permission)) {
      const [[account]] = await db.query('SELECT id,is_active,auth_version FROM community_admins WHERE id=? LIMIT 1', [payload.id])
      if (!account || !account.is_active || Number(account.auth_version) !== Number(payload.auth_version || 0)) {
        return fail(res, '公共服务管理员账号已停用或登录已失效', 401)
      }
      req.pestAdmin = { id: Number(account.id), type: 'community' }
      return next()
    }
    if (payload.is_admin) {
      const [[account]] = await db.query('SELECT id,is_admin,is_active,admin_auth_version FROM users WHERE id=? LIMIT 1', [payload.id])
      if (!account || !account.is_admin || !account.is_active || Number(account.admin_auth_version || 0) !== Number(payload.auth_version || 0)) {
        return fail(res, '平台管理员登录已失效', 401)
      }
      req.pestAdmin = { id: Number(account.id), type: 'platform' }
      return next()
    }
    return fail(res, '无病虫害管理权限', 403)
  } catch (error) {
    console.error('[pest-admin-auth]', error)
    return fail(res, '管理员身份校验失败', 500)
  }
}

function safeUrl(value) {
  const url = String(value || '').trim().slice(0, 500)
  return !url || /^https:\/\//i.test(url) || url.startsWith('/uploads/') || url.startsWith('/assets/') ? url : ''
}

function stringList(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/\r?\n|，|,/)
  return source.map(item => String(item).trim()).filter(Boolean).slice(0, 30).map(item => item.slice(0, 300))
}

function parseBody(body = {}) {
  const category = CATEGORIES.has(body.category) ? body.category : ''
  const status = ['draft', 'published', 'offline'].includes(body.status) ? body.status : 'draft'
  return {
    name: String(body.name || '').trim().slice(0, 120),
    category,
    icon: String(body.icon || '🌿').trim().slice(0, 16) || '🌿',
    coverUrl: safeUrl(body.cover_url || body.coverUrl),
    summary: String(body.summary || '').trim().slice(0, 4000),
    symptoms: stringList(body.symptoms || body.symptoms_json),
    treatmentAdvice: String(body.treatment_advice || body.treatmentAdvice || '').trim().slice(0, 10000),
    medicationWarning: String(body.medication_warning || body.medicationWarning || '').trim().slice(0, 4000),
    sourceName: String(body.source_name || body.sourceName || '').trim().slice(0, 200),
    sourceUrl: safeUrl(body.source_url || body.sourceUrl),
    status,
    featured: body.is_featured === true || body.is_featured === 1 || body.is_featured === '1' ? 1 : 0,
    sortOrder: Math.max(-9999, Math.min(9999, Number.parseInt(body.sort_order, 10) || 0))
  }
}

function normalize(row) {
  let symptoms = []
  try { symptoms = JSON.parse(row.symptoms_json || '[]') } catch {}
  return {
    id: Number(row.id), name: row.name || '', category: row.category || 'pest',
    categoryName: CATEGORY_NAMES[row.category] || '病虫害', icon: row.icon || '🌿', coverUrl: row.cover_url || '',
    summary: row.summary || '', symptoms: Array.isArray(symptoms) ? symptoms : [],
    treatmentAdvice: row.treatment_advice || '', medicationWarning: row.medication_warning || '',
    sourceName: row.source_name || '', sourceUrl: row.source_url || '', status: row.status || 'draft',
    isFeatured: !!row.is_featured, sortOrder: Number(row.sort_order || 0),
    publishedAt: row.published_at || null, createdAt: row.created_at || null, updatedAt: row.updated_at || null
  }
}

router.get('/admin/list', adminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM community_pest_knowledge ORDER BY updated_at DESC,id DESC LIMIT 500')
    return ok(res, rows.map(normalize))
  } catch (error) {
    console.error('[pest-admin-list]', error)
    return fail(res, '病虫害知识管理列表加载失败', 500)
  }
})

router.post('/admin', adminAuth, async (req, res) => {
  const item = parseBody(req.body)
  if (!item.name || !item.category || !item.summary || !item.treatmentAdvice) return fail(res, '名称、类别、问题概述和防治建议不能为空')
  try {
    const [result] = await db.query(
      `INSERT INTO community_pest_knowledge
       (name,category,icon,cover_url,summary,symptoms_json,treatment_advice,medication_warning,source_name,source_url,status,is_featured,sort_order,published_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?='published',NOW(),NULL),?,?)`,
      [item.name, item.category, item.icon, item.coverUrl, item.summary, JSON.stringify(item.symptoms), item.treatmentAdvice,
       item.medicationWarning, item.sourceName, item.sourceUrl, item.status, item.featured, item.sortOrder, item.status,
       req.pestAdmin.id, req.pestAdmin.id]
    )
    return ok(res, { id: Number(result.insertId) }, '病虫害知识已保存')
  } catch (error) {
    console.error('[pest-create]', error)
    return fail(res, '病虫害知识保存失败', 500)
  }
})

router.put('/admin/:id', adminAuth, async (req, res) => {
  const item = parseBody(req.body)
  if (!item.name || !item.category || !item.summary || !item.treatmentAdvice) return fail(res, '名称、类别、问题概述和防治建议不能为空')
  try {
    const [result] = await db.query(
      `UPDATE community_pest_knowledge SET name=?,category=?,icon=?,cover_url=?,summary=?,symptoms_json=?,treatment_advice=?,
       medication_warning=?,source_name=?,source_url=?,status=?,is_featured=?,sort_order=?,
       published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_by=? WHERE id=?`,
      [item.name, item.category, item.icon, item.coverUrl, item.summary, JSON.stringify(item.symptoms), item.treatmentAdvice,
       item.medicationWarning, item.sourceName, item.sourceUrl, item.status, item.featured, item.sortOrder, item.status,
       req.pestAdmin.id, req.params.id]
    )
    if (!result.affectedRows) return fail(res, '病虫害知识不存在', 404)
    return ok(res, null, '病虫害知识已更新')
  } catch (error) {
    console.error('[pest-update]', error)
    return fail(res, '病虫害知识更新失败', 500)
  }
})

router.patch('/admin/:id/status', adminAuth, async (req, res) => {
  const status = ['draft', 'published', 'offline'].includes(req.body.status) ? req.body.status : ''
  if (!status) return fail(res, '病虫害知识状态不正确')
  try {
    const [result] = await db.query(
      `UPDATE community_pest_knowledge SET status=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_by=? WHERE id=?`,
      [status, status, req.pestAdmin.id, req.params.id]
    )
    if (!result.affectedRows) return fail(res, '病虫害知识不存在', 404)
    return ok(res, null, '状态已更新')
  } catch (error) {
    console.error('[pest-status]', error)
    return fail(res, '状态更新失败', 500)
  }
})

router.delete('/admin/:id', adminAuth, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM community_pest_knowledge WHERE id=?', [req.params.id])
    if (!result.affectedRows) return fail(res, '病虫害知识不存在', 404)
    return ok(res, null, '病虫害知识已删除')
  } catch (error) {
    console.error('[pest-delete]', error)
    return fail(res, '病虫害知识删除失败', 500)
  }
})

router.get('/', async (req, res) => {
  const category = CATEGORIES.has(req.query.category) ? req.query.category : ''
  const params = []
  let categorySql = ''
  if (category) { categorySql = ' AND category=?'; params.push(category) }
  try {
    const [rows] = await db.query(
      `SELECT * FROM community_pest_knowledge WHERE status='published'${categorySql}
       ORDER BY is_featured DESC,sort_order ASC,published_at DESC,id DESC LIMIT 200`, params
    )
    return ok(res, rows.map(normalize))
  } catch (error) {
    console.error('[pest-public-list]', error)
    return fail(res, '病虫害知识加载失败', 500)
  }
})

router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await db.query("SELECT * FROM community_pest_knowledge WHERE id=? AND status='published' LIMIT 1", [req.params.id])
    if (!row) return fail(res, '病虫害知识不存在或未发布', 404)
    return ok(res, normalize(row))
  } catch (error) {
    console.error('[pest-public-detail]', error)
    return fail(res, '病虫害知识详情加载失败', 500)
  }
})

module.exports = router
