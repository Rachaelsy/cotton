const express = require('express')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const querystring = require('querystring')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const JWT_SECRET = process.env.JWT_SECRET
const LEVELS = new Set(['basic', 'intermediate', 'advanced'])
const TYPES = new Set(['video', 'article'])
const STATUSES = new Set(['draft', 'published', 'offline'])

function tokenPayload(req) {
  const auth = String(req.headers.authorization || '')
  if (!auth.startsWith('Bearer ')) return null
  try { return jwt.verify(auth.slice(7), JWT_SECRET) } catch { return null }
}

async function adminAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload || (!payload.is_admin && !payload.is_community_admin)) return fail(res, '管理员登录已过期', 401)
  try {
    if (payload.is_community_admin) {
      const [[account]] = await db.query('SELECT is_active,auth_version,permission_key FROM community_admins WHERE id=? LIMIT 1', [payload.id])
      const allowed = account && account.is_active && ['public_admin', 'policy_editor'].includes(String(account.permission_key || ''))
      if (!allowed || Number(payload.auth_version || 0) !== Number(account.auth_version || 0)) {
        return fail(res, '公共服务管理员登录状态已失效', 401)
      }
      req.admin = payload
      return next()
    }
    const [[account]] = await db.query('SELECT is_admin,is_active,admin_auth_version FROM users WHERE id=? LIMIT 1', [payload.id])
    if (!account || !account.is_admin || !account.is_active || Number(payload.auth_version || 0) !== Number(account.admin_auth_version || 0)) {
      return fail(res, '管理员登录状态已失效', 401)
    }
    req.admin = payload
    next()
  } catch (error) {
    console.error('[academy-admin-auth]', error)
    return fail(res, '管理员身份校验失败', 500)
  }
}

function farmerAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload || !payload.id || payload.role !== 'farmer') return fail(res, '请先登录后参与评论', 401)
  req.viewer = payload
  next()
}

function parseList(value, max = 8) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, max)
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean).slice(0, max)
  } catch {}
  return String(value).split(/[，,\n]/).map(item => item.trim()).filter(Boolean).slice(0, max)
}

function safeUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  return url.startsWith('/uploads/') || url.startsWith('/assets/') || /^https:\/\//i.test(url) ? url.slice(0, 500) : ''
}

function durationText(seconds) {
  const value = Math.max(1, Number(seconds || 60))
  if (value < 60) return `${value}秒`
  const minutes = Math.floor(value / 60)
  return value % 60 ? `${minutes}分${value % 60}秒` : `${minutes}分钟`
}

function vodConfig() {
  const appId = String(process.env.VOD_APP_ID || '').trim()
  const subAppId = String(process.env.VOD_SUB_APP_ID || '').trim()
  const secretId = String(process.env.VOD_SECRET_ID || process.env.TENCENT_SECRET_ID || '').trim()
  const secretKey = String(process.env.VOD_SECRET_KEY || process.env.TENCENT_SECRET_KEY || '').trim()
  const procedure = String(process.env.VOD_PROCEDURE_NAME || '').trim()
  const storageRegion = String(process.env.VOD_STORAGE_REGION || '').trim()
  return {
    appId, subAppId, secretId, secretKey, procedure, storageRegion,
    configured: Boolean(appId && secretId && secretKey)
  }
}

function vodUploadSignature(sourceContext = '') {
  const config = vodConfig()
  if (!config.configured) return ''
  const now = Math.floor(Date.now() / 1000)
  const params = {
    secretId: config.secretId,
    currentTimeStamp: now,
    expireTime: now + 10 * 60,
    random: crypto.randomInt(1, 2147483647)
  }
  if (config.subAppId) params.vodSubAppId = config.subAppId
  if (config.procedure) params.procedure = config.procedure
  if (config.storageRegion) params.storageRegion = config.storageRegion
  if (sourceContext) params.sourceContext = String(sourceContext).replace(/[^a-zA-Z0-9_.:-]/g, '-').slice(0, 200)
  const original = querystring.stringify(params)
  const digest = crypto.createHmac('sha1', config.secretKey).update(original).digest()
  return Buffer.concat([digest, Buffer.from(original)]).toString('base64')
}

