// server/routes/orders.js — 农户订单接口
const express  = require('express')
const crypto   = require('crypto')
const jwt      = require('jsonwebtoken')
const db       = require('../db/database')
const { notifyNewOrder, notifyAftersale } = require('../utils/notify')
const refunds  = require('../utils/refunds')
const marketing = require('../utils/marketing')
const { cancelPendingSupplyOrder } = require('../utils/order-lifecycle')
const router   = express.Router()

const ok   = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })
const DELIVERY_FEE = 0

// 农户鉴权中间件（严格版：必须登录）
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

// 可选鉴权：有 token 则解析，无 token 或过期则以访客身份继续
function optionalAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  req.user = null
  if (auth.startsWith('Bearer ')) {
    try { req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET) } catch {}
  }
  next()
}

// 生成订单号：MG + yyyyMMddHHmmssSSS + 随机后缀，避免并发下单撞号
function genOrderNo() {
  const now = new Date()
  const date = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const time = String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0') +
    String(now.getMilliseconds()).padStart(3, '0')
  return 'MG' + date + time + crypto.randomBytes(3).toString('hex').toUpperCase()
}

function parseCoordinate(value, min, max) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : NaN
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const radians = degrees => degrees * Math.PI / 180
  const latDelta = radians(lat2 - lat1)
  const lngDelta = radians(lng2 - lng1)
  const a = Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(lngDelta / 2) ** 2
  const normalized = Math.min(1, Math.max(0, a))
  return 6371 * 2 * Math.atan2(Math.sqrt(normalized), Math.sqrt(1 - normalized))
}

function validateDeliveryRange(merchant, receiverLatitude, receiverLongitude) {
  if (receiverLatitude === null || receiverLongitude === null) return null
  const merchantLatitudeValue = merchant && merchant.merchant_latitude
  const merchantLongitudeValue = merchant && merchant.merchant_longitude
  const deliveryRadiusValue = merchant && merchant.delivery_radius
  if ([merchantLatitudeValue, merchantLongitudeValue, deliveryRadiusValue].some(value => value === null || value === undefined || value === '')) {
    return null
  }
  const merchantLatitude = Number(merchantLatitudeValue)
  const merchantLongitude = Number(merchantLongitudeValue)
  const deliveryRadius = Number(deliveryRadiusValue)
  if (!Number.isFinite(merchantLatitude) || !Number.isFinite(merchantLongitude) || !Number.isFinite(deliveryRadius) || deliveryRadius <= 0) {
    return null
  }
  const deliveryDistance = distanceKm(merchantLatitude, merchantLongitude, receiverLatitude, receiverLongitude)
  if (deliveryDistance > deliveryRadius) {
    throw marketing.statusError(`该收货地址超出商户配送范围（距离约${deliveryDistance.toFixed(1)}公里，配送半径${deliveryRadius}公里）`, 409)
  }
  return Number(deliveryDistance.toFixed(1))
}

