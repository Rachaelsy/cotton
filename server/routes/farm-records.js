// server/routes/farm-records.js — 农事记录接口
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
// GET /api/farm-records — 获取当前用户全部农事记录
// 支持筛选：?type=灌溉  &plot_id=3
// ─────────────────────────────────────────────
router.get('/', farmerAuth, async (req, res) => {
  try {
    const { type, plot_id } = req.query
    let sql = `SELECT id, plot_id, plot_name, type, title,
                      DATE_FORMAT(work_date,'%Y-%m-%d') AS work_date,
                      work_time, amount, cost, worker, note
               FROM farm_records WHERE user_id=?`
    const params = [req.user.id]
    if (type && type !== '全部') { sql += ' AND type=?'; params.push(type) }
    if (plot_id) { sql += ' AND plot_id=?'; params.push(parseInt(plot_id)) }
    sql += ' ORDER BY work_date DESC, work_time DESC, id DESC'
    const [rows] = await db.query(sql, params)
    return ok(res, rows)
  } catch (e) {
    console.error('[farm-records-list]', e)
    return fail(res, '服务器错误', 500)
  }
})

// ─────────────────────────────────────────────
// POST /api/farm-records — 新增农事记录
// ─────────────────────────────────────────────
router.post('/', farmerAuth, async (req, res) => {
  const {
    plot_id = null, plot_name = '全部地块', type, title = '',
    work_date, work_time = '', amount = '', cost = 0,
    worker = '本人', note = ''
  } = req.body
  if (!type || !type.trim()) return fail(res, '请选择农事类型')
  if (!work_date) return fail(res, '请选择日期')
  try {
    const [r] = await db.query(
      `INSERT INTO farm_records
       (user_id,plot_id,plot_name,type,title,work_date,work_time,amount,cost,worker,note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id, plot_id || null, plot_name || '全部地块',
        type.trim(), title || type.trim(), work_date, work_time || '',
        amount || '', parseFloat(cost) || 0, worker || '本人', note || ''
      ]
    )
    return ok(res, { id: r.insertId }, '记录已添加')
  } catch (e) {
    console.error('[farm-records-create]', e)
    return fail(res, '保存失败', 500)
  }
})

// ─────────────────────────────────────────────
// PUT /api/farm-records/:id — 更新农事记录
// ─────────────────────────────────────────────
router.put('/:id', farmerAuth, async (req, res) => {
  const {
    plot_id = null, plot_name = '全部地块', type, title = '',
    work_date, work_time = '', amount = '', cost = 0,
    worker = '本人', note = ''
  } = req.body
  if (!type || !type.trim()) return fail(res, '请选择农事类型')
  if (!work_date) return fail(res, '请选择日期')
  try {
    const [rows] = await db.query(
      'SELECT id FROM farm_records WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    )
    if (!rows.length) return fail(res, '记录不存在', 404)
    await db.query(
      `UPDATE farm_records SET
       plot_id=?,plot_name=?,type=?,title=?,work_date=?,work_time=?,
       amount=?,cost=?,worker=?,note=? WHERE id=?`,
      [
        plot_id || null, plot_name || '全部地块', type.trim(),
        title || type.trim(), work_date, work_time || '',
        amount || '', parseFloat(cost) || 0, worker || '本人', note || '',
        req.params.id
      ]
    )
    return ok(res, null, '记录已更新')
  } catch (e) {
    console.error('[farm-records-update]', e)
    return fail(res, '更新失败', 500)
  }
})

// ─────────────────────────────────────────────
// POST /api/farm-records/batch-delete — 批量删除（body: { ids:[1,2,3] }）
// 用 POST 而非 DELETE，避免部分客户端不发送 DELETE 请求体
// ─────────────────────────────────────────────
router.post('/batch-delete', farmerAuth, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return fail(res, '请选择要删除的记录')
  try {
    const placeholders = ids.map(() => '?').join(',')
    const [r] = await db.query(
      `DELETE FROM farm_records WHERE user_id=? AND id IN (${placeholders})`,
      [req.user.id, ...ids]
    )
    return ok(res, { deleted: r.affectedRows }, `已删除 ${r.affectedRows} 条`)
  } catch (e) {
    console.error('[farm-records-batch-delete]', e)
    return fail(res, '删除失败', 500)
  }
})

// ─────────────────────────────────────────────
// DELETE /api/farm-records/:id — 删除单条记录
// ─────────────────────────────────────────────
router.delete('/:id', farmerAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id FROM farm_records WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    )
    if (!rows.length) return fail(res, '记录不存在', 404)
    await db.query('DELETE FROM farm_records WHERE id=?', [req.params.id])
    return ok(res, null, '已删除')
  } catch (e) {
    console.error('[farm-records-delete]', e)
    return fail(res, '删除失败', 500)
  }
})

module.exports = router
