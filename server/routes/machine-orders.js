// server/routes/machine-orders.js — 农户端：农机预约订单
const express = require('express')
const jwt     = require('jsonwebtoken')
const db      = require('../db/database')
const refunds = require('../utils/refunds')
const machineLifecycle = require('../utils/machine-order-lifecycle')
const router  = express.Router()

const ok   = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function farmerAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ code: 401, msg: '请先登录' })
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    if (req.user.role !== 'farmer') return res.status(403).json({ code: 403, msg: '仅农户可预约农机' })
    next()
  } catch {
    res.status(401).json({ code: 401, msg: '登录已过期' })
  }
}

function businessToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIMEZONE || 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date())
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function coordinates(lat, lng) {
  const hasLat = lat !== null && lat !== undefined && lat !== ''
  const hasLng = lng !== null && lng !== undefined && lng !== ''
  if (!hasLat && !hasLng) return null
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!hasLat || !hasLng || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false
  return { latitude, longitude }
}

function distanceKm(a, b) {
  const rad = value => value * Math.PI / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
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
  if (work_address.trim().length > 255) return fail(res, '作业地址不能超过255个字')
  if (!isValidDate(work_date)) return fail(res, '请选择正确的作业日期')
  if (work_date < businessToday()) return fail(res, '作业日期不能早于今天')
  const area = Number(work_area)
  if (!Number.isFinite(area) || area <= 0 || area > 100000) return fail(res, '请填写正确的计费数量')
  if (!['deposit', 'full'].includes(pay_mode)) return fail(res, '支付方式无效')
  if (String(note || '').length > 255) return fail(res, '备注不能超过255个字')
  const workCoordinates = coordinates(farmer_lat, farmer_lng)
  if (workCoordinates === false) return fail(res, '作业地点坐标无效')
  await machineLifecycle.expireUnpaidMachineOrders({}).catch(error => {
    console.error('[machine-expire-before-create]', error.message)
  })
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[m]] = await conn.query(
      `SELECT m.*,COALESCE(m.latitude,o.latitude) AS service_lat,
              COALESCE(m.longitude,o.longitude) AS service_lng,
              o.sub_mchid,o.apply_status
         FROM machines m JOIN operators o ON o.id=m.operator_id
        WHERE m.id=? AND m.status IN ('on','busy') AND o.apply_status='approved'
        FOR UPDATE`,
      [machine_id]
    )
    if (!m) {
      await conn.rollback()
      return fail(res, '机具不存在、已下架或服务方未通过审核', 404)
    }
    if (!m.sub_mchid) {
      await conn.rollback()
      return fail(res, '该农机服务方尚未开通微信收款，暂不能预约', 409)
    }
    const billingUnit = m.unit === '天' ? '天' : '亩'
    if (billingUnit === '天' && (!Number.isInteger(area) || area > 365)) {
      await conn.rollback()
      return fail(res, '租赁天数应为1到365的整数')
    }
    const workEndDate = billingUnit === '天' ? addDays(work_date, area - 1) : work_date
    if (workCoordinates && m.service_lat !== null && m.service_lng !== null) {
      const km = distanceKm(
        { latitude: Number(m.service_lat), longitude: Number(m.service_lng) },
        workCoordinates
      )
      if (km > Number(m.service_radius || 50)) {
        await conn.rollback()
        return fail(res, `作业地点距农机约${km.toFixed(1)}公里，超出${Number(m.service_radius || 50)}公里服务范围`, 409)
      }
    }
    const [[conflict]] = await conn.query(
      `SELECT id FROM machine_orders
        WHERE machine_id=? AND status!='cancelled'
          AND work_date<=? AND COALESCE(work_end_date,work_date)>=? LIMIT 1`,
      [machine_id, workEndDate, work_date]
    )
    if (conflict) {
      await conn.rollback()
      return fail(res, '该机具所选日期已有预约，请调整日期或选择其他机具', 409)
    }
    const unitPrice = parseFloat(m.price)
    const totalPrice = +(unitPrice * area).toFixed(2)
    const deposit = Math.max(0.01, +(totalPrice * 0.2).toFixed(2))
    const [[farmer]] = await conn.query('SELECT real_name,phone FROM users WHERE id=?', [req.user.id])
    const phone = String(contact_phone || farmer?.phone || '').trim()
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      await conn.rollback()
      return fail(res, '请填写正确的11位联系电话')
    }
    const orderNo = genOrderNo()
    const paymentMinutes = machineLifecycle.paymentWindowMinutes()
    const [r] = await conn.query(
      `INSERT INTO machine_orders
       (order_no,machine_id,operator_id,farmer_id,machine_name,machine_icon,
        plot_id,plot_name,work_address,work_date,work_end_date,work_area,unit_price,billing_unit,total_price,deposit,pay_mode,pay_expires_at,
        farmer_lat,farmer_lng,farmer_name,contact_phone,note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,DATE_ADD(NOW(), INTERVAL ${paymentMinutes} MINUTE),?,?,?,?,?)`,
      [orderNo, machine_id, m.operator_id, req.user.id, m.name, m.icon,
       plot_id || null, plot_name, work_address.trim(), work_date, workEndDate, area,
       unitPrice, billingUnit, totalPrice, deposit, pay_mode,
       workCoordinates ? workCoordinates.latitude : null, workCoordinates ? workCoordinates.longitude : null,
       farmer?.real_name || '', phone, String(note || '').trim()]
    )
    await conn.commit()
    return ok(res, {
      id: r.insertId, order_no: orderNo, total_price: totalPrice, deposit,
      payment_window_minutes: paymentMinutes, billing_unit: billingUnit, work_end_date: workEndDate
    }, `预约已提交，请在${paymentMinutes}分钟内完成付款`)
  } catch (e) {
    await conn.rollback().catch(() => {})
    console.error('[mo-create]', e)
    return fail(res, '提交失败', 500)
  } finally {
    conn.release()
  }
})

