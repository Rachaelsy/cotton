const express = require('express')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const JWT_SECRET = process.env.JWT_SECRET
const LEVELS = new Set(['basic', 'intermediate', 'advanced'])
const TYPES = new Set(['video', 'article'])
const STATUSES = new Set(['draft', 'published', 'offline'])
const LEARNING_POINTS = { basic: 5, intermediate: 8, advanced: 10 }

function tokenPayload(req) {
  const auth = String(req.headers.authorization || '')
  if (!auth.startsWith('Bearer ')) return null
  try { return jwt.verify(auth.slice(7), JWT_SECRET) } catch { return null }
}

function academyViewer(req) {
  const payload = tokenPayload(req)
  return payload && payload.id && payload.role === 'farmer' ? payload : null
}

function canAccessLevel(req, level) {
  return level === 'basic' || Boolean(academyViewer(req))
}

function requireLevelAccess(req, res, level) {
  if (canAccessLevel(req, level)) return true
  fail(res, '中级和高级课程需登录后学习', 401)
  return false
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
    feedToken: String(body.feedToken || body.feed_token || '').trim().slice(0, 1000),
    durationSeconds: Math.max(1, Math.min(86400, Number.parseInt(body.durationSeconds || body.duration_seconds, 10) || 60)),
    objectivesJson: JSON.stringify(parseList(body.objectives)),
    status: STATUSES.has(body.status) ? body.status : 'draft',
    featured: body.isFeatured === true || Number(body.isFeatured || body.is_featured) === 1 ? 1 : 0,
    sortOrder: Math.max(-99999, Math.min(99999, Number.parseInt(body.sortOrder || body.sort_order, 10) || 0))
  }
}

function generatedCourseKey() {
  return `course-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`
}

function seriesPayload(body = {}) {
  const rawKey = String(body.seriesKey || body.series_key || '').trim().toLowerCase()
  return {
    seriesKey: rawKey.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80),
    level: LEVELS.has(body.level) ? body.level : 'basic',
    title: String(body.title || '').trim().slice(0, 160),
    summary: String(body.summary || '').trim().slice(0, 1000),
    teacher: String(body.teacher || '平台农技组').trim().slice(0, 100),
    coverUrl: safeUrl(body.coverUrl || body.cover_url),
    status: STATUSES.has(body.status) ? body.status : 'draft',
    featured: body.isFeatured === true || Number(body.isFeatured || body.is_featured) === 1 ? 1 : 0,
    sortOrder: Math.max(-99999, Math.min(99999, Number.parseInt(body.sortOrder || body.sort_order, 10) || 0))
  }
}

function courseView(row, admin = false) {
  const cover = row.cover_url
  const data = {
    id: row.course_key,
    databaseId: Number(row.id),
    seriesKey: row.series_key || '',
    seriesTitle: row.series_title || '',
    lessonNo: Number(row.lesson_no || 1),
    level: row.level,
    requiresLogin: row.level !== 'basic',
    type: row.type === 'quiz' ? '小测验' : row.type === 'video' ? '视频' : '图文',
    rawType: row.type,
    order: Number(row.sort_order || 0) % 100 || 1,
    title: row.title,
    summary: row.summary || '',
    teacher: row.teacher || '平台农技组',
    role: row.teacher_title || '',
    cover: cover || '',
    feedToken: row.feed_token || '',
    duration: row.type === 'quiz' ? `${JSON.parse(row.quiz_json || '{"questions":[]}').questions.length} 题` : durationText(row.duration_seconds),
    durationSeconds: Number(row.duration_seconds || 0),
    objectives: parseList(row.objectives_json),
    status: row.status,
    isFeatured: Boolean(row.is_featured),
    sortOrder: Number(row.sort_order || 0),
    viewCount: Number(row.view_count || 0),
    updatedAt: row.updated_at
  }
  if (admin) Object.assign(data, {
    coverUrl: row.cover_url || '',
    coverObjectKey: row.cover_object_key || ''
  })
  return data
}

function seriesView(row) {
  return {
    id: row.series_key,
    databaseId: Number(row.id),
    level: row.level,
    requiresLogin: row.level !== 'basic',
    title: row.title,
    summary: row.summary || '',
    teacher: row.teacher || '平台农技组',
    cover: row.cover_url || '',
    status: row.status || 'draft',
    lessonCount: Number(row.lesson_count || 0),
    totalSeconds: Number(row.total_seconds || 0),
    isFeatured: Boolean(row.is_featured),
    sortOrder: Number(row.sort_order || 0)
  }
}

