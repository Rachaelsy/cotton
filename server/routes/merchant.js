// server/routes/merchant.js — 商户后台接口
require('dotenv').config()
const express = require('express')
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const db      = require('../db/database')
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const router  = express.Router()

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
             m.product_category, m.apply_status
      FROM users u JOIN merchants m ON m.user_id = u.id WHERE u.id = ?
    `, [req.merchant.id])
    if (!rows.length) return fail(res, '用户不存在', 404)
    return ok(res, rows[0])
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

router.put('/profile', merchantAuth, async (req, res) => {
  const { real_name, company_name, product_category, business_license } = req.body
  try {
    if (real_name) await db.query('UPDATE users SET real_name=? WHERE id=?', [real_name, req.merchant.id])
    await db.query(
      'UPDATE merchants SET company_name=?, product_category=?, business_license=? WHERE user_id=?',
      [company_name||'', product_category||'', business_license||'', req.merchant.id]
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
      pending_settlement: '0.00',
      monthly_sales:      parseFloat(o.monthly_sales || 0).toFixed(2),
      total_customers:    tc.total_customers || 0,
      unread_messages:    0,
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
    const [[m]] = await db.query(`
      SELECT
        COUNT(*) AS monthly_orders,
        IFNULL(SUM(o.total), 0) AS monthly_sales,
        IFNULL(SUM(CASE WHEN o.status='refund' THEN o.total ELSE 0 END), 0) AS monthly_refund
      FROM orders o
      JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
      WHERE DATE_FORMAT(o.created_at,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m')
    `, [mid])
    const [settleRows] = await db.query(`
      SELECT o.id, o.order_no, o.total, o.created_at,
             GROUP_CONCAT(i.name ORDER BY i.id SEPARATOR '、') AS prod_names
      FROM orders o
      JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?
      WHERE o.status='completed'
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT 50
    `, [mid])
    return ok(res, {
      available_balance: '0.00',
      monthly_sales:  parseFloat(m.monthly_sales  || 0).toFixed(2),
      monthly_orders: parseInt(m.monthly_orders)  || 0,
      monthly_refund: parseFloat(m.monthly_refund || 0).toFixed(2),
      settlements: settleRows.map((s, idx) => {
        const amount     = parseFloat(s.total)
        const commission = parseFloat((amount * 0.03).toFixed(2))
        return {
          id:         'SE' + String(idx + 1).padStart(3, '0'),
          order_no:   s.order_no,
          prod:       s.prod_names || '商品',
          amount,
          commission,
          actual:     parseFloat((amount - commission).toFixed(2)),
          status:     '已结算',
          date:       String(s.created_at).slice(0, 10)
        }
      }),
      withdrawals: []
    })
  } catch(e) { console.error('[merchant-finance]', e); return fail(res, '服务器错误', 500) }
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
    if (status && status !== 'all') { sql += ' WHERE o.status = ?'; params.push(status) }
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
    await db.query(`UPDATE orders SET status='shipped', logistics_no=? WHERE id=?`,
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
      `SELECT o.id FROM orders o JOIN order_items i ON i.order_id=o.id
       WHERE o.id=? AND i.merchant_id=? LIMIT 1`,
      [req.params.id, mid]
    )
    if (!rows.length) return fail(res, '订单不存在或无权删除', 404)
    await db.query('DELETE FROM orders WHERE id=?', [req.params.id])
    return ok(res, null, '订单已删除')
  } catch(e) { console.error(e); return fail(res, '服务器错误', 500) }
})

// ─────────────────────────────────────────────────────────────
// POST /api/merchant/upload — 图片上传
// ─────────────────────────────────────────────────────────────
router.post('/upload', merchantAuth, upload.single('image'), (req, res) => {
  if (!req.file) return fail(res, '请选择图片文件')
  return ok(res, { url: `/uploads/products/${req.file.filename}` }, '上传成功')
})

module.exports = router
