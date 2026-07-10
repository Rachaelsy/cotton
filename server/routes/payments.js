// server/routes/payments.js — 微信支付服务商 partner JSAPI
const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const { notifyNewOrder } = require('../utils/notify')
const wxpay = require('../utils/wechat-pay')
const profitSharing = require('../utils/profit-sharing')

const router = express.Router()
const ok = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function farmerAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ code: 401, msg: '请先登录' })
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ code: 401, msg: '登录已过期，请重新登录' })
  }
}

function fen(amount) {
  return Math.round(Number(amount || 0) * 100)
}

function isWechatPayTestMode() {
  return String(process.env.WECHAT_PAY_TEST_MODE || '').trim().toLowerCase() === 'small_amount'
}

function getWechatPayChargeFen(order) {
  const forcedFen = Number(process.env.WECHAT_PAY_FORCE_TEST_FEN || 0)
  if (isWechatPayTestMode() && Number.isInteger(forcedFen) && forcedFen > 0) return forcedFen
  return fen(order.amount)
}

function outTradeNo(orderType, order) {
  return `${orderType.toUpperCase()}_${order.orderNo}_${order.id}`
}

function orderDescription(orderType, order) {
  if (orderType === 'machine') return `农机预约 ${order.name || order.orderNo}`
  return `棉花农资订单 ${order.orderNo}`
}

function parseNotifyOrder(transaction) {
  if (transaction.attach) {
    try {
      const attach = JSON.parse(transaction.attach)
      if (attach.orderType && attach.orderId) {
        return {
          orderType: attach.orderType === 'machine' ? 'machine' : 'supply',
          orderId: Number(attach.orderId)
        }
      }
    } catch {}
  }
  const tradeNo = String(transaction.out_trade_no || '')
  const parts = tradeNo.split('_')
  return {
    orderType: tradeNo.startsWith('MACHINE_') ? 'machine' : 'supply',
    orderId: Number(parts[parts.length - 1])
  }
}

function getRawBody(req) {
  if (req.rawBody) return req.rawBody.toString('utf8')
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  return ''
}

function validateReceiver(order) {
  if (!order) return { ok: false, msg: '订单不存在、已支付或已超时', code: 404 }
  if (order.kind === 'supply' && Number(order.merchantCount) !== 1) {
    return { ok: false, msg: '该订单包含多个商户，请拆分订单后分别支付', code: 409 }
  }
  if (!order.subMchid) {
    if (order.isSelfOperated) {
      return { ok: false, msg: '服务商自营测试也必须绑定自营子商户号 sub_mchid，不能直接用服务商商户号收款', code: 409 }
    }
    const who = order.kind === 'machine' ? '农机服务商' : '收款商户'
    return { ok: false, msg: `${who}尚未配置微信支付子商户号，暂不能发起真实支付`, code: 409 }
  }
  return { ok: true }
}

function shouldUseProfitSharing(order) {
  if (!order || order.kind !== 'supply') return false
  if (order.isSelfOperated) return false
  if (String(process.env.WECHAT_PAY_PROFIT_SHARING_ENABLED || 'true') === 'false') return false
  return profitSharing.calculateCommissionFen(order.amount, order.commissionRate) > 0
}

async function loadSupplyOrder(orderId, userId, statuses = ['pending_payment']) {
  const placeholders = statuses.map(() => '?').join(',')
  const [[order]] = await db.query(
    `SELECT o.id, o.order_no, o.total, o.status,
            COUNT(DISTINCT i.merchant_id) AS merchant_count,
            MIN(i.merchant_id) AS merchant_id,
            MIN(m.sub_mchid) AS sub_mchid,
            MIN(m.commission_rate) AS commission_rate,
            MAX(CASE WHEN m.wechat_applyment_state='SELF_OPERATED' THEN 1 ELSE 0 END) AS self_operated
     FROM orders o
     JOIN order_items i ON i.order_id=o.id
     JOIN merchants m ON m.id=i.merchant_id
     WHERE o.id=? AND o.user_id=? AND o.status IN (${placeholders})
     GROUP BY o.id`,
    [orderId, userId, ...statuses]
  )
  if (!order) return null
  return {
    kind: 'supply',
    id: order.id,
    orderNo: order.order_no,
    amount: Number(order.total || 0),
    status: order.status,
    merchantCount: Number(order.merchant_count || 0),
    merchantId: order.merchant_id,
    subMchid: order.sub_mchid || '',
    commissionRate: Number(order.commission_rate || 0),
    isSelfOperated: Number(order.self_operated || 0) === 1
  }
}