function coursePayload(body = {}) {
  const rawKey = String(body.courseKey || body.course_key || '').trim().toLowerCase()
  return {
    courseKey: rawKey.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80),
    seriesKey: String(body.seriesKey || body.series_key || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80),
    lessonNo: Math.max(1, Math.min(999, Number.parseInt(body.lessonNo || body.lesson_no, 10) || 1)),
    level: LEVELS.has(body.level) ? body.level : 'basic',
    type: TYPES.has(body.type) ? body.type : 'video',
    title: String(body.title || '').trim().slice(0, 160),
    summary: String(body.summary || '').trim().slice(0, 1000),
    teacher: String(body.teacher || '平台农技组').trim().slice(0, 100),
    teacherTitle: String(body.teacherTitle || body.teacher_title || '棉花栽培课程').trim().slice(0, 120),
    coverUrl: safeUrl(body.coverUrl || body.cover_url),
    coverObjectKey: String(body.coverObjectKey || body.cover_object_key || '').trim().slice(0, 500),
    videoUrl: safeUrl(body.videoUrl || body.video_url),
    videoObjectKey: String(body.videoObjectKey || body.video_object_key || '').trim().slice(0, 500),
    vodFileId: String(body.vodFileId || body.vod_file_id || '').trim().replace(/[^0-9]/g, '').slice(0, 64),
    vodStatus: ['none','ready','processing','failed'].includes(body.vodStatus || body.vod_status) ? (body.vodStatus || body.vod_status) : 'none',
    durationSeconds: Math.max(1, Math.min(86400, Number.parseInt(body.durationSeconds || body.duration_seconds, 10) || 60)),
    objectivesJson: JSON.stringify(parseList(body.objectives)),
    status: STATUSES.has(body.status) ? body.status : 'draft',
    featured: body.isFeatured === true || Number(body.isFeatured || body.is_featured) === 1 ? 1 : 0,
    sortOrder: Math.max(-99999, Math.min(99999, Number.parseInt(body.sortOrder || body.sort_order, 10) || 0))
  }
}

function courseView(row, admin = false) {
  const cover = row.cover_url
  const videoUrl = row.video_url
  const data = {
    id: row.course_key,
    databaseId: Number(row.id),
    seriesKey: row.series_key || '',
    seriesTitle: row.series_title || '',
    lessonNo: Number(row.lesson_no || 1),
    level: row.level,
    type: row.type === 'video' ? '视频' : '图文',
    rawType: row.type,
    order: Number(row.sort_order || 0) % 100 || 1,
    title: row.title,
    summary: row.summary || '',
    teacher: row.teacher || '平台农技组',
    role: row.teacher_title || '',
    cover: cover || '',
    videoUrl: videoUrl || '',
    duration: durationText(row.duration_seconds),
    durationSeconds: Number(row.duration_seconds || 0),
    objectives: parseList(row.objectives_json),
    status: row.status,
    isFeatured: Boolean(row.is_featured),
    sortOrder: Number(row.sort_order || 0),
    viewCount: Number(row.view_count || 0),
    updatedAt: row.updated_at
  }
  if (admin) Object.assign(data, {
    coverUrl: row.cover_url || '', videoRawUrl: row.video_url || '',
    coverObjectKey: row.cover_object_key || '', videoObjectKey: row.video_object_key || '',
    vodFileId: row.vod_file_id || '', vodStatus: row.vod_status || 'none'
  })
  return data
}

