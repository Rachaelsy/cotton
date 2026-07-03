// server/routes/machine-orders.js — 农户端：农机预约订单
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

function genOrderNo() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  return `MJ${stamp}${Math.floor(Math.random() * 900 + 100)}`
}

const STATUS_LABEL = {
  pending: '待接单', accepted: '已接单', departed: '已出发',
  arrived: '已到场', working: '作业中', completed: '已完成', cancelled: '已取消'
}

// ─────────────────────────────────────────────────────────────
// POST /api/machine-orders — 提交预约
// ─────────────────────────────────────────────────────────────
router.post('/', farmerAuth, async (req, res) => {
  const {
    machine_id, plot_id = null, plot_name = '', work_address = '', work_date, work_area,
    pay_mode = 'deposit', farmer_lat = null, farmer_lng = null,
    contact_phone = '', note = ''
  } = req.body
  if (!machine_id) return fail(res, '缺少机具信息')
  if (!work_address || !work_address.trim()) return fail(res, '请填写作业地址')
  if (!work_date) return fail(res, '请选择作业日期')
  if (!work_area || isNaN(work_area) || work_area <= 0) return fail(res, '请填写作业面积')
  try {
    const [[m]] = await db.query(
      "SELECT * FROM machines WHERE id=? AND status IN ('on','busy')", [machine_id]
    )
    if (!m) return fail(res, '机具不存在或已下架', 404)
    const unitPrice = parseFloat(m.price)
    const totalPrice = +(unitPrice * parseFloat(work_area)).toFixed(2)
    const deposit = +(totalPrice * 0.2).toFixed(2)
    const [[farmer]] = await db.query('SELECT real_name FROM users WHERE id=?', [req.user.id])
    const orderNo = genOrderNo()
    const [r] = await db.query(
      `INSERT INTO machine_orders
       (order_no,machine_id,operator_id,farmer_id,machine_name,machine_icon,
        plot_id,plot_name,work_address,work_date,work_area,unit_price,total_price,deposit,pay_mode,
        farmer_lat,farmer_lng,farmer_name,contact_phone,note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [orderNo, machine_id, m.operator_id, req.user.id, m.name, m.icon,
       plot_id || null, plot_name, work_address.trim(), work_date, parseFloat(work_area),
       unitPrice, totalPrice, deposit, pay_mode,
       farmer_lat || null, farmer_lng || null,
       farmer?.real_name || '', contact_phone, note]
    )
    return ok(res, {
      id: r.insertId, order_no: orderNo, total_price: totalPrice, deposit
    }, '预约已提交')
  } catch (e) { console.error('[mo-create]', e); return fail(res, '提交失败', 500) }
})

// ─────────────────────────────────────────────────────────────
// GET /api/machine-orders/my — 我的预约（?status 筛选）
// ─────────────────────────────────────────────────────────────
router.get('/my', farmerAuth, async (req, res) => {
  try {
    const { status } = req.query
    let sql = `SELECT *, DATE_FORMAT(work_date,'%Y-%m-%d') AS work_date
               FROM machine_orders WHERE farmer_id=? AND farmer_deleted=0`
    const params = [req.user.id]
    if (status && status !== 'all') {
      if (status === 'ongoing') sql += " AND status IN ('accepted','departed','arrived','working')"
      else { sql += ' AND status=?'; params.push(status) }
    }
    sql += ' ORDER BY created_at DESC'
    const [rows] = await db.query(sql, params)
    rows.forEach(o => { o.status_label = STATUS_LABEL[o.status] || o.status })
    return ok(res, rows)
  } catch (e) { console.error('[mo-my]', e); return fail(res, '获取失败', 500) }
})

// ─────────────────────────────────────────────────────────────
// GET /api/machine-orders/:id — 订单详情/跟踪
// ─────────────────────────────────────────────────────────────
router.get('/:id', farmerAuth, async (req, res) => {
  try {
    const [[o]] = await db.query(`
      SELECT mo.*, DATE_FORMAT(mo.work_date,'%Y-%m-%d') AS work_date,
             op.org_name, op.phone AS operator_phone, op.response_time,
             op.latitude AS op_lat, op.longitude AS op_lng, op.location_name AS op_location
      FROM machine_orders mo
      JOIN operators op ON op.id = mo.operator_id
      WHERE mo.id=? AND mo.farmer_id=?
    `, [req.params.id, req.user.id])
    if (!o) return fail(res, '订单不存在', 404)
    o.status_label = STATUS_LABEL[o.status] || o.status
    // 机手→地块的距离（实时位置示意）
    if (o.op_lat && o.op_lng && o.farmer_lat && o.farmer_lng) {
      const [[d]] = await db.query(
        'SELECT ROUND(ST_Distance_Sphere(POINT(?,?),POINT(?,?))/1000,1) AS km',
        [o.op_lng, o.op_lat, o.farmer_lng, o.farmer_lat]
      )
      o.distance_km = d.km !== null ? Number(d.km) : null
    } else o.distance_km = null
    return ok(res, o)
  } catch (e) { console.error('[mo-detail]', e); return fail(res, '获取失败', 500) }
})

// ─────────────────────────────────────────────────────────────
// PATCH /api/machine-orders/:id/pay — 已废弃：必须走微信支付接口
// ─────────────────────────────────────────────────────────────
router.patch('/:id/pay', farmerAuth, async (req, res) => {
  return fail(res, '请通过微信支付接口完成付款', 410)

  try {
    const [[o]] = await db.query('SELECT * FROM machine_orders WHERE id=? AND farmer_id=?',
      [req.params.id, req.user.id])
    if (!o) return fail(res, '订单不存在', 404)
    if (o.pay_status === 'paid') return fail(res, '订单已支付')
    await db.query("UPDATE machine_orders SET pay_status='paid' WHERE id=?", [req.params.id])
    return ok(res, null, '支付成功')
  } catch (e) { console.error('[mo-pay]', e); return fail(res, '支付失败', 500) }
})

// ─────────────────────────────────────────────────────────────
// PATCH /api/machine-orders/:id/cancel — 取消（仅待接单可取消）
// ─────────────────────────────────────────────────────────────
router.patch('/:id/cancel', farmerAuth, async (req, res) => {
  try {
    const [[o]] = await db.query('SELECT * FROM machine_orders WHERE id=? AND farmer_id=?',
      [req.params.id, req.user.id])
    if (!o) return fail(res, '订单不存在', 404)
    if (o.status !== 'pending') return fail(res, '已接单订单无法取消，请联系机手')
    await db.query("UPDATE machine_orders SET status='cancelled', reject_reason='农户取消' WHERE id=?",
      [req.params.id])
    return ok(res, null, '已取消，定金原路退回')
  } catch (e) { console.error('[mo-cancel]', e); return fail(res, '取消失败', 500) }
})

// ─────────────────────────────────────────────────────────────
// DELETE /api/machine-orders/:id — 删除（隐藏）订单（仅已完成/已取消）
// ─────────────────────────────────────────────────────────────
router.delete('/:id', farmerAuth, async (req, res) => {
  try {
    const [[o]] = await db.query('SELECT status FROM machine_orders WHERE id=? AND farmer_id=?',
      [req.params.id, req.user.id])
    if (!o) return fail(res, '订单不存在', 404)
    if (!['completed', 'cancelled'].includes(o.status))
      return fail(res, '仅已完成或已取消的订单可删除')
    await db.query('UPDATE machine_orders SET farmer_deleted=1 WHERE id=?', [req.params.id])
    return ok(res, null, '已删除记录')
  } catch (e) { console.error('[mo-delete]', e); return fail(res, '删除失败', 500) }
})

// ─────────────────────────────────────────────────────────────
// POST /api/machine-orders/:id/review — 评价（分项）
// ─────────────────────────────────────────────────────────────
router.post('/:id/review', farmerAuth, async (req, res) => {
  const {
    score_timely = 5, score_quality = 5, score_attitude = 5, score_price = 5, content = ''
  } = req.body
  const clamp = v => Math.min(5, Math.max(1, parseInt(v) || 5))
  const st = clamp(score_timely), sq = clamp(score_quality)
  const sa = clamp(score_attitude), sp = clamp(score_price)
  const rating = +((st + sq + sa + sp) / 4).toFixed(2)
  try {
    const [[o]] = await db.query('SELECT * FROM machine_orders WHERE id=? AND farmer_id=?',
      [req.params.id, req.user.id])
    if (!o) return fail(res, '订单不存在', 404)
    if (o.status !== 'completed') return fail(res, '订单完成后才能评价')
    const [[exist]] = await db.query('SELECT id FROM machine_reviews WHERE order_id=?', [req.params.id])
    if (exist) return fail(res, '该订单已评价')
    await db.query(
      `INSERT INTO machine_reviews
       (order_id,machine_id,operator_id,farmer_id,farmer_name,
        score_timely,score_quality,score_attitude,score_price,rating,content)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [req.params.id, o.machine_id, o.operator_id, req.user.id, o.farmer_name,
       st, sq, sa, sp, rating, content]
    )
    // 更新机具与机手的平均评分
    await db.query(
      'UPDATE machines SET rating_avg=(SELECT AVG(rating) FROM machine_reviews WHERE machine_id=?) WHERE id=?',
      [o.machine_id, o.machine_id]
    )
    await db.query(
      'UPDATE operators SET rating_avg=(SELECT AVG(rating) FROM machine_reviews WHERE operator_id=?) WHERE id=?',
      [o.operator_id, o.operator_id]
    )
    return ok(res, null, '评价成功，感谢您的反馈')
  } catch (e) { console.error('[mo-review]', e); return fail(res, '评价失败', 500) }
})

module.exports = router
