// server/routes/orders.js — 农户订单接口
const express = require('express')
const jwt     = require('jsonwebtoken')
const db      = require('../db/database')
const router  = express.Router()

const ok   = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

// 农户鉴权中间件
function farmerAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ code: 401, msg: '请先登录' })
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    req.user = payload
    next()
  } catch {
    res.status(401).json({ code: 401, msg: '登录已过期，请重新登录' })
  }
}

// 生成订单号：MG + yyyyMMdd + 4位序列
async function genOrderNo() {
  const now = new Date()
  const date = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const prefix = 'MG' + date
  const [[{ cnt }]] = await db.query(
    `SELECT COUNT(*) AS cnt FROM orders WHERE order_no LIKE ?`, [prefix + '%']
  )
  return prefix + String(Number(cnt) + 1).padStart(4, '0')
}

// ─────────────────────────────────────────────
// POST /api/orders — 农户下单
// ─────────────────────────────────────────────
router.post('/', farmerAuth, async (req, res) => {
  const {
    items, subtotal, deliveryFee, total, payMethod,
    receiverName, receiverPhone, address
  } = req.body

  if (!items || !items.length) return fail(res, '订单商品不能为空')
  if (!receiverName)           return fail(res, '请填写收货人姓名')
  if (!address)                return fail(res, '请填写收货地址')

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    // 查询农户信息
    const [[user]] = await conn.query(
      'SELECT real_name, phone FROM users WHERE id=?', [req.user.id]
    )

    const orderNo = await genOrderNo()
    const [r] = await conn.query(
      `INSERT INTO orders (order_no, user_id, farmer_name, farmer_phone,
        receiver_name, receiver_phone, address,
        subtotal, delivery_fee, total, pay_method, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending_ship')`,
      [
        orderNo, req.user.id,
        user?.real_name || '', user?.phone || '',
        receiverName, receiverPhone || '',
        address,
        parseFloat(subtotal) || 0,
        parseFloat(deliveryFee) || 10,
        parseFloat(total) || 0,
        payMethod || 'wechat'
      ]
    )
    const orderId = r.insertId

    // 插入商品明细
    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, merchant_id, product_id, name, icon, spec, price, qty, subtotal)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          orderId,
          parseInt(item.merchant_id) || 1,
          parseInt(item.id) || null,
          item.name || '',
          item.icon || '📦',
          item.spec || '',
          parseFloat(item.price) || 0,
          parseInt(item.qty) || 1,
          parseFloat(item.price) * parseInt(item.qty) || 0
        ]
      )
    }

    await conn.commit()
    conn.release()
    return ok(res, { orderId, orderNo }, '订单创建成功')
  } catch (e) {
    await conn.rollback()
    conn.release()
    console.error('[create-order]', e)
    return fail(res, '下单失败，请重试', 500)
  }
})

// ─────────────────────────────────────────────
// GET /api/orders/my — 农户查看自己的订单
// ─────────────────────────────────────────────
router.get('/my', farmerAuth, async (req, res) => {
  try {
    const { status } = req.query
    let sql = `
      SELECT o.id, o.order_no, o.subtotal, o.delivery_fee, o.total,
             o.pay_method, o.status, o.logistics_no, o.address,
             o.receiver_name, o.receiver_phone, o.created_at,
             GROUP_CONCAT(
               CONCAT(i.icon,'|',i.name,'|',i.spec,'|',i.price,'|',i.qty)
               SEPARATOR ';;'
             ) AS items_raw
      FROM orders o
      LEFT JOIN order_items i ON i.order_id = o.id
      WHERE o.user_id = ?
    `
    const params = [req.user.id]
    if (status && status !== 'all') { sql += ' AND o.status = ?'; params.push(status) }
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
  } catch (e) {
    console.error('[my-orders]', e)
    return fail(res, '服务器错误', 500)
  }
})

module.exports = router
