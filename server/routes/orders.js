// server/routes/orders.js — 农户订单接口
const express  = require('express')
const jwt      = require('jsonwebtoken')
const db       = require('../db/database')
const { notifyNewOrder, notifyAftersale } = require('../utils/notify')
const router   = express.Router()

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
// POST /api/orders — 农户提交订单（待付款）
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

    // 锁库存：每件商品扣减，不足则回滚
    for (const item of items) {
      const pid = parseInt(item.id)
      const qty = parseInt(item.qty) || 1
      if (!pid) continue  // 本地兜底商品跳过
      const [r] = await conn.query(
        `UPDATE products SET stock = stock - ?
         WHERE id = ? AND stock >= ? AND status = 'on'`,
        [qty, pid, qty]
      )
      if (r.affectedRows === 0) {
        await conn.rollback()
        conn.release()
        return fail(res, `商品「${item.name}」库存不足或已下架`)
      }
    }

    // 查询农户信息
    const [[user]] = await conn.query(
      'SELECT real_name, phone FROM users WHERE id=?', [req.user.id]
    )

    const orderNo = await genOrderNo()
    const [r] = await conn.query(
      `INSERT INTO orders (order_no, user_id, farmer_name, farmer_phone,
        receiver_name, receiver_phone, address,
        subtotal, delivery_fee, total, pay_method, status, pay_expires_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending_payment', DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
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
    return ok(res, { orderId, orderNo }, '订单提交成功，请在30分钟内完成支付')
  } catch (e) {
    await conn.rollback()
    conn.release()
    console.error('[create-order]', e)
    return fail(res, '下单失败，请重试', 500)
  }
})

// ─────────────────────────────────────────────
// PATCH /api/orders/:id/pay — 农户确认付款
// ─────────────────────────────────────────────
router.patch('/:id/pay', farmerAuth, async (req, res) => {
  const { id } = req.params
  try {
    const [rows] = await db.query(
      `SELECT id, order_no, pay_expires_at FROM orders
       WHERE id=? AND user_id=? AND status='pending_payment'`,
      [id, req.user.id]
    )
    if (!rows.length) return fail(res, '订单不存在或已超时', 404)
    const order = rows[0]
    if (order.pay_expires_at && new Date(order.pay_expires_at) < new Date()) {
      // 已超时，关单并释放库存
      await _cancelAndReleaseStock(id)
      return fail(res, '订单已超时，请重新下单', 410)
    }
    // 付款成功 → 待发货
    const [items] = await db.query(
      'SELECT merchant_id FROM order_items WHERE order_id=?', [id]
    )
    await db.query(
      `UPDATE orders SET status='pending_ship', pay_expires_at=NULL WHERE id=?`, [id]
    )
    // 异步通知商户
    notifyNewOrder(id, order.order_no, items).catch(e => console.error('[notify-order]', e))
    return ok(res, null, '支付成功')
  } catch (e) {
    console.error('[pay-order]', e)
    return fail(res, '服务器错误', 500)
  }
})

// ─────────────────────────────────────────────
// PATCH /api/orders/:id/cancel — 农户主动取消（仅限待付款）
// ─────────────────────────────────────────────
router.patch('/:id/cancel', farmerAuth, async (req, res) => {
  const { id } = req.params
  try {
    const [rows] = await db.query(
      `SELECT id FROM orders WHERE id=? AND user_id=? AND status='pending_payment'`,
      [id, req.user.id]
    )
    if (!rows.length) return fail(res, '订单不存在或不可取消', 404)
    await _cancelAndReleaseStock(id)
    return ok(res, null, '订单已取消')
  } catch (e) {
    console.error('[cancel-order]', e)
    return fail(res, '服务器错误', 500)
  }
})

// 内部：取消订单并释放库存
async function _cancelAndReleaseStock(orderId) {
  const [items] = await db.query(
    'SELECT product_id, qty FROM order_items WHERE order_id=?', [orderId]
  )
  for (const item of items) {
    if (!item.product_id) continue
    await db.query(
      'UPDATE products SET stock=stock+? WHERE id=?', [item.qty, item.product_id]
    )
  }
  await db.query(
    `UPDATE orders SET status='cancelled', pay_expires_at=NULL WHERE id=?`, [orderId]
  )
}

// ─────────────────────────────────────────────
// GET /api/orders/my — 农户查看自己的订单
// ─────────────────────────────────────────────
router.get('/my', farmerAuth, async (req, res) => {
  try {
    const { status } = req.query
    let sql = `
      SELECT o.id, o.order_no, o.subtotal, o.delivery_fee, o.total,
             o.pay_method, o.status, o.logistics_no, o.address,
             o.receiver_name, o.receiver_phone, o.created_at, o.pay_expires_at,
             (SELECT COUNT(*) FROM reviews rv WHERE rv.order_id = o.id) AS has_reviewed,
             GROUP_CONCAT(
               CONCAT(i.icon,'|',i.name,'|',i.spec,'|',i.price,'|',i.qty,'|',IFNULL(p.image_url,''))
               SEPARATOR ';;'
             ) AS items_raw
      FROM orders o
      LEFT JOIN order_items i ON i.order_id = o.id
      LEFT JOIN products p ON p.id = i.product_id
      WHERE o.user_id = ?
    `
    const params = [req.user.id]
    if (status && status !== 'all') { sql += ' AND o.status = ?'; params.push(status) }
    sql += ' GROUP BY o.id ORDER BY o.created_at DESC'

    const [rows] = await db.query(sql, params)
    const orders = rows.map(o => ({
      ...o,
      items: (o.items_raw || '').split(';;').filter(Boolean).map(s => {
        const [icon, name, spec, price, qty, image_url] = s.split('|')
        return { icon, name, spec, price: parseFloat(price), qty: parseInt(qty), image_url: image_url || null }
      })
    }))
    return ok(res, orders)
  } catch (e) {
    console.error('[my-orders]', e)
    return fail(res, '服务器错误', 500)
  }
})

// ─────────────────────────────────────────────
// POST /api/orders/:id/aftersale — 农户提交售后申请
// ─────────────────────────────────────────────
router.post('/:id/aftersale', farmerAuth, async (req, res) => {
  const { id } = req.params
  const { aftersale_type, reason, other_reason, description, images } = req.body
  if (!aftersale_type) return fail(res, '请选择售后类型')
  if (!reason)         return fail(res, '请选择售后原因')
  if (reason === '其他' && !other_reason?.trim()) return fail(res, '请填写具体原因')
  try {
    const [orders] = await db.query(
      'SELECT id, order_no FROM orders WHERE id=? AND user_id=?',
      [id, req.user.id]
    )
    if (!orders.length) return fail(res, '订单不存在', 404)
    const [[item]] = await db.query(
      'SELECT merchant_id FROM order_items WHERE order_id=? LIMIT 1', [id]
    )
    if (!item) return fail(res, '订单商品不存在', 404)
    const [[user]] = await db.query('SELECT real_name FROM users WHERE id=?', [req.user.id])
    // 同一订单只允许一条未拒绝的申请
    const [existing] = await db.query(
      "SELECT id FROM aftersale_requests WHERE order_id=? AND status != 'rejected'", [id]
    )
    if (existing.length) return fail(res, '该订单已有售后申请，请勿重复提交')
    const [insertResult] = await db.query(
      `INSERT INTO aftersale_requests
       (order_id, order_no, merchant_id, user_id, farmer_name, aftersale_type, reason, other_reason, description, images)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, orders[0].order_no, item.merchant_id, req.user.id,
       user?.real_name || '', aftersale_type, reason, other_reason || '', description || '',
       Array.isArray(images) ? images.join(',') : (images || '')]
    )
    // 异步通知商户
    notifyAftersale(item.merchant_id, orders[0].order_no, insertResult.insertId)
      .catch(e => console.error('[notify-aftersale]', e))
    return ok(res, null, '售后申请已提交')
  } catch (e) {
    console.error('[aftersale-submit]', e)
    return fail(res, '提交失败，请重试', 500)
  }
})

