const express = require('express')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const uploadDir = path.join(__dirname, '../public/uploads/knowledge')
const localUploadMaxMb = Math.max(1, Math.min(2048, Number.parseInt(process.env.KNOWLEDGE_LOCAL_UPLOAD_MAX_MB, 10) || 250))
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase()
      cb(null, `knowledge_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`)
    }
  }),
  limits: { fileSize: localUploadMaxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      return cb(new Error('仅支持图片或视频文件'))
    }
    cb(null, true)
  }
})

function tokenPayload(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null
  try { return jwt.verify(auth.slice(7), process.env.JWT_SECRET) } catch { return null }
}

function optionalAuth(req, _res, next) {
  req.viewer = tokenPayload(req)
  next()
}

function userAuth(req, res, next) {
  req.viewer = tokenPayload(req)
  if (!req.viewer || !req.viewer.id) return fail(res, '请先登录后再使用此功能', 401)
  next()
}

function adminAuth(req, res, next) {
  req.admin = tokenPayload(req)
  if (!req.admin) return fail(res, '管理员登录已过期', 401)
  if (!req.admin.is_admin) return fail(res, '无管理员权限', 403)
  next()
}

function parseJson(value, fallback = []) {
  if (Array.isArray(value)) return value
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch { return fallback }
}

function splitList(value, max = 12) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[,，、\n]/)
  return [...new Set(values.map(item => String(item || '').trim()).filter(Boolean))].slice(0, max)
}

function safeUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (url.startsWith('/uploads/') || url.startsWith('/assets/') || /^https:\/\//i.test(url)) return url.slice(0, 500)
  return ''
}

function normalizeQuiz(value) {
  return parseJson(value).slice(0, 12).map(item => {
    const options = Array.isArray(item && item.options)
      ? item.options.map(option => String(option || '').trim().slice(0, 200)).filter(Boolean).slice(0, 6)
      : []
    const correctIndex = Number.parseInt(item && item.correctIndex, 10)
    return {
      question: String(item && item.question || '').trim().slice(0, 300),
      options,
      correctIndex,
      explanation: String(item && item.explanation || '').trim().slice(0, 1200)
    }
  }).filter(item => item.question && item.options.length >= 2 && Number.isInteger(item.correctIndex) &&
    item.correctIndex >= 0 && item.correctIndex < item.options.length)
}

function contentBody(body = {}) {
  const type = ['video', 'article', 'gallery'].includes(body.type) ? body.type : 'article'
  const status = body.status === 'published' ? 'published' : 'draft'
  const difficulty = ['intro', 'intermediate', 'advanced'].includes(body.difficulty) ? body.difficulty : 'intro'
  return {
    type,
    title: String(body.title || '').trim().slice(0, 160),
    subtitle: String(body.subtitle || '').trim().slice(0, 255),
    categoryKey: String(body.category_key || 'planting').trim().slice(0, 40),
    categoryName: String(body.category_name || '栽培技术').trim().slice(0, 64),
    coverUrl: safeUrl(body.cover_url),
    videoUrl: safeUrl(body.video_url),
    imagesJson: JSON.stringify(splitList(body.images || body.images_json, 12).map(safeUrl).filter(Boolean)),
    content: String(body.content || '').trim().slice(0, 100000),
    tagsJson: JSON.stringify(splitList(body.tags || body.tags_json, 12)),
    quizJson: JSON.stringify(normalizeQuiz(body.quiz || body.quiz_json)),
    durationSeconds: Math.max(0, Math.min(86400, Number.parseInt(body.duration_seconds, 10) || 0)),
    difficulty,
    sourceName: String(body.source_name || '棉花智能体知识中心').trim().slice(0, 120),
    status,
    featured: body.is_featured === true || body.is_featured === 1 || body.is_featured === '1' ? 1 : 0,
    sortOrder: Math.max(-9999, Math.min(9999, Number.parseInt(body.sort_order, 10) || 0))
  }
}