async function loadAnySupplyOrder(orderId, userId) {
  return loadSupplyOrder(orderId, userId, ['pending_payment', 'pending_ship'])
}

async function loadSupplyOrderForNotify(orderId) {
  const [[order]] = await db.query(
    `SELECT o.id, o.order_no, o.total, o.status,
            COUNT(DISTINCT i.merchant_id) AS merchant_count,
            MIN(i.merchant_id) AS merchant_id,
            MIN(m.sub_mchid) AS sub_mchid,
            MIN(m.commission_rate) AS commission_rate,
            MAX(CASE WHEN m.wechat_applyment_state='SELF_OPERATED' THEN 1 ELSE 0 END) AS self_operated
     FROM orders o
     JOIN order_items i ON i.order_id=o.id
     JOIN merchants m ON m.id=i.merchant_id
     WHERE o.id=?
     GROUP BY o.id`,
    [orderId]
  )
  if (!order) return null
  return {
    kind: 'supply',
    id: order.id,
    orderNo: order.order_no,
    amount: Number(order.total || 0),
    status: order.status,
    merchantCount: Number(order.merchant_count || 0),
    merchantId: order.merchant_id,
    subMchid: order.sub_mchid || '',
    commissionRate: Number(order.commission_rate || 0),
    isSelfOperated: Number(order.self_operated || 0) === 1
  }
}

async function loadMachineOrder(orderId, userId, statuses = ['unpaid']) {
  const placeholders = statuses.map(() => '?').join(',')
  const [[order]] = await db.query(
    `SELECT mo.id, mo.order_no, mo.machine_name, mo.total_price, mo.deposit,
            mo.pay_mode, mo.pay_status, op.sub_mchid
     FROM machine_orders mo
     JOIN operators op ON op.id=mo.operator_id
     WHERE mo.id=? AND mo.farmer_id=? AND mo.pay_status IN (${placeholders})`,
    [orderId, userId, ...statuses]
  )
  if (!order) return null
  const amount = order.pay_mode === 'full' ? Number(order.total_price || 0) : Number(order.deposit || 0)
  return {
    kind: 'machine',
    id: order.id,
    orderNo: order.order_no,
    name: order.machine_name,
    amount,
    status: order.pay_status,
    subMchid: order.sub_mchid || ''
  }
}

async function loadAnyMachineOrder(orderId, userId) {
  return loadMachineOrder(orderId, userId, ['unpaid', 'paid'])
}

async function loadMachineOrderForNotify(orderId) {
  const [[order]] = await db.query(
    `SELECT mo.id, mo.order_no, mo.machine_name, mo.total_price, mo.deposit,
            mo.pay_mode, mo.pay_status, op.sub_mchid
     FROM machine_orders mo
     JOIN operators op ON op.id=mo.operator_id
     WHERE mo.id=?`,
    [orderId]
  )
  if (!order) return null
  const amount = order.pay_mode === 'full' ? Number(order.total_price || 0) : Number(order.deposit || 0)
  return {
    kind: 'machine',
    id: order.id,
    orderNo: order.order_no,
    name: order.machine_name,
    amount,
    status: order.pay_status,
    subMchid: order.sub_mchid || ''
  }
}

async function markPaid(type, orderId, userId) {
  if (type === 'machine') {
    const [r] = await db.query(
      "UPDATE machine_orders SET pay_status='paid' WHERE id=? AND farmer_id=? AND pay_status='unpaid'",
      [orderId, userId]
    )
    return r.affectedRows > 0
  }

  const [r] = await db.query(
    "UPDATE orders SET status='pending_ship', pay_expires_at=NULL WHERE id=? AND user_id=? AND status='pending_payment'",
    [orderId, userId]
  )
  if (r.affectedRows > 0) {
    const [[order]] = await db.query('SELECT order_no FROM orders WHERE id=?', [orderId])
    const [items] = await db.query('SELECT merchant_id FROM order_items WHERE order_id=?', [orderId])
    notifyNewOrder(orderId, order?.order_no || '', items).catch(error => console.error('[notify-order]', error))
  }
  return r.affectedRows > 0
}

