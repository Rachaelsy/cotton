// server/routes/operator.js — 农机手（机手/合作社）后台接口
require('dotenv').config()
const express = require('express')
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const db      = require('../db/database')
const router  = express.Router()

const ok   = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

// ── 机手鉴权中间件 ───────────────────────────────────────────
function operatorAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ code: 401, msg: '请先登录' })
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    if (payload.role !== 'operator')
      return res.status(403).json({ code: 403, msg: '权限不足，仅农机手可访问' })
    req.operator = payload   // { id(user_id), phone, role, operator_id, org_name }
    next()
  } catch {
    res.status(401).json({ code: 401, msg: '登录已过期，请重新登录' })
  }
}

function parseJSON(str, fallback) {
  try { return str ? JSON.parse(str) : fallback } catch { return fallback }
}

// 经纬度合法性校验（中国范围，可防止经纬度填反）
// 返回错误信息字符串，或 null 表示通过
function geoError(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return null // 允许留空（用基地坐标兜底）
  const la = parseFloat(lat), ln = parseFloat(lng)
  if (isNaN(la) || isNaN(ln)) return '经纬度格式不正确'
  if (la < 3 || la > 54)  return '纬度应在 3~54 之间，请检查是否与经度填反了（喀什纬度约 37~40）'
  if (ln < 73 || ln > 136) return '经度应在 73~136 之间，请检查是否与纬度填反了（喀什经度约 75~78）'
  return null
}

// ─────────────────────────────────────────────────────────────
// POST /api/operator/apply — 机手入驻申请（公开）
// ─────────────────────────────────────────────────────────────
router.post('/apply', async (req, res) => {
  const {
    phone, password, org_name, contact = '', id_card = '',
    service_area = '', latitude = null, longitude = null, location_name = ''
  } = req.body
  if (!phone || !/^1\d{10}$/.test(phone)) return fail(res, '请输入正确的手机号')
  if (!password || password.length < 6) return fail(res, '密码至少 6 位')
  if (!org_name || !org_name.trim()) return fail(res, '请填写合作社/机队名称')
  const conn = await db.getConnection()
  try {
    const [exist] = await conn.query('SELECT id FROM users WHERE phone=?', [phone])
    if (exist.length) return fail(res, '该手机号已注册')
    await conn.beginTransaction()
    const hash = await bcrypt.hash(password, 10)
    const [u] = await conn.query(
      'INSERT INTO users (phone,password,role,real_name) VALUES (?,?,?,?)',
      [phone, hash, 'operator', contact || org_name.trim()]
    )
    await conn.query(
      `INSERT INTO operators
       (user_id,org_name,contact,phone,id_card,service_area,latitude,longitude,location_name,apply_status)
       VALUES (?,?,?,?,?,?,?,?,?,'pending')`,
      [u.insertId, org_name.trim(), contact, phone, id_card, service_area,
       latitude || null, longitude || null, location_name]
    )
    await conn.commit()
    return ok(res, null, '入驻申请已提交，请等待平台审核')
  } catch (e) {
    await conn.rollback()
    console.error('[op-apply]', e)
    return fail(res, '提交失败', 500)
  } finally {
    conn.release()
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/operator/login — 机手登录
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { phone, password } = req.body
  if (!phone || !password) return fail(res, '请输入手机号和密码')
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.phone, u.password, u.real_name, u.is_active,
             o.id AS operator_id, o.org_name, o.apply_status, o.reject_reason
      FROM users u JOIN operators o ON o.user_id = u.id
      WHERE u.phone = ? AND u.role = 'operator'
    `, [phone])
    if (!rows.length) return fail(res, '账号不存在，请确认为农机手账号', 404)
    const u = rows[0]
    if (!u.is_active) return fail(res, '账号已被禁用，请联系平台客服', 403)
    if (u.apply_status === 'pending')  return fail(res, '入驻申请正在审核中，请耐心等待', 403)
    if (u.apply_status === 'rejected') return fail(res, `入驻申请已被拒绝：${u.reject_reason || '不符合条件'}`, 403)
    if (!await bcrypt.compare(password, u.password)) return fail(res, '密码错误')
    const token = jwt.sign(
      { id: u.id, phone: u.phone, role: 'operator', operator_id: u.operator_id, org_name: u.org_name },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    )
    return ok(res, {
      token, id: u.id, phone: u.phone, real_name: u.real_name,
      operator_id: u.operator_id, org_name: u.org_name
    }, '登录成功')
  } catch (e) { console.error('[op-login]', e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// GET /api/operator/profile — 机手资料
// ─────────────────────────────────────────────────────────────
router.get('/profile', operatorAuth, async (req, res) => {
  try {
    const [[o]] = await db.query('SELECT * FROM operators WHERE id=?', [req.operator.operator_id])
    if (!o) return fail(res, '机手信息不存在', 404)
    return ok(res, o)
  } catch (e) { console.error('[op-profile]', e); return fail(res, '服务器错误', 500) }
})

// PUT /api/operator/profile — 更新基地信息/定位
router.put('/profile', operatorAuth, async (req, res) => {
  const { org_name, contact, phone, service_area, latitude, longitude, location_name, response_time } = req.body
  try {
    await db.query(
      `UPDATE operators SET org_name=?,contact=?,phone=?,service_area=?,
       latitude=?,longitude=?,location_name=?,response_time=? WHERE id=?`,
      [org_name || '', contact || '', phone || '', service_area || '',
       latitude || null, longitude || null, location_name || '',
       response_time || '30分钟', req.operator.operator_id]
    )
    return ok(res, null, '资料已更新')
  } catch (e) { console.error('[op-profile-update]', e); return fail(res, '更新失败', 500) }
})

// ─────────────────────────────────────────────────────────────
// 机具管理
// ─────────────────────────────────────────────────────────────

// GET /api/operator/machines — 本机手机具列表
router.get('/machines', operatorAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM machines WHERE operator_id=? ORDER BY created_at DESC',
      [req.operator.operator_id]
    )
    rows.forEach(m => {
      m.spec_badges = parseJSON(m.spec_badges, [])
      m.params = parseJSON(m.params, [])
    })
    return ok(res, rows)
  } catch (e) { console.error('[op-machines]', e); return fail(res, '获取失败', 500) }
})

// POST /api/operator/machines — 发布机具
router.post('/machines', operatorAuth, async (req, res) => {
  const {
    name, category = '其他', icon = '🚜', price, price_orig = null, unit = '亩',
    latitude = null, longitude = null, location_name = '',
    spec_badges = [], params = [], description = ''
  } = req.body
  if (!name || !name.trim()) return fail(res, '请填写机具名称')
  if (!price || isNaN(price) || price <= 0) return fail(res, '请填写正确的单价')
  const ge = geoError(latitude, longitude)
  if (ge) return fail(res, ge)
  try {
    const [r] = await db.query(
      `INSERT INTO machines
       (operator_id,name,category,icon,price,price_orig,unit,latitude,longitude,location_name,spec_badges,params,description)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.operator.operator_id, name.trim(), category, icon, parseFloat(price),
       price_orig ? parseFloat(price_orig) : null, unit,
       latitude || null, longitude || null, location_name,
       JSON.stringify(spec_badges || []), JSON.stringify(params || []), description]
    )
    return ok(res, { id: r.insertId }, '机具已发布')
  } catch (e) { console.error('[op-machine-add]', e); return fail(res, '发布失败', 500) }
})