function normalizeContent(row, viewerState = {}) {
  return {
    id: Number(row.id),
    type: row.type || 'article',
    title: row.title || '',
    subtitle: row.subtitle || '',
    categoryKey: row.category_key || 'planting',
    categoryName: row.category_name || '栽培技术',
    coverUrl: row.cover_url || '',
    videoUrl: row.video_url || '',
    images: parseJson(row.images_json),
    content: row.content || '',
    tags: parseJson(row.tags_json),
    quiz: normalizeQuiz(row.quiz_json),
    durationSeconds: Number(row.duration_seconds || 0),
    difficulty: row.difficulty || 'intro',
    sourceName: row.source_name || '棉花智能体知识中心',
    status: row.status || 'draft',
    isFeatured: !!row.is_featured,
    sortOrder: Number(row.sort_order || 0),
    viewCount: Number(row.view_count || 0),
    commentCount: Number(row.comment_count || 0),
    publishedAt: row.published_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    isFavorite: !!viewerState.favorite,
    progressSeconds: Number(viewerState.progress_seconds || 0),
    progressPercent: Number(viewerState.progress_percent || 0),
    completed: !!viewerState.completed
  }
}

async function attachViewerState(rows, userId) {
  if (!userId || !rows.length) return rows.map(row => normalizeContent(row))
  const ids = rows.map(row => Number(row.id))
  const placeholders = ids.map(() => '?').join(',')
  const [progressRows] = await db.query(
    `SELECT content_id,progress_seconds,progress_percent,completed FROM knowledge_progress
      WHERE user_id=? AND content_id IN (${placeholders})`,
    [userId, ...ids]
  )
  const [favoriteRows] = await db.query(
    `SELECT content_id FROM knowledge_favorites WHERE user_id=? AND content_id IN (${placeholders})`,
    [userId, ...ids]
  )
  const states = new Map(progressRows.map(item => [Number(item.content_id), { ...item }]))
  favoriteRows.forEach(item => {
    const id = Number(item.content_id)
    states.set(id, { ...(states.get(id) || {}), favorite: true })
  })
  return rows.map(row => normalizeContent(row, states.get(Number(row.id)) || {}))
}

router.get('/home', optionalAuth, async (req, res) => {
  try {
    const params = []
    const conditions = ["status='published'"]
    if (req.query.type && ['video', 'article', 'gallery'].includes(req.query.type)) {
      conditions.push('type=?')
      params.push(req.query.type)
    }
    if (req.query.category && req.query.category !== 'all') {
      conditions.push('category_key=?')
      params.push(String(req.query.category).slice(0, 40))
    }
    const q = String(req.query.q || '').trim()
    if (q) {
      conditions.push('(title LIKE ? OR subtitle LIKE ? OR content LIKE ? OR tags_json LIKE ?)')
      const like = `%${q.slice(0, 60)}%`
      params.push(like, like, like, like)
    }
    const [rows] = await db.query(
      `SELECT * FROM knowledge_contents WHERE ${conditions.join(' AND ')}
       ORDER BY is_featured DESC,sort_order ASC,id DESC LIMIT 100`,
      params
    )
    const contents = await attachViewerState(rows, req.viewer && req.viewer.id)
    const [categoryRows] = await db.query(
      "SELECT category_key,MAX(category_name) AS category_name,COUNT(*) AS total FROM knowledge_contents WHERE status='published' GROUP BY category_key ORDER BY MIN(sort_order),category_key"
    )
    return ok(res, {
      contents,
      categories: [{ key: 'all', name: '全部内容', total: contents.length }].concat(categoryRows.map(item => ({
        key: item.category_key, name: item.category_name, total: Number(item.total || 0)
      }))),
      viewer: req.viewer ? { id: req.viewer.id, role: req.viewer.role || '', name: req.viewer.real_name || '' } : null
    })
  } catch (error) {
    console.error('[knowledge-home]', error)
    return fail(res, '知识讲堂加载失败', 500)
  }
})

router.get('/contents/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM knowledge_contents WHERE id=? AND status='published' LIMIT 1", [req.params.id])
    if (!rows.length) return fail(res, '内容不存在或尚未上架', 404)
    await db.query('UPDATE knowledge_contents SET view_count=view_count+1 WHERE id=?', [req.params.id])
    rows[0].view_count = Number(rows[0].view_count || 0) + 1
    const [content] = await attachViewerState(rows, req.viewer && req.viewer.id)
    const [relatedRows] = await db.query(
      "SELECT * FROM knowledge_contents WHERE status='published' AND id<>? AND category_key=? ORDER BY is_featured DESC,sort_order,id DESC LIMIT 4",
      [req.params.id, rows[0].category_key]
    )
    return ok(res, {
      content,
      related: await attachViewerState(relatedRows, req.viewer && req.viewer.id),
      viewer: req.viewer ? { id: Number(req.viewer.id) } : null
    })
  } catch (error) {
    console.error('[knowledge-detail]', error)
    return fail(res, '内容加载失败', 500)
  }
})