async function ensurePublishedCourse(req, res, next) {
  try {
    const [[course]] = await db.query("SELECT c.id,c.level FROM academy_courses c JOIN academy_series s ON s.series_key=c.series_key WHERE c.course_key=? AND c.status='published' AND s.status='published' LIMIT 1", [req.params.courseId])
    if (!course) return fail(res, '课程不存在', 404)
    if (!requireLevelAccess(req, res, course.level)) return
    next()
  } catch (error) {
    console.error('[academy-course-check]', error)
    return fail(res, '课程校验失败', 500)
  }
}

router.get('/courses', async (req, res) => {
  try {
    const params = []
    let where = "c.status='published' AND s.status='published'"
    const viewer = academyViewer(req)
    if (LEVELS.has(req.query.level) && req.query.level !== 'basic' && !viewer) {
      return fail(res, '中级和高级课程需登录后学习', 401)
    }
    if (LEVELS.has(req.query.level)) { where += ' AND c.level=?'; params.push(req.query.level) }
    else if (!viewer) { where += " AND c.level='basic'" }
    const [rows] = await db.query(`SELECT c.* FROM academy_courses c JOIN academy_series s ON s.series_key=c.series_key WHERE ${where} ORDER BY c.lesson_no,c.sort_order,c.id`, params)
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
    const viewer = academyViewer(req)
    if (level && level !== 'basic' && !viewer) {
      return fail(res, '中级和高级课程需登录后学习', 401)
    }
    if (level) { where.push('s.level=?'); params.push(level) }
    else if (!viewer) where.push("s.level='basic'")
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
    if (!requireLevelAccess(req, res, series.level)) return
    const [lessons] = await db.query("SELECT * FROM academy_courses WHERE series_key=? AND status='published' ORDER BY lesson_no,sort_order,id", [req.params.seriesKey])
    const data = seriesView({ ...series, lesson_count: lessons.length, total_seconds: lessons.reduce((sum, item) => sum + Number(item.duration_seconds || 0), 0) })
    data.lessons = lessons.map(item => courseView({ ...item, series_title: series.title }))
    return ok(res, data)
  } catch (error) { console.error('[academy-series-detail]', error); return fail(res, '课程目录加载失败', 500) }
})

router.get('/courses/:courseId', async (req, res) => {
  try {
    const [[row]] = await db.query("SELECT c.*,s.title series_title FROM academy_courses c JOIN academy_series s ON s.series_key=c.series_key WHERE c.course_key=? AND c.status='published' AND s.status='published' LIMIT 1", [req.params.courseId])
    if (!row) return fail(res, '课程不存在', 404)
    if (!requireLevelAccess(req, res, row.level)) return
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

router.get('/progress', farmerAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT course_key,completed_at,updated_at FROM academy_progress WHERE user_id=? AND completed_at IS NOT NULL', [req.viewer.id])
    return ok(res, rows)
  } catch (error) { return fail(res, '学习记录加载失败', 500) }
})

router.post('/courses/:courseId/complete', farmerAuth, ensurePublishedCourse, async (req, res) => {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [[course]] = await connection.query(
      `SELECT c.level FROM academy_courses c JOIN academy_series s ON s.series_key=c.series_key
       WHERE c.course_key=? AND c.type!='quiz' AND c.status='published' AND s.status='published' LIMIT 1 FOR UPDATE`,
      [req.params.courseId]
    )
    if (!course) { await connection.rollback(); return fail(res, '课程已下架或不存在', 404) }
    const [[existing]] = await connection.query(
      'SELECT completed_at FROM academy_progress WHERE user_id=? AND course_key=? FOR UPDATE',
      [req.viewer.id, req.params.courseId]
    )
    await connection.query(
      'INSERT IGNORE INTO academy_progress(user_id,course_key,completed_at) VALUES (?,?,NOW())',
      [req.viewer.id, req.params.courseId]
    )
    if (existing && !existing.completed_at) await connection.query(
      'UPDATE academy_progress SET completed_at=NOW() WHERE user_id=? AND course_key=?',
      [req.viewer.id, req.params.courseId]
    )
    let awardedPoints = 0
    if (!existing || !existing.completed_at) {
      const points = LEARNING_POINTS[course.level] || 5
      const [award] = await connection.query(
        `INSERT IGNORE INTO academy_learning_points(user_id,course_key,points,reason) VALUES (?,?,?,'首次标记完成课时')`,
        [req.viewer.id, req.params.courseId, points]
      )
      if (award.affectedRows) awardedPoints = points
    }
    const [[total]] = await connection.query('SELECT COALESCE(SUM(points),0) total FROM academy_learning_points WHERE user_id=?', [req.viewer.id])
    await connection.commit()
    return ok(res, { completed: true, awardedPoints, totalPoints: Number(total.total || 0) })
  } catch (error) {
    await connection.rollback()
    console.error('[academy-complete]', error)
    return fail(res, '课时完成状态保存失败', 500)
  } finally { connection.release() }
})

