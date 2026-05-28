// server/routes/plots.js — 农户地块管理接口
const express = require('express')
const jwt     = require('jsonwebtoken')
const db      = require('../db/database')
const router  = express.Router()

const ok   = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function farmerAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ code: 401, msg: '请先登录' })
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ code: 401, msg: '登录已过期' })
  }
}

// ─────────────────────────────────────────────
// GET /api/plots — 获取当前用户全部地块
// ─────────────────────────────────────────────
router.get('/', farmerAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM plots WHERE user_id=? ORDER BY created_at DESC',
      [req.user.id]
    )
    return ok(res, rows)
  } catch (e) {
    console.error('[plots-list]', e)
    return fail(res, '服务器错误', 500)
  }
})

// ─────────────────────────────────────────────
// POST /api/plots — 新建地块
// ─────────────────────────────────────────────
router.post('/', farmerAuth, async (req, res) => {
  const {
    name, variety = '', area = 0, perimeter = 0, coordinates,
    sow_date, irrigation = '滴灌', soil_type = '', note = ''
  } = req.body
  if (!name || !name.trim()) return fail(res, '地块名称不能为空')
  try {
    const [r] = await db.query(
      `INSERT INTO plots (user_id,name,variety,area,perimeter,coordinates,sow_date,irrigation,soil_type,note)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id, name.trim(), variety, parseFloat(area) || 0,
        parseFloat(perimeter) || 0,
        coordinates ? JSON.stringify(coordinates) : null,
        sow_date || null, irrigation, soil_type, note
      ]
    )
    return ok(res, { id: r.insertId }, '地块已保存')
  } catch (e) {
    console.error('[plots-create]', e)
    return fail(res, '保存失败', 500)
  }
})

// ─────────────────────────────────────────────
// GET /api/plots/:id — 获取单个地块
// ─────────────────────────────────────────────
router.get('/:id', farmerAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM plots WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    )
    if (!rows.length) return fail(res, '地块不存在', 404)
    return ok(res, rows[0])
  } catch (e) {
    console.error('[plots-get]', e)
    return fail(res, '服务器错误', 500)
  }
})

// ─────────────────────────────────────────────
// PUT /api/plots/:id — 更新地块信息
// ─────────────────────────────────────────────
router.put('/:id', farmerAuth, async (req, res) => {
  const {
    name, variety, sow_date, irrigation, soil_type,
    health_score, health_issue, status, note
  } = req.body
  if (!name || !name.trim()) return fail(res, '地块名称不能为空')
  try {
    const [rows] = await db.query(
      'SELECT id FROM plots WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    )
    if (!rows.length) return fail(res, '地块不存在', 404)
    await db.query(
      `UPDATE plots SET name=?,variety=?,sow_date=?,irrigation=?,soil_type=?,
       health_score=?,health_issue=?,status=?,note=? WHERE id=?`,
      [
        name.trim(), variety || '', sow_date || null,
        irrigation || '滴灌', soil_type || '',
        parseInt(health_score) || 100, health_issue || '',
        status || 'normal', note || '',
        req.params.id
      ]
    )
    return ok(res, null, '更新成功')
  } catch (e) {
    console.error('[plots-update]', e)
    return fail(res, '更新失败', 500)
  }
})

// ─────────────────────────────────────────────
// DELETE /api/plots/:id — 删除地块
// ─────────────────────────────────────────────
router.delete('/:id', farmerAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id FROM plots WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    )
    if (!rows.length) return fail(res, '地块不存在', 404)
    await db.query('DELETE FROM plots WHERE id=?', [req.params.id])
    return ok(res, null, '已删除')
  } catch (e) {
    console.error('[plots-delete]', e)
    return fail(res, '删除失败', 500)
  }
})

module.exports = router
