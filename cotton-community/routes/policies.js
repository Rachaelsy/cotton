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

function userAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload || !payload.id || payload.role !== 'farmer') return fail(res, '请先登录后发表评论', 401)
  req.viewer = payload
  next()
}

function formatComment(row) {
  const name = String(row.real_name || '').trim()
  const phone = String(row.phone || '')
  return {
    id: Number(row.id),
    parentId: row.parent_id ? Number(row.parent_id) : null,
    content: row.content || '',
    author: name || (phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '棉农用户'),
    createdAt: row.created_at || null,
    likeCount: Number(row.like_count || 0),
    liked: !!row.viewer_liked
  }
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
        return fail(res, '公共服务管理员账号已停用或登录已失效', 401)
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

function dateTimeText(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = number => String(number).padStart(2, '0')
    const chinaTime = new Date(value.getTime() + 8 * 60 * 60 * 1000)
    return `${chinaTime.getUTCFullYear()}-${pad(chinaTime.getUTCMonth() + 1)}-${pad(chinaTime.getUTCDate())} ${pad(chinaTime.getUTCHours())}:${pad(chinaTime.getUTCMinutes())}:${pad(chinaTime.getUTCSeconds())}`
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!match) return ''
  return `${match[1]}-${match[2]}-${match[3]}${match[4] ? ` ${match[4]}:${match[5]}:${match[6] || '00'}` : ''}`
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
  const markdown = String(body.body_markdown || body.markdown || '').trim().slice(0, 200000)
  const generatedSummary = markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
  const requestedType = String(body.content_type || body.contentType || 'policy').trim()
  const contentType = ['policy', 'industry', 'finance', 'home'].includes(requestedType) ? requestedType : 'policy'
  const policyLevels = new Set(['国家', '自治区', '地区', '县级'])
  const industryCategories = new Set(['产业', '农机', '农资', '市场', '气象'])
  const financeCategories = new Set(['loan', 'insurance', 'futures', 'finance-policy'])
  const requestedSection = String(body.section || body.category || body.policy_level || body.level || '').trim()
  let section = '地区'
  if (contentType === 'industry') section = industryCategories.has(requestedSection) ? requestedSection : '产业'
  else if (contentType === 'finance') section = financeCategories.has(requestedSection) ? requestedSection : 'loan'
  else if (contentType === 'home') section = 'homepage'
  else section = policyLevels.has(requestedSection) ? requestedSection : '地区'
  const homeFeatured = body.is_home_featured === true || body.isHomeFeatured === true || body.is_home_featured === 1 || body.is_home_featured === '1' ? 1 : 0
  const sourcePublishedAt = dateTimeText(body.source_published_at || body.sourcePublishedAt)
  return {
    title: String(body.title || '').trim().slice(0, 180),
    summary: generatedSummary,
    markdown,
    contentType,
    level: contentType === 'policy' ? section : contentType === 'industry' ? '行业资讯' : contentType === 'finance' ? '优棉金融' : '首页专稿',
    category: section,
    issuer: String(body.issuer || '').trim().slice(0, 160),
    region: String(body.region || '喀什地区').trim().slice(0, 160),
    documentNo: String(body.document_no || body.documentNo || '').trim().slice(0, 120),
    deadline: String(body.deadline || '').trim().slice(0, 120),
    originalUrl: safeUrl(body.original_url || body.originalUrl),
    sourcePublishedAt,
    coverUrl: safeUrl(body.cover_url || body.coverUrl),
    status,
    featured: body.is_featured === true || body.is_featured === 1 || body.is_featured === '1' ? 1 : 0,
    homeFeatured: status === 'published' ? homeFeatured : 0,
    sortOrder: Math.max(-9999, Math.min(9999, Number.parseInt(body.sort_order, 10) || 0))
  }
}