// PUT /api/operator/machines/:id — 编辑机具
router.put('/machines/:id', operatorAuth, async (req, res) => {
  const {
    name, category, icon, price, price_orig, unit,
    latitude, longitude, location_name, spec_badges, params, description
  } = req.body
  const ge = geoError(latitude, longitude)
  if (ge) return fail(res, ge)
  try {
    const [[m]] = await db.query('SELECT id FROM machines WHERE id=? AND operator_id=?',
      [req.params.id, req.operator.operator_id])
    if (!m) return fail(res, '机具不存在或无权限', 404)
    await db.query(
      `UPDATE machines SET name=?,category=?,icon=?,price=?,price_orig=?,unit=?,
       latitude=?,longitude=?,location_name=?,spec_badges=?,params=?,description=? WHERE id=?`,
      [name, category || '其他', icon || '🚜', parseFloat(price),
       price_orig ? parseFloat(price_orig) : null, unit || '亩',
       latitude || null, longitude || null, location_name || '',
       JSON.stringify(spec_badges || []), JSON.stringify(params || []), description || '',
       req.params.id]
    )
    return ok(res, null, '修改成功')
  } catch (e) { console.error('[op-machine-edit]', e); return fail(res, '修改失败', 500) }
})

// PATCH /api/operator/machines/:id/status — 上下架
router.patch('/machines/:id/status', operatorAuth, async (req, res) => {
  const { status } = req.body
  if (!['on', 'off', 'busy'].includes(status)) return fail(res, '状态值无效')
  try {
    const [[m]] = await db.query('SELECT id FROM machines WHERE id=? AND operator_id=?',
      [req.params.id, req.operator.operator_id])
    if (!m) return fail(res, '机具不存在或无权限', 404)
    await db.query('UPDATE machines SET status=? WHERE id=?', [status, req.params.id])
    return ok(res, null, '操作成功')
  } catch (e) { console.error('[op-machine-status]', e); return fail(res, '操作失败', 500) }
})

// DELETE /api/operator/machines/:id
router.delete('/machines/:id', operatorAuth, async (req, res) => {
  try {
    const [[m]] = await db.query('SELECT id FROM machines WHERE id=? AND operator_id=?',
      [req.params.id, req.operator.operator_id])
    if (!m) return fail(res, '机具不存在或无权限', 404)
    await db.query('DELETE FROM machines WHERE id=?', [req.params.id])
    return ok(res, null, '已删除')
  } catch (e) { console.error('[op-machine-del]', e); return fail(res, '删除失败', 500) }
})

// ─────────────────────────────────────────────────────────────
// 接单 / 订单管理
// ─────────────────────────────────────────────────────────────