router.get('/learning', farmerAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.course_key,p.completed_at,p.updated_at,
              c.title,c.summary,c.cover_url,c.duration_seconds,c.lesson_no,c.level,c.series_key,
              s.title series_title,s.cover_url series_cover,s.summary series_summary,
              (SELECT COUNT(*) FROM academy_courses tc WHERE tc.series_key=c.series_key AND tc.status='published' AND tc.type!='quiz') series_course_count,
              (SELECT COUNT(*) FROM academy_courses tq WHERE tq.series_key=c.series_key AND tq.status='published' AND tq.type='quiz') series_quiz_count,
              COALESCE(lp.points,0) earned_points
         FROM academy_progress p
         JOIN academy_courses c ON c.course_key=p.course_key
         LEFT JOIN academy_series s ON s.series_key=c.series_key
         LEFT JOIN academy_learning_points lp ON lp.user_id=p.user_id AND lp.course_key=p.course_key
        WHERE p.user_id=? AND p.completed_at IS NOT NULL
        ORDER BY p.updated_at DESC`,
      [req.viewer.id]
    )
    const seriesMap = new Map()
    for (const row of rows) {
      const key = row.series_key || `course:${row.course_key}`
      if (!seriesMap.has(key)) seriesMap.set(key, {
        id: key, title: row.series_title || row.title, cover: row.series_cover || row.cover_url || '',
        summary: row.series_summary || '', level: row.level, courses: [], learnedCount: 0,
        completedCount: 0, totalCount: Number(row.series_course_count || 1), quizCount: Number(row.series_quiz_count || 0), points: 0, totalPercent: 0, updatedAt: row.updated_at
      })
      const group = seriesMap.get(key)
      const course = {
        id: row.course_key, title: row.title, cover: row.cover_url || '', lessonNo: Number(row.lesson_no || 1),
        durationSeconds: Number(row.duration_seconds || 0), completed: Boolean(row.completed_at), points: Number(row.earned_points || 0),
        updatedAt: row.updated_at
      }
      group.courses.push(course)
      group.learnedCount += 1
      group.completedCount += course.completed ? 1 : 0
      group.points += course.points
    }
    const viewerQuizRows = await db.query(`SELECT c.series_key,c.level,s.title,s.cover_url,s.summary,
      MAX(a.submitted_at) updated_at,COUNT(DISTINCT CASE WHEN a.passed=1 AND c.status='published' THEN c.course_key END) passed_count,
      (SELECT COUNT(*) FROM academy_courses q WHERE q.series_key=c.series_key AND q.type='quiz' AND q.status='published') quiz_count,
      (SELECT COUNT(*) FROM academy_courses v WHERE v.series_key=c.series_key AND v.type!='quiz' AND v.status='published') video_count
      FROM academy_quiz_attempts a JOIN academy_courses c ON c.course_key=a.course_key JOIN academy_series s ON s.series_key=c.series_key
      WHERE a.user_id=? AND a.submitted_at IS NOT NULL GROUP BY c.series_key,c.level,s.title,s.cover_url,s.summary`, [req.viewer.id])
    for (const q of viewerQuizRows[0]) {
      if (!seriesMap.has(q.series_key)) seriesMap.set(q.series_key,{ id:q.series_key,title:q.title,cover:q.cover_url,summary:q.summary,level:q.level,courses:[],learnedCount:0,completedCount:0,totalCount:Number(q.video_count),quizCount:Number(q.quiz_count),points:0,totalPercent:0,updatedAt:q.updated_at })
      const group = seriesMap.get(q.series_key)
      group.quizPassedCount = Number(q.passed_count)
      if (new Date(q.updated_at) > new Date(group.updatedAt)) group.updatedAt = q.updated_at
    }
    const seriesKeys = [...seriesMap.keys()].filter(key => !key.startsWith('course:'))
    const availableBySeries = new Map()
    if (seriesKeys.length) {
      const [available] = await db.query(
        `SELECT course_key,series_key,title,cover_url,lesson_no,duration_seconds
           FROM academy_courses
          WHERE series_key IN (?) AND status='published' AND type!='quiz'
          ORDER BY series_key,lesson_no,sort_order,id`,
        [seriesKeys]
      )
      for (const course of available) {
        if (!availableBySeries.has(course.series_key)) availableBySeries.set(course.series_key, [])
        availableBySeries.get(course.series_key).push({
          id: course.course_key, title: course.title, cover: course.cover_url || '',
          lessonNo: Number(course.lesson_no || 1), durationSeconds: Number(course.duration_seconds || 0)
        })
      }
    }
    const series = [...seriesMap.values()].map(group => ({
      ...group,
      quizPassedCount: Number((viewerQuizRows[0].find(q=>q.series_key===group.id)||{}).passed_count || 0),
      progress: Math.min(100, Math.round((group.completedCount + Number(group.quizPassedCount || 0)) * 100 / Math.max(1, group.totalCount + group.quizCount))),
      currentCourse: (availableBySeries.get(group.id) || []).find(course => !group.courses.some(done => done.id === course.id)) || group.courses[0]
    }))
    series.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    const [[summary]] = await db.query(
      `SELECT SUM(CASE WHEN p.completed_at IS NOT NULL THEN 1 ELSE 0 END) completed_count,
              (SELECT COALESCE(SUM(points),0) FROM academy_learning_points WHERE user_id=?) total_points
         FROM academy_progress p WHERE p.user_id=?`,
      [req.viewer.id, req.viewer.id]
    )
    const [pointRows] = await db.query(
      `SELECT lp.id,lp.points,lp.reason,lp.created_at,c.title,c.level FROM academy_learning_points lp
       LEFT JOIN academy_courses c ON c.course_key=lp.course_key WHERE lp.user_id=? ORDER BY lp.id DESC LIMIT 50`,
      [req.viewer.id]
    )
    return ok(res, {
      summary: { totalPoints: Number(summary.total_points || 0), completedCount: Number(summary.completed_count || 0), quizPassedCount: Number(viewerQuizRows[0].reduce((sum, row) => sum + Number(row.passed_count || 0), 0)) },
      series, pointRecords: pointRows
    })
  } catch (error) {
    console.error('[academy-learning]', error)
    return fail(res, '学习中心加载失败', 500)
  }
})

router.put('/admin/series/:id/order', adminAuth, async (req, res) => {
  const ids = req.body.ids
  if (!Array.isArray(ids) || ids.some(id => !Number.isInteger(id)) || new Set(ids).size !== ids.length) return fail(res, '课时顺序无效')
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [[series]] = await connection.query('SELECT series_key FROM academy_series WHERE id=? FOR UPDATE', [req.params.id])
    if (!series) { await connection.rollback(); return fail(res, '系列不存在', 404) }
    const [rows] = await connection.query('SELECT id FROM academy_courses WHERE series_key=? FOR UPDATE', [series.series_key])
    if (rows.length !== ids.length || rows.some(row => !ids.includes(Number(row.id)))) {
      await connection.rollback(); return fail(res, '课时已变化，请刷新后重试')
    }
    for (let index = 0; index < ids.length; index++) await connection.query('UPDATE academy_courses SET lesson_no=?,sort_order=? WHERE id=?', [index + 1, index + 1, ids[index]])
    await connection.commit()
    return ok(res)
  } catch (error) { await connection.rollback(); return fail(res, '顺序保存失败', 500) }
  finally { connection.release() }
})

router.get('/admin/courses', adminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT c.*,s.title series_title FROM academy_courses c LEFT JOIN academy_series s ON s.series_key=c.series_key ORDER BY c.sort_order,c.id')
    return ok(res, rows.map(row => courseView(row, true)))
  } catch (error) { console.error('[academy-admin-list]', error); return fail(res, '课程加载失败', 500) }
})

router.get('/admin/learning-stats', adminAuth, async (_req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT COUNT(DISTINCT CASE WHEN p.completed_at IS NOT NULL THEN p.user_id END) learner_count,
              SUM(CASE WHEN p.completed_at IS NOT NULL THEN 1 ELSE 0 END) started_count,
              SUM(CASE WHEN p.completed_at IS NOT NULL THEN 1 ELSE 0 END) completed_count,
              (SELECT COALESCE(SUM(points),0) FROM academy_learning_points) points_issued
         FROM academy_progress p`
    )
    const started = Number(row.started_count || 0), completed = Number(row.completed_count || 0)
    return ok(res, {
      learnerCount: Number(row.learner_count || 0), completedCount: completed,
      completionRate: started ? Math.round(completed / started * 100) : 0,
      pointsIssued: Number(row.points_issued || 0)
    })
  } catch (error) { return fail(res, '学习统计加载失败', 500) }
})

