// server/routes/merchant.js — 商户后台接口
require('dotenv').config()
const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const db       = require('../db/database')
const multer   = require('multer')
const path     = require('path')
const fs       = require('fs')
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
             m.business_license, m.apply_status, m.reject_reason
      FROM users u JOIN merchants m ON m.user_id = u.id
      WHERE u.phone = ? AND u.role = 'merchant'
    `, [phone])
    if (!rows.length) return fail(res, '账号不存在，请确认为商户账号', 404)
    const u = rows[0]
    if (!u.is_active) return fail(res, '账号已被禁用，请联系平台客服', 403)
    if (u.apply_status === 'pending')  return fail(res, '入驻申请正在审核中，请耐心等待', 403)
    if (u.apply_status === 'rejected') return fail(res, `入驻申请已被拒绝：${u.reject_reason || '不符合条件'}`, 403)
    if (!await bcrypt.compare(password, u.password)) return fail(res, '密码错误')
    const token = jwt.sign(
      { id: u.id, phone: u.phone, role: 'merchant', merchant_id: u.merchant_id, company_name: u.company_name },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    )
    return ok(res, {
      token, id: u.id, phone: u.phone, real_name: u.real_name,
      company_name: u.company_name, merchant_id: u.merchant_id,
      product_category: u.product_category
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
             m.product_category, m.apply_status, m.wechat_id
      FROM users u JOIN merchants m ON m.user_id = u.id WHERE u.id = ?
    `, [req.merchant.id])
    if (!rows.length) return fail(res, '用户不存在', 404)
    return ok(res, rows[0])
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

