const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })

function tokenPayload(req) {
  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ')) return null
  try { return jwt.verify(authorization.slice(7), process.env.JWT_SECRET) } catch { return null }
}

async function policyAdminAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload) return fail(res, '管理员登录已过期', 401)
  try {
    if (payload.is_community_admin && ['public_admin', 'policy_editor'].includes(payload.permission)) {
      const [[account]] = await db.query(
        'SELECT id,is_active,auth_version FROM community_admins WHERE id=? LIMIT 1',
        [payload.id]
      )
      if (!account || !account.is_active || Number(account.auth_version) !== Number(payload.auth_version || 0)) {
        return fail(res, '公益管理员账号已停用或登录已失效', 401)
      }
      req.policyAdmin = { id: Number(account.id), type: 'community' }
      return next()
    }
    if (payload.is_admin) {
      const [[account]] = await db.query(
        'SELECT id,is_admin,is_active,admin_auth_version FROM users WHERE id=? LIMIT 1',
        [payload.id]
      )
      if (!account || !account.is_admin || !account.is_active ||
          Number(account.admin_auth_version || 0) !== Number(payload.auth_version || 0)) {
        return fail(res, '平台管理员登录已失效', 401)
      }
      req.policyAdmin = { id: Number(account.id), type: 'platform' }
      return next()
    }
    return fail(res, '无政策发布权限', 403)
  } catch (error) {
    console.error('[policy-admin-auth]', error)
    return fail(res, '管理员身份校验失败', 500)
  }
}

function safeUrl(value) {
  const url = String(value || '').trim().slice(0, 500)
  return !url || /^https:\/\//i.test(url) ? url : ''
}

function validateAdminPassword(value) {
  const password = String(value || '')
  if (password.length < 10 || password.length > 72) return '新密码需为10-72位'
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return '新密码必须同时包含大写字母、小写字母、数字和特殊符号'
  }
  return ''
}

function articleBody(body = {}) {
  const status = body.status === 'published' ? 'published' : 'draft'
  return {
    title: String(body.title || '').trim().slice(0, 180),
    summary: String(body.summary || '').trim().slice(0, 500),
    markdown: String(body.body_markdown || body.markdown || '').trim().slice(0, 200000),
    level: String(body.policy_level || body.level || '地区').trim().slice(0, 32),
    category: String(body.category || '政策动态').trim().slice(0, 64),
    issuer: String(body.issuer || '').trim().slice(0, 160),
    region: String(body.region || '喀什地区').trim().slice(0, 160),
    documentNo: String(body.document_no || body.documentNo || '').trim().slice(0, 120),
    deadline: String(body.deadline || '').trim().slice(0, 120),
    originalUrl: safeUrl(body.original_url || body.originalUrl),
    status,
    featured: body.is_featured === true || body.is_featured === 1 || body.is_featured === '1' ? 1 : 0,
    sortOrder: Math.max(-9999, Math.min(9999, Number.parseInt(body.sort_order, 10) || 0))
  }
}

function normalize(row, includeMarkdown = false) {
  const article = {
    id: Number(row.id), title: row.title || '', summary: row.summary || '',
    level: row.policy_level || '地区', category: row.category || '政策动态',
    issuer: row.issuer || '', region: row.region || '', documentNo: row.document_no || '',
    deadline: row.deadline || '', originalUrl: row.original_url || '', status: row.status || 'draft',
    isFeatured: !!row.is_featured, sortOrder: Number(row.sort_order || 0),
    publishDate: row.published_at || row.created_at || null,
    createdAt: row.created_at || null, updatedAt: row.updated_at || null
  }
  if (includeMarkdown) article.markdown = row.body_markdown || ''
  return article
}

router.get('/', async (req, res) => {
  try {
    const params = []
    const conditions = ["status='published'"]
    if (req.query.level && req.query.level !== '全部') { conditions.push('policy_level=?'); params.push(String(req.query.level).slice(0, 32)) }
    if (req.query.category && req.query.category !== '全部') { conditions.push('category=?'); params.push(String(req.query.category).slice(0, 64)) }
    const q = String(req.query.q || '').trim().slice(0, 80)
    if (q) { conditions.push('(title LIKE ? OR summary LIKE ? OR issuer LIKE ? OR body_markdown LIKE ?)'); params.push(...Array(4).fill(`%${q}%`)) }
    const [rows] = await db.query(
      `SELECT * FROM policy_articles WHERE ${conditions.join(' AND ')} ORDER BY is_featured DESC,sort_order ASC,published_at DESC,id DESC LIMIT 100`,
      params
    )
    return ok(res, rows.map(row => normalize(row)))
  } catch (error) {
    console.error('[policy-list]', error)
    return fail(res, '政策列表加载失败', 500)
  }
})