router.get('/contents/:id/comments', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT kc.id,kc.content_id,kc.user_id,kc.parent_id,kc.nickname,kc.avatar_url,kc.body,kc.created_at,
              CASE WHEN parent.status='visible' THEN parent.nickname ELSE '' END AS parent_nickname,
              CASE WHEN parent.status='visible' THEN parent.body ELSE '' END AS parent_body
         FROM knowledge_comments kc
         LEFT JOIN knowledge_comments parent ON parent.id=kc.parent_id
        WHERE kc.content_id=? AND kc.status='visible'
        ORDER BY kc.id ASC LIMIT 400`,
      [req.params.id]
    )
    return ok(res, rows)
  } catch (error) {
    console.error('[knowledge-comments]', error)
    return fail(res, '评论加载失败', 500)
  }
})

router.post('/contents/:id/comments', userAuth, async (req, res) => {
  try {
    const body = String(req.body.body || '').trim()
    if (body.length < 2) return fail(res, '评论至少需要2个字')
    if (body.length > 800) return fail(res, '评论不能超过800字')
    const [[content]] = await db.query("SELECT id FROM knowledge_contents WHERE id=? AND status='published'", [req.params.id])
    if (!content) return fail(res, '内容不存在或尚未上架', 404)
    const [[user]] = await db.query('SELECT real_name,phone,avatar_url FROM users WHERE id=?', [req.viewer.id])
    const nickname = String(user && user.real_name || req.viewer.real_name || `用户${String(user && user.phone || '').slice(-4)}` || '学习用户').slice(0, 64)
    const parentId = Number.parseInt(req.body.parent_id, 10) || null
    if (parentId) {
      const [[parent]] = await db.query(
        "SELECT id FROM knowledge_comments WHERE id=? AND content_id=? AND status='visible'",
        [parentId, content.id]
      )
      if (!parent) return fail(res, '回复的评论不存在', 404)
    }
    const [result] = await db.query(
      'INSERT INTO knowledge_comments (content_id,user_id,parent_id,nickname,avatar_url,body) VALUES (?,?,?,?,?,?)',
      [content.id, req.viewer.id, parentId, nickname || '学习用户', user && user.avatar_url || '', body]
    )
    await db.query('UPDATE knowledge_contents SET comment_count=comment_count+1 WHERE id=?', [content.id])
    return ok(res, { id: result.insertId }, '评论已发布')
  } catch (error) {
    console.error('[knowledge-comment-create]', error)
    return fail(res, '评论发布失败', 500)
  }
})

router.delete('/comments/:id', userAuth, async (req, res) => {
  try {
    const [[comment]] = await db.query("SELECT content_id FROM knowledge_comments WHERE id=? AND user_id=? AND status='visible'", [req.params.id, req.viewer.id])
    if (!comment) return fail(res, '评论不存在或无权删除', 404)
    await db.query("UPDATE knowledge_comments SET status='hidden' WHERE id=?", [req.params.id])
    await db.query('UPDATE knowledge_contents SET comment_count=GREATEST(comment_count-1,0) WHERE id=?', [comment.content_id])
    return ok(res, null, '评论已删除')
  } catch (error) {
    console.error('[knowledge-comment-delete]', error)
    return fail(res, '评论删除失败', 500)
  }
})

router.put('/contents/:id/progress', userAuth, async (req, res) => {
  try {
    const [[content]] = await db.query("SELECT id,duration_seconds FROM knowledge_contents WHERE id=? AND status='published'", [req.params.id])
    if (!content) return fail(res, '内容不存在或尚未上架', 404)
    const duration = Math.max(0, Math.min(86400, Number.parseInt(req.body.duration_seconds, 10) || Number(content.duration_seconds || 0)))
    const progress = Math.max(0, Math.min(duration || 86400, Number.parseInt(req.body.progress_seconds, 10) || 0))
    const percent = duration > 0 ? Math.min(100, Math.round(progress / duration * 100)) : (req.body.completed ? 100 : 0)
    const completed = req.body.completed || percent >= 90 ? 1 : 0
    await db.query(
      `INSERT INTO knowledge_progress
       (content_id,user_id,progress_seconds,duration_seconds,progress_percent,completed,last_viewed_at)
       VALUES (?,?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE
       progress_seconds=VALUES(progress_seconds),duration_seconds=VALUES(duration_seconds),
       progress_percent=GREATEST(progress_percent,VALUES(progress_percent)),completed=GREATEST(completed,VALUES(completed)),
       last_viewed_at=NOW()`,
      [content.id, req.viewer.id, progress, duration, percent, completed]
    )
    return ok(res, { progressSeconds: progress, progressPercent: percent, completed: !!completed })
  } catch (error) {
    console.error('[knowledge-progress]', error)
    return fail(res, '学习进度保存失败', 500)
  }
})

router.post('/contents/:id/favorite', userAuth, async (req, res) => {
  try {
    const [[content]] = await db.query("SELECT id FROM knowledge_contents WHERE id=? AND status='published'", [req.params.id])
    if (!content) return fail(res, '内容不存在或尚未上架', 404)
    await db.query('INSERT IGNORE INTO knowledge_favorites (content_id,user_id) VALUES (?,?)', [content.id, req.viewer.id])
    return ok(res, { isFavorite: true }, '已收藏')
  } catch (error) {
    console.error('[knowledge-favorite]', error)
    return fail(res, '收藏失败', 500)
  }
})

router.delete('/contents/:id/favorite', userAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM knowledge_favorites WHERE content_id=? AND user_id=?', [req.params.id, req.viewer.id])
    return ok(res, { isFavorite: false }, '已取消收藏')
  } catch (error) {
    console.error('[knowledge-unfavorite]', error)
    return fail(res, '取消收藏失败', 500)
  }
})

router.get('/me/history', userAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT kc.*,kp.progress_seconds,kp.progress_percent,kp.completed,kp.last_viewed_at
         FROM knowledge_progress kp JOIN knowledge_contents kc ON kc.id=kp.content_id
        WHERE kp.user_id=? AND kc.status='published' ORDER BY kp.last_viewed_at DESC LIMIT 100`,
      [req.viewer.id]
    )
    return ok(res, rows.map(row => ({ ...normalizeContent(row, row), lastViewedAt: row.last_viewed_at })))
  } catch (error) {
    console.error('[knowledge-history]', error)
    return fail(res, '学习记录加载失败', 500)
  }
})