// ─────────────────────────────────────────────
// POST /api/orders — 提交订单（登录/访客均可）
// ─────────────────────────────────────────────
router.post('/', optionalAuth, async (req, res) => {
  const {
    items, payMethod, userCouponId, user_coupon_id,
    receiverName, receiverPhone, address, receiverLatitude, receiverLongitude
  } = req.body

  if (!items || !items.length) return fail(res, '订单商品不能为空')
  if (!receiverName)           return fail(res, '请填写收货人姓名')
  if (!receiverPhone)          return fail(res, '请填写手机号')
  if (!address)                return fail(res, '请填写收货地址')
  const parsedReceiverLatitude = parseCoordinate(receiverLatitude, -90, 90)
  const parsedReceiverLongitude = parseCoordinate(receiverLongitude, -180, 180)
  if (Number.isNaN(parsedReceiverLatitude) || Number.isNaN(parsedReceiverLongitude) ||
      (parsedReceiverLatitude === null) !== (parsedReceiverLongitude === null)) {
    return fail(res, '收货位置坐标无效，请重新选择')
  }
  const selectedCouponId = Number(userCouponId || user_coupon_id) || null
  if (selectedCouponId && !req.user) return fail(res, '请登录后使用优惠券', 401)

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const pricing = await marketing.priceOrder(conn, {
      items,
      userId: req.user && req.user.id,
      userCouponId: selectedCouponId,
      lock: true
    })
    if (selectedCouponId && !pricing.couponApplied) {
      throw marketing.statusError(pricing.couponReason || '所选优惠券当前不可用', 409)
    }
    const deliveryDistance = validateDeliveryRange(
      pricing.merchant,
      parsedReceiverLatitude,
      parsedReceiverLongitude
    )

    for (const line of pricing.lines) {
      const [stock] = await conn.query(
        `UPDATE products SET stock=stock-? WHERE id=? AND stock>=? AND status='on'`,
        [line.qty, line.productId, line.qty]
      )
      if (!stock.affectedRows) throw marketing.statusError(`商品「${line.name}」库存不足或已下架`, 409)
    }

    // 已登录：用账号信息作为买家姓名/电话；访客：用收货人信息
    let userId = null
    let farmerName  = receiverName
    let farmerPhone = receiverPhone || ''
    if (req.user) {
      userId = req.user.id
      const [[user]] = await conn.query(
        'SELECT real_name, phone FROM users WHERE id=?', [req.user.id]
      )
      farmerName  = user?.real_name || receiverName
      farmerPhone = user?.phone     || receiverPhone || ''
    }

    const quote = marketing.publicQuote(pricing)
    const originalSubtotal = quote.original_subtotal
    const promotionDiscount = quote.promotion_discount
    const couponDiscount = quote.coupon_discount
    const merchantDiscount = quote.merchant_discount
    const orderSubtotal = quote.payable_total
    const orderDeliveryFee = DELIVERY_FEE
    const orderTotal = Number((orderSubtotal + orderDeliveryFee).toFixed(2))

    const orderNo = await genOrderNo()
    const [r] = await conn.query(
      `INSERT INTO orders (order_no, user_id, farmer_name, farmer_phone,
        receiver_name, receiver_phone, address,
        original_subtotal,promotion_discount,coupon_discount,merchant_discount,commission_base,user_coupon_id,
        subtotal, delivery_fee, total, pay_method, status, pay_expires_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending_payment', DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [
        orderNo, userId,
        farmerName, farmerPhone,
        receiverName, receiverPhone || '',
        address,
        originalSubtotal,
        promotionDiscount,
        couponDiscount,
        merchantDiscount,
        originalSubtotal,
        pricing.coupon ? pricing.coupon.userCouponId : null,
        orderSubtotal,
        orderDeliveryFee,
        orderTotal,
        payMethod || 'wechat'
      ]
    )
    const orderId = r.insertId

    const orderItemIds = new Map()
    for (const line of pricing.lines) {
      const promotionPrice = Number(((line.lineOriginalFen - (line.promotionDiscountFen || 0)) / line.qty / 100).toFixed(2))
      const [itemResult] = await conn.query(
        `INSERT INTO order_items
          (order_id,merchant_id,product_id,name,icon,spec,original_price,promotion_price,price,qty,subtotal,
           promotion_discount,coupon_discount,marketing_campaign_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          orderId,
          line.merchantId,
          line.productId,
          line.name,
          line.icon || '📦',
          line.unit,
          Number((line.originalPriceFen / 100).toFixed(2)),
          promotionPrice,
          Number((line.originalPriceFen / 100).toFixed(2)),
          line.qty,
          Number((line.linePayableFen / 100).toFixed(2)),
          Number(((line.promotionDiscountFen || 0) / 100).toFixed(2)),
          Number(((line.couponDiscountFen || 0) / 100).toFixed(2)),
          line.promotion ? line.promotion.id : (line.orderPromotion ? line.orderPromotion.id : null)
        ]
      )
      orderItemIds.set(line.productId, itemResult.insertId)
    }

    await marketing.reserveOrderMarketing(conn, orderId, userId, pricing, orderItemIds)

    await conn.commit()
    conn.release()
    return ok(res, {
      orderId,
      orderNo,
      subtotal: orderSubtotal,
      originalSubtotal,
      promotionDiscount,
      couponDiscount,
      merchantDiscount,
      deliveryFee: orderDeliveryFee,
      total: orderTotal,
      couponApplied: pricing.couponApplied,
      couponReason: pricing.couponReason,
      deliveryDistance
    }, '订单提交成功，请在30分钟内完成支付')
  } catch (e) {
    await conn.rollback()
    conn.release()
    if (!e.statusCode || e.statusCode >= 500) console.error('[create-order]', e)
    return fail(res, e.message || '下单失败，请重试', e.statusCode || 500)
  }
})