router.get('/admin/list', policyAdminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM policy_articles ORDER BY updated_at DESC,id DESC LIMIT 200')
    return ok(res, rows.map(row => normalize(row, true)))
  } catch (error) { console.error('[policy-admin-list]', error); return fail(res, '政策管理列表加载失败', 500) }
})

router.post('/admin/change-password', policyAdminAuth, async (req, res) => {
  if (req.policyAdmin.type !== 'community') return fail(res, '该入口仅供公益管理员修改密码', 403)
  const oldPassword = String(req.body.old_password || '')
  const newPassword = String(req.body.new_password || '')
  if (!oldPassword || !newPassword) return fail(res, '请填写当前密码和新密码')
  if (oldPassword === newPassword) return fail(res, '新密码不能与当前密码相同')
  const passwordError = validateAdminPassword(newPassword)
  if (passwordError) return fail(res, passwordError)

  try {
    const [[account]] = await db.query(
      'SELECT password,is_active FROM community_admins WHERE id=? LIMIT 1',
      [req.policyAdmin.id]
    )
    if (!account || !account.is_active) return fail(res, '公益管理员账号不存在或已停用', 404)
    if (!account.password || !await bcrypt.compare(oldPassword, account.password)) {
      return fail(res, '当前密码不正确', 401)
    }
    const hash = await bcrypt.hash(newPassword, 12)
    await db.query(
      'UPDATE community_admins SET password=?,auth_version=auth_version+1 WHERE id=?',
      [hash, req.policyAdmin.id]
    )
    return ok(res, null, '密码修改成功，请重新登录')
  } catch (error) {
    console.error('[policy-admin-change-password]', error)
    return fail(res, '密码修改失败，请稍后重试', 500)
  }
})

router.post('/admin', policyAdminAuth, async (req, res) => {
  const article = articleBody(req.body)
  if (!article.title || !article.summary || !article.markdown) return fail(res, '标题、摘要和 Markdown 正文不能为空')
  try {
    const [result] = await db.query(
      `INSERT INTO policy_articles
       (title,summary,body_markdown,policy_level,category,issuer,region,document_no,deadline,original_url,status,is_featured,sort_order,published_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?='published',NOW(),NULL),?,?)`,
      [article.title,article.summary,article.markdown,article.level,article.category,article.issuer,article.region,
       article.documentNo,article.deadline,article.originalUrl,article.status,article.featured,article.sortOrder,
       article.status,req.policyAdmin.id,req.policyAdmin.id]
    )
    return ok(res, { id: Number(result.insertId) }, article.status === 'published' ? '政策已发布' : '草稿已保存')
  } catch (error) { console.error('[policy-admin-create]', error); return fail(res, '政策保存失败', 500) }
})

router.put('/admin/:id', policyAdminAuth, async (req, res) => {
  const article = articleBody(req.body)
  if (!article.title || !article.summary || !article.markdown) return fail(res, '标题、摘要和 Markdown 正文不能为空')
  try {
    const [result] = await db.query(
      `UPDATE policy_articles SET title=?,summary=?,body_markdown=?,policy_level=?,category=?,issuer=?,region=?,
       document_no=?,deadline=?,original_url=?,status=?,is_featured=?,sort_order=?,
       published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE NULL END,updated_by=? WHERE id=?`,
      [article.title,article.summary,article.markdown,article.level,article.category,article.issuer,article.region,
       article.documentNo,article.deadline,article.originalUrl,article.status,article.featured,article.sortOrder,
       article.status,req.policyAdmin.id,req.params.id]
    )
    if (!result.affectedRows) return fail(res, '政策文章不存在', 404)
    return ok(res, null, article.status === 'published' ? '政策已发布' : '草稿已保存')
  } catch (error) { console.error('[policy-admin-update]', error); return fail(res, '政策保存失败', 500) }
})

router.delete('/admin/:id', policyAdminAuth, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM policy_articles WHERE id=?', [req.params.id])
    if (!result.affectedRows) return fail(res, '政策文章不存在', 404)
    return ok(res, null, '政策文章已删除')
  } catch (error) { console.error('[policy-admin-delete]', error); return fail(res, '政策删除失败', 500) }
})

router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await db.query("SELECT * FROM policy_articles WHERE id=? AND status='published' LIMIT 1", [req.params.id])
    if (!row) return fail(res, '政策文章不存在或尚未发布', 404)
    return ok(res, normalize(row, true))
  } catch (error) { console.error('[policy-detail]', error); return fail(res, '政策详情加载失败', 500) }
})

module.exports = router