function seriesView(row) {
  return {
    id: row.series_key,
    databaseId: Number(row.id),
    level: row.level,
    title: row.title,
    summary: row.summary || '',
    teacher: row.teacher || '平台农技组',
    cover: row.cover_url || '',
    lessonCount: Number(row.lesson_count || 0),
    totalSeconds: Number(row.total_seconds || 0),
    isFeatured: Boolean(row.is_featured),
    sortOrder: Number(row.sort_order || 0)
  }
}

async function ensurePublishedCourse(req, res, next) {
  try {
    const [[course]] = await db.query("SELECT id FROM academy_courses WHERE course_key=? AND status='published' LIMIT 1", [req.params.courseId])
    if (!course) return fail(res, '课程不存在', 404)
    next()
  } catch (error) {
    console.error('[academy-course-check]', error)
    return fail(res, '课程校验失败', 500)
  }
}

router.get('/courses', async (req, res) => {
  try {
    const params = []
    let where = "status='published'"
    if (LEVELS.has(req.query.level)) { where += ' AND level=?'; params.push(req.query.level) }
    const [rows] = await db.query(`SELECT * FROM academy_courses WHERE ${where} ORDER BY sort_order,id`, params)
    return ok(res, rows.map(row => courseView(row)))
  } catch (error) {
    console.error('[academy-course-list]', error)
    return fail(res, '课程加载失败', 500)
  }
})

router.get('/series', async (req, res) => {
  const level = LEVELS.has(req.query.level) ? req.query.level : ''
  try {
    const params = []
    const where = ["s.status='published'"]
    if (level) { where.push('s.level=?'); params.push(level) }
    const [rows] = await db.query(
      `SELECT s.*,COUNT(c.id) lesson_count,COALESCE(SUM(c.duration_seconds),0) total_seconds
         FROM academy_series s
         LEFT JOIN academy_courses c ON c.series_key=s.series_key AND c.status='published'
        WHERE ${where.join(' AND ')}
        GROUP BY s.id ORDER BY s.sort_order,s.id`,
      params
    )
    return ok(res, rows.map(seriesView))
  } catch (error) { console.error('[academy-series-list]', error); return fail(res, '系列课程加载失败', 500) }
})

router.get('/series/:seriesKey', async (req, res) => {
  try {
    const [[series]] = await db.query("SELECT * FROM academy_series WHERE series_key=? AND status='published' LIMIT 1", [req.params.seriesKey])
    if (!series) return fail(res, '系列课程不存在', 404)
    const [lessons] = await db.query("SELECT * FROM academy_courses WHERE series_key=? AND status='published' ORDER BY lesson_no,sort_order,id", [req.params.seriesKey])
    const data = seriesView({ ...series, lesson_count: lessons.length, total_seconds: lessons.reduce((sum, item) => sum + Number(item.duration_seconds || 0), 0) })
    data.lessons = lessons.map(item => courseView({ ...item, series_title: series.title }))
    return ok(res, data)
  } catch (error) { console.error('[academy-series-detail]', error); return fail(res, '课程目录加载失败', 500) }
})

router.get('/courses/:courseId', async (req, res) => {
  try {
    const [[row]] = await db.query("SELECT c.*,s.title series_title FROM academy_courses c LEFT JOIN academy_series s ON s.series_key=c.series_key WHERE c.course_key=? AND c.status='published' LIMIT 1", [req.params.courseId])
    if (!row) return fail(res, '课程不存在', 404)
    await db.query('UPDATE academy_courses SET view_count=view_count+1 WHERE id=?', [row.id])
    row.view_count = Number(row.view_count || 0) + 1
    return ok(res, courseView(row))
  } catch (error) {
    console.error('[academy-course-detail]', error)
    return fail(res, '课程加载失败', 500)
  }
})

function displayName(row) {
  const name = String(row.nickname || row.real_name || '').trim()
  const phone = String(row.phone || '')
  return name || (phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '棉农用户')
}