async function assertHomeCapacity(article, excludeId = 0) {
  if (!article.homeFeatured) return
  const params = []
  let exclude = ''
  if (excludeId) { exclude = ' AND id<>?'; params.push(excludeId) }
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total FROM policy_articles WHERE status='published' AND is_home_featured=1${exclude}`,
    params
  )
  if (Number(row.total || 0) >= 5) {
    const error = new Error('首页最多推送5篇文章，请先取消一篇现有推送')
    error.status = 409
    throw error
  }
}

function normalize(row, includeMarkdown = false) {
  const contentType = ['policy', 'industry', 'finance', 'home'].includes(row.content_type) ? row.content_type : 'policy'
  const imageMatch = String(row.body_markdown || '').match(/!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+|\/[^\s)]+)\s*(?:["'][^"']*["'])?\s*\)/i)
  const article = {
    id: Number(row.id), title: row.title || '', summary: row.summary || '',
    contentType,
    level: row.policy_level || '地区', category: row.category || '政策动态',
    section: contentType === 'policy' ? (row.policy_level || '地区') : (row.category || (contentType === 'industry' ? '产业' : contentType === 'finance' ? 'loan' : 'homepage')),
    issuer: row.issuer || '', region: row.region || '', documentNo: row.document_no || '',
    deadline: row.deadline || '', originalUrl: row.original_url || '', status: row.status || 'draft',
    isFeatured: !!row.is_featured, isHomeFeatured: !!row.is_home_featured,
    homeFeaturedAt: row.home_featured_at || null, sortOrder: Number(row.sort_order || 0),
    coverImage: row.cover_url || (imageMatch ? imageMatch[1] : ''),
    sourcePublishedAt: dateTimeText(row.source_published_at) || null,
    publishDate: dateTimeText(row.source_published_at) || dateTimeText(row.published_at) || dateTimeText(row.created_at) || null,
    createdAt: row.created_at || null, updatedAt: row.updated_at || null
  }
  if (includeMarkdown) article.markdown = row.body_markdown || ''
  return article
}

router.get('/', async (req, res) => {
  try {
    const params = []
    const conditions = ["status='published'"]
    const homepage = req.query.homepage === '1' || req.query.homepage === 'true'
    if (homepage) conditions.push('is_home_featured=1')
    const requestedType = ['policy', 'industry', 'finance', 'home'].includes(req.query.type) ? req.query.type : ''
    if (requestedType) {
      conditions.push('content_type=?')
      params.push(requestedType)
    } else if (!homepage) {
      conditions.push("content_type IN ('policy','industry')")
    }
    const section = String(req.query.section || '').trim().slice(0, 32)
    if (section) {
      if (['industry', 'finance', 'home'].includes(requestedType)) conditions.push('category=?')
      else conditions.push('policy_level=?')
      params.push(section)
    }
    if (req.query.level && req.query.level !== '全部') { conditions.push('policy_level=?'); params.push(String(req.query.level).slice(0, 32)) }
    if (req.query.category && req.query.category !== '全部') { conditions.push('category=?'); params.push(String(req.query.category).slice(0, 64)) }
    const q = String(req.query.q || '').trim().slice(0, 80)
    if (q) { conditions.push('(title LIKE ? OR summary LIKE ? OR issuer LIKE ? OR body_markdown LIKE ?)'); params.push(...Array(4).fill(`%${q}%`)) }
    const [rows] = await db.query(
      `SELECT * FROM policy_articles WHERE ${conditions.join(' AND ')} ORDER BY ${homepage ? 'home_featured_at DESC,' : ''}is_featured DESC,sort_order ASC,published_at DESC,id DESC LIMIT ${homepage ? 5 : 100}`,
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
  if (req.policyAdmin.type !== 'community') return fail(res, '该入口仅供公共服务管理员修改密码', 403)
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
    if (!account || !account.is_active) return fail(res, '公共服务管理员账号不存在或已停用', 404)
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
  if (!article.title || !article.markdown) return fail(res, '标题和 Markdown 正文不能为空')
  if (['policy', 'industry'].includes(article.contentType) && !article.sourcePublishedAt) return fail(res, '请填写原文发布时间')
  try {
    await assertHomeCapacity(article)
    const [result] = await db.query(
      `INSERT INTO policy_articles
       (title,summary,body_markdown,content_type,policy_level,category,issuer,region,document_no,deadline,original_url,source_published_at,cover_url,status,is_featured,is_home_featured,home_featured_at,sort_order,published_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?=1,NOW(),NULL),?,IF(?='published',NOW(),NULL),?,?)`,
      [article.title,article.summary,article.markdown,article.contentType,article.level,article.category,article.issuer,article.region,
       article.documentNo,article.deadline,article.originalUrl,article.sourcePublishedAt,article.coverUrl,article.status,article.featured,article.homeFeatured,article.homeFeatured,
       article.sortOrder,article.status,req.policyAdmin.id,req.policyAdmin.id]
    )
    return ok(res, { id: Number(result.insertId) }, article.status === 'published' ? '政策已发布' : '草稿已保存')
  } catch (error) { console.error('[policy-admin-create]', error); return fail(res, error.message || '政策保存失败', error.status || 500) }
})

router.put('/admin/:id', policyAdminAuth, async (req, res) => {
  const article = articleBody(req.body)
  if (!article.title || !article.markdown) return fail(res, '标题和 Markdown 正文不能为空')
  if (['policy', 'industry'].includes(article.contentType) && !article.sourcePublishedAt) return fail(res, '请填写原文发布时间')
  try {
    await assertHomeCapacity(article, Number(req.params.id))
    const [result] = await db.query(
      `UPDATE policy_articles SET title=?,summary=?,body_markdown=?,content_type=?,policy_level=?,category=?,issuer=?,region=?,
       document_no=?,deadline=?,original_url=?,source_published_at=?,cover_url=?,status=?,is_featured=?,is_home_featured=?,
       home_featured_at=CASE WHEN ?=1 THEN COALESCE(home_featured_at,NOW()) ELSE NULL END,sort_order=?,
       published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE NULL END,updated_by=? WHERE id=?`,
      [article.title,article.summary,article.markdown,article.contentType,article.level,article.category,article.issuer,article.region,
       article.documentNo,article.deadline,article.originalUrl,article.sourcePublishedAt,article.coverUrl,article.status,article.featured,article.homeFeatured,article.homeFeatured,article.sortOrder,
       article.status,req.policyAdmin.id,req.params.id]
    )
    if (!result.affectedRows) return fail(res, '政策文章不存在', 404)
    return ok(res, null, article.status === 'published' ? '政策已发布' : '草稿已保存')
  } catch (error) { console.error('[policy-admin-update]', error); return fail(res, error.message || '政策保存失败', error.status || 500) }
})

router.patch('/admin/:id/home-featured', policyAdminAuth, async (req, res) => {
  const enabled = req.body.enabled === true || req.body.enabled === 1 || req.body.enabled === '1'
  try {
    const [[article]] = await db.query('SELECT id,status,is_home_featured FROM policy_articles WHERE id=? LIMIT 1', [req.params.id])
    if (!article) return fail(res, '政策资讯不存在', 404)
    if (enabled && article.status !== 'published') return fail(res, '只有已发布文章才能推送到首页', 409)
    if (enabled && !article.is_home_featured) await assertHomeCapacity({ homeFeatured: 1 }, Number(req.params.id))
    await db.query(
      'UPDATE policy_articles SET is_home_featured=?,home_featured_at=IF(?=1,NOW(),NULL),updated_by=? WHERE id=?',
      [enabled ? 1 : 0, enabled ? 1 : 0, req.policyAdmin.id, req.params.id]
    )
    return ok(res, null, enabled ? '文章已推送到小程序首页' : '已取消首页推送')
  } catch (error) {
    console.error('[policy-home-featured]', error)
    return fail(res, error.message || '首页推送设置失败', error.status || 500)
  }
})

router.delete('/admin/:id', policyAdminAuth, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM policy_articles WHERE id=?', [req.params.id])
    if (!result.affectedRows) return fail(res, '政策文章不存在', 404)
    return ok(res, null, '政策文章已删除')
  } catch (error) { console.error('[policy-admin-delete]', error); return fail(res, '政策删除失败', 500) }
})

router.get('/:id/comments', async (req, res) => {
  try {
    const viewer = tokenPayload(req)
    const viewerId = viewer && viewer.role === 'farmer' ? Number(viewer.id || 0) : 0
    const [rows] = await db.query(
      `SELECT c.id,c.parent_id,c.content,c.created_at,u.real_name,u.phone,
              COALESCE(likes.like_count,0) AS like_count,
              CASE WHEN viewer_like.user_id IS NULL THEN 0 ELSE 1 END AS viewer_liked
         FROM policy_comments c
         LEFT JOIN users u ON u.id=c.user_id
         LEFT JOIN (
           SELECT comment_id,COUNT(*) AS like_count
             FROM policy_comment_likes GROUP BY comment_id
         ) likes ON likes.comment_id=c.id
         LEFT JOIN policy_comment_likes viewer_like ON viewer_like.comment_id=c.id AND viewer_like.user_id=?
        WHERE c.article_id=? AND c.status='published'
        ORDER BY c.created_at ASC,c.id ASC
        LIMIT 200`,
      [viewerId, req.params.id]
    )
    return ok(res, rows.map(formatComment))
  } catch (error) {
    console.error('[policy-comments-list]', error)
    return fail(res, '评论加载失败', 500)
  }
})

router.post('/:id/comments', userAuth, async (req, res) => {
  const content = String(req.body.content || '').trim().slice(0, 300)
  const requestedParentId = Number.parseInt(req.body.parent_id, 10) || 0
  if (content.length < 2) return fail(res, '评论至少需要2个字')
  try {
    const [[article]] = await db.query("SELECT id FROM policy_articles WHERE id=? AND status='published' LIMIT 1", [req.params.id])
    if (!article) return fail(res, '文章不存在或尚未发布', 404)
    const [[user]] = await db.query("SELECT id,real_name,phone FROM users WHERE id=? AND role='farmer' AND is_active=1 LIMIT 1", [req.viewer.id])
    if (!user) return fail(res, '账号不存在或已停用', 403)
    let parentId = null
    if (requestedParentId) {
      const [[parent]] = await db.query(
        "SELECT id FROM policy_comments WHERE id=? AND article_id=? AND status='published' LIMIT 1",
        [requestedParentId, article.id]
      )
      if (!parent) return fail(res, '要回复的评论不存在', 404)
      parentId = Number(parent.id)
    }
    const [[recent]] = await db.query(
      'SELECT id FROM policy_comments WHERE user_id=? AND created_at>DATE_SUB(NOW(),INTERVAL 15 SECOND) LIMIT 1',
      [req.viewer.id]
    )
    if (recent) return fail(res, '评论发送太频繁，请稍后再试', 429)
    const [result] = await db.query('INSERT INTO policy_comments (article_id,user_id,parent_id,content) VALUES (?,?,?,?)', [article.id, user.id, parentId, content])
    return ok(res, formatComment({ id: result.insertId, parent_id: parentId, content, created_at: new Date(), real_name: user.real_name, phone: user.phone }), parentId ? '回复已发表' : '评论已发表')
  } catch (error) {
    console.error('[policy-comment-create]', error)
    return fail(res, '评论发表失败', 500)
  }
})

router.post('/:id/comments/:commentId/like', userAuth, async (req, res) => {
  try {
    const [[user]] = await db.query(
      "SELECT id FROM users WHERE id=? AND role='farmer' AND is_active=1 LIMIT 1",
      [req.viewer.id]
    )
    if (!user) return fail(res, '账号不存在或已停用', 403)
    const [[comment]] = await db.query(
      "SELECT id FROM policy_comments WHERE id=? AND article_id=? AND status='published' LIMIT 1",
      [req.params.commentId, req.params.id]
    )
    if (!comment) return fail(res, '评论不存在', 404)
    const [[existing]] = await db.query(
      'SELECT comment_id FROM policy_comment_likes WHERE comment_id=? AND user_id=? LIMIT 1',
      [comment.id, req.viewer.id]
    )
    if (existing) {
      await db.query('DELETE FROM policy_comment_likes WHERE comment_id=? AND user_id=?', [comment.id, req.viewer.id])
    } else {
      await db.query('INSERT INTO policy_comment_likes (comment_id,user_id) VALUES (?,?)', [comment.id, req.viewer.id])
    }
    const [[count]] = await db.query('SELECT COUNT(*) AS total FROM policy_comment_likes WHERE comment_id=?', [comment.id])
    return ok(res, { liked: !existing, likeCount: Number(count.total || 0) }, existing ? '已取消点赞' : '已点赞')
  } catch (error) {
    console.error('[policy-comment-like]', error)
    return fail(res, '点赞操作失败', 500)
  }
})

router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await db.query("SELECT * FROM policy_articles WHERE id=? AND status='published' LIMIT 1", [req.params.id])
    if (!row) return fail(res, '政策文章不存在或尚未发布', 404)
    return ok(res, normalize(row, true))
  } catch (error) { console.error('[policy-detail]', error); return fail(res, '政策详情加载失败', 500) }
})

module.exports = router