router.put('/profile', merchantAuth, async (req, res) => {
  const { real_name, company_name, product_category, business_license, wechat_id } = req.body
  try {
    if (real_name) await db.query('UPDATE users SET real_name=? WHERE id=?', [real_name, req.merchant.id])
    await db.query(
      'UPDATE merchants SET company_name=?, product_category=?, business_license=?, wechat_id=? WHERE user_id=?',
      [company_name||'', product_category||'', business_license||'', wechat_id||'', req.merchant.id]
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
    let sql = `
      SELECT a.*, o.total AS order_total
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
      'SELECT id FROM aftersale_requests WHERE id=? AND merchant_id=?',
      [id, req.merchant.merchant_id]
    )
    if (!rows.length) return fail(res, '记录不存在或无权限', 404)
    await db.query(
      'UPDATE aftersale_requests SET status=?, handle_note=? WHERE id=?',
      [action, handle_note || '', id]
    )
    const [[ar]] = await db.query('SELECT order_id FROM aftersale_requests WHERE id=?', [id])
    if (ar) await db.query("UPDATE orders SET status='refunded' WHERE id=?", [ar.order_id])
    return ok(res, null, action === 'approved' ? '已同意售后' : '已拒绝申请')
  } catch(e) { console.error('[merchant-aftersale-handle]', e); return fail(res, '服务器错误', 500) }
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
      JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
    `, [mid])
    const [[tc]] = await db.query(`
      SELECT COUNT(DISTINCT o.user_id) AS total_customers
      FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
    `, [mid])
    const [[frozen]] = await db.query(`
      SELECT IFNULL(SUM(o.total * 0.97), 0) AS amount
      FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
      WHERE o.fund_status='frozen'
    `, [mid])
    const [[um]] = await db.query(
      "SELECT COUNT(*) AS cnt FROM messages WHERE merchant_id=? AND is_read=0", [mid]
    )
    const [[pa]] = await db.query(
      "SELECT COUNT(*) AS cnt FROM aftersale_requests WHERE merchant_id=? AND status='pending'", [mid]
    )
    const [wtRows] = await db.query(`
      SELECT DATE(o.created_at) AS day, SUM(o.total) AS amount
      FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
      WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
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
    const keepRate = parseFloat((1 - commissionRate).toFixed(4))

    // 可提现余额（扣除佣金后）
    const [[avail]] = await db.query(`
      SELECT IFNULL(SUM(o.total * ?), 0) AS amount
      FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
      WHERE o.fund_status='available'
    `, [keepRate, mid])

    // 冻结中余额（扣除佣金后）
    const [[frozen]] = await db.query(`
      SELECT IFNULL(SUM(o.total * ?), 0) AS amount
      FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
      WHERE o.fund_status='frozen'
    `, [keepRate, mid])

    // 本月统计
    const [[m]] = await db.query(`
      SELECT
        COUNT(*) AS monthly_orders,
        IFNULL(SUM(o.total), 0) AS monthly_sales,
        IFNULL(SUM(CASE WHEN o.status='refund' THEN o.total ELSE 0 END), 0) AS monthly_refund
      FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
      WHERE DATE_FORMAT(o.created_at,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m')
    `, [mid])

    // 结算明细（已完成的订单，含资金状态和确认时间）
    const [settleRows] = await db.query(`
      SELECT o.id, o.order_no, o.total, o.created_at,
             o.fund_status, o.confirmed_at, o.auto_confirmed,
             GROUP_CONCAT(i.name ORDER BY i.id SEPARATOR '、') AS prod_names
      FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
      WHERE o.status='completed'
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100
    `, [mid])

    // 提现记录
    const [wdRows] = await db.query(
      'SELECT * FROM withdrawals WHERE merchant_id=? ORDER BY created_at DESC LIMIT 30',
      [mid]
    )

    const now = Date.now()
    const commissionPct = parseFloat((commissionRate * 100).toFixed(2))
    return ok(res, {
      commission_rate:   commissionPct,
      available_balance: parseFloat(avail.amount).toFixed(2),
      frozen_balance:    parseFloat(frozen.amount).toFixed(2),
      monthly_sales:     parseFloat(m.monthly_sales  || 0).toFixed(2),
      monthly_orders:    parseInt(m.monthly_orders)  || 0,
      monthly_refund:    parseFloat(m.monthly_refund || 0).toFixed(2),
      settlements: settleRows.map((s, idx) => {
        const amount     = parseFloat(s.total)
        const commission = parseFloat((amount * commissionRate).toFixed(2))
        const actual     = parseFloat((amount * keepRate).toFixed(2))
        // 距解冻剩余天数（确认收货后 7 天）
        let daysLeft = null
        if (s.fund_status === 'frozen' && s.confirmed_at) {
          const releaseAt = new Date(s.confirmed_at).getTime() + 7 * 24 * 3600 * 1000
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
          days_left:    daysLeft,
          confirmed_at: s.confirmed_at ? String(s.confirmed_at).slice(0, 10) : null,
          auto_confirmed: !!s.auto_confirmed,
          date:         String(s.created_at).slice(0, 10)
        }
      }),
      withdrawals: wdRows.map(w => ({
        id:         'WD' + String(w.id).padStart(4, '0'),
        amount:     parseFloat(w.amount),
        status:     w.status === 'paid' ? '已到账' : w.status === 'rejected' ? '已拒绝' : '处理中',
        note:       w.note || '',
        apply_date: String(w.created_at).slice(0, 10),
        arrive_date: w.paid_at ? String(w.paid_at).slice(0, 10) : '—'
      }))
    })
  } catch(e) { console.error('[merchant-finance]', e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// POST /api/merchant/withdraw — 发起提现
// ─────────────────────────────────────────────────────────────
router.post('/withdraw', merchantAuth, async (req, res) => {
  const mid = req.merchant.merchant_id
  const amount = parseFloat(req.body.amount)
  if (!amount || amount < 1) return fail(res, '提现金额不能少于 1 元')
  try {
    // 查询可提现余额
    const [[avail]] = await db.query(`
      SELECT IFNULL(SUM(o.total * 0.97), 0) AS amount
      FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
      WHERE o.fund_status='available'
    `, [mid])
    const available = parseFloat(avail.amount)
    if (amount > available + 0.01) return fail(res, `可提现余额不足，当前可提现 ¥${available.toFixed(2)}`)

    // 按金额从旧到新标记订单为已提现
    const [oRows] = await db.query(`
      SELECT o.id, ROUND(o.total * 0.97, 2) AS net
      FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
      WHERE o.fund_status='available'
      GROUP BY o.id ORDER BY o.confirmed_at ASC
    `, [mid])
    let remaining = amount
    const toWithdraw = []
    for (const row of oRows) {
      if (remaining <= 0) break
      toWithdraw.push(row.id)
      remaining -= parseFloat(row.net)
    }
    if (toWithdraw.length) {
      const ph = toWithdraw.map(() => '?').join(',')
      await db.query(`UPDATE orders SET fund_status='withdrawn' WHERE id IN (${ph})`, toWithdraw)
    }
    await db.query('INSERT INTO withdrawals (merchant_id, amount) VALUES (?, ?)',
      [mid, amount.toFixed(2)])
    return ok(res, null, `提现申请已提交，¥${amount.toFixed(2)} 将在 1-3 个工作日内到账`)
  } catch(e) { console.error('[merchant-withdraw]', e); return fail(res, '服务器错误', 500) }
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
        FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
        WHERE DATE(o.created_at)=CURDATE() GROUP BY h ORDER BY h
      `, [mid])
      const hm = {}; rows.forEach(r => { hm[r.h] = parseFloat(r.amount) })
      data = [0,3,6,9,12,15,18,21].map(h => ({ label: h + '时', val: Math.round(hm[h] || 0) }))
    } else if (period === 'month') {
      const [rows] = await db.query(`
        SELECT FLOOR((DAY(o.created_at)-1)/7)+1 AS w, IFNULL(SUM(o.total), 0) AS amount
        FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
        WHERE DATE_FORMAT(o.created_at,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m')
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
        FROM orders o JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
        WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
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
    let sql = `
      SELECT o.id, o.order_no, o.farmer_name, o.farmer_phone,
             o.receiver_name, o.receiver_phone, o.address,
             o.subtotal, o.delivery_fee, o.total,
             o.pay_method, o.status, o.logistics_no, o.note,
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
  const { logistics_no } = req.body
  if (!logistics_no) return fail(res, '请填写物流单号')
  try {
    const mid = req.merchant.merchant_id
    const [rows] = await db.query(
      `SELECT o.id FROM orders o JOIN order_items i ON i.order_id=o.id
       WHERE o.id=? AND i.merchant_id=? AND o.status='pending_ship' LIMIT 1`,
      [req.params.id, mid]
    )
    if (!rows.length) return fail(res, '订单不存在或无法发货', 404)
    await db.query(`UPDATE orders SET status='shipped', logistics_no=?, shipped_at=NOW() WHERE id=?`,
      [logistics_no, req.params.id])
    return ok(res, null, '发货成功')
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
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
    await db.query(`UPDATE orders SET status='completed' WHERE id=?`, [req.params.id])
    return ok(res, null, '退款已处理')
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
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
    const statusMap = { pending_ship: '待发货', shipped: '已发货', completed: '已完成', aftersale: '售后中', refund: '退款中' }
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
