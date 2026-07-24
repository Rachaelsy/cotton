// server/routes/operator.js — 农机手（机手/合作社）后台接口
require('dotenv').config()
const express = require('express')
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const db      = require('../db/database')
const commissionRequests = require('../utils/commission-requests')
const applymentRegistration = require('../utils/applyment-registration')
const refunds = require('../utils/refunds')
const machineLifecycle = require('../utils/machine-order-lifecycle')
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

router.get('/commission', operatorAuth, async (req, res) => {
  try {
    return ok(res, await commissionRequests.getSummary('operator', req.operator.operator_id))
  } catch (error) { return fail(res, error.message || '佣金信息加载失败', 500) }
})

router.post('/commission-change-requests', operatorAuth, async (req, res) => {
  try {
    const data = await commissionRequests.submit(
      'operator', req.operator.operator_id, req.body.requested_rate, req.body.reason
    )
    return ok(res, data, '佣金调整申请已提交，等待管理员审核')
  } catch (error) { return fail(res, error.message || '申请提交失败', 400) }
})

router.get('/finance', operatorAuth, async (req, res) => {
  try {
    const operatorId = req.operator.operator_id
    const [[operator]] = await db.query('SELECT commission_rate FROM operators WHERE id=?', [operatorId])
    const [orders] = await db.query(`
      SELECT mo.id,mo.order_no,mo.machine_name,mo.paid_amount,mo.total_price,mo.pay_mode,
             mo.fund_status,mo.paid_at,mo.completed_at,
             ps.amount_fen AS profit_sharing_amount_fen,ps.state AS profit_sharing_state,
             ps.error_msg AS profit_sharing_error,ps.wechat_order_id
      FROM machine_orders mo
      LEFT JOIN (
        SELECT order_id,SUM(amount_fen) AS amount_fen,
               CASE
                 WHEN SUM(state IN ('FAILED')) > 0 THEN 'FAILED'
                 WHEN SUM(state NOT IN ('SUCCESS','FINISHED')) > 0 THEN 'PROCESSING'
                 ELSE 'SUCCESS' END AS state,
               GROUP_CONCAT(NULLIF(error_msg,'') SEPARATOR '; ') AS error_msg,
               GROUP_CONCAT(NULLIF(wechat_order_id,'') SEPARATOR ',') AS wechat_order_id
          FROM wechat_profit_sharing_orders
         WHERE order_type='machine' GROUP BY order_id
      ) ps ON ps.order_id=mo.id
      WHERE mo.operator_id=? AND mo.pay_status='paid'
      ORDER BY mo.paid_at DESC,mo.id DESC LIMIT 100
    `, [operatorId])
    const commissionRate = Number(operator?.commission_rate || 0)
    const rows = orders.map(order => {
      const paid = Number(order.paid_amount || 0)
      const commission = order.profit_sharing_amount_fen == null
        ? Number((paid * commissionRate / 100).toFixed(2))
        : Number((Number(order.profit_sharing_amount_fen) / 100).toFixed(2))
      return {
        ...order,
        paid_amount: paid,
        commission,
        commission_amount: commission,
        net_amount: Number((paid - commission).toFixed(2))
      }
    })
    const paidTotal = Number(rows.reduce((sum, row) => sum + row.paid_amount, 0).toFixed(2))
    const commissionTotal = Number(rows.reduce((sum, row) => sum + row.commission, 0).toFixed(2))
    const netTotal = Number(rows.reduce((sum, row) => sum + row.net_amount, 0).toFixed(2))
    return ok(res, {
      commission_rate: commissionRate,
      paid_total: paidTotal,
      commission_total: commissionTotal,
      net_total: netTotal,
      total_paid: paidTotal,
      total_commission: commissionTotal,
      total_net: netTotal,
      orders: rows,
      settlements: rows
    })
  } catch (error) { console.error('[operator-finance]', error); return fail(res, '结算信息加载失败', 500) }
})

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
    service_area = '', latitude = null, longitude = null, location_name = '',
    business_license = '', contact_mobile = '', merchant_shortname = '', service_phone = '',
    id_card_number = '', card_period_begin = '', card_period_end = '',
    account_bank = '', account_name = '', account_number = '',
    license_copy_url = '', id_card_copy_url = '', id_card_national_url = '', mini_program_pic_url = ''
  } = req.body
  if (!phone || !/^1\d{10}$/.test(phone)) return fail(res, '请输入正确的手机号')
  if (!password || password.length < 6) return fail(res, '密码至少 6 位')
  if (!org_name || !org_name.trim()) return fail(res, '请填写合作社/机队名称')
  if (!String(business_license).trim()) return fail(res, '请填写营业执照号')
  if (!/^1\d{10}$/.test(String(contact_mobile || phone).trim())) return fail(res, '请填写正确的联系人手机号')
  if (!String(id_card_number || id_card).trim()) return fail(res, '请填写身份证号')
  if (!String(card_period_begin).trim() || !String(card_period_end).trim()) return fail(res, '请填写身份证有效期')
  if (!String(merchant_shortname).trim() || !String(service_phone).trim()) return fail(res, '请填写商户简称和客服电话')
  if (!String(account_bank).trim() || !String(account_name).trim() || !String(account_number).trim()) return fail(res, '请补全结算账户信息')
  if (![license_copy_url, id_card_copy_url, id_card_national_url, mini_program_pic_url].every(value => String(value || '').trim())) {
    return fail(res, '请上传营业执照、身份证正反面和经营页面截图')
  }
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
    const applymentDraft = applymentRegistration.buildRegistrationDraft(req.body, {
      companyName: org_name,
      businessLicense: business_license,
      realName: contact,
      qualificationType: '零售批发/生活娱乐/其他'
    })
    await conn.query(
      `INSERT INTO operators
       (user_id,org_name,contact,phone,id_card,service_area,latitude,longitude,location_name,
        apply_status,wechat_applyment_state,wechat_applyment_payload)
       VALUES (?,?,?,?,?,?,?,?,?,'pending','DRAFT',?)`,
      [u.insertId, org_name.trim(), contact, phone, id_card, service_area,
       latitude || null, longitude || null, location_name, JSON.stringify(applymentDraft)]
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

// PATCH /api/operator/location - share current working location with active customers.
router.patch('/location', operatorAuth, async (req, res) => {
  const { latitude, longitude, accuracy = null } = req.body
  const ge = geoError(latitude, longitude)
  if (ge || latitude == null || longitude == null) return fail(res, ge || '缺少定位坐标')
  try {
    await db.query(
      `UPDATE operators SET live_latitude=?,live_longitude=?,live_accuracy=?,
              live_location_updated_at=NOW() WHERE id=?`,
      [Number(latitude), Number(longitude), accuracy == null ? null : Number(accuracy), req.operator.operator_id]
    )
    return ok(res, { updated_at: new Date().toISOString() }, '实时位置已更新')
  } catch (error) {
    console.error('[operator-live-location]', error)
    return fail(res, '实时位置更新失败', 500)
  }
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
    latitude = null, longitude = null, location_name = '', service_radius = 50,
    spec_badges = [], params = [], description = ''
  } = req.body
  if (!name || !name.trim()) return fail(res, '请填写机具名称')
  if (!price || isNaN(price) || price <= 0) return fail(res, '请填写正确的单价')
  if (price_orig !== null && price_orig !== '' && (!Number.isFinite(Number(price_orig)) || Number(price_orig) < Number(price))) {
    return fail(res, '原价不能低于当前单价')
  }
  if (!Number.isFinite(Number(service_radius)) || Number(service_radius) < 1 || Number(service_radius) > 500) {
    return fail(res, '服务范围应为1到500公里')
  }
  const ge = geoError(latitude, longitude)
  if (ge) return fail(res, ge)
  try {
    const [r] = await db.query(
      `INSERT INTO machines
       (operator_id,name,category,icon,price,price_orig,unit,latitude,longitude,location_name,service_radius,spec_badges,params,description)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.operator.operator_id, name.trim(), category, icon, parseFloat(price),
       price_orig ? parseFloat(price_orig) : null, unit,
       latitude || null, longitude || null, location_name, parseFloat(service_radius) || 50,
       JSON.stringify(spec_badges || []), JSON.stringify(params || []), description]
    )
    return ok(res, { id: r.insertId }, '机具已发布')
  } catch (e) { console.error('[op-machine-add]', e); return fail(res, '发布失败', 500) }
})

// PUT /api/operator/machines/:id — 编辑机具
router.put('/machines/:id', operatorAuth, async (req, res) => {
  const {
    name, category, icon, price, price_orig, unit,
    latitude, longitude, location_name, service_radius, spec_badges, params, description
  } = req.body
  const ge = geoError(latitude, longitude)
  if (ge) return fail(res, ge)
  if (!name || !name.trim()) return fail(res, '请填写机具名称')
  if (!Number.isFinite(Number(price)) || Number(price) <= 0) return fail(res, '请填写正确的单价')
  if (price_orig !== null && price_orig !== '' && (!Number.isFinite(Number(price_orig)) || Number(price_orig) < Number(price))) {
    return fail(res, '原价不能低于当前单价')
  }
  if (!Number.isFinite(Number(service_radius)) || Number(service_radius) < 1 || Number(service_radius) > 500) {
    return fail(res, '服务范围应为1到500公里')
  }
  try {
    const [[m]] = await db.query('SELECT id FROM machines WHERE id=? AND operator_id=?',
      [req.params.id, req.operator.operator_id])
    if (!m) return fail(res, '机具不存在或无权限', 404)
    await db.query(
      `UPDATE machines SET name=?,category=?,icon=?,price=?,price_orig=?,unit=?,
       latitude=?,longitude=?,location_name=?,service_radius=?,spec_badges=?,params=?,description=? WHERE id=?`,
      [name.trim(), category || '其他', icon || '🚜', parseFloat(price),
       price_orig ? parseFloat(price_orig) : null, unit || '亩',
       latitude || null, longitude || null, location_name || '', parseFloat(service_radius) || 50,
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
    const [[used]] = await db.query('SELECT COUNT(*) AS n FROM machine_orders WHERE machine_id=?', [req.params.id])
    if (Number(used.n || 0) > 0) {
      await db.query("UPDATE machines SET status='off' WHERE id=?", [req.params.id])
      return ok(res, null, '该机具已有订单记录，已为您下架并保留历史数据')
    }
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
    await machineLifecycle.expireUnpaidMachineOrders({ operatorId: req.operator.operator_id })
    await refunds.syncPendingMachineRefunds({ operatorId: req.operator.operator_id }).catch(error => {
      console.error('[machine-refund-sync-operator]', error.message)
    })
    const { status } = req.query
    let sql = `SELECT *, DATE_FORMAT(work_date,'%Y-%m-%d') AS work_date,
                      DATE_FORMAT(work_end_date,'%Y-%m-%d') AS work_end_date
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
    if (!['partial', 'paid'].includes(o.pay_status)) return fail(res, '农户尚未支付订金或全款，暂不能接单', 409)
    if (o.refund_status && !['FAILED', ''].includes(o.refund_status)) return fail(res, '该订单正在退款，不能接单', 409)
    const [changed] = await db.query(
      "UPDATE machine_orders SET status='accepted',accepted_at=NOW() WHERE id=? AND operator_id=? AND status='pending' AND pay_status IN ('partial','paid')",
      [req.params.id, req.operator.operator_id]
    )
    if (!changed.affectedRows) return fail(res, '订单状态已变化，请刷新后重试', 409)
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
    const [changed] = await db.query(
      "UPDATE machine_orders SET status='cancelled',reject_reason=? WHERE id=? AND operator_id=? AND status='pending'",
      [reason || '机手已拒单', req.params.id, req.operator.operator_id]
    )
    if (!changed.affectedRows) return fail(res, '订单状态已变化，请刷新后重试', 409)
    let refund = null
    let refundError = null
    if (['partial', 'paid'].includes(o.pay_status)) {
      try {
        refund = await refunds.createMachineRefund({
          orderId: Number(req.params.id), operatorId: req.operator.operator_id,
          reason: `农机手拒绝预约：${reason || '无法接单'}`
        })
      } catch (error) {
        refundError = error
        console.error('[op-reject-refund]', error)
        await db.query("UPDATE machine_orders SET refund_status='FAILED' WHERE id=?", [req.params.id])
      }
    }
    if (refundError) {
      return ok(res, { refund_status: 'FAILED' }, '已拒单，但退款发起失败，请联系平台客服处理')
    }
    return ok(res, { refund_status: refund && refund.status || '' },
      refund ? '已拒单，付款正在原路退回' : '已拒单')
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
    if (!['partial', 'paid'].includes(o.pay_status)) return fail(res, '订单尚未付款，不能推进作业状态', 409)
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

// GET /api/operator/reviews — 农户评价
router.get('/reviews', operatorAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT mr.id,mr.order_id,mr.machine_id,mr.farmer_name,mr.rating,mr.content,mr.reply,
              mr.score_timely,mr.score_quality,mr.score_attitude,mr.score_price,
              mo.order_no,mo.machine_name,DATE_FORMAT(mr.created_at,'%Y-%m-%d %H:%i') AS created_at
         FROM machine_reviews mr JOIN machine_orders mo ON mo.id=mr.order_id
        WHERE mr.operator_id=? ORDER BY mr.created_at DESC`,
      [req.operator.operator_id]
    )
    return ok(res, rows)
  } catch (e) { console.error('[op-reviews]', e); return fail(res, '评价加载失败', 500) }
})

// PATCH /api/operator/reviews/:id/reply — 回复评价
router.patch('/reviews/:id/reply', operatorAuth, async (req, res) => {
  const reply = String(req.body.reply || '').trim()
  if (!reply) return fail(res, '请填写回复内容')
  if (reply.length > 255) return fail(res, '回复不能超过255个字')
  try {
    const [result] = await db.query(
      'UPDATE machine_reviews SET reply=? WHERE id=? AND operator_id=?',
      [reply, req.params.id, req.operator.operator_id]
    )
    if (!result.affectedRows) return fail(res, '评价不存在或无权回复', 404)
    return ok(res, null, '回复已发布')
  } catch (e) { console.error('[op-review-reply]', e); return fail(res, '回复失败', 500) }
})

// GET /api/operator/stats — 工作台统计
router.get('/stats', operatorAuth, async (req, res) => {
  try {
    const oid = req.operator.operator_id
    await machineLifecycle.expireUnpaidMachineOrders({ operatorId: oid })
    const [[mc]] = await db.query("SELECT COUNT(*) AS n FROM machines WHERE operator_id=? AND status!='off'", [oid])
    const [[pend]] = await db.query("SELECT COUNT(*) AS n FROM machine_orders WHERE operator_id=? AND status='pending' AND pay_status IN ('partial','paid')", [oid])
    const [[active]] = await db.query("SELECT COUNT(*) AS n FROM machine_orders WHERE operator_id=? AND status IN ('accepted','departed','arrived','working')", [oid])
    const [[income]] = await db.query("SELECT IFNULL(SUM(paid_amount),0) AS s FROM machine_orders WHERE operator_id=? AND status='completed' AND pay_status='paid' AND fund_status!='refunded'", [oid])
    return ok(res, {
      machine_count: mc.n, pending_count: pend.n,
      active_count: active.n, total_income: parseFloat(income.s)
    })
  } catch (e) { console.error('[op-stats]', e); return fail(res, '获取失败', 500) }
})

module.exports = router