async function markPaidByNotify(type, orderId, paidFen, transactionSubMchid) {
  const order = type === 'machine'
    ? await loadMachineOrderForNotify(orderId)
    : await loadSupplyOrderForNotify(orderId)
  if (!order) return { ok: false, message: 'order not found' }

  const receiver = validateReceiver(order)
  if (!receiver.ok) return { ok: false, message: receiver.msg }
  if (transactionSubMchid && transactionSubMchid !== order.subMchid) return { ok: false, message: 'sub_mchid mismatch' }
  if (getWechatPayChargeFen(order) !== Number(paidFen)) return { ok: false, message: 'order amount mismatch' }

  if (type === 'machine') {
    if (order.status === 'paid') return { ok: true, order }
    await db.query("UPDATE machine_orders SET pay_status='paid' WHERE id=? AND pay_status='unpaid'", [orderId])
    return { ok: true, order }
  }

  if (order.status === 'pending_ship') return { ok: true, order }
  if (order.status !== 'pending_payment') return { ok: false, message: 'supply order status invalid' }
  await db.query(
    "UPDATE orders SET status='pending_ship', pay_expires_at=NULL WHERE id=? AND status='pending_payment'",
    [orderId]
  )
  const [items] = await db.query('SELECT merchant_id FROM order_items WHERE order_id=?', [orderId])
  notifyNewOrder(orderId, order.orderNo || '', items).catch(error => console.error('[notify-order]', error))
  return { ok: true, order }
}

router.post('/wechat/prepay', farmerAuth, async (req, res) => {
  const orderType = req.body.orderType === 'machine' ? 'machine' : 'supply'
  const orderId = Number(req.body.orderId)
  if (!orderId) return fail(res, '缺少订单编号')

  try {
    const [[user]] = await db.query('SELECT openid FROM users WHERE id=?', [req.user.id])
    if (!user || !user.openid) return fail(res, '请先使用微信登录绑定 openid 后再支付', 409)

    const order = orderType === 'machine'
      ? await loadMachineOrder(orderId, req.user.id)
      : await loadSupplyOrder(orderId, req.user.id)
    const receiver = validateReceiver(order)
    if (!receiver.ok) return fail(res, receiver.msg, receiver.code)
    if (order.amount <= 0) return fail(res, '订单金额异常')

    const cfg = wxpay.getServiceProviderConfig()
    if (!cfg) return fail(res, '微信支付服务商未配置：请配置服务商 AppID、服务商商户号、证书序列号、私钥和支付回调地址', 501)

    const tradeNo = outTradeNo(orderType, order)
    const prepayPayload = {
      cfg,
      openid: user.openid,
      order: {
        description: orderDescription(orderType, order),
        outTradeNo: tradeNo,
        amountFen: getWechatPayChargeFen(order),
        attach: {
          orderType,
          orderId: order.id,
          subMchid: order.subMchid,
          paymentMode: order.isSelfOperated ? 'self_operated' : 'partner',
          testMode: isWechatPayTestMode() ? 'small_amount' : 'off',
          expectedPaidFen: getWechatPayChargeFen(order)
        }
      }
    }
    prepayPayload.order.subMchid = order.subMchid
    prepayPayload.order.profitSharing = shouldUseProfitSharing(order)
    const prepay = await wxpay.partnerJsapiPrepay(prepayPayload)
    if (!prepay || !prepay.prepay_id) return fail(res, '微信支付未返回预支付单号', 502)

    const payParams = wxpay.buildRequestPaymentParams({
      appid: cfg.spAppid,
      privateKey: cfg.privateKey,
      prepayId: prepay.prepay_id
    })
    return ok(res, {
      orderType,
      orderId: order.id,
      payParams,
      testMode: isWechatPayTestMode() ? 'small_amount' : 'off',
      chargeFen: getWechatPayChargeFen(order)
    })
  } catch (error) {
    console.error('[wechat-prepay]', error)
    return fail(res, error.message || '微信支付预下单失败', 500)
  }
})

