const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const db = require('../db/database')

const router = express.Router()
const uploadDir = path.join(__dirname, '../public/uploads/knowledge/expert')
fs.mkdirSync(uploadDir, { recursive: true })

const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const videoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' }
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extensions[file.mimetype] || ''}`)
  }),
  limits: { fileSize: Math.max(10, Number(process.env.KNOWLEDGE_LOCAL_UPLOAD_MAX_MB || 250)) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => (imageTypes.has(file.mimetype) || videoTypes.has(file.mimetype)) ? cb(null, true) : cb(new Error('仅支持 JPG、PNG、WebP、GIF、MP4、WebM 或 MOV 文件'))
})

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
      req.expertAdmin = { id: Number(account.id), type: 'community' }
      return next()
    }
    if (payload.is_admin) {
      const [[account]] = await db.query('SELECT id,is_admin,is_active,admin_auth_version FROM users WHERE id=? LIMIT 1', [payload.id])
      if (!account || !account.is_admin || !account.is_active || Number(account.admin_auth_version || 0) !== Number(payload.auth_version || 0)) return fail(res, '平台管理员登录已失效', 401)
      req.expertAdmin = { id: Number(account.id), type: 'platform' }
      return next()
    }
    return fail(res, '无专家讲堂管理权限', 403)
  } catch (error) {
    console.error('[expert-studio-auth]', error)
    return fail(res, '管理员身份校验失败', 500)
  }
}

function safeUrl(value) {
  const url = String(value || '').trim().slice(0, 500)
  return !url || /^https:\/\//i.test(url) || url.startsWith('/uploads/knowledge/expert/') || url.startsWith('/assets/') ? url : ''
}

function stringList(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/\r?\n|，|,/)
  return source.map(item => String(item).trim()).filter(Boolean).slice(0, 12).map(item => item.slice(0, 60))
}

function normalizeExpert(row) {
  let tags = []
  try { tags = JSON.parse(row.specialties || '[]') } catch {}
  return { id: Number(row.id), name: row.name || '', title: row.title || '', org: row.org || '', avatar: row.avatar || '专', avatarUrl: row.avatar_url || '', tags, bio: row.bio || '', isActive: !!row.is_active, profileOnly: !!row.profile_only, sortOrder: Number(row.sort_order || 0), updatedAt: row.updated_at || null }
}

function normalizeContent(row) {
  let tags = []
  try { tags = JSON.parse(row.expert_tags || '[]') } catch {}
  return { id: Number(row.id), type: row.type, title: row.title || '', subtitle: row.subtitle || '', categoryKey: row.category_key || 'planting', categoryName: row.category_name || '种植技术', expertId: row.expert_id ? Number(row.expert_id) : null, expertName: row.expert_name || row.teacher || '', tags, intro: row.intro || '', content: row.content || '', coverUrl: row.cover_url || '', videoUrl: row.video_url || '', duration: row.duration || '', isPublished: !!row.is_published, isFeatured: !!row.is_featured, sortOrder: Number(row.sort_order || 0), updatedAt: row.updated_at || null }
}

function contentBody(body = {}) {
  const type = body.type === 'qa' ? 'qa' : 'video'
  return { type, title: String(body.title || '').trim().slice(0, 160), subtitle: String(body.subtitle || '').trim().slice(0, 255), categoryKey: String(body.category_key || 'planting').trim().slice(0, 40), categoryName: String(body.category_name || '种植技术').trim().slice(0, 64), expertId: Number(body.expert_id) > 0 ? Number(body.expert_id) : null, intro: String(body.intro || '').trim().slice(0, 4000), content: String(body.content || '').trim().slice(0, 200000), coverUrl: safeUrl(body.cover_url), videoUrl: safeUrl(body.video_url), duration: String(body.duration || '').trim().slice(0, 32), tags: stringList(body.tags), published: body.is_published === true || body.is_published === 1 || body.is_published === '1' ? 1 : 0, featured: body.is_featured === true || body.is_featured === 1 || body.is_featured === '1' ? 1 : 0, sortOrder: Math.max(-9999, Math.min(9999, Number.parseInt(body.sort_order, 10) || 0)) }
}

function normalizePublicContent(row) {
  const item = normalizeContent(row)
  return {
    ...item,
    teacher: row.teacher || row.expert_name || '',
    teacherTitle: row.teacher_title || row.expert_title || '',
    org: row.org || row.expert_org || '',
    expertAvatar: row.expert_avatar || row.profile_avatar || '专',
    expertAvatarUrl: row.profile_avatar_url || '',
    createdAt: row.created_at || null
  }
}

router.get('/public', async (_req, res) => {
  try {
    const [experts] = await db.query(`SELECT id,name,title,org,avatar,avatar_url,specialties,bio,is_active
      FROM experts WHERE is_active=1 ORDER BY sort_order ASC,id DESC LIMIT 100`)
    const [contents] = await db.query(`SELECT ec.*,e.name AS expert_name,e.title AS expert_title,e.org AS expert_org,
      e.avatar AS profile_avatar,e.avatar_url AS profile_avatar_url
      FROM expert_contents ec LEFT JOIN experts e ON e.id=ec.expert_id
      WHERE ec.type IN ('qa','video') AND ec.is_published=1
      ORDER BY ec.is_featured DESC,ec.sort_order ASC,ec.id DESC LIMIT 500`)
    return ok(res, { experts: experts.map(normalizeExpert), contents: contents.map(normalizePublicContent) })
  } catch (error) {
    console.error('[expert-studio-public]', error)
    return fail(res, '专家讲堂内容加载失败', 500)
  }
})

router.get('/public/:id', async (req, res) => {
  try {
    const [[row]] = await db.query(`SELECT ec.*,e.name AS expert_name,e.title AS expert_title,e.org AS expert_org,
      e.avatar AS profile_avatar,e.avatar_url AS profile_avatar_url
      FROM expert_contents ec LEFT JOIN experts e ON e.id=ec.expert_id
      WHERE ec.id=? AND ec.type IN ('qa','video') AND ec.is_published=1 LIMIT 1`, [req.params.id])
    if (!row) return fail(res, '专家讲堂内容不存在或尚未发布', 404)
    return ok(res, normalizePublicContent(row))
  } catch (error) {
    console.error('[expert-studio-public-detail]', error)
    return fail(res, '专家讲堂详情加载失败', 500)
  }
})

router.get('/admin/overview', adminAuth, async (_req, res) => {
  try {
    const [experts] = await db.query('SELECT * FROM experts ORDER BY sort_order ASC,id DESC LIMIT 500')
    const [contents] = await db.query(`SELECT ec.*,e.name AS expert_name FROM expert_contents ec LEFT JOIN experts e ON e.id=ec.expert_id WHERE ec.type IN ('qa','video') ORDER BY ec.type,ec.is_featured DESC,ec.sort_order ASC,ec.id DESC LIMIT 1000`)
    return ok(res, { experts: experts.map(normalizeExpert), contents: contents.map(normalizeContent) })
  } catch (error) { console.error('[expert-studio-overview]', error); return fail(res, '专家讲堂管理数据加载失败', 500) }
})

router.post('/admin/upload', adminAuth, upload.single('file'), (req, res) => {
  if (!req.file) return fail(res, '请选择图片或视频文件')
  return ok(res, { url: `/uploads/knowledge/expert/${req.file.filename}`, mediaType: imageTypes.has(req.file.mimetype) ? 'image' : 'video' }, '文件上传成功')
})

router.post('/admin/experts', adminAuth, async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 64)
  if (!name) return fail(res, '专家姓名不能为空')
  const phone = `P${Date.now().toString().slice(-10)}`
  const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
  try {
    const [result] = await db.query(`INSERT INTO experts (phone,password,name,title,org,avatar,avatar_url,specialties,bio,profile_only,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`, [phone, password, name, String(req.body.title || '').trim().slice(0, 64), String(req.body.org || '').trim().slice(0, 128), String(req.body.avatar || '专').trim().slice(0, 16), safeUrl(req.body.avatar_url), JSON.stringify(stringList(req.body.tags)), String(req.body.bio || '').trim().slice(0, 10000), Number.parseInt(req.body.sort_order, 10) || 0, req.body.is_active === false || req.body.is_active === 0 || req.body.is_active === '0' ? 0 : 1])
    return ok(res, { id: Number(result.insertId) }, '在线专家已创建')
  } catch (error) { console.error('[expert-studio-expert-create]', error); return fail(res, '在线专家保存失败', 500) }
})

router.put('/admin/experts/:id', adminAuth, async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 64)
  if (!name) return fail(res, '专家姓名不能为空')
  try {
    const [result] = await db.query(`UPDATE experts SET name=?,title=?,org=?,avatar=?,avatar_url=?,specialties=?,bio=?,sort_order=?,is_active=? WHERE id=?`, [name, String(req.body.title || '').trim().slice(0, 64), String(req.body.org || '').trim().slice(0, 128), String(req.body.avatar || '专').trim().slice(0, 16), safeUrl(req.body.avatar_url), JSON.stringify(stringList(req.body.tags)), String(req.body.bio || '').trim().slice(0, 10000), Number.parseInt(req.body.sort_order, 10) || 0, req.body.is_active === false || req.body.is_active === 0 || req.body.is_active === '0' ? 0 : 1, req.params.id])
    if (!result.affectedRows) return fail(res, '专家不存在', 404)
    return ok(res, null, '在线专家已更新')
  } catch (error) { console.error('[expert-studio-expert-update]', error); return fail(res, '在线专家更新失败', 500) }
})

router.delete('/admin/experts/:id', adminAuth, async (req, res) => {
  try {
    const [[expert]] = await db.query('SELECT profile_only FROM experts WHERE id=? LIMIT 1', [req.params.id])
    if (!expert) return fail(res, '专家不存在', 404)
    if (!expert.profile_only) return fail(res, '专家登录账号不能在此删除，请改为停用')
    const [[linked]] = await db.query('SELECT COUNT(*) AS total FROM expert_contents WHERE expert_id=?', [req.params.id])
    if (Number(linked.total) > 0) return fail(res, '该专家仍有关联问答或视频，请先调整关联内容')
    await db.query('DELETE FROM experts WHERE id=?', [req.params.id])
    return ok(res, null, '在线专家已删除')
  } catch (error) { console.error('[expert-studio-expert-delete]', error); return fail(res, '在线专家删除失败', 500) }
})

router.post('/admin/contents', adminAuth, async (req, res) => {
  const item = contentBody(req.body)
  if (!item.title || !item.content || (item.type === 'video' && !item.videoUrl)) return fail(res, item.type === 'video' ? '视频标题、正文说明和视频文件不能为空' : '问题标题和答案正文不能为空')
  try {
    const [[expert]] = item.expertId ? await db.query('SELECT name,title,org,avatar,specialties FROM experts WHERE id=? LIMIT 1', [item.expertId]) : [[]]
    const [result] = await db.query(`INSERT INTO expert_contents (type,title,subtitle,category_key,category_name,teacher,teacher_title,org,expert_avatar,expert_tags,intro,content,cover_url,video_url,duration,price_type,price,sort_order,is_published,expert_id,is_featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`, [item.type,item.title,item.subtitle,item.categoryKey,item.categoryName,expert?.name||'',expert?.title||'',expert?.org||'',expert?.avatar||'专',expert?.specialties||JSON.stringify(item.tags),item.intro,item.content,item.coverUrl,item.videoUrl,item.duration,'free',item.sortOrder,item.published,item.expertId,item.featured])
    return ok(res, { id: Number(result.insertId) }, item.published ? '内容已同步发布到小程序和网页端' : '草稿已保存')
  } catch (error) { console.error('[expert-studio-content-create]', error); return fail(res, '专家内容保存失败', 500) }
})

router.put('/admin/contents/:id', adminAuth, async (req, res) => {
  const item = contentBody(req.body)
  if (!item.title || !item.content || (item.type === 'video' && !item.videoUrl)) return fail(res, item.type === 'video' ? '视频标题、正文说明和视频文件不能为空' : '问题标题和答案正文不能为空')
  try {
    const [[expert]] = item.expertId ? await db.query('SELECT name,title,org,avatar,specialties FROM experts WHERE id=? LIMIT 1', [item.expertId]) : [[]]
    const [result] = await db.query(`UPDATE expert_contents SET type=?,title=?,subtitle=?,category_key=?,category_name=?,teacher=?,teacher_title=?,org=?,expert_avatar=?,expert_tags=?,intro=?,content=?,cover_url=?,video_url=?,duration=?,price_type='free',price=0,sort_order=?,is_published=?,expert_id=?,is_featured=? WHERE id=?`, [item.type,item.title,item.subtitle,item.categoryKey,item.categoryName,expert?.name||'',expert?.title||'',expert?.org||'',expert?.avatar||'专',expert?.specialties||JSON.stringify(item.tags),item.intro,item.content,item.coverUrl,item.videoUrl,item.duration,item.sortOrder,item.published,item.expertId,item.featured,req.params.id])
    if (!result.affectedRows) return fail(res, '内容不存在', 404)
    return ok(res, null, item.published ? '内容已更新并发布' : '草稿已更新')
  } catch (error) { console.error('[expert-studio-content-update]', error); return fail(res, '专家内容更新失败', 500) }
})

router.delete('/admin/contents/:id', adminAuth, async (req, res) => {
  try { const [result] = await db.query("DELETE FROM expert_contents WHERE id=? AND type IN ('qa','video')", [req.params.id]); if (!result.affectedRows) return fail(res, '内容不存在', 404); return ok(res, null, '内容已删除') } catch (error) { console.error('[expert-studio-content-delete]', error); return fail(res, '内容删除失败', 500) }
})

module.exports = router