// ─────────────────────────────────────────────
// PATCH /api/orders/:id/pay — 已废弃：必须走微信支付接口
// ─────────────────────────────────────────────
router.patch('/:id/pay', optionalAuth, async (req, res) => {
  return fail(res, '请通过微信支付接口完成付款', 410)

  const { id } = req.params
  try {
    let rows
    if (req.user) {
      ;[rows] = await db.query(
        `SELECT id, order_no, pay_expires_at FROM orders WHERE id=? AND user_id=? AND status='pending_payment'`,
        [id, req.user.id]
      )
    } else {
      ;[rows] = await db.query(
        `SELECT id, order_no, pay_expires_at FROM orders WHERE id=? AND user_id IS NULL AND status='pending_payment'`,
        [id]
      )
    }
    if (!rows.length) return fail(res, '订单不存在或已超时', 404)
    const order = rows[0]
    if (order.pay_expires_at && new Date(order.pay_expires_at) < new Date()) {
      // 已超时，关单并释放库存
      await cancelPendingSupplyOrder(id)
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
// PATCH /api/orders/:id/cancel — 主动取消（登录/访客均可）
// ─────────────────────────────────────────────
router.patch('/:id/cancel', optionalAuth, async (req, res) => {
  const { id } = req.params
  try {
    let rows
    if (req.user) {
      ;[rows] = await db.query(
        `SELECT id FROM orders WHERE id=? AND user_id=? AND status='pending_payment'`,
        [id, req.user.id]
      )
    } else {
      ;[rows] = await db.query(
        `SELECT id FROM orders WHERE id=? AND user_id IS NULL AND status='pending_payment'`,
        [id]
      )
    }
    if (!rows.length) return fail(res, '订单不存在或不可取消', 404)
    await cancelPendingSupplyOrder(id)
    return ok(res, null, '订单已取消')
  } catch (e) {
    console.error('[cancel-order]', e)
    return fail(res, '服务器错误', 500)
  }
})

// 内部：取消订单并释放库存
// ─────────────────────────────────────────────
// GET /api/orders/my — 农户查看自己的订单
// ─────────────────────────────────────────────
router.get('/my', farmerAuth, async (req, res) => {
  try {
    await refunds.syncPendingSupplyRefunds({ userId: req.user.id }).catch(error => {
      console.error('[refund-sync-farmer-orders]', error.message)
    })
    const { status } = req.query
    let sql = `
      SELECT o.id, o.order_no, o.original_subtotal, o.promotion_discount,
             o.coupon_discount, o.merchant_discount, o.subtotal, o.delivery_fee, o.total,
             o.pay_method, o.status, o.logistics_no, o.logistics_company,
             o.logistics_company_name, o.logistics_state, o.logistics_status,
             o.logistics_latest, o.logistics_arrival_time, o.logistics_updated_at, o.address,
             o.receiver_name, o.receiver_phone, o.created_at, o.pay_expires_at,
             (SELECT COUNT(*) FROM reviews rv WHERE rv.order_id = o.id) AS has_reviewed,
             GROUP_CONCAT(
               CONCAT(i.icon,'|',i.name,'|',i.spec,'|',i.price,'|',i.qty,'|',
                      IFNULL(p.image_url,''),'|',IFNULL(mu.phone,''),'|',IFNULL(m2.wechat_id,''))
               SEPARATOR ';;'
             ) AS items_raw
      FROM orders o
      LEFT JOIN order_items i ON i.order_id = o.id
      LEFT JOIN products p ON p.id = i.product_id
      LEFT JOIN merchants m2 ON m2.id = i.merchant_id
      LEFT JOIN users mu ON mu.id = m2.user_id
      WHERE o.user_id = ? AND o.farmer_deleted = 0
    `
    const params = [req.user.id]
    const { status2 } = req.query
    if (status && status !== 'all') {
      if (status2) {
        sql += ' AND o.status IN (?,?)'; params.push(status, status2)
      } else {
        sql += ' AND o.status = ?'; params.push(status)
      }
    }
    sql += ' GROUP BY o.id ORDER BY o.created_at DESC'

    const [rows] = await db.query(sql, params)
    const orders = rows.map(o => ({
      ...o,
      items: (o.items_raw || '').split(';;').filter(Boolean).map(s => {
        const [icon, name, spec, price, qty, image_url, merchantPhone, merchantWechat] = s.split('|')
        return { icon, name, spec, price: parseFloat(price), qty: parseInt(qty), image_url: image_url || null, merchantPhone: merchantPhone || '', merchantWechat: merchantWechat || '' }
      })
    }))
    return ok(res, orders)
  } catch (e) {
    console.error('[my-orders]', e)
    return fail(res, '服务器错误', 500)
  }
})

// ─────────────────────────────────────────────
// DELETE /api/orders/:id — 农户删除（隐藏）订单（仅已完成/已取消/售后完成）
// ─────────────────────────────────────────────
router.delete('/:id', farmerAuth, async (req, res) => {
  const { id } = req.params
  try {
    const [[o]] = await db.query('SELECT status FROM orders WHERE id=? AND user_id=?', [id, req.user.id])
    if (!o) return fail(res, '订单不存在', 404)
    if (!['completed', 'cancelled', 'refunded'].includes(o.status))
      return fail(res, '仅已完成、已取消的订单可删除')
    await db.query('UPDATE orders SET farmer_deleted=1 WHERE id=?', [id])
    return ok(res, null, '已删除记录')
  } catch (e) {
    console.error('[order-delete]', e)
    return fail(res, '删除失败', 500)
  }
})

// ─────────────────────────────────────────────
// GET /api/orders/:id/aftersale — 农户查看售后申请状态
// ─────────────────────────────────────────────
router.get('/:id/aftersale', farmerAuth, async (req, res) => {
  const { id } = req.params
  try {
    const [rows] = await db.query(
      'SELECT id, aftersale_type, reason, other_reason, description, images, status, handle_note, created_at, updated_at FROM aftersale_requests WHERE order_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1',
      [id, req.user.id]
    )
    return ok(res, rows[0] || null)
  } catch (e) {
    console.error('[aftersale-status]', e)
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
    // 更新订单状态为售后中
    await db.query("UPDATE orders SET status='refund' WHERE id=?", [id])
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
  const isAnonymous = req.body.is_anonymous ? 1 : 0
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
      'INSERT INTO reviews (order_id,merchant_id,user_id,farmer_name,rating,content,is_anonymous) VALUES (?,?,?,?,?,?,?)',
      [id, item.merchant_id, req.user.id, user?.real_name || '买家', rating, content || null, isAnonymous]
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
