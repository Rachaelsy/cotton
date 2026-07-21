// server/routes/merchant.js — 商户后台接口
require('dotenv').config()
const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const db       = require('../db/database')
const multer   = require('multer')
const path     = require('path')
const fs       = require('fs')
const profitSharing = require('../utils/profit-sharing')
const refunds = require('../utils/refunds')
const logistics = require('../utils/logistics')
const commissionRequests = require('../utils/commission-requests')
const router   = express.Router()

// ── 图片上传配置 ─────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../public/uploads/products')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename:    (_, file, cb) => cb(null, `prod_${Date.now()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    /image\/(jpeg|png|gif|webp)/.test(file.mimetype)
      ? cb(null, true) : cb(new Error('只支持 JPG/PNG/GIF/WebP'))
  }
})

// ── 商户鉴权中间件 ────────────────────────────────────────────
function merchantAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ code: 401, msg: '请先登录' })
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    if (payload.role !== 'merchant')
      return res.status(403).json({ code: 403, msg: '权限不足，仅商户可访问' })
    req.merchant = payload
    next()
  } catch {
    res.status(401).json({ code: 401, msg: '登录已过期，请重新登录' })
  }
}

const ok   = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

router.get('/commission', merchantAuth, async (req, res) => {
  try {
    return ok(res, await commissionRequests.getSummary('merchant', req.merchant.merchant_id))
  } catch (error) { return fail(res, error.message || '佣金信息加载失败', 500) }
})

router.post('/commission-change-requests', merchantAuth, async (req, res) => {
  try {
    const data = await commissionRequests.submit(
      'merchant', req.merchant.merchant_id, req.body.requested_rate, req.body.reason
    )
    return ok(res, data, '佣金调整申请已提交，等待管理员审核')
  } catch (error) { return fail(res, error.message || '申请提交失败', 400) }
})

// ─────────────────────────────────────────────────────────────
// POST /api/merchant/login — 商户登录
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { phone, password } = req.body
  if (!phone || !password) return fail(res, '请输入手机号和密码')
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.phone, u.password, u.real_name, u.is_active,
             m.id AS merchant_id, m.company_name, m.product_category,
             m.business_license, m.apply_status, m.reject_reason,
             m.sub_mchid, m.wechat_applyment_state
      FROM users u JOIN merchants m ON m.user_id = u.id
      WHERE u.phone = ? AND u.role = 'merchant'
    `, [phone])
    if (!rows.length) return fail(res, '账号不存在，请确认为商户账号', 404)
    const u = rows[0]
    if (!u.is_active) return fail(res, '账号已被禁用，请联系平台客服', 403)
    if (u.apply_status === 'rejected') return fail(res, `入驻申请已被拒绝：${u.reject_reason || '不符合条件'}`, 403)
    if (!await bcrypt.compare(password, u.password)) return fail(res, '密码错误')
    const token = jwt.sign(
      { id: u.id, phone: u.phone, role: 'merchant', merchant_id: u.merchant_id, company_name: u.company_name },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    )
    return ok(res, {
      token, id: u.id, phone: u.phone, real_name: u.real_name,
      company_name: u.company_name, merchant_id: u.merchant_id,
      product_category: u.product_category,
      apply_status: u.apply_status,
      reject_reason: u.reject_reason || '',
      wechat_applyment_state: u.wechat_applyment_state || '',
      sub_mchid: u.sub_mchid || ''
    }, '登录成功')
  } catch(e) { console.error('[m-login]', e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// GET  /api/merchant/profile — 获取店铺信息
// PUT  /api/merchant/profile — 更新店铺信息
// ─────────────────────────────────────────────────────────────
router.get('/profile', merchantAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.phone, u.real_name, u.is_verified,
             m.id AS merchant_id, m.company_name, m.business_license,
             m.product_category, m.apply_status, m.reject_reason,
             m.sub_mchid, m.wechat_applyment_state, m.wechat_id,
             m.latitude, m.longitude, m.location_name, m.delivery_radius
      FROM users u JOIN merchants m ON m.user_id = u.id WHERE u.id = ?
    `, [req.merchant.id])
    if (!rows.length) return fail(res, '用户不存在', 404)
    return ok(res, rows[0])
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