// ─────────────────────────────────────────────
// POST /api/orders/:id/review — 农户提交评价（已完成订单）
// ─────────────────────────────────────────────
router.post('/:id/review', farmerAuth, async (req, res) => {
  const { id } = req.params
  const rating = parseInt(req.body.rating)
  const content = (req.body.content || '').trim()
  if (!rating || rating < 1 || rating > 5) return fail(res, '请选择评分（1-5星）')
  try {
    const [rows] = await db.query(
      'SELECT id, status FROM orders WHERE id=? AND user_id=?', [id, req.user.id]
    )
    if (!rows.length) return fail(res, '订单不存在', 404)
    if (rows[0].status !== 'completed') return fail(res, '只能评价已完成的订单')
    const [[item]] = await db.query(
      'SELECT merchant_id FROM order_items WHERE order_id=? LIMIT 1', [id]
    )
    if (!item) return fail(res, '订单商品不存在', 404)
    const [[user]] = await db.query('SELECT real_name FROM users WHERE id=?', [req.user.id])
    await db.query(
      'INSERT INTO reviews (order_id,merchant_id,user_id,farmer_name,rating,content) VALUES (?,?,?,?,?,?)',
      [id, item.merchant_id, req.user.id, user?.real_name || '买家', rating, content || null]
    )
    return ok(res, null, '评价成功，感谢您的反馈')
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return fail(res, '该订单已评价')
    console.error('[review-submit]', e)
    return fail(res, '服务器错误', 500)
  }
})

// ─────────────────────────────────────────────
// PATCH /api/orders/:id/confirm — 农户确认收货
// ─────────────────────────────────────────────
router.patch('/:id/confirm', farmerAuth, async (req, res) => {
  const { id } = req.params
  try {
    const [rows] = await db.query(
      'SELECT id FROM orders WHERE id=? AND user_id=? AND status=?',
      [id, req.user.id, 'shipped']
    )
    if (!rows.length) return fail(res, '订单不存在或状态不符', 404)
    await db.query(
      "UPDATE orders SET status='completed', confirmed_at=NOW(), fund_status='frozen' WHERE id=?",
      [id]
    )
    return ok(res, null, '确认收货成功')
  } catch (e) {
    console.error('[confirm-order]', e)
    return fail(res, '服务器错误', 500)
  }
})

module.exports = router
