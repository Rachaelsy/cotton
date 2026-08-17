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

async function adminAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload) return fail(res, '管理员登录已过期', 401)
  try {
    if (payload.is_community_admin && ['public_admin', 'policy_editor'].includes(payload.permission)) {
      const [[account]] = await db.query('SELECT id,is_active,auth_version FROM community_admins WHERE id=? LIMIT 1', [payload.id])
      if (!account || !account.is_active || Number(account.auth_version) !== Number(payload.auth_version || 0)) return fail(res, '公共服务管理员账号已停用或登录已失效', 401)
      req.todoAdmin = { id: Number(account.id), type: 'community' }
      return next()
    }
    if (payload.is_admin) {
      const [[account]] = await db.query('SELECT id,is_admin,is_active,admin_auth_version FROM users WHERE id=? LIMIT 1', [payload.id])
      if (!account || !account.is_admin || !account.is_active || Number(account.admin_auth_version || 0) !== Number(payload.auth_version || 0)) return fail(res, '平台管理员登录已失效', 401)
      req.todoAdmin = { id: Number(account.id), type: 'platform' }
      return next()
    }
    return fail(res, '无今日待办管理权限', 403)
  } catch (error) {
    console.error('[daily-todo-admin-auth]', error)
    return fail(res, '管理员身份校验失败', 500)
  }
}

function dateOnly(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : ''
}

function normalize(row) {
  return {
    id: Number(row.id), date: dateOnly(row.todo_date), timeLabel: row.time_label || '',
    title: row.title || '', content: row.content || '', voiceText: row.voice_text || '',
    priority: row.priority || 'normal', status: row.status || 'draft',
    sortOrder: Number(row.sort_order || 0), publishedAt: row.published_at || null,
    createdAt: row.created_at || null, updatedAt: row.updated_at || null
  }
}

function todoBody(body = {}) {
  const date = dateOnly(body.todo_date || body.date)
  const title = String(body.title || '').trim().slice(0, 120)
  const content = String(body.content || '').trim().slice(0, 500)
  const timeLabel = String(body.time_label || body.timeLabel || '').trim().slice(0, 40)
  const autoVoice = [timeLabel, title, content].filter(Boolean).join('，')
  return {
    date,
    timeLabel,
    title,
    content,
    voiceText: String(body.voice_text || body.voiceText || autoVoice).trim().slice(0, 1000),
    priority: ['normal', 'important', 'urgent'].includes(body.priority) ? body.priority : 'normal',
    status: ['draft', 'published', 'offline'].includes(body.status) ? body.status : 'draft',
    sortOrder: Math.max(-9999, Math.min(9999, Number.parseInt(body.sort_order ?? body.sortOrder, 10) || 0))
  }
}

router.get('/', async (req, res) => {
  const date = dateOnly(req.query.date)
  if (!date) return fail(res, '请提供正确的待办日期')
  try {
    const [rows] = await db.query(
      "SELECT * FROM community_daily_todos WHERE todo_date=? AND status='published' ORDER BY sort_order ASC,id ASC LIMIT 20",
      [date]
    )
    return ok(res, rows.map(normalize))
  } catch (error) {
    console.error('[daily-todo-list]', error)
    return fail(res, '今日待办加载失败', 500)
  }
})

router.get('/admin/list', adminAuth, async (req, res) => {
  const date = dateOnly(req.query.date)
  try {
    const [rows] = date
      ? await db.query('SELECT * FROM community_daily_todos WHERE todo_date=? ORDER BY sort_order ASC,id ASC LIMIT 500', [date])
      : await db.query('SELECT * FROM community_daily_todos ORDER BY todo_date DESC,sort_order ASC,id ASC LIMIT 1000')
    return ok(res, rows.map(normalize))
  } catch (error) {
    console.error('[daily-todo-admin-list]', error)
    return fail(res, '待办管理列表加载失败', 500)
  }
})

router.post('/admin', adminAuth, async (req, res) => {
  const todo = todoBody(req.body)
  if (!todo.date || !todo.title) return fail(res, '待办日期和标题不能为空')
  try {
    const [result] = await db.query(
      `INSERT INTO community_daily_todos
       (todo_date,time_label,title,content,voice_text,priority,status,sort_order,published_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,IF(?='published',NOW(),NULL),?,?)`,
      [todo.date, todo.timeLabel, todo.title, todo.content, todo.voiceText, todo.priority, todo.status,
       todo.sortOrder, todo.status, req.todoAdmin.id, req.todoAdmin.id]
    )
    return ok(res, { id: Number(result.insertId) }, todo.status === 'published' ? '待办已发布' : '待办已保存')
  } catch (error) {
    console.error('[daily-todo-create]', error)
    return fail(res, '待办保存失败', 500)
  }
})

router.put('/admin/:id', adminAuth, async (req, res) => {
  const todo = todoBody(req.body)
  if (!todo.date || !todo.title) return fail(res, '待办日期和标题不能为空')
  try {
    const [result] = await db.query(
      `UPDATE community_daily_todos
          SET todo_date=?,time_label=?,title=?,content=?,voice_text=?,priority=?,status=?,sort_order=?,
              published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_by=?
        WHERE id=?`,
      [todo.date, todo.timeLabel, todo.title, todo.content, todo.voiceText, todo.priority, todo.status,
       todo.sortOrder, todo.status, req.todoAdmin.id, req.params.id]
    )
    if (!result.affectedRows) return fail(res, '待办不存在', 404)
    return ok(res, null, '待办已更新')
  } catch (error) {
    console.error('[daily-todo-update]', error)
    return fail(res, '待办更新失败', 500)
  }
})

router.delete('/admin/:id', adminAuth, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM community_daily_todos WHERE id=?', [req.params.id])
    if (!result.affectedRows) return fail(res, '待办不存在', 404)
    return ok(res, null, '待办已删除')
  } catch (error) {
    console.error('[daily-todo-delete]', error)
    return fail(res, '待办删除失败', 500)
  }
})

module.exports = router