router.get('/courses/:courseId/comments', ensurePublishedCourse, async (req, res) => {
  const viewer = tokenPayload(req)
  const viewerId = viewer && viewer.role === 'farmer' ? Number(viewer.id || 0) : 0
  try {
    const [rows] = await db.query(
      `SELECT c.id,c.parent_id,c.content,c.created_at,u.nickname,u.real_name,u.phone,
              COALESCE(pu.nickname,pu.real_name,CASE WHEN CHAR_LENGTH(pu.phone)>=7 THEN CONCAT(LEFT(pu.phone,3),'****',RIGHT(pu.phone,4)) ELSE '' END) parent_author,
              COALESCE(l.like_count,0) like_count,CASE WHEN vl.user_id IS NULL THEN 0 ELSE 1 END viewer_liked
         FROM academy_comments c LEFT JOIN users u ON u.id=c.user_id
         LEFT JOIN academy_comments pc ON pc.id=c.parent_id AND pc.status='visible' LEFT JOIN users pu ON pu.id=pc.user_id
         LEFT JOIN (SELECT comment_id,COUNT(*) like_count FROM academy_comment_likes GROUP BY comment_id) l ON l.comment_id=c.id
         LEFT JOIN academy_comment_likes vl ON vl.comment_id=c.id AND vl.user_id=?
        WHERE c.course_id=? AND c.status='visible' ORDER BY c.created_at DESC,c.id DESC LIMIT 200`,
      [viewerId, req.params.courseId]
    )
    return ok(res, rows.map(row => ({
      id: Number(row.id), parentId: row.parent_id ? Number(row.parent_id) : null,
      parentAuthor: row.parent_author || '', content: row.content || '', author: displayName(row), avatarUrl: '',
      createdAt: row.created_at, likeCount: Number(row.like_count || 0), liked: Boolean(row.viewer_liked)
    })))
  } catch (error) {
    console.error('[academy-comments-list]', error)
    return fail(res, '评论加载失败', 500)
  }
})

router.post('/courses/:courseId/comments', farmerAuth, ensurePublishedCourse, async (req, res) => {
  const content = String(req.body.content || '').trim().slice(0, 500)
  const requestedParentId = Number.parseInt(req.body.parentId, 10) || null
  if (content.length < 2) return fail(res, '评论至少需要2个字')
  try {
    let parentId = null
    if (requestedParentId) {
      const [[parent]] = await db.query("SELECT id FROM academy_comments WHERE id=? AND course_id=? AND status='visible'", [requestedParentId, req.params.courseId])
      if (!parent) return fail(res, '要回复的评论不存在', 404)
      parentId = Number(parent.id)
    }
    const [[recent]] = await db.query('SELECT id FROM academy_comments WHERE user_id=? AND created_at>DATE_SUB(NOW(),INTERVAL 10 SECOND)', [req.viewer.id])
    if (recent) return fail(res, '评论发送太频繁，请稍后再试', 429)
    const [result] = await db.query('INSERT INTO academy_comments (course_id,user_id,parent_id,content) VALUES (?,?,?,?)', [req.params.courseId, req.viewer.id, parentId, content])
    return ok(res, { id: Number(result.insertId) }, parentId ? '回复已发表' : '评论已发表')
  } catch (error) {
    console.error('[academy-comment-create]', error)
    return fail(res, '评论发表失败', 500)
  }
})

router.post('/courses/:courseId/comments/:commentId/like', farmerAuth, ensurePublishedCourse, async (req, res) => {
  try {
    const [[comment]] = await db.query("SELECT id FROM academy_comments WHERE id=? AND course_id=? AND status='visible'", [req.params.commentId, req.params.courseId])
    if (!comment) return fail(res, '评论不存在', 404)
    const [[liked]] = await db.query('SELECT comment_id FROM academy_comment_likes WHERE comment_id=? AND user_id=?', [comment.id, req.viewer.id])
    if (liked) await db.query('DELETE FROM academy_comment_likes WHERE comment_id=? AND user_id=?', [comment.id, req.viewer.id])
    else await db.query('INSERT INTO academy_comment_likes (comment_id,user_id) VALUES (?,?)', [comment.id, req.viewer.id])
    const [[count]] = await db.query('SELECT COUNT(*) total FROM academy_comment_likes WHERE comment_id=?', [comment.id])
    return ok(res, { liked: !liked, likeCount: Number(count.total || 0) })
  } catch (error) {
    console.error('[academy-comment-like]', error)
    return fail(res, '操作失败', 500)
  }
})