router.get('/me/favorites', userAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT kc.*,1 AS favorite,kp.progress_seconds,kp.progress_percent,kp.completed
         FROM knowledge_favorites kf JOIN knowledge_contents kc ON kc.id=kf.content_id
         LEFT JOIN knowledge_progress kp ON kp.content_id=kc.id AND kp.user_id=kf.user_id
        WHERE kf.user_id=? AND kc.status='published' ORDER BY kf.created_at DESC LIMIT 100`,
      [req.viewer.id]
    )
    return ok(res, rows.map(row => normalizeContent(row, row)))
  } catch (error) {
    console.error('[knowledge-favorites]', error)
    return fail(res, '收藏加载失败', 500)
  }
})

function forumQuestion(row) {
  return {
    id: Number(row.id), userId: Number(row.user_id), nickname: row.nickname || '棉友', title: row.title || '',
    body: row.body || '', categoryKey: row.category_key || 'other', categoryName: row.category_name || '其他问题',
    tags: parseJson(row.tags_json), images: parseJson(row.images_json), status: row.status || 'open',
    acceptedAnswerId: row.accepted_answer_id ? Number(row.accepted_answer_id) : null,
    viewCount: Number(row.view_count || 0), answerCount: Number(row.answer_count || 0),
    createdAt: row.created_at || null, updatedAt: row.updated_at || null
  }
}

async function viewerName(userId, payload = {}) {
  const [[user]] = await db.query('SELECT real_name,phone FROM users WHERE id=?', [userId])
  const phoneTail = String(user && user.phone || '').slice(-4)
  return String(user && user.real_name || payload.real_name || (phoneTail ? `棉友${phoneTail}` : '棉友')).slice(0, 64)
}

router.get('/forum', optionalAuth, async (req, res) => {
  try {
    const params = []
    const conditions = ["status IN ('open','solved')"]
    if (req.query.category && req.query.category !== 'all') {
      conditions.push('category_key=?')
      params.push(String(req.query.category).slice(0, 40))
    }
    const q = String(req.query.q || '').trim()
    if (q) {
      const like = `%${q.slice(0, 60)}%`
      conditions.push('(title LIKE ? OR body LIKE ? OR tags_json LIKE ?)')
      params.push(like, like, like)
    }
    const [rows] = await db.query(
      `SELECT * FROM knowledge_questions WHERE ${conditions.join(' AND ')}
       ORDER BY status='solved' DESC,updated_at DESC,id DESC LIMIT 100`,
      params
    )
    return ok(res, { questions: rows.map(forumQuestion), viewer: req.viewer ? { id: req.viewer.id } : null })
  } catch (error) {
    console.error('[knowledge-forum]', error)
    return fail(res, '问答社区加载失败', 500)
  }
})

router.post('/forum', userAuth, async (req, res) => {
  try {
    const title = String(req.body.title || '').trim()
    const body = String(req.body.body || '').trim()
    if (title.length < 5 || title.length > 160) return fail(res, '问题标题需要5到160个字')
    if (body.length < 10 || body.length > 5000) return fail(res, '问题描述需要10到5000个字')
    const nickname = await viewerName(req.viewer.id, req.viewer)
    const categoryKey = String(req.body.category_key || 'other').trim().slice(0, 40)
    const categoryName = String(req.body.category_name || '其他问题').trim().slice(0, 64)
    const tags = JSON.stringify(splitList(req.body.tags, 8))
    const images = JSON.stringify(splitList(req.body.images, 6).map(safeUrl).filter(Boolean))
    const [result] = await db.query(
      `INSERT INTO knowledge_questions
       (user_id,nickname,title,body,category_key,category_name,tags_json,images_json)
       VALUES (?,?,?,?,?,?,?,?)`,
      [req.viewer.id, nickname, title, body, categoryKey, categoryName, tags, images]
    )
    return ok(res, { id: result.insertId }, '问题已发布')
  } catch (error) {
    console.error('[knowledge-question-create]', error)
    return fail(res, '问题发布失败', 500)
  }
})

router.get('/forum/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM knowledge_questions WHERE id=? AND status IN ('open','solved') LIMIT 1", [req.params.id])
    if (!rows.length) return fail(res, '问题不存在或已被隐藏', 404)
    await db.query('UPDATE knowledge_questions SET view_count=view_count+1 WHERE id=?', [req.params.id])
    rows[0].view_count = Number(rows[0].view_count || 0) + 1
    const [answers] = await db.query(
      `SELECT * FROM knowledge_answers WHERE question_id=? AND status='visible'
       ORDER BY id=? DESC,vote_count DESC,id ASC`,
      [req.params.id, rows[0].accepted_answer_id || 0]
    )
    let voted = new Set()
    if (req.viewer && req.viewer.id && answers.length) {
      const ids = answers.map(item => Number(item.id))
      const placeholders = ids.map(() => '?').join(',')
      const [votes] = await db.query(
        `SELECT answer_id FROM knowledge_answer_votes WHERE user_id=? AND answer_id IN (${placeholders})`,
        [req.viewer.id, ...ids]
      )
      voted = new Set(votes.map(item => Number(item.answer_id)))
    }
    return ok(res, {
      question: forumQuestion(rows[0]),
      answers: answers.map(item => ({
        id: Number(item.id), questionId: Number(item.question_id), userId: Number(item.user_id),
        nickname: item.nickname || '棉友', body: item.body || '', images: parseJson(item.images_json),
        voteCount: Number(item.vote_count || 0), isVoted: voted.has(Number(item.id)),
        isAccepted: Number(rows[0].accepted_answer_id || 0) === Number(item.id), createdAt: item.created_at
      })),
      viewer: req.viewer ? { id: Number(req.viewer.id) } : null
    })
  } catch (error) {
    console.error('[knowledge-question-detail]', error)
    return fail(res, '问题加载失败', 500)
  }
})

router.post('/forum/:id/answers', userAuth, async (req, res) => {
  try {
    const body = String(req.body.body || '').trim()
    if (body.length < 5 || body.length > 5000) return fail(res, '回答需要5到5000个字')
    const [[question]] = await db.query("SELECT id FROM knowledge_questions WHERE id=? AND status IN ('open','solved')", [req.params.id])
    if (!question) return fail(res, '问题不存在或已被隐藏', 404)
    const nickname = await viewerName(req.viewer.id, req.viewer)
    const images = JSON.stringify(splitList(req.body.images, 6).map(safeUrl).filter(Boolean))
    const [result] = await db.query(
      'INSERT INTO knowledge_answers (question_id,user_id,nickname,body,images_json) VALUES (?,?,?,?,?)',
      [question.id, req.viewer.id, nickname, body, images]
    )
    await db.query('UPDATE knowledge_questions SET answer_count=answer_count+1,updated_at=NOW() WHERE id=?', [question.id])
    return ok(res, { id: result.insertId }, '回答已发布')
  } catch (error) {
    console.error('[knowledge-answer-create]', error)
    return fail(res, '回答发布失败', 500)
  }
})

router.post('/forum/answers/:id/vote', userAuth, async (req, res) => {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[answer]] = await conn.query("SELECT id FROM knowledge_answers WHERE id=? AND status='visible' FOR UPDATE", [req.params.id])
    if (!answer) {
      await conn.rollback()
      return fail(res, '回答不存在', 404)
    }
    const [[vote]] = await conn.query('SELECT id FROM knowledge_answer_votes WHERE answer_id=? AND user_id=?', [answer.id, req.viewer.id])
    let voted
    if (vote) {
      await conn.query('DELETE FROM knowledge_answer_votes WHERE id=?', [vote.id])
      await conn.query('UPDATE knowledge_answers SET vote_count=GREATEST(vote_count-1,0) WHERE id=?', [answer.id])
      voted = false
    } else {
      await conn.query('INSERT INTO knowledge_answer_votes (answer_id,user_id) VALUES (?,?)', [answer.id, req.viewer.id])
      await conn.query('UPDATE knowledge_answers SET vote_count=vote_count+1 WHERE id=?', [answer.id])
      voted = true
    }
    const [[saved]] = await conn.query('SELECT vote_count FROM knowledge_answers WHERE id=?', [answer.id])
    await conn.commit()
    return ok(res, { voted, voteCount: Number(saved.vote_count || 0) }, voted ? '已点赞' : '已取消点赞')
  } catch (error) {
    await conn.rollback().catch(() => {})
    console.error('[knowledge-answer-vote]', error)
    return fail(res, '操作失败', 500)
  } finally {
    conn.release()
  }
})

router.patch('/forum/:id/accept/:answerId', userAuth, async (req, res) => {
  try {
    const [[question]] = await db.query('SELECT id,user_id FROM knowledge_questions WHERE id=?', [req.params.id])
    if (!question) return fail(res, '问题不存在', 404)
    if (Number(question.user_id) !== Number(req.viewer.id)) return fail(res, '只有提问者可以采纳答案', 403)
    const [[answer]] = await db.query("SELECT id FROM knowledge_answers WHERE id=? AND question_id=? AND status='visible'", [req.params.answerId, question.id])
    if (!answer) return fail(res, '回答不存在', 404)
    await db.query("UPDATE knowledge_questions SET accepted_answer_id=?,status='solved',updated_at=NOW() WHERE id=?", [answer.id, question.id])
    return ok(res, null, '已采纳该回答')
  } catch (error) {
    console.error('[knowledge-answer-accept]', error)
    return fail(res, '采纳失败', 500)
  }
})

router.post('/admin/upload', adminAuth, (req, res) => {
  upload.single('file')(req, res, error => {
    if (error) return fail(res, error.message || '上传失败')
    if (!req.file) return fail(res, '请选择文件')
    return ok(res, {
      url: `/uploads/knowledge/${req.file.filename}`,
      type: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
      size: req.file.size,
      storage: 'local',
      localUploadMaxMb
    }, '上传成功')
  })
})

router.get('/admin/stats', adminAuth, async (_req, res) => {
  try {
    const [[content]] = await db.query("SELECT COUNT(*) AS total,SUM(status='published') AS published,SUM(view_count) AS views,SUM(comment_count) AS comments FROM knowledge_contents")
    const [[learners]] = await db.query('SELECT COUNT(DISTINCT user_id) AS learners FROM knowledge_progress')
    return ok(res, {
      total: Number(content.total || 0), published: Number(content.published || 0), views: Number(content.views || 0),
      comments: Number(content.comments || 0), learners: Number(learners.learners || 0)
    })
  } catch (error) {
    console.error('[knowledge-admin-stats]', error)
    return fail(res, '运营数据加载失败', 500)
  }
})

router.get('/admin/contents', adminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM knowledge_contents ORDER BY is_featured DESC,sort_order ASC,id DESC')
    return ok(res, rows.map(row => normalizeContent(row)))
  } catch (error) {
    console.error('[knowledge-admin-contents]', error)
    return fail(res, '内容加载失败', 500)
  }
})

router.post('/admin/contents', adminAuth, async (req, res) => {
  try {
    const data = contentBody(req.body)
    if (!data.title) return fail(res, '请填写内容标题')
    if (!data.content && !data.videoUrl && parseJson(data.imagesJson).length === 0) return fail(res, '请填写正文或上传素材')
    const [result] = await db.query(
      `INSERT INTO knowledge_contents
       (type,title,subtitle,category_key,category_name,cover_url,video_url,images_json,content,tags_json,quiz_json,
        duration_seconds,difficulty,source_name,status,is_featured,sort_order,created_by,published_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?='published',NOW(),NULL))`,
      [data.type, data.title, data.subtitle, data.categoryKey, data.categoryName, data.coverUrl, data.videoUrl,
        data.imagesJson, data.content, data.tagsJson, data.quizJson, data.durationSeconds, data.difficulty, data.sourceName,
        data.status, data.featured, data.sortOrder, req.admin.id, data.status]
    )
    return ok(res, { id: result.insertId }, '内容已创建')
  } catch (error) {
    console.error('[knowledge-admin-create]', error)
    return fail(res, '内容保存失败', 500)
  }
})

router.put('/admin/contents/:id', adminAuth, async (req, res) => {
  try {
    const data = contentBody(req.body)
    if (!data.title) return fail(res, '请填写内容标题')
    const [result] = await db.query(
      `UPDATE knowledge_contents SET type=?,title=?,subtitle=?,category_key=?,category_name=?,cover_url=?,video_url=?,
       images_json=?,content=?,tags_json=?,quiz_json=?,duration_seconds=?,difficulty=?,source_name=?,status=?,is_featured=?,sort_order=?,
       published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END WHERE id=?`,
      [data.type, data.title, data.subtitle, data.categoryKey, data.categoryName, data.coverUrl, data.videoUrl,
        data.imagesJson, data.content, data.tagsJson, data.quizJson, data.durationSeconds, data.difficulty, data.sourceName,
        data.status, data.featured, data.sortOrder, data.status, req.params.id]
    )
    if (!result.affectedRows) return fail(res, '内容不存在', 404)
    return ok(res, null, '内容已保存')
  } catch (error) {
    console.error('[knowledge-admin-update]', error)
    return fail(res, '内容保存失败', 500)
  }
})

router.patch('/admin/contents/:id/status', adminAuth, async (req, res) => {
  const status = req.body.status === 'published' ? 'published' : 'draft'
  try {
    const [result] = await db.query(
      "UPDATE knowledge_contents SET status=?,published_at=IF(?='published',COALESCE(published_at,NOW()),published_at) WHERE id=?",
      [status, status, req.params.id]
    )
    if (!result.affectedRows) return fail(res, '内容不存在', 404)
    return ok(res, null, status === 'published' ? '内容已上架' : '内容已下架')
  } catch (error) {
    console.error('[knowledge-admin-status]', error)
    return fail(res, '状态更新失败', 500)
  }
})

router.delete('/admin/contents/:id', adminAuth, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM knowledge_contents WHERE id=?', [req.params.id])
    if (!result.affectedRows) return fail(res, '内容不存在', 404)
    return ok(res, null, '内容已删除')
  } catch (error) {
    console.error('[knowledge-admin-delete]', error)
    return fail(res, '内容删除失败', 500)
  }
})

router.get('/admin/comments', adminAuth, async (req, res) => {
  try {
    const params = []
    const conditions = []
    let sql = `SELECT kc.id,kc.content_id,kc.user_id,kc.parent_id,kc.nickname,kc.avatar_url,kc.body,kc.status,kc.created_at,
                      parent.nickname AS parent_nickname,parent.body AS parent_body,parent.status AS parent_status,
                      c.title AS content_title,c.type AS content_type,c.category_key,c.category_name
               FROM knowledge_comments kc
               JOIN knowledge_contents c ON c.id=kc.content_id
               LEFT JOIN knowledge_comments parent ON parent.id=kc.parent_id`
    if (['visible', 'hidden'].includes(req.query.status)) {
      conditions.push('kc.status=?')
      params.push(req.query.status)
    }
    if (req.query.category_key) {
      conditions.push('c.category_key=?')
      params.push(String(req.query.category_key).slice(0, 40))
    }
    const contentId = Number.parseInt(req.query.content_id, 10)
    if (contentId > 0) {
      conditions.push('kc.content_id=?')
      params.push(contentId)
    }
    const query = String(req.query.q || '').trim().slice(0, 80)
    if (query) {
      conditions.push('(kc.body LIKE ? OR kc.nickname LIKE ? OR c.title LIKE ?)')
      const like = `%${query}%`
      params.push(like, like, like)
    }
    if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`
    sql += ' ORDER BY c.category_name,kc.content_id,kc.id DESC LIMIT 500'
    const [rows] = await db.query(sql, params)
    return ok(res, rows)
  } catch (error) {
    console.error('[knowledge-admin-comments]', error)
    return fail(res, '评论加载失败', 500)
  }
})