router.get('/admin/series', adminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query(`SELECT s.*,COUNT(c.id) lesson_count,COALESCE(SUM(c.duration_seconds),0) total_seconds FROM academy_series s LEFT JOIN academy_courses c ON c.series_key=s.series_key GROUP BY s.id ORDER BY s.sort_order,s.id`)
    return ok(res, rows.map(seriesView))
  } catch (error) { console.error('[academy-admin-series]', error); return fail(res, '系列课程加载失败', 500) }
})

router.post('/admin/series', adminAuth, async (req, res) => {
  const data = seriesPayload(req.body)
  data.seriesKey = `series-${crypto.randomBytes(12).toString('hex')}`
  if (!data.title) return fail(res, '请填写系列名称')
  try {
    const [result] = await db.query(
      `INSERT INTO academy_series
       (series_key,level,title,summary,teacher,cover_url,status,is_featured,sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [data.seriesKey,data.level,data.title,data.summary,data.teacher,data.coverUrl,data.status,data.featured,data.sortOrder]
    )
    return ok(res, { id: Number(result.insertId) }, '系列课程已创建')
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') return fail(res, '系列标识已存在')
    console.error('[academy-series-create]', error)
    return fail(res, '系列课程保存失败', 500)
  }
})

router.put('/admin/series/:id', adminAuth, async (req, res) => {
  const data = seriesPayload(req.body)
  if (!data.title) return fail(res, '请填写系列名称')
  try {
    const [[current]] = await db.query('SELECT series_key FROM academy_series WHERE id=? LIMIT 1', [req.params.id])
    if (!current) return fail(res, '系列课程不存在', 404)
    data.seriesKey = current.series_key
    await db.query(
      `UPDATE academy_series SET series_key=?,level=?,title=?,summary=?,teacher=?,cover_url=?,status=?,is_featured=?,sort_order=? WHERE id=?`,
      [data.seriesKey,data.level,data.title,data.summary,data.teacher,data.coverUrl,data.status,data.featured,data.sortOrder,req.params.id]
    )
    if (current.series_key !== data.seriesKey) {
      await db.query('UPDATE academy_courses SET series_key=?,level=? WHERE series_key=?', [data.seriesKey,data.level,current.series_key])
    } else {
      await db.query('UPDATE academy_courses SET level=? WHERE series_key=?', [data.level,data.seriesKey])
    }
    return ok(res, null, '系列课程已保存')
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') return fail(res, '系列标识已存在')
    console.error('[academy-series-update]', error)
    return fail(res, '系列课程保存失败', 500)
  }
})

router.patch('/admin/series/:id/status', adminAuth, async (req, res) => {
  const status = STATUSES.has(req.body.status) ? req.body.status : 'draft'
  try {
    const [result] = await db.query('UPDATE academy_series SET status=? WHERE id=?', [status, req.params.id])
    if (!result.affectedRows) return fail(res, '系列课程不存在', 404)
    return ok(res, null, status === 'published' ? '系列课程已上架' : '系列课程已下架')
  } catch (error) {
    console.error('[academy-series-status]', error)
    return fail(res, '系列课程状态更新失败', 500)
  }
})

router.delete('/admin/series/:id', adminAuth, async (req, res) => {
  try {
    const [[series]] = await db.query('SELECT series_key FROM academy_series WHERE id=? LIMIT 1', [req.params.id])
    if (!series) return fail(res, '系列课程不存在', 404)
    const [[used]] = await db.query('SELECT COUNT(*) total FROM academy_courses WHERE series_key=?', [series.series_key])
    if (Number(used.total || 0) > 0) return fail(res, '该系列下仍有课程，请先删除或移动课程')
    await db.query('DELETE FROM academy_series WHERE id=?', [req.params.id])
    return ok(res, null, '系列课程已删除')
  } catch (error) {
    console.error('[academy-series-delete]', error)
    return fail(res, '系列课程删除失败', 500)
  }
})

router.post('/admin/courses', adminAuth, async (req, res) => {
  const data = coursePayload(req.body)
  if (!data.title || !data.seriesKey) return fail(res, '请选择系列课程并填写课程标题')
  data.courseKey = generatedCourseKey()
  if (data.type === 'video' && data.status === 'published' && !data.feedToken) return fail(res, '视频课程上架前请填写 feedToken')
  try {
    const [[series]] = await db.query('SELECT level FROM academy_series WHERE series_key=? LIMIT 1', [data.seriesKey])
    if (!series) return fail(res, '所选系列课程不存在')
    data.level = series.level
    const [result] = await db.query(
      `INSERT INTO academy_courses
       (course_key,series_key,lesson_no,level,type,title,summary,teacher,teacher_title,cover_url,cover_object_key,feed_token,duration_seconds,objectives_json,status,is_featured,sort_order,created_by,published_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?='published',NOW(),NULL))`,
      [data.courseKey,data.seriesKey,data.lessonNo,data.level,data.type,data.title,data.summary,data.teacher,data.teacherTitle,data.coverUrl,'',data.feedToken,data.durationSeconds,data.objectivesJson,data.status,data.featured,data.sortOrder,req.admin.id,data.status]
    )
    return ok(res, { id: Number(result.insertId) }, '课程已创建')
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') return fail(res, '课程数据冲突，请重新保存')
    console.error('[academy-admin-create]', error); return fail(res, '课程保存失败', 500)
  }
})

router.put('/admin/courses/:id', adminAuth, async (req, res) => {
  const data = coursePayload(req.body)
  if (!data.title || !data.seriesKey) return fail(res, '请选择系列课程并填写课程标题')
  if (data.type === 'video' && data.status === 'published' && !data.feedToken) return fail(res, '视频课程上架前请填写 feedToken')
  try {
    const [[current]] = await db.query('SELECT course_key,type FROM academy_courses WHERE id=? LIMIT 1', [req.params.id])
    if (!current) return fail(res, '课程不存在', 404)
    if (current.type === 'quiz') return fail(res, '请使用测验编辑器')
    data.courseKey = current.course_key
    const [[series]] = await db.query('SELECT level FROM academy_series WHERE series_key=? LIMIT 1', [data.seriesKey])
    if (!series) return fail(res, '所选系列课程不存在')
    data.level = series.level
    const [result] = await db.query(
      `UPDATE academy_courses SET course_key=?,series_key=?,lesson_no=?,level=?,type=?,title=?,summary=?,teacher=?,teacher_title=?,cover_url=?,cover_object_key='',feed_token=?,duration_seconds=?,objectives_json=?,status=?,is_featured=?,sort_order=?,published_at=IF(?='published',COALESCE(published_at,NOW()),published_at) WHERE id=?`,
      [data.courseKey,data.seriesKey,data.lessonNo,data.level,data.type,data.title,data.summary,data.teacher,data.teacherTitle,data.coverUrl,data.feedToken,data.durationSeconds,data.objectivesJson,data.status,data.featured,data.sortOrder,data.status,req.params.id]
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
      const [[course]] = await db.query('SELECT type,feed_token FROM academy_courses WHERE id=?', [req.params.id])
      if (!course) return fail(res, '课程不存在', 404)
      if (course.type === 'video' && !course.feed_token) return fail(res, '请先填写 feedToken 再上架')
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
    return ok(res, null, '课程已删除；视频号中的原视频不会受到影响')
  } catch (error) { console.error('[academy-admin-delete]', error); return fail(res, '课程删除失败', 500) }
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

require('./academy-quiz')(router, { db, adminAuth, academyViewer, requireLevelAccess, ok, fail })
module.exports = router