// GET /api/operator/orders — 订单列表（可按 status 筛选）
router.get('/orders', operatorAuth, async (req, res) => {
  try {
    const { status } = req.query
    let sql = `SELECT *, DATE_FORMAT(work_date,'%Y-%m-%d') AS work_date
               FROM machine_orders WHERE operator_id=? AND operator_deleted=0`
    const params = [req.operator.operator_id]
    if (status && status !== 'all') { sql += ' AND status=?'; params.push(status) }
    sql += ' ORDER BY created_at DESC'
    const [rows] = await db.query(sql, params)
    return ok(res, rows)
  } catch (e) { console.error('[op-orders]', e); return fail(res, '获取失败', 500) }
})

// PATCH /api/operator/orders/:id/accept — 接单
router.patch('/orders/:id/accept', operatorAuth, async (req, res) => {
  try {
    const [[o]] = await db.query('SELECT * FROM machine_orders WHERE id=? AND operator_id=?',
      [req.params.id, req.operator.operator_id])
    if (!o) return fail(res, '订单不存在', 404)
    if (o.status !== 'pending') return fail(res, '该订单已处理')
    await db.query("UPDATE machine_orders SET status='accepted', accepted_at=NOW() WHERE id=?", [req.params.id])
    await db.query('UPDATE machines SET order_count=order_count+1 WHERE id=?', [o.machine_id])
    return ok(res, null, '已接单')
  } catch (e) { console.error('[op-accept]', e); return fail(res, '操作失败', 500) }
})

// PATCH /api/operator/orders/:id/reject — 拒单
router.patch('/orders/:id/reject', operatorAuth, async (req, res) => {
  const { reason = '' } = req.body
  try {
    const [[o]] = await db.query('SELECT * FROM machine_orders WHERE id=? AND operator_id=?',
      [req.params.id, req.operator.operator_id])
    if (!o) return fail(res, '订单不存在', 404)
    if (o.status !== 'pending') return fail(res, '该订单已处理')
    await db.query("UPDATE machine_orders SET status='cancelled', reject_reason=? WHERE id=?",
      [reason || '机手已拒单', req.params.id])
    return ok(res, null, '已拒单，定金原路退回')
  } catch (e) { console.error('[op-reject]', e); return fail(res, '操作失败', 500) }
})

// PATCH /api/operator/orders/:id/status — 推进作业状态
// departed(已出发) → arrived(已到场) → working(作业中) → completed(已完成)
const FLOW = { accepted: 'departed', departed: 'arrived', arrived: 'working', working: 'completed' }
router.patch('/orders/:id/status', operatorAuth, async (req, res) => {
  const { status } = req.body
  try {
    const [[o]] = await db.query('SELECT * FROM machine_orders WHERE id=? AND operator_id=?',
      [req.params.id, req.operator.operator_id])
    if (!o) return fail(res, '订单不存在', 404)
    if (FLOW[o.status] !== status)
      return fail(res, `当前状态(${o.status})不能推进到 ${status}`)
    const done = status === 'completed' ? ', completed_at=NOW()' : ''
    await db.query(`UPDATE machine_orders SET status=?${done} WHERE id=?`, [status, req.params.id])
    return ok(res, null, '状态已更新')
  } catch (e) { console.error('[op-status]', e); return fail(res, '操作失败', 500) }
})

// DELETE /api/operator/orders/:id — 删除（隐藏）订单（仅已完成/已取消）
router.delete('/orders/:id', operatorAuth, async (req, res) => {
  try {
    const [[o]] = await db.query('SELECT status FROM machine_orders WHERE id=? AND operator_id=?',
      [req.params.id, req.operator.operator_id])
    if (!o) return fail(res, '订单不存在', 404)
    if (!['completed', 'cancelled'].includes(o.status))
      return fail(res, '仅已完成或已取消的订单可删除')
    await db.query('UPDATE machine_orders SET operator_deleted=1 WHERE id=?', [req.params.id])
    return ok(res, null, '已删除记录')
  } catch (e) { console.error('[op-order-delete]', e); return fail(res, '删除失败', 500) }
})

// GET /api/operator/stats — 工作台统计
router.get('/stats', operatorAuth, async (req, res) => {
  try {
    const oid = req.operator.operator_id
    const [[mc]] = await db.query("SELECT COUNT(*) AS n FROM machines WHERE operator_id=? AND status!='off'", [oid])
    const [[pend]] = await db.query("SELECT COUNT(*) AS n FROM machine_orders WHERE operator_id=? AND status='pending'", [oid])
    const [[active]] = await db.query("SELECT COUNT(*) AS n FROM machine_orders WHERE operator_id=? AND status IN ('accepted','departed','arrived','working')", [oid])
    const [[income]] = await db.query("SELECT IFNULL(SUM(total_price),0) AS s FROM machine_orders WHERE operator_id=? AND status='completed'", [oid])
    return ok(res, {
      machine_count: mc.n, pending_count: pend.n,
      active_count: active.n, total_income: parseFloat(income.s)
    })
  } catch (e) { console.error('[op-stats]', e); return fail(res, '获取失败', 500) }
})

module.exports = router