router.get('/admin/forum', adminAuth, async (_req, res) => {
  try {
    const [questions] = await db.query('SELECT * FROM knowledge_questions ORDER BY id DESC LIMIT 300')
    const [answers] = await db.query(
      `SELECT ka.*,kq.title AS question_title FROM knowledge_answers ka
       JOIN knowledge_questions kq ON kq.id=ka.question_id ORDER BY ka.id DESC LIMIT 500`
    )
    return ok(res, { questions: questions.map(forumQuestion), answers })
  } catch (error) {
    console.error('[knowledge-admin-forum]', error)
    return fail(res, '社区内容加载失败', 500)
  }
})

router.patch('/admin/forum/questions/:id/status', adminAuth, async (req, res) => {
  const status = ['open', 'solved', 'hidden'].includes(req.body.status) ? req.body.status : 'hidden'
  try {
    const [result] = await db.query('UPDATE knowledge_questions SET status=? WHERE id=?', [status, req.params.id])
    if (!result.affectedRows) return fail(res, '问题不存在', 404)
    return ok(res, null, '问题状态已更新')
  } catch (error) {
    console.error('[knowledge-admin-question-status]', error)
    return fail(res, '问题状态更新失败', 500)
  }
})

router.patch('/admin/forum/answers/:id/status', adminAuth, async (req, res) => {
  const status = req.body.status === 'visible' ? 'visible' : 'hidden'
  let conn
  try {
    conn = await db.getConnection()
    await conn.beginTransaction()
    const [[answer]] = await conn.query('SELECT question_id,status FROM knowledge_answers WHERE id=? FOR UPDATE', [req.params.id])
    if (!answer) {
      await conn.rollback()
      return fail(res, '回答不存在', 404)
    }
    await conn.query('UPDATE knowledge_answers SET status=? WHERE id=?', [status, req.params.id])
    if (answer.status !== status) {
      await conn.query('UPDATE knowledge_questions SET answer_count=GREATEST(answer_count+?,0) WHERE id=?', [status === 'visible' ? 1 : -1, answer.question_id])
    }
    if (status === 'hidden') {
      await conn.query(
        "UPDATE knowledge_questions SET accepted_answer_id=NULL,status='open' WHERE id=? AND accepted_answer_id=?",
        [answer.question_id, req.params.id]
      )
    }
    await conn.commit()
    return ok(res, null, '回答状态已更新')
  } catch (error) {
    if (conn) await conn.rollback()
    console.error('[knowledge-admin-answer-status]', error)
    return fail(res, '回答状态更新失败', 500)
  } finally {
    if (conn) conn.release()
  }
})

