const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })

function tokenPayload(req) {
  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ')) return null
  try { return jwt.verify(authorization.slice(7), process.env.JWT_SECRET) } catch { return null }
}

async function farmerAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload || payload.role !== 'farmer' || !payload.id) return fail(res, '请先登录农户账号', 401)
  try {
    const [[account]] = await db.query('SELECT id,is_active FROM users WHERE id=? AND role=? LIMIT 1', [payload.id, 'farmer'])
    if (!account || !account.is_active) return fail(res, '农户账号不存在或已停用', 401)
    req.farmerId = Number(account.id)
    next()
  } catch (error) {
    console.error('[plot-daily-work-farmer-auth]', error)
    return fail(res, '农户身份校验失败', 500)
  }
}

async function adminAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload) return fail(res, '管理员登录已过期', 401)
  try {
    if (payload.is_community_admin && ['public_admin', 'policy_editor'].includes(payload.permission)) {
      const [[account]] = await db.query('SELECT id,is_active,auth_version FROM community_admins WHERE id=? LIMIT 1', [payload.id])
      if (!account || !account.is_active || Number(account.auth_version) !== Number(payload.auth_version || 0)) return fail(res, '公共服务管理员账号已停用或登录已失效', 401)
      req.workAdmin = { id: Number(account.id), type: 'community' }
      return next()
    }
    if (payload.is_admin) {
      const [[account]] = await db.query('SELECT id,is_admin,is_active,admin_auth_version FROM users WHERE id=? LIMIT 1', [payload.id])
      if (!account || !account.is_admin || !account.is_active || Number(account.admin_auth_version || 0) !== Number(payload.auth_version || 0)) return fail(res, '平台管理员登录已失效', 401)
      req.workAdmin = { id: Number(account.id), type: 'platform' }
      return next()
    }
    return fail(res, '无地块农事管理权限', 403)
  } catch (error) {
    console.error('[plot-daily-work-admin-auth]', error)
    return fail(res, '管理员身份校验失败', 500)
  }
}

function dateOnly(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : ''
}

function normalize(row) {
  return {
    id: Number(row.id), plotId: Number(row.plot_id), workDate: dateOnly(row.work_date),
    timeLabel: row.time_label || '', title: row.title || '', content: row.content || '',
    priority: row.priority || 'normal', status: row.status || 'draft', sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at || null, updatedAt: row.updated_at || null
  }
}

function workBody(body = {}) {
  return {
    plotId: Number.parseInt(body.plot_id ?? body.plotId, 10),
    workDate: dateOnly(body.work_date || body.workDate),
    timeLabel: String(body.time_label || body.timeLabel || '').trim().slice(0, 40),
    title: String(body.title || '').trim().slice(0, 120),
    content: String(body.content || '').trim().slice(0, 500),
    priority: ['normal', 'important', 'urgent'].includes(body.priority) ? body.priority : 'normal',
    status: ['draft', 'published', 'offline'].includes(body.status) ? body.status : 'draft',
    sortOrder: Math.max(-9999, Math.min(9999, Number.parseInt(body.sort_order ?? body.sortOrder, 10) || 0))
  }
}

router.get('/', farmerAuth, async (req, res) => {
  const date = dateOnly(req.query.date)
  if (!date) return fail(res, '请提供正确的农事日期')
  try {
    const [rows] = await db.query(
      `SELECT w.*,p.name AS plot_name,p.area,p.variety,p.growth_stage
         FROM community_plot_daily_work w
         INNER JOIN plots p ON p.id=w.plot_id
        WHERE p.user_id=? AND w.work_date=? AND w.status='published'
        ORDER BY p.id ASC,w.sort_order ASC,w.id ASC`,
      [req.farmerId, date]
    )
    const groups = []
    const map = new Map()
    rows.forEach(row => {
      const plotId = Number(row.plot_id)
      let group = map.get(plotId)
      if (!group) {
        group = { plotId, plotName: row.plot_name || `地块${plotId}`, area: Number(row.area || 0), variety: row.variety || '', growthStage: row.growth_stage || '', items: [] }
        map.set(plotId, group)
        groups.push(group)
      }
      group.items.push(normalize(row))
    })
    return ok(res, groups)
  } catch (error) {
    console.error('[plot-daily-work-list]', error)
    return fail(res, '今日农事加载失败', 500)
  }
})

router.get('/admin/list', adminAuth, async (req, res) => {
  const plotId = Number.parseInt(req.query.plotId, 10)
  const date = dateOnly(req.query.date)
  if (!plotId || !date) return fail(res, '请选择地块和日期')
  try {
    const [rows] = await db.query('SELECT * FROM community_plot_daily_work WHERE plot_id=? AND work_date=? ORDER BY sort_order ASC,id ASC', [plotId, date])
    return ok(res, rows.map(normalize))
  } catch (error) {
    console.error('[plot-daily-work-admin-list]', error)
    return fail(res, '地块农事列表加载失败', 500)
  }
})

router.post('/admin', adminAuth, async (req, res) => {
  const work = workBody(req.body)
  if (!work.plotId || !work.workDate || !work.title) return fail(res, '地块、日期和农事标题不能为空')
  try {
    const [[plot]] = await db.query('SELECT id FROM plots WHERE id=? LIMIT 1', [work.plotId])
    if (!plot) return fail(res, '地块不存在', 404)
    const [result] = await db.query(
      `INSERT INTO community_plot_daily_work
       (plot_id,work_date,time_label,title,content,priority,status,sort_order,published_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,IF(?='published',NOW(),NULL),?,?)`,
      [work.plotId, work.workDate, work.timeLabel, work.title, work.content, work.priority, work.status, work.sortOrder, work.status, req.workAdmin.id, req.workAdmin.id]
    )
    return ok(res, { id: Number(result.insertId) }, work.status === 'published' ? '今日农事已发布' : '今日农事已保存')
  } catch (error) {
    console.error('[plot-daily-work-create]', error)
    return fail(res, '今日农事保存失败', 500)
  }
})

router.put('/admin/:id', adminAuth, async (req, res) => {
  const work = workBody(req.body)
  if (!work.plotId || !work.workDate || !work.title) return fail(res, '地块、日期和农事标题不能为空')
  try {
    const [result] = await db.query(
      `UPDATE community_plot_daily_work SET plot_id=?,work_date=?,time_label=?,title=?,content=?,priority=?,status=?,sort_order=?,
       published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_by=? WHERE id=?`,
      [work.plotId, work.workDate, work.timeLabel, work.title, work.content, work.priority, work.status, work.sortOrder, work.status, req.workAdmin.id, req.params.id]
    )
    if (!result.affectedRows) return fail(res, '今日农事不存在', 404)
    return ok(res, null, '今日农事已更新')
  } catch (error) {
    console.error('[plot-daily-work-update]', error)
    return fail(res, '今日农事更新失败', 500)
  }
})

router.delete('/admin/:id', adminAuth, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM community_plot_daily_work WHERE id=?', [req.params.id])
    if (!result.affectedRows) return fail(res, '今日农事不存在', 404)
    return ok(res, null, '今日农事已删除')
  } catch (error) {
    console.error('[plot-daily-work-delete]', error)
    return fail(res, '今日农事删除失败', 500)
  }
})

module.exports = router