router.post('/wechat/confirm', farmerAuth, async (req, res) => {
  const orderType = req.body.orderType === 'machine' ? 'machine' : 'supply'
  const orderId = Number(req.body.orderId)
  if (!orderId) return fail(res, '缺少订单编号')

  try {
    const order = orderType === 'machine'
      ? await loadAnyMachineOrder(orderId, req.user.id)
      : await loadAnySupplyOrder(orderId, req.user.id)
    if (!order) return fail(res, '订单不存在或无权访问', 404)
    if (order.status === 'paid' || order.status === 'pending_ship') return ok(res, null, '支付状态已同步')

    const receiver = validateReceiver(order)
    if (!receiver.ok) return fail(res, receiver.msg, receiver.code)

    const cfg = wxpay.getServiceProviderConfig()
    if (!cfg) return fail(res, '微信支付服务商未配置：请配置服务商 AppID、服务商商户号、证书序列号、私钥和支付回调地址', 501)

    const transaction = await wxpay.queryPartnerTransaction({
      cfg,
      outTradeNo: outTradeNo(orderType, order),
      subMchid: order.subMchid
    })
    if (transaction.trade_state !== 'SUCCESS') {
      return fail(res, `微信支付未完成：${transaction.trade_state || 'UNKNOWN'}`, 409)
    }
    if (transaction.sub_mchid && transaction.sub_mchid !== order.subMchid) return fail(res, '微信支付子商户号与订单不一致', 400)
    const paidFen = transaction.amount && (transaction.amount.payer_total || transaction.amount.total)
    if (getWechatPayChargeFen(order) !== Number(paidFen)) return fail(res, '微信支付金额与订单金额不一致', 400)

    const changed = await markPaid(orderType, orderId, req.user.id)
    if (changed && orderType === 'supply' && shouldUseProfitSharing(order)) {
      try {
        await profitSharing.savePendingSupplyOrder({ order, transaction })
      } catch (error) {
        console.error('[profit-sharing-record]', error.message)
      }
    }
    if (!changed) return fail(res, '订单不存在或已处理', 404)
    return ok(res, null, '支付状态已同步')
  } catch (error) {
    console.error('[wechat-confirm]', error)
    return fail(res, error.message || '支付状态同步失败', 500)
  }
})

router.post('/wechat/notify', async (req, res) => {
  try {
    const cfg = wxpay.getNotifyConfig()
    if (!cfg) return res.status(500).json({ code: 'FAIL', message: 'wechat pay notify is not configured' })

    const rawBody = getRawBody(req)
    if (!rawBody || !wxpay.verifyNotifySignature(req, rawBody, cfg)) {
      return res.status(401).json({ code: 'FAIL', message: 'invalid wechat pay signature' })
    }

    const body = JSON.parse(rawBody)
    const transaction = wxpay.decryptNotifyResource(body.resource, cfg.apiV3Key)
    if (transaction.trade_state !== 'SUCCESS') return res.json({ code: 'SUCCESS', message: 'success' })

    const { orderType, orderId } = parseNotifyOrder(transaction)
    if (!orderId) return res.status(400).json({ code: 'FAIL', message: 'invalid order info' })
    const paidFen = transaction.amount && (transaction.amount.payer_total || transaction.amount.total)
    const result = await markPaidByNotify(orderType, orderId, paidFen, transaction.sub_mchid)
    if (!result.ok) return res.status(400).json({ code: 'FAIL', message: result.message })
    if (orderType === 'supply' && result.order && shouldUseProfitSharing(result.order)) {
      try {
        await profitSharing.savePendingSupplyOrder({ order: result.order, transaction })
      } catch (error) {
        console.error('[profit-sharing-record]', error.message)
      }
    }
    return res.json({ code: 'SUCCESS', message: 'success' })
  } catch (error) {
    console.error('[wechat-notify]', error)
    return res.status(500).json({ code: 'FAIL', message: 'wechat pay notify failed' })
  }
})

module.exports = router