router.patch('/admin/comments/:id/status', adminAuth, async (req, res) => {
  const status = req.body.status === 'visible' ? 'visible' : 'hidden'
  try {
    const [[comment]] = await db.query('SELECT content_id,status FROM knowledge_comments WHERE id=?', [req.params.id])
    if (!comment) return fail(res, '评论不存在', 404)
    await db.query('UPDATE knowledge_comments SET status=? WHERE id=?', [status, req.params.id])
    if (comment.status !== status) {
      const delta = status === 'visible' ? 1 : -1
      await db.query('UPDATE knowledge_contents SET comment_count=GREATEST(comment_count+?,0) WHERE id=?', [delta, comment.content_id])
    }
    return ok(res, null, status === 'visible' ? '评论已恢复' : '评论已隐藏')
  } catch (error) {
    console.error('[knowledge-admin-comment-status]', error)
    return fail(res, '评论状态更新失败', 500)
  }
})

router.delete('/admin/comments/:id', adminAuth, async (req, res) => {
  try {
    const [[comment]] = await db.query('SELECT content_id,status FROM knowledge_comments WHERE id=?', [req.params.id])
    if (!comment) return fail(res, '评论不存在', 404)
    await db.query('DELETE FROM knowledge_comments WHERE id=?', [req.params.id])
    if (comment.status === 'visible') {
      await db.query('UPDATE knowledge_contents SET comment_count=GREATEST(comment_count-1,0) WHERE id=?', [comment.content_id])
    }
    return ok(res, null, '评论已删除')
  } catch (error) {
    console.error('[knowledge-admin-comment-delete]', error)
    return fail(res, '评论删除失败', 500)
  }
})

module.exports = router
