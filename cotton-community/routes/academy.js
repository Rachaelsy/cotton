const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const COURSE_IDS = new Set([
  'cotton-growth-cycle', 'seed-selection-preparation', 'precision-sowing', 'seedling-management', 'field-scouting-basics', 'basic-field-checklist',
  'irrigation-principles', 'fertigation-management', 'plant-architecture', 'pest-monitoring', 'flower-boll-management', 'midlevel-record-template',
  'yield-diagnosis', 'fiber-quality', 'defoliation-harvest', 'digital-field-data', 'weather-risk-decision', 'annual-review-template'
])

function tokenPayload(req) {
  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ')) return null
  try { return jwt.verify(authorization.slice(7), process.env.JWT_SECRET) } catch { return null }
}

function farmerAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload || !payload.id || payload.role !== 'farmer') return fail(res, '请先登录后参与评论', 401)
  req.viewer = payload
  next()
}

function validCourse(req, res, next) {
  if (!COURSE_IDS.has(String(req.params.courseId || ''))) return fail(res, '课程不存在', 404)
  next()
}

function displayName(row) {
  const nickname = String(row.nickname || row.real_name || '').trim()
  const phone = String(row.phone || '')
  return nickname || (phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '棉农用户')
}

function formatComment(row) {
  return {
    id: Number(row.id),
    parentId: row.parent_id ? Number(row.parent_id) : null,
    parentAuthor: row.parent_author || '',
    content: row.content || '',
    author: displayName(row),
    avatarUrl: '',
    createdAt: row.created_at || null,
    likeCount: Number(row.like_count || 0),
    liked: !!row.viewer_liked
  }
}

router.get('/courses/:courseId/comments', validCourse, async (req, res) => {
  const viewer = tokenPayload(req)
  const viewerId = viewer && viewer.role === 'farmer' ? Number(viewer.id || 0) : 0
  try {
    const [rows] = await db.query(
      `SELECT c.id,c.parent_id,c.content,c.created_at,u.nickname,u.real_name,u.phone,
              COALESCE(parent_user.nickname,parent_user.real_name,
                CASE WHEN CHAR_LENGTH(parent_user.phone)>=7 THEN CONCAT(LEFT(parent_user.phone,3),'****',RIGHT(parent_user.phone,4)) ELSE '' END) AS parent_author,
              COALESCE(likes.like_count,0) AS like_count,
              CASE WHEN viewer_like.user_id IS NULL THEN 0 ELSE 1 END AS viewer_liked
         FROM academy_comments c
         LEFT JOIN users u ON u.id=c.user_id
         LEFT JOIN academy_comments parent ON parent.id=c.parent_id AND parent.status='visible'
         LEFT JOIN users parent_user ON parent_user.id=parent.user_id
         LEFT JOIN (SELECT comment_id,COUNT(*) AS like_count FROM academy_comment_likes GROUP BY comment_id) likes ON likes.comment_id=c.id
         LEFT JOIN academy_comment_likes viewer_like ON viewer_like.comment_id=c.id AND viewer_like.user_id=?
        WHERE c.course_id=? AND c.status='visible'
        ORDER BY c.created_at DESC,c.id DESC LIMIT 200`,
      [viewerId, req.params.courseId]
    )
    return ok(res, rows.map(formatComment))
  } catch (error) {
    console.error('[academy-comments-list]', error)
    return fail(res, '评论加载失败', 500)
  }
})

router.post('/courses/:courseId/comments', farmerAuth, validCourse, async (req, res) => {
  const content = String(req.body.content || '').trim().slice(0, 500)
  const requestedParentId = Number.parseInt(req.body.parentId, 10) || null
  if (content.length < 2) return fail(res, '评论至少需要2个字')
  try {
    const [[user]] = await db.query("SELECT id FROM users WHERE id=? AND role='farmer' AND is_active=1 LIMIT 1", [req.viewer.id])
    if (!user) return fail(res, '账号不存在或已停用', 403)
    let parentId = null
    if (requestedParentId) {
      const [[parent]] = await db.query("SELECT id FROM academy_comments WHERE id=? AND course_id=? AND status='visible' LIMIT 1", [requestedParentId, req.params.courseId])
      if (!parent) return fail(res, '要回复的评论不存在', 404)
      parentId = Number(parent.id)
    }
    const [[recent]] = await db.query('SELECT id FROM academy_comments WHERE user_id=? AND created_at>DATE_SUB(NOW(),INTERVAL 10 SECOND) LIMIT 1', [req.viewer.id])
    if (recent) return fail(res, '评论发送太频繁，请稍后再试', 429)
    const [result] = await db.query('INSERT INTO academy_comments (course_id,user_id,parent_id,content) VALUES (?,?,?,?)', [req.params.courseId, user.id, parentId, content])
    return ok(res, { id: Number(result.insertId) }, parentId ? '回复已发表' : '评论已发表')
  } catch (error) {
    console.error('[academy-comment-create]', error)
    return fail(res, '评论发表失败', 500)
  }
})

router.post('/courses/:courseId/comments/:commentId/like', farmerAuth, validCourse, async (req, res) => {
  try {
    const [[comment]] = await db.query("SELECT id FROM academy_comments WHERE id=? AND course_id=? AND status='visible' LIMIT 1", [req.params.commentId, req.params.courseId])
    if (!comment) return fail(res, '评论不存在', 404)
    const [[existing]] = await db.query('SELECT comment_id FROM academy_comment_likes WHERE comment_id=? AND user_id=? LIMIT 1', [comment.id, req.viewer.id])
    if (existing) await db.query('DELETE FROM academy_comment_likes WHERE comment_id=? AND user_id=?', [comment.id, req.viewer.id])
    else await db.query('INSERT INTO academy_comment_likes (comment_id,user_id) VALUES (?,?)', [comment.id, req.viewer.id])
    const [[count]] = await db.query('SELECT COUNT(*) AS total FROM academy_comment_likes WHERE comment_id=?', [comment.id])
    return ok(res, { liked: !existing, likeCount: Number(count.total || 0) }, existing ? '已取消点赞' : '已点赞')
  } catch (error) {
    console.error('[academy-comment-like]', error)
    return fail(res, '点赞操作失败', 500)
  }
})

module.exports = router