// ─────────────────────────────────────────────────────────────
// GET /api/machine-orders/my — 我的预约（?status 筛选）
// ─────────────────────────────────────────────────────────────
router.get('/my', farmerAuth, async (req, res) => {
  try {
    await machineLifecycle.expireUnpaidMachineOrders({ farmerId: req.user.id })
    await refunds.syncPendingMachineRefunds({ farmerId: req.user.id }).catch(error => {
      console.error('[machine-refund-sync-farmer]', error.message)
    })
    const { status } = req.query
    let sql = `SELECT *, DATE_FORMAT(work_date,'%Y-%m-%d') AS work_date,
                      DATE_FORMAT(work_end_date,'%Y-%m-%d') AS work_end_date
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
    await machineLifecycle.expireUnpaidMachineOrders({ farmerId: req.user.id, orderId: req.params.id })
    await refunds.syncPendingMachineRefunds({ farmerId: req.user.id, orderId: req.params.id }).catch(error => {
      console.error('[machine-refund-sync-detail]', error.message)
    })
    const [[o]] = await db.query(`
      SELECT mo.*, DATE_FORMAT(mo.work_date,'%Y-%m-%d') AS work_date,
             DATE_FORMAT(mo.work_end_date,'%Y-%m-%d') AS work_end_date,
             op.org_name, op.phone AS operator_phone, op.response_time,
             CASE WHEN op.live_location_updated_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
                  THEN op.live_latitude ELSE op.latitude END AS op_lat,
             CASE WHEN op.live_location_updated_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
                  THEN op.live_longitude ELSE op.longitude END AS op_lng,
             op.location_name AS op_location,
             CASE WHEN op.live_location_updated_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
                  THEN 1 ELSE 0 END AS is_live_location,
             EXISTS(SELECT 1 FROM machine_reviews mr WHERE mr.order_id=mo.id) AS has_review,
             DATE_FORMAT(op.live_location_updated_at,'%Y-%m-%d %H:%i:%s') AS live_location_updated_at
      FROM machine_orders mo
      JOIN operators op ON op.id = mo.operator_id
      WHERE mo.id=? AND mo.farmer_id=?
    `, [req.params.id, req.user.id])
    if (!o) return fail(res, '订单不存在', 404)
    o.status_label = STATUS_LABEL[o.status] || o.status
    // Live location is used only while the operator has updated it in the last 10 minutes.
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
    const [changed] = await db.query(
      "UPDATE machine_orders SET status='cancelled',reject_reason='农户取消' WHERE id=? AND farmer_id=? AND status='pending'",
      [req.params.id, req.user.id]
    )
    if (!changed.affectedRows) return fail(res, '订单状态已变化，请刷新后重试', 409)
    let refund = null
    let refundError = null
    if (['partial', 'paid'].includes(o.pay_status)) {
      try {
        refund = await refunds.createMachineRefund({
          orderId: Number(req.params.id), farmerId: req.user.id, reason: '农户取消农机预约'
        })
      } catch (error) {
        refundError = error
        console.error('[mo-cancel-refund]', error)
        await db.query("UPDATE machine_orders SET refund_status='FAILED' WHERE id=?", [req.params.id])
      }
    }
    if (refundError) {
      return ok(res, { refund_status: 'FAILED' }, '预约已取消，但退款发起失败，请联系客服处理')
    }
    const message = refund
      ? (refund.status === 'SUCCESS' ? '已取消，款项已原路退回' : '已取消，微信退款处理中')
      : '已取消（该订单未支付）'
    return ok(res, { refund_status: refund && refund.status || '' }, message)
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
    if (o.pay_status !== 'paid') return fail(res, '请先付清尾款后再评价')
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