router.get('/admin/courses', adminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT c.*,s.title series_title FROM academy_courses c LEFT JOIN academy_series s ON s.series_key=c.series_key ORDER BY c.sort_order,c.id')
    return ok(res, rows.map(row => courseView(row, true)))
  } catch (error) { console.error('[academy-admin-list]', error); return fail(res, '课程加载失败', 500) }
})

router.get('/admin/series', adminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query(`SELECT s.*,COUNT(c.id) lesson_count,COALESCE(SUM(c.duration_seconds),0) total_seconds FROM academy_series s LEFT JOIN academy_courses c ON c.series_key=s.series_key GROUP BY s.id ORDER BY s.sort_order,s.id`)
    return ok(res, rows.map(seriesView))
  } catch (error) { console.error('[academy-admin-series]', error); return fail(res, '系列课程加载失败', 500) }
})

router.post('/admin/courses', adminAuth, async (req, res) => {
  const data = coursePayload(req.body)
  if (!data.courseKey || !data.title || !data.seriesKey) return fail(res, '请选择系列课程并填写课程标识和标题')
  if (data.type === 'video' && data.status === 'published' && !data.videoUrl) return fail(res, '视频课程上架前请先上传到云点播')
  try {
    const [result] = await db.query(
      `INSERT INTO academy_courses
       (course_key,series_key,lesson_no,level,type,title,summary,teacher,teacher_title,cover_url,cover_object_key,video_url,video_object_key,vod_file_id,vod_status,duration_seconds,objectives_json,status,is_featured,sort_order,created_by,published_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?='published',NOW(),NULL))`,
      [data.courseKey,data.seriesKey,data.lessonNo,data.level,data.type,data.title,data.summary,data.teacher,data.teacherTitle,data.coverUrl,'',data.videoUrl,'',data.vodFileId,data.vodStatus,data.durationSeconds,data.objectivesJson,data.status,data.featured,data.sortOrder,req.admin.id,data.status]
    )
    return ok(res, { id: Number(result.insertId) }, '课程已创建')
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') return fail(res, '课程标识已存在')
    console.error('[academy-admin-create]', error); return fail(res, '课程保存失败', 500)
  }
})

router.put('/admin/courses/:id', adminAuth, async (req, res) => {
  const data = coursePayload(req.body)
  if (!data.courseKey || !data.title || !data.seriesKey) return fail(res, '请选择系列课程并填写课程标识和标题')
  if (data.type === 'video' && data.status === 'published' && !data.videoUrl) return fail(res, '视频课程上架前请先上传到云点播')
  try {
    const [result] = await db.query(
      `UPDATE academy_courses SET course_key=?,series_key=?,lesson_no=?,level=?,type=?,title=?,summary=?,teacher=?,teacher_title=?,cover_url=?,cover_object_key='',video_url=?,video_object_key='',vod_file_id=?,vod_status=?,duration_seconds=?,objectives_json=?,status=?,is_featured=?,sort_order=?,published_at=IF(?='published',COALESCE(published_at,NOW()),published_at) WHERE id=?`,
      [data.courseKey,data.seriesKey,data.lessonNo,data.level,data.type,data.title,data.summary,data.teacher,data.teacherTitle,data.coverUrl,data.videoUrl,data.vodFileId,data.vodStatus,data.durationSeconds,data.objectivesJson,data.status,data.featured,data.sortOrder,data.status,req.params.id]
    )
    if (!result.affectedRows) return fail(res, '课程不存在', 404)
    return ok(res, null, '课程已保存')
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') return fail(res, '课程标识已存在')
    console.error('[academy-admin-update]', error); return fail(res, '课程保存失败', 500)
  }
})