router.put('/profile', merchantAuth, async (req, res) => {
  const {
    real_name, company_name, product_category, business_license, wechat_id,
    latitude, longitude, location_name, delivery_radius
  } = req.body
  // 经纬度合法性（防填反，中国范围）
  if (latitude != null && latitude !== '' && longitude != null && longitude !== '') {
    const la = parseFloat(latitude), ln = parseFloat(longitude)
    if (isNaN(la) || isNaN(ln)) return fail(res, '经纬度格式不正确')
    if (la < 3 || la > 54) return fail(res, '纬度应在 3~54 之间，请检查是否与经度填反了')
    if (ln < 73 || ln > 136) return fail(res, '经度应在 73~136 之间，请检查是否与纬度填反了')
  }
  try {
    if (real_name) await db.query('UPDATE users SET real_name=? WHERE id=?', [real_name, req.merchant.id])
    await db.query(
      `UPDATE merchants SET company_name=?, product_category=?, business_license=?, wechat_id=?,
       latitude=?, longitude=?, location_name=?, delivery_radius=? WHERE user_id=?`,
      [company_name||'', product_category||'', business_license||'', wechat_id||'',
       latitude || null, longitude || null, location_name||'', parseFloat(delivery_radius) || 50,
       req.merchant.id]
    )
    return ok(res, null, '店铺信息已更新')
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// POST /api/merchant/change-password — 修改密码
// ─────────────────────────────────────────────────────────────
router.post('/change-password', merchantAuth, async (req, res) => {
  const { old_password, new_password } = req.body
  if (!old_password || !new_password || new_password.length < 6)
    return fail(res, '新密码不能少于6位')
  try {
    const [rows] = await db.query('SELECT password FROM users WHERE id=?', [req.merchant.id])
    if (!rows.length) return fail(res, '用户不存在', 404)
    if (!await bcrypt.compare(old_password, rows[0].password)) return fail(res, '原密码错误')
    await db.query('UPDATE users SET password=? WHERE id=?',
      [await bcrypt.hash(new_password, 10), req.merchant.id])
    return ok(res, null, '密码已修改，请重新登录')
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// GET  /api/merchant/aftersale        — 售后申请列表
// PATCH /api/merchant/aftersale/:id/handle — 处理售后
// ─────────────────────────────────────────────────────────────
router.get('/aftersale', merchantAuth, async (req, res) => {
  try {
    const { status } = req.query
    const mid = req.merchant.merchant_id
    await refunds.syncPendingSupplyRefunds({ merchantId: mid }).catch(error => {
      console.error('[refund-sync-merchant-aftersale]', error.message)
    })
    let sql = `
      SELECT a.*, o.total AS order_total,
             (
               SELECT wr.status FROM wechat_refunds wr
               WHERE wr.order_type='supply' AND wr.aftersale_id=a.id
               ORDER BY wr.id DESC LIMIT 1
             ) AS refund_status,
             (
               SELECT wr.out_refund_no FROM wechat_refunds wr
               WHERE wr.order_type='supply' AND wr.aftersale_id=a.id
               ORDER BY wr.id DESC LIMIT 1
             ) AS out_refund_no
      FROM aftersale_requests a
      LEFT JOIN orders o ON o.id = a.order_id
      WHERE a.merchant_id = ?
    `
    const params = [mid]
    if (status && status !== 'all') { sql += ' AND a.status = ?'; params.push(status) }
    sql += ' ORDER BY a.created_at DESC'
    const [rows] = await db.query(sql, params)
    return ok(res, rows)
  } catch(e) { console.error('[merchant-aftersale]', e); return fail(res, '服务器错误', 500) }
})

router.patch('/aftersale/:id/handle', merchantAuth, async (req, res) => {
  const { id } = req.params
  const { action, handle_note } = req.body
  if (!['approved', 'rejected'].includes(action)) return fail(res, '操作类型无效')
  try {
    const [rows] = await db.query(
      'SELECT id, order_id, reason, other_reason FROM aftersale_requests WHERE id=? AND merchant_id=?',
      [id, req.merchant.merchant_id]
    )
    if (!rows.length) return fail(res, '记录不存在或无权限', 404)
    const ar = rows[0]
    if (action === 'approved') {
      const reason = handle_note || ar.other_reason || ar.reason || '商户同意售后退款'
      const refund = await refunds.createSupplyRefund({
        orderId: ar.order_id,
        merchantId: req.merchant.merchant_id,
        aftersaleId: Number(id),
        reason
      })
      await db.query(
        'UPDATE aftersale_requests SET status=?, handle_note=? WHERE id=?',
        ['approved', handle_note || '已发起微信退款', id]
      )
      return ok(res, {
        out_refund_no: refund.refund?.out_refund_no || '',
        refund_status: refund.status || ''
      }, refund.status === 'SUCCESS' ? '退款成功' : '微信退款已提交，等待微信处理结果')
    }

    await db.query(
      'UPDATE aftersale_requests SET status=?, handle_note=? WHERE id=?',
      ['rejected', handle_note || '', id]
    )
    await db.query("UPDATE orders SET status='completed' WHERE id=?", [ar.order_id])
    return ok(res, null, '已拒绝申请')
  } catch(e) { console.error('[merchant-aftersale-handle]', e); return fail(res, e.message || '服务器错误', e.statusCode || 500) }
})

// ─────────────────────────────────────────────────────────────
// GET /api/merchant/stats — 店铺统计数据
// ─────────────────────────────────────────────────────────────
router.get('/stats', merchantAuth, async (req, res) => {
  try {
    const mid = req.merchant.merchant_id
    const [[p]] = await db.query(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status='on'  THEN 1 ELSE 0 END) AS on_sale,
             SUM(CASE WHEN stock < 10 AND status='on' THEN 1 ELSE 0 END) AS low_stock,
             SUM(CASE WHEN stock = 0   THEN 1 ELSE 0 END) AS no_stock
      FROM products WHERE merchant_id=?
    `, [mid])
    const [[o]] = await db.query(`
      SELECT
        COUNT(*) AS total_orders,
        SUM(CASE WHEN o.status='pending_ship' THEN 1 ELSE 0 END) AS pending_ship,
        SUM(CASE WHEN DATE(o.created_at)=CURDATE() THEN 1 ELSE 0 END) AS today_orders,
        SUM(CASE WHEN DATE(o.created_at)=CURDATE() THEN o.total ELSE 0 END) AS today_sales,
        SUM(CASE WHEN DATE_FORMAT(o.created_at,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m') THEN o.total ELSE 0 END) AS monthly_sales
      FROM orders o
      WHERE EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.merchant_id=?)
    `, [mid])
    const [[tc]] = await db.query(`
      SELECT COUNT(DISTINCT o.user_id) AS total_customers
      FROM orders o
      WHERE EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.merchant_id=?)
    `, [mid])
    const [[merchantInfo]] = await db.query(
      'SELECT commission_rate FROM merchants WHERE id=?', [mid]
    )
    const commissionRate = parseFloat(merchantInfo?.commission_rate || 5) / 100
    const [[frozen]] = await db.query(`
      SELECT IFNULL(SUM(GREATEST(o.total - LEAST(o.total, COALESCE(NULLIF(o.commission_base,0),o.total) * ?), 0)), 0) AS amount
      FROM orders o
      WHERE o.fund_status='frozen'
        AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.merchant_id=?)
    `, [commissionRate, mid])
    const [[um]] = await db.query(
      "SELECT COUNT(*) AS cnt FROM messages WHERE merchant_id=? AND is_read=0", [mid]
    )
    const [[pa]] = await db.query(
      "SELECT COUNT(*) AS cnt FROM aftersale_requests WHERE merchant_id=? AND status='pending'", [mid]
    )
    const [wtRows] = await db.query(`
      SELECT DATE(o.created_at) AS day, SUM(o.total) AS amount
      FROM orders o
      WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.merchant_id=?)
      GROUP BY DATE(o.created_at) ORDER BY day ASC
    `, [mid])
    const today = new Date()
    const days = Array.from({length: 7}, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - 6 + i)
      return d.toISOString().slice(0, 10)
    })
    const wtMap = {}
    wtRows.forEach(r => { wtMap[String(r.day).slice(0, 10)] = parseFloat(r.amount || 0) })
    const weekly_trend = days.map(d => {
      const [, mm, dd] = d.split('-')
      return { label: parseInt(mm) + '/' + parseInt(dd), val: Math.round(wtMap[d] || 0) }
    })
    return ok(res, {
      total_products: p.total    || 0,
      on_sale:        p.on_sale  || 0,
      low_stock:      p.low_stock|| 0,
      no_stock:       p.no_stock || 0,
      today_orders:       o.today_orders   || 0,
      today_sales:        parseFloat(o.today_sales   || 0).toFixed(2),
      pending_ship:       o.pending_ship   || 0,
      pending_settlement: parseFloat(frozen?.amount || 0).toFixed(2),
      monthly_sales:      parseFloat(o.monthly_sales || 0).toFixed(2),
      total_customers:    tc.total_customers || 0,
      unread_messages:    um.cnt  || 0,
      pending_aftersale:  pa.cnt  || 0,
      weekly_trend
    })
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// GET /api/merchant/finance — 财务结算数据
// ─────────────────────────────────────────────────────────────
router.get('/finance', merchantAuth, async (req, res) => {
  try {
    const mid = req.merchant.merchant_id

    // 读取该商户的实际佣金率（admin 可调整，默认 5%）
    const [[merchantInfo]] = await db.query(
      'SELECT commission_rate FROM merchants WHERE id=?', [mid]
    )
    const commissionRate = parseFloat(merchantInfo?.commission_rate || 5) / 100
    // 已解冻资金（扣除佣金后，提现在微信支付商户平台操作）
    const [[avail]] = await db.query(`
      SELECT IFNULL(SUM(GREATEST(o.total - LEAST(o.total, COALESCE(NULLIF(o.commission_base,0),o.total) * ?), 0)), 0) AS amount
      FROM orders o
      WHERE o.fund_status='available'
        AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.merchant_id=?)
    `, [commissionRate, mid])

    // 冻结中余额（扣除佣金后）
    const [[frozen]] = await db.query(`
      SELECT IFNULL(SUM(GREATEST(o.total - LEAST(o.total, COALESCE(NULLIF(o.commission_base,0),o.total) * ?), 0)), 0) AS amount
      FROM orders o
      WHERE o.fund_status='frozen'
        AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.merchant_id=?)
    `, [commissionRate, mid])

    // 本月统计
    const [[m]] = await db.query(`
      SELECT
        COUNT(*) AS monthly_orders,
        IFNULL(SUM(o.total), 0) AS monthly_sales,
        IFNULL(SUM(CASE WHEN o.status='refunded' THEN o.total ELSE 0 END), 0) AS monthly_refund
      FROM orders o
      WHERE DATE_FORMAT(o.created_at,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m')
        AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.merchant_id=?)
    `, [mid])

    // 结算明细（已完成的订单，含资金状态和确认时间）
    const [settleRows] = await db.query(`
      SELECT o.id, o.order_no, o.total, o.commission_base, o.created_at,
             o.fund_status, o.confirmed_at, o.auto_confirmed,
             MAX(ps.state) AS profit_sharing_state,
             MAX(ps.amount_fen) AS profit_sharing_amount_fen,
             MAX(ps.error_msg) AS profit_sharing_error,
             MAX(ps.wechat_order_id) AS profit_sharing_wechat_order_id,
             GROUP_CONCAT(i.name ORDER BY i.id SEPARATOR '、') AS prod_names
      FROM orders o
      JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
      LEFT JOIN wechat_profit_sharing_orders ps ON ps.order_type='supply' AND ps.order_id=o.id
      WHERE o.status='completed'
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100
    `, [mid])

    const now = Date.now()
    const commissionPct = parseFloat((commissionRate * 100).toFixed(2))
    const freezeDays = profitSharing.getProfitSharingFreezeDays()
    return ok(res, {
      settlement_freeze_days: freezeDays,
      commission_rate:   commissionPct,
      available_balance: parseFloat(avail.amount).toFixed(2),
      frozen_balance:    parseFloat(frozen.amount).toFixed(2),
      monthly_sales:     parseFloat(m.monthly_sales  || 0).toFixed(2),
      monthly_orders:    parseInt(m.monthly_orders)  || 0,
      monthly_refund:    parseFloat(m.monthly_refund || 0).toFixed(2),
      settlements: settleRows.map((s, idx) => {
        const amount     = parseFloat(s.total)
        const commissionBase = parseFloat(s.commission_base || amount)
        const commission = parseFloat(Math.min(amount, commissionBase * commissionRate).toFixed(2))
        const actual     = parseFloat(Math.max(0, amount - commission).toFixed(2))
        // 距解冻剩余天数（确认收货后按当前分账冻结配置）
        let daysLeft = null
        if (s.fund_status === 'frozen' && s.confirmed_at) {
          const releaseAt = new Date(s.confirmed_at).getTime() + freezeDays * 24 * 3600 * 1000
          daysLeft = Math.max(0, Math.ceil((releaseAt - now) / (24 * 3600 * 1000)))
        }
        return {
          id:           'SE' + String(idx + 1).padStart(3, '0'),
          order_no:     s.order_no,
          prod:         s.prod_names || '商品',
          amount,
          commission,
          actual,
          fund_status:  s.fund_status,
          profit_sharing_state: s.profit_sharing_state || '',
          profit_sharing_amount: s.profit_sharing_amount_fen == null
            ? commission
            : parseFloat((Number(s.profit_sharing_amount_fen || 0) / 100).toFixed(2)),
          profit_sharing_error: s.profit_sharing_error || '',
          profit_sharing_wechat_order_id: s.profit_sharing_wechat_order_id || '',
          days_left:    daysLeft,
          confirmed_at: s.confirmed_at ? String(s.confirmed_at).slice(0, 10) : null,
          auto_confirmed: !!s.auto_confirmed,
          date:         String(s.created_at).slice(0, 10)
        }
      })
    })
  } catch(e) { console.error('[merchant-finance]', e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// POST /api/merchant/withdraw — 已停用：资金提现统一在微信支付商户平台处理
// ─────────────────────────────────────────────────────────────
router.post('/withdraw', merchantAuth, async (req, res) => {
  return fail(res, '平台内提现已停用，请到微信支付商户平台提现', 410)
})

// ─────────────────────────────────────────────────────────────
// GET /api/merchant/customers — 下单客户列表
// ─────────────────────────────────────────────────────────────
router.get('/customers', merchantAuth, async (req, res) => {
  const mid = req.merchant.merchant_id
  try {
    const [rows] = await db.query(`
      SELECT
        u.id,
        u.real_name  AS farmer_name,
        u.phone,
        f.location   AS region,
        SUM(oi.subtotal)           AS total_spent,
        COUNT(DISTINCT o.id)       AS order_count,
        MAX(DATE(o.created_at))    AS last_order_date
      FROM order_items oi
      JOIN orders o  ON o.id  = oi.order_id
      JOIN users  u  ON u.id  = o.user_id
      LEFT JOIN farmers f ON f.user_id = u.id
      WHERE oi.merchant_id = ?
        AND o.status NOT IN ('cancelled','pending_payment')
      GROUP BY u.id
      ORDER BY total_spent DESC
    `, [mid])
    return ok(res, rows)
  } catch(e) { console.error('[merchant-customers]', e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// DELETE /api/merchant/customers/:userId — 删除该客户在本店的订单记录
// ─────────────────────────────────────────────────────────────
router.delete('/customers/:userId', merchantAuth, async (req, res) => {
  const mid    = req.merchant.merchant_id
  const userId = req.params.userId
  try {
    // 找出该客户在本店有 items 的所有订单 id
    const [orderRows] = await db.query(`
      SELECT DISTINCT o.id FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = ? AND oi.merchant_id = ?
    `, [userId, mid])
    if (!orderRows.length) return fail(res, '未找到该客户的订单', 404)
    const ids = orderRows.map(r => r.id)
    const ph  = ids.map(() => '?').join(',')
    await db.query(`DELETE FROM reviews          WHERE order_id IN (${ph}) AND merchant_id = ?`, [...ids, mid])
    await db.query(`DELETE FROM aftersale_requests WHERE order_id IN (${ph}) AND merchant_id = ?`, [...ids, mid])
    await db.query(`DELETE FROM order_items      WHERE order_id IN (${ph}) AND merchant_id = ?`, [...ids, mid])
    // 若订单已无任何 items，一并删除订单主记录
    await db.query(`
      DELETE FROM orders WHERE id IN (${ph})
      AND (SELECT COUNT(*) FROM order_items WHERE order_id = orders.id) = 0
    `, ids)
    return ok(res, null, '已删除该客户的订单记录')
  } catch(e) { console.error('[merchant-customers-delete]', e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// GET /api/merchant/trend?period=day|week|month — 销售趋势图表数据
// ─────────────────────────────────────────────────────────────
router.get('/trend', merchantAuth, async (req, res) => {
  const mid = req.merchant.merchant_id
  const { period = 'week' } = req.query
  try {
    let data = []
    if (period === 'day') {
      const [rows] = await db.query(`
        SELECT HOUR(o.created_at) AS h, IFNULL(SUM(o.total), 0) AS amount
        FROM orders o
        WHERE DATE(o.created_at)=CURDATE()
          AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.merchant_id=?)
        GROUP BY h ORDER BY h
      `, [mid])
      const hm = {}; rows.forEach(r => { hm[r.h] = parseFloat(r.amount) })
      data = [0,3,6,9,12,15,18,21].map(h => ({ label: h + '时', val: Math.round(hm[h] || 0) }))
    } else if (period === 'month') {
      const [rows] = await db.query(`
        SELECT FLOOR((DAY(o.created_at)-1)/7)+1 AS w, IFNULL(SUM(o.total), 0) AS amount
        FROM orders o
        WHERE DATE_FORMAT(o.created_at,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m')
          AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.merchant_id=?)
        GROUP BY w ORDER BY w
      `, [mid])
      const wm = {}; rows.forEach(r => { wm[r.w] = parseFloat(r.amount) })
      data = [1,2,3,4].map(w => ({ label: '第' + w + '周', val: Math.round(wm[w] || 0) }))
    } else {
      const today = new Date()
      const days = Array.from({length: 7}, (_, i) => {
        const d = new Date(today); d.setDate(today.getDate() - 6 + i)
        return d.toISOString().slice(0, 10)
      })
      const [rows] = await db.query(`
        SELECT DATE(o.created_at) AS day, IFNULL(SUM(o.total), 0) AS amount
        FROM orders o
        WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.merchant_id=?)
        GROUP BY DATE(o.created_at) ORDER BY day
      `, [mid])
      const dm = {}; rows.forEach(r => { dm[String(r.day).slice(0, 10)] = parseFloat(r.amount) })
      data = days.map(d => {
        const [, mm, dd] = d.split('-')
        return { label: parseInt(mm) + '/' + parseInt(dd), val: Math.round(dm[d] || 0) }
      })
    }
    return ok(res, data)
  } catch(e) { console.error('[merchant-trend]', e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// 商品 CRUD
// ─────────────────────────────────────────────────────────────
router.get('/products', merchantAuth, async (req, res) => {
  try {
    const { status, category } = req.query
    let sql = 'SELECT * FROM products WHERE merchant_id=?'
    const params = [req.merchant.merchant_id]
    if (status && ['on','off'].includes(status)) { sql += ' AND status=?'; params.push(status) }
    if (category && category !== '全部') { sql += ' AND category=?'; params.push(category) }
    sql += ' ORDER BY created_at DESC'
    const [rows] = await db.query(sql, params)
    return ok(res, rows)
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

router.post('/products', merchantAuth, async (req, res) => {
  const { name, category, icon, price, unit, stock, status, image_url, description, detail } = req.body
  if (!name?.trim()) return fail(res, '商品名称不能为空')
  if (!price || isNaN(price) || Number(price) <= 0) return fail(res, '请填写正确的价格')
  try {
    const [r] = await db.query(
      'INSERT INTO products (merchant_id,name,category,icon,price,unit,stock,status,image_url,description,detail) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [req.merchant.merchant_id, name.trim(), category||'', icon||'📦',
       parseFloat(price), unit||'', parseInt(stock)||0, status||'on', image_url||null, description||'', detail||'']
    )
    return ok(res, { id: r.insertId }, '商品已上架')
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

router.put('/products/:id', merchantAuth, async (req, res) => {
  const { name, category, icon, price, unit, stock, status, image_url, description, detail } = req.body
  try {
    const [rows] = await db.query('SELECT id FROM products WHERE id=? AND merchant_id=?',
      [req.params.id, req.merchant.merchant_id])
    if (!rows.length) return fail(res, '商品不存在或无权限', 404)
    await db.query(
      'UPDATE products SET name=?,category=?,icon=?,price=?,unit=?,stock=?,status=?,image_url=?,description=?,detail=? WHERE id=?',
      [name, category||'', icon||'📦', parseFloat(price)||0, unit||'', parseInt(stock)||0,
       status||'on', image_url||null, description||'', detail||'', req.params.id]
    )
    return ok(res, null, '修改成功')
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

router.patch('/products/:id/status', merchantAuth, async (req, res) => {
  const { status } = req.body
  if (!['on','off'].includes(status)) return fail(res, '状态无效')
  try {
    const [rows] = await db.query('SELECT id FROM products WHERE id=? AND merchant_id=?',
      [req.params.id, req.merchant.merchant_id])
    if (!rows.length) return fail(res, '商品不存在或无权限', 404)
    await db.query('UPDATE products SET status=? WHERE id=?', [status, req.params.id])
    return ok(res, null, status === 'on' ? '已上架' : '已下架')
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

router.delete('/products/:id', merchantAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id FROM products WHERE id=? AND merchant_id=?',
      [req.params.id, req.merchant.merchant_id])
    if (!rows.length) return fail(res, '商品不存在或无权限', 404)
    await db.query('DELETE FROM products WHERE id=?', [req.params.id])
    return ok(res, null, '已删除')
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// GET  /api/merchant/orders — 商户查看订单
// ─────────────────────────────────────────────────────────────
router.get('/orders', merchantAuth, async (req, res) => {
  try {
    const { status } = req.query
    const mid = req.merchant.merchant_id
    await refunds.syncPendingSupplyRefunds({ merchantId: mid }).catch(error => {
      console.error('[refund-sync-merchant-orders]', error.message)
    })
    let sql = `
      SELECT o.id, o.order_no, o.farmer_name, o.farmer_phone,
             o.receiver_name, o.receiver_phone, o.address,
             o.original_subtotal, o.promotion_discount, o.coupon_discount,
             o.merchant_discount, o.subtotal, o.delivery_fee, o.total,
             o.pay_method, o.status, o.logistics_no, o.logistics_company,
             o.logistics_company_name, o.logistics_status, o.logistics_latest,
             o.logistics_updated_at, o.note,
             o.created_at,
             GROUP_CONCAT(
               CONCAT(i.icon,'|',i.name,'|',i.spec,'|',i.price,'|',i.qty)
               SEPARATOR ';;'
             ) AS items_raw
      FROM orders o
      JOIN order_items i ON i.order_id = o.id AND i.merchant_id = ?
    `
    const params = [mid]
    // 未付款和已取消的订单不向商户展示；已删除（隐藏）的也不展示
    if (status && status !== 'all') {
      sql += ` WHERE o.merchant_deleted=0 AND o.status = ?`; params.push(status)
    } else {
      sql += ` WHERE o.merchant_deleted=0 AND o.status NOT IN ('pending_payment','cancelled')`
    }
    sql += ' GROUP BY o.id ORDER BY o.created_at DESC'

    const [rows] = await db.query(sql, params)
    const orders = rows.map(o => ({
      ...o,
      items: (o.items_raw || '').split(';;').filter(Boolean).map(s => {
        const [icon, name, spec, price, qty] = s.split('|')
        return { icon, name, spec, price: parseFloat(price), qty: parseInt(qty) }
      })
    }))
    return ok(res, orders)
  } catch(e) { console.error('[merchant-orders]', e); return fail(res, '服务器错误', 500) }
})

router.patch('/orders/:id/ship', merchantAuth, async (req, res) => {
  const deliveryId = String(req.body.delivery_id || req.body.logistics_company || '').trim()
  const bizId = String(req.body.biz_id || '').trim()
  const serviceType = Number(req.body.service_type)
  if (!deliveryId || !bizId || !Number.isFinite(serviceType)) return fail(res, '请选择已绑定的微信快递账号')
  try {
    const mid = req.merchant.merchant_id
    const [rows] = await db.query(
      `SELECT o.id, o.order_no, o.receiver_name, o.receiver_phone, o.address, o.note,
              u.openid, m.id AS merchant_id, m.company_name AS sender_company,
              m.location_name AS sender_address, mu.real_name AS sender_name,
              mu.phone AS sender_mobile
       FROM orders o
       JOIN order_items i ON i.order_id=o.id
       JOIN merchants m ON m.id=i.merchant_id
       JOIN users mu ON mu.id=m.user_id
       LEFT JOIN users u ON u.id=o.user_id
       WHERE o.id=? AND i.merchant_id=? AND o.status='pending_ship' LIMIT 1`,
      [req.params.id, mid]
    )
    if (!rows.length) return fail(res, '订单不存在或无法发货', 404)
    const order = rows[0]
    const accounts = await logistics.listDeliveryAccounts()
    const account = accounts.find(item => item.delivery_id === deliveryId && item.biz_id === bizId)
    if (!account) return fail(res, '该快递账号未绑定、审核未通过或已失效', 409)
    const service = account.services.find(item => Number(item.service_type) === serviceType)
    if (!service) return fail(res, '所选快递服务类型不可用', 409)
    const [items] = await db.query(
      'SELECT name, qty FROM order_items WHERE order_id=? AND merchant_id=? ORDER BY id',
      [order.id, mid]
    )
    const waybill = await logistics.createWaybill({ ...order, items }, account, service)
    const logisticsNo = String(waybill.result.waybill_id)
    await db.query(
      `UPDATE orders SET status='shipped', logistics_no=?, logistics_company=?,
       logistics_company_name=?, logistics_status='等待揽收', logistics_latest='商家已发货，等待快递公司揽收',
       logistics_error='', logistics_subscribed=1, logistics_subscribe_attempted_at=NOW(),
       wechat_logistics_order_id=?, wechat_logistics_biz_id=?, wechat_logistics_waybill_data=?,
       logistics_updated_at=NOW(), shipped_at=NOW() WHERE id=?`,
      [logisticsNo, account.delivery_id, account.name,
        waybill.request.order_id, account.biz_id, JSON.stringify(waybill.result.waybill_data || []), req.params.id]
    )
    return ok(res, {
      logistics_no: logisticsNo,
      logistics_company: account.delivery_id,
      logistics_company_name: account.name,
      subscribed: true
    }, '微信电子面单创建成功，农户将收到物流状态通知')
  } catch(e) {
    console.error('[wechat-logistics-ship]', e)
    return fail(res, e.message || '微信物流发货失败', 502)
  }
})

router.patch('/orders/:id/refund', merchantAuth, async (req, res) => {
  try {
    const mid = req.merchant.merchant_id
    const [rows] = await db.query(
      `SELECT o.id FROM orders o JOIN order_items i ON i.order_id=o.id
       WHERE o.id=? AND i.merchant_id=? LIMIT 1`,
      [req.params.id, mid]
    )
    if (!rows.length) return fail(res, '订单不存在', 404)
    const refund = await refunds.createSupplyRefund({
      orderId: Number(req.params.id),
      merchantId: mid,
      reason: req.body.reason || '商户后台发起退款'
    })
    return ok(res, {
      out_refund_no: refund.refund?.out_refund_no || '',
      refund_status: refund.status || ''
    }, refund.status === 'SUCCESS' ? '退款成功' : '微信退款已提交，等待微信处理结果')
  } catch(e) { console.error(e); return fail(res, e.message || '服务器错误', e.statusCode || 500) }
})

router.delete('/orders/:id', merchantAuth, async (req, res) => {
  try {
    const mid = req.merchant.merchant_id
    const [rows] = await db.query(
      `SELECT o.id, o.status FROM orders o JOIN order_items i ON i.order_id=o.id
       WHERE o.id=? AND i.merchant_id=? LIMIT 1`,
      [req.params.id, mid]
    )
    if (!rows.length) return fail(res, '订单不存在或无权删除', 404)
    // 软删除：只从商户视图隐藏，不影响农户记录与资金/售后数据
    if (!['completed', 'cancelled', 'refunded'].includes(rows[0].status))
      return fail(res, '仅已完成、已取消的订单可删除')
    await db.query('UPDATE orders SET merchant_deleted=1 WHERE id=?', [req.params.id])
    return ok(res, null, '订单已删除')
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// GET /api/merchant/orders/export?token=xxx — 导出订单 CSV
// token 走 query 参数，供 wx.downloadFile 直接使用
// ─────────────────────────────────────────────────────────────
router.get('/orders/export', async (req, res) => {
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ code: 401, msg: '请先登录' })
  let merchant
  try {
    merchant = jwt.verify(token, process.env.JWT_SECRET)
    if (merchant.role !== 'merchant') return res.status(403).json({ code: 403, msg: '权限不足' })
  } catch { return res.status(401).json({ code: 401, msg: '登录已过期' }) }

  try {
    const mid = merchant.merchant_id
    const { status } = req.query
    let sql = `
      SELECT o.order_no, o.farmer_name, o.farmer_phone, o.receiver_name, o.receiver_phone,
             o.address, o.subtotal, o.delivery_fee, o.total, o.pay_method, o.status,
             o.logistics_no, o.created_at,
             GROUP_CONCAT(CONCAT(i.name,'×',i.qty) SEPARATOR '; ') AS products
      FROM orders o
      JOIN order_items i ON i.order_id = o.id AND i.merchant_id = ?
    `
    const params = [mid]
    if (status && status !== 'all') {
      sql += ' WHERE o.status = ?'; params.push(status)
    } else {
      sql += " WHERE o.status NOT IN ('pending_payment','cancelled')"
    }
    sql += ' GROUP BY o.id ORDER BY o.created_at DESC'
    const [rows] = await db.query(sql, params)

    const header = ['订单编号','买家姓名','买家电话','收货人','收货电话','收货地址','商品明细','商品小计','运费','实付','支付方式','订单状态','物流单号','下单时间']
    const statusMap = { pending_ship: '待发货', shipped: '已发货', completed: '已完成', aftersale: '售后中', refund: '退款中', refunded: '退款成功' }
    const payMap   = { wechat: '微信支付', transfer: '银行转账', cod: '货到付款' }

    const escCsv = v => {
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }

    const lines = [
      header.join(','),
      ...rows.map(o => [
        o.order_no, o.farmer_name, o.farmer_phone,
        o.receiver_name, o.receiver_phone, o.address,
        o.products,
        o.subtotal, o.delivery_fee, o.total,
        payMap[o.pay_method] || o.pay_method,
        statusMap[o.status] || o.status,
        o.logistics_no || '',
        String(o.created_at).slice(0, 19)
      ].map(escCsv).join(','))
    ]

    const csv = '﻿' + lines.join('\r\n')  // BOM 让 Excel 正确识别 UTF-8
    const filename = `orders_${new Date().toISOString().slice(0,10)}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(csv)
  } catch(e) { console.error('[orders-export]', e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// POST /api/merchant/upload — 图片上传
// ─────────────────────────────────────────────────────────────
router.post('/upload', merchantAuth, upload.single('image'), (req, res) => {
  if (!req.file) return fail(res, '请选择图片文件')
  return ok(res, { url: `/uploads/products/${req.file.filename}` }, '上传成功')
})

// ─────────────────────────────────────────────────────────────
// GET  /api/merchant/messages        — 获取消息列表
// PATCH /api/merchant/messages/read-all — 全部已读
// PATCH /api/merchant/messages/:id/read — 单条已读
// ─────────────────────────────────────────────────────────────
router.get('/messages', merchantAuth, async (req, res) => {
  try {
    const mid = req.merchant.merchant_id
    const [rows] = await db.query(
      `SELECT * FROM messages WHERE merchant_id=? ORDER BY created_at DESC LIMIT 100`,
      [mid]
    )
    const unread = rows.filter(m => !m.is_read).length
    return ok(res, { list: rows, unread })
  } catch(e) { console.error('[merchant-messages]', e); return fail(res, '服务器错误', 500) }
})

router.patch('/messages/read-all', merchantAuth, async (req, res) => {
  try {
    await db.query('UPDATE messages SET is_read=1 WHERE merchant_id=?', [req.merchant.merchant_id])
    return ok(res, null, '已全部标为已读')
  } catch(e) { return fail(res, '服务器错误', 500) }
})

router.patch('/messages/:id/read', merchantAuth, async (req, res) => {
  try {
    await db.query('UPDATE messages SET is_read=1 WHERE id=? AND merchant_id=?',
      [req.params.id, req.merchant.merchant_id])
    return ok(res, null)
  } catch(e) { return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// GET /api/merchant/reviews — 获取本店全部评价
// ─────────────────────────────────────────────────────────────
router.get('/reviews', merchantAuth, async (req, res) => {
  const mid = req.merchant.merchant_id
  try {
    const [rows] = await db.query(`
      SELECT r.id, r.order_id, r.rating, r.content, r.reply,
             IF(r.is_anonymous, '匿名用户', r.farmer_name) AS farmer_name,
             o.order_no,
             DATE_FORMAT(r.created_at,'%Y-%m-%d') AS date,
             GROUP_CONCAT(i.name ORDER BY i.id SEPARATOR '、') AS prod_names
      FROM reviews r
      JOIN orders o ON o.id = r.order_id
      JOIN order_items i ON i.order_id = r.order_id AND i.merchant_id = ?
      WHERE r.merchant_id = ?
      GROUP BY r.id
      ORDER BY r.created_at DESC LIMIT 100
    `, [mid, mid])
    const [[stats]] = await db.query(
      'SELECT COUNT(*) AS total, IFNULL(AVG(rating),0) AS avg FROM reviews WHERE merchant_id=?', [mid]
    )
    return ok(res, {
      reviews:    rows,
      total:      stats.total,
      avg_rating: parseFloat(stats.avg).toFixed(1)
    })
  } catch(e) { console.error('[merchant-reviews]', e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// DELETE /api/merchant/reviews/:id — 删除评价
// ─────────────────────────────────────────────────────────────
router.delete('/reviews/:id', merchantAuth, async (req, res) => {
  const mid = req.merchant.merchant_id
  try {
    const [rows] = await db.query('SELECT id FROM reviews WHERE id=? AND merchant_id=?', [req.params.id, mid])
    if (!rows.length) return fail(res, '评价不存在', 404)
    await db.query('DELETE FROM reviews WHERE id=?', [req.params.id])
    return ok(res, null, '评价已删除')
  } catch(e) { console.error('[merchant-review-delete]', e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// PATCH /api/merchant/reviews/:id/reply — 商家回复评价
// ─────────────────────────────────────────────────────────────
router.patch('/reviews/:id/reply', merchantAuth, async (req, res) => {
  const mid = req.merchant.merchant_id
  const reply = (req.body.reply || '').trim()
  if (!reply) return fail(res, '回复内容不能为空')
  try {
    const [rows] = await db.query('SELECT id FROM reviews WHERE id=? AND merchant_id=?', [req.params.id, mid])
    if (!rows.length) return fail(res, '评价不存在', 404)
    await db.query('UPDATE reviews SET reply=?, replied_at=NOW() WHERE id=?', [reply, req.params.id])
    return ok(res, null, '回复成功')
  } catch(e) { return fail(res, '服务器错误', 500) }
})

module.exports = router