router.patch('/admin/courses/:id/status', adminAuth, async (req, res) => {
  const status = STATUSES.has(req.body.status) ? req.body.status : 'draft'
  try {
    if (status === 'published') {
      const [[course]] = await db.query('SELECT type,video_url FROM academy_courses WHERE id=?', [req.params.id])
      if (!course) return fail(res, '课程不存在', 404)
      if (course.type === 'video' && !course.video_url) return fail(res, '请先上传到云点播再上架')
    }
    const [result] = await db.query("UPDATE academy_courses SET status=?,published_at=IF(?='published',COALESCE(published_at,NOW()),published_at) WHERE id=?", [status,status,req.params.id])
    if (!result.affectedRows) return fail(res, '课程不存在', 404)
    return ok(res, null, status === 'published' ? '课程已上架' : '课程已下架')
  } catch (error) { console.error('[academy-admin-status]', error); return fail(res, '状态更新失败', 500) }
})

router.delete('/admin/courses/:id', adminAuth, async (req, res) => {
  try {
    const [[course]] = await db.query('SELECT course_key FROM academy_courses WHERE id=?', [req.params.id])
    if (!course) return fail(res, '课程不存在', 404)
    await db.query('DELETE FROM academy_comment_likes WHERE comment_id IN (SELECT id FROM academy_comments WHERE course_id=?)', [course.course_key])
    await db.query('DELETE FROM academy_comments WHERE course_id=?', [course.course_key])
    await db.query('DELETE FROM academy_courses WHERE id=?', [req.params.id])
    return ok(res, null, '课程已删除；云点播媒资未自动删除')
  } catch (error) { console.error('[academy-admin-delete]', error); return fail(res, '课程删除失败', 500) }
})

router.get('/admin/storage', adminAuth, (_req, res) => {
  const config = vodConfig()
  return ok(res, {
    provider: 'vod', configured: config.configured, appId: config.appId,
    subAppId: config.subAppId, procedure: config.procedure,
    storageRegion: config.storageRegion, localFallback: false
  })
})

router.post('/admin/upload-signature', adminAuth, (req, res) => {
  const config = vodConfig()
  if (!config.configured) return fail(res, '云点播尚未配置，请先设置 VOD_APP_ID、VOD_SECRET_ID 和 VOD_SECRET_KEY', 503)
  const courseKey = String(req.body.courseKey || 'new-course').trim().slice(0, 80)
  const signature = vodUploadSignature(`academy:${courseKey}:admin-${req.admin.id}`)
  return ok(res, {
    signature,
    appId: Number(config.appId),
    subAppId: config.subAppId ? Number(config.subAppId) : null,
    expiresIn: 600
  })
})

router.get('/admin/comments', adminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id,c.course_id,c.content,c.status,c.created_at,u.nickname,u.real_name,u.phone,ac.title course_title
         FROM academy_comments c LEFT JOIN users u ON u.id=c.user_id LEFT JOIN academy_courses ac ON ac.course_key=c.course_id
        ORDER BY c.id DESC LIMIT 500`
    )
    return ok(res, rows.map(row => ({ ...row, author: displayName(row) })))
  } catch (error) { console.error('[academy-admin-comments]', error); return fail(res, '评论加载失败', 500) }
})

router.patch('/admin/comments/:id/status', adminAuth, async (req, res) => {
  const status = req.body.status === 'visible' ? 'visible' : 'hidden'
  try {
    const [result] = await db.query('UPDATE academy_comments SET status=? WHERE id=?', [status, req.params.id])
    if (!result.affectedRows) return fail(res, '评论不存在', 404)
    return ok(res, null, '评论状态已更新')
  } catch (error) { console.error('[academy-admin-comment-status]', error); return fail(res, '操作失败', 500) }
})

module.exports = router
