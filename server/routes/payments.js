// WeChat Pay service-provider partner JSAPI routes.
const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const { notifyNewOrder } = require('../utils/notify')
const wxpay = require('../utils/wechat-pay')
const profitSharing = require('../utils/profit-sharing')
const refunds = require('../utils/refunds')

const router = express.Router()
const ok = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function farmerAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return fail(res, '请先登录', 401)
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    next()
  } catch {
    fail(res, '登录已过期，请重新登录', 401)
  }
}

const fen = amount => Math.round(Number(amount || 0) * 100)

function isWechatPayTestMode() {
  return String(process.env.WECHAT_PAY_TEST_MODE || '').trim().toLowerCase() === 'small_amount'
}

function getWechatPayChargeFen(order) {
  const forcedFen = Number(process.env.WECHAT_PAY_FORCE_TEST_FEN || 0)
  if (isWechatPayTestMode() && Number.isInteger(forcedFen) && forcedFen > 0) return forcedFen
  return fen(order.amount)
}

function normalizeMachineStage(stage, fallback = 'deposit') {
  return ['deposit', 'balance', 'full'].includes(stage) ? stage : fallback
}

function outTradeNo(orderType, order) {
  const base = `${orderType.toUpperCase()}_${order.orderNo}_${order.id}`
  if (orderType !== 'machine') return base
  return `${base}_${String(order.paymentStage || 'full').toUpperCase()}`
}

function orderDescription(orderType, order) {
  if (orderType !== 'machine') return `棉花农资订单 ${order.orderNo}`
  const stageName = { deposit: '订金', balance: '尾款', full: '全款' }[order.paymentStage] || '款项'
  return `农机预约${stageName} ${order.name || order.orderNo}`
}

function parseNotifyOrder(transaction) {
  if (transaction.attach) {
    try {
      const attach = JSON.parse(transaction.attach)
      if (attach.orderType && attach.orderId) {
        const orderType = attach.orderType === 'machine' ? 'machine' : 'supply'
        return {
          orderType,
          orderId: Number(attach.orderId),
          paymentStage: orderType === 'machine'
            ? normalizeMachineStage(attach.paymentStage, 'full')
            : 'full'
        }
      }
    } catch {}
  }
  const tradeNo = String(transaction.out_trade_no || '')
  const parts = tradeNo.split('_')
  const machine = tradeNo.startsWith('MACHINE_')
  const last = String(parts[parts.length - 1] || '').toLowerCase()
  const hasStage = machine && ['deposit', 'balance', 'full'].includes(last)
  return {
    orderType: machine ? 'machine' : 'supply',
    orderId: Number(parts[parts.length - (hasStage ? 2 : 1)]),
    paymentStage: machine ? normalizeMachineStage(hasStage ? last : 'full', 'full') : 'full'
  }
}

function getRawBody(req) {
  if (req.rawBody) return req.rawBody.toString('utf8')
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  return ''
}

function validateReceiver(order) {
  if (!order) return { ok: false, msg: '订单不存在或无权访问', code: 404 }
  if (order.kind === 'supply' && Number(order.merchantCount) !== 1) {
    return { ok: false, msg: '该订单包含多个商户，请拆分订单后分别支付', code: 409 }
  }
  if (!order.subMchid) {
    if (order.isSelfOperated) {
      return { ok: false, msg: '服务商自营测试也必须绑定自营子商户号 sub_mchid', code: 409 }
    }
    return {
      ok: false,
      msg: `${order.kind === 'machine' ? '农机服务商' : '收款商户'}尚未配置微信支付子商户号，暂不能发起真实支付`,
      code: 409
    }
  }
  return { ok: true }
}

function shouldUseProfitSharing(order) {
  if (!order || !['supply', 'machine'].includes(order.kind) || order.isSelfOperated) return false
  if (String(process.env.WECHAT_PAY_PROFIT_SHARING_ENABLED || 'true') === 'false') return false
  return profitSharing.calculateCommissionFen(order.amount, order.commissionRate) > 0
}

async function loadSupplyOrder(orderId, userId, statuses = ['pending_payment']) {
  const placeholders = statuses.map(() => '?').join(',')
  const [[row]] = await db.query(
    `SELECT o.id,o.order_no,o.total,o.status,
            COUNT(DISTINCT i.merchant_id) AS merchant_count,
            MIN(i.merchant_id) AS merchant_id,MIN(m.sub_mchid) AS sub_mchid,
            MIN(m.commission_rate) AS commission_rate,
            MAX(CASE WHEN m.wechat_applyment_state='SELF_OPERATED' THEN 1 ELSE 0 END) AS self_operated
       FROM orders o JOIN order_items i ON i.order_id=o.id JOIN merchants m ON m.id=i.merchant_id
      WHERE o.id=? AND o.user_id=? AND o.status IN (${placeholders}) GROUP BY o.id`,
    [orderId, userId, ...statuses]
  )
  return normalizeSupplyOrder(row)
}

function normalizeSupplyOrder(row) {
  if (!row) return null
  return {
    kind: 'supply', id: row.id, orderNo: row.order_no, amount: Number(row.total || 0),
    status: row.status, merchantCount: Number(row.merchant_count || 0), merchantId: row.merchant_id,
    subMchid: row.sub_mchid || '', commissionRate: Number(row.commission_rate || 0),
    isSelfOperated: Number(row.self_operated || 0) === 1, paymentStage: 'full'
  }
}

async function loadAnySupplyOrder(orderId, userId) {
  return loadSupplyOrder(orderId, userId, ['pending_payment', 'pending_ship'])
}

async function loadSupplyOrderForNotify(orderId) {
  const [[row]] = await db.query(
    `SELECT o.id,o.order_no,o.total,o.status,
            COUNT(DISTINCT i.merchant_id) AS merchant_count,
            MIN(i.merchant_id) AS merchant_id,MIN(m.sub_mchid) AS sub_mchid,
            MIN(m.commission_rate) AS commission_rate,
            MAX(CASE WHEN m.wechat_applyment_state='SELF_OPERATED' THEN 1 ELSE 0 END) AS self_operated
       FROM orders o JOIN order_items i ON i.order_id=o.id JOIN merchants m ON m.id=i.merchant_id
      WHERE o.id=? GROUP BY o.id`, [orderId]
  )
  return normalizeSupplyOrder(row)
}

async function loadMachineRow(orderId, userId = null) {
  const params = [orderId]
  let ownerSql = ''
  if (userId !== null) {
    ownerSql = ' AND mo.farmer_id=?'
    params.push(userId)
  }
  const [[row]] = await db.query(
    `SELECT mo.id,mo.order_no,mo.machine_name,mo.total_price,mo.deposit,mo.operator_id,
            mo.status,mo.pay_mode,mo.pay_status,mo.paid_amount,
            mo.deposit_status,mo.balance_status,mo.deposit_paid_amount,mo.balance_paid_amount,
            mo.deposit_transaction_id,mo.balance_transaction_id,
            op.sub_mchid,op.commission_rate
       FROM machine_orders mo JOIN operators op ON op.id=mo.operator_id
      WHERE mo.id=?${ownerSql}`, params
  )
  return row || null
}

function normalizeMachineOrder(row, requestedStage) {
  if (!row) return null
  const fallback = row.pay_status === 'partial' ? 'balance' : (row.pay_mode === 'full' ? 'full' : 'deposit')
  const paymentStage = normalizeMachineStage(requestedStage, fallback)
  const total = Number(row.total_price || 0)
  const deposit = Number(row.deposit || 0)
  const depositPaid = Number(row.deposit_paid_amount || 0)
  const amount = paymentStage === 'deposit'
    ? deposit
    : paymentStage === 'balance' ? Math.max(0, +(total - depositPaid).toFixed(2)) : total
  return {
    kind: 'machine', id: row.id, orderNo: row.order_no, name: row.machine_name,
    amount, total, deposit, status: row.pay_status, workStatus: row.status,
    paymentStage, payMode: row.pay_mode, depositStatus: row.deposit_status,
    balanceStatus: row.balance_status, paidAmount: Number(row.paid_amount || 0),
    subMchid: row.sub_mchid || '', operatorId: row.operator_id,
    commissionRate: Number(row.commission_rate || 0), isSelfOperated: false
  }
}

function validateMachineStage(order) {
  if (!order) return { ok: false, msg: '农机订单不存在或无权访问', code: 404 }
  if (order.paymentStage === 'balance') {
    if (order.depositStatus !== 'paid' || order.status !== 'partial') {
      return { ok: false, msg: '该订单没有待支付的尾款', code: 409 }
    }
    if (order.workStatus !== 'completed') {
      return { ok: false, msg: '作业完成后才能支付尾款', code: 409 }
    }
    if (order.balanceStatus === 'paid') return { ok: false, msg: '尾款已支付', code: 409 }
  } else if (order.status !== 'unpaid') {
    return { ok: false, msg: '首笔款项已支付，不能重复付款', code: 409 }
  }
  if (order.amount <= 0) return { ok: false, msg: '订单金额异常', code: 409 }
  return { ok: true }
}

async function loadMachineOrder(orderId, userId, stage) {
  return normalizeMachineOrder(await loadMachineRow(orderId, userId), stage)
}

async function loadMachineOrderForNotify(orderId, stage) {
  return normalizeMachineOrder(await loadMachineRow(orderId), stage)
}

async function markMachinePaid(order, userId, transaction) {
  const transactionId = transaction && transaction.transaction_id || ''
  if (order.paymentStage === 'deposit') {
    const [result] = await db.query(
      `UPDATE machine_orders SET pay_mode='deposit',pay_status='partial',deposit_status='paid',
              balance_status='unpaid',deposit_paid_amount=?,paid_amount=?,transaction_id=?,
              deposit_transaction_id=?,paid_at=NOW(),deposit_paid_at=NOW(),fund_status='frozen'
        WHERE id=? AND farmer_id=? AND pay_status='unpaid'`,
      [order.amount, order.amount, transactionId, transactionId, order.id, userId]
    )
    return result.affectedRows > 0
  }
  if (order.paymentStage === 'balance') {
    const [result] = await db.query(
      `UPDATE machine_orders SET pay_status='paid',balance_status='paid',balance_paid_amount=?,
              paid_amount=deposit_paid_amount+?,balance_transaction_id=?,balance_paid_at=NOW(),fund_status='frozen'
        WHERE id=? AND farmer_id=? AND pay_status='partial' AND deposit_status='paid' AND balance_status!='paid'`,
      [order.amount, order.amount, transactionId, order.id, userId]
    )
    return result.affectedRows > 0
  }
  const [result] = await db.query(
    `UPDATE machine_orders SET pay_mode='full',pay_status='paid',deposit_status='skipped',
            balance_status='paid',balance_paid_amount=?,paid_amount=?,transaction_id=?,
            balance_transaction_id=?,paid_at=NOW(),balance_paid_at=NOW(),fund_status='frozen'
      WHERE id=? AND farmer_id=? AND pay_status='unpaid'`,
    [order.amount, order.amount, transactionId, transactionId, order.id, userId]
  )
  return result.affectedRows > 0
}

async function markMachinePaidByNotify(order, transaction) {
  const transactionId = transaction.transaction_id || ''
  if (order.paymentStage === 'deposit') {
    await db.query(
      `UPDATE machine_orders SET pay_mode='deposit',pay_status='partial',deposit_status='paid',
              balance_status='unpaid',deposit_paid_amount=?,paid_amount=?,transaction_id=?,
              deposit_transaction_id=?,paid_at=NOW(),deposit_paid_at=NOW(),fund_status='frozen'
        WHERE id=? AND pay_status='unpaid'`,
      [order.amount, order.amount, transactionId, transactionId, order.id]
    )
  } else if (order.paymentStage === 'balance') {
    await db.query(
      `UPDATE machine_orders SET pay_status='paid',balance_status='paid',balance_paid_amount=?,
              paid_amount=deposit_paid_amount+?,balance_transaction_id=?,balance_paid_at=NOW(),fund_status='frozen'
        WHERE id=? AND pay_status='partial' AND deposit_status='paid' AND balance_status!='paid'`,
      [order.amount, order.amount, transactionId, order.id]
    )
  } else {
    await db.query(
      `UPDATE machine_orders SET pay_mode='full',pay_status='paid',deposit_status='skipped',
              balance_status='paid',balance_paid_amount=?,paid_amount=?,transaction_id=?,
              balance_transaction_id=?,paid_at=NOW(),balance_paid_at=NOW(),fund_status='frozen'
        WHERE id=? AND pay_status='unpaid'`,
      [order.amount, order.amount, transactionId, transactionId, order.id]
    )
  }
}

async function markSupplyPaid(orderId, userId) {
  const [result] = await db.query(
    "UPDATE orders SET status='pending_ship',pay_expires_at=NULL WHERE id=? AND user_id=? AND status='pending_payment'",
    [orderId, userId]
  )
  if (result.affectedRows > 0) {
    const [[order]] = await db.query('SELECT order_no FROM orders WHERE id=?', [orderId])
    const [items] = await db.query('SELECT merchant_id FROM order_items WHERE order_id=?', [orderId])
    notifyNewOrder(orderId, order && order.order_no || '', items).catch(error => console.error('[notify-order]', error))
  }
  return result.affectedRows > 0
}

async function markPaidByNotify(type, orderId, paymentStage, paidFen, transaction) {
  const order = type === 'machine'
    ? await loadMachineOrderForNotify(orderId, paymentStage)
    : await loadSupplyOrderForNotify(orderId)
  if (!order) return { ok: false, message: 'order not found' }
  const receiver = validateReceiver(order)
  if (!receiver.ok) return { ok: false, message: receiver.msg }
  if (transaction.sub_mchid && transaction.sub_mchid !== order.subMchid) return { ok: false, message: 'sub_mchid mismatch' }
  if (getWechatPayChargeFen(order) !== Number(paidFen)) return { ok: false, message: 'order amount mismatch' }

  if (type === 'machine') {
    const alreadyPaid = order.paymentStage === 'deposit'
      ? order.depositStatus === 'paid'
      : order.balanceStatus === 'paid'
    if (!alreadyPaid) {
      const valid = validateMachineStage(order)
      if (!valid.ok) return { ok: false, message: valid.msg }
      await markMachinePaidByNotify(order, transaction)
    }
    return { ok: true, order }
  }

  if (order.status === 'pending_ship') return { ok: true, order }
  if (order.status !== 'pending_payment') return { ok: false, message: 'supply order status invalid' }
  await db.query(
    "UPDATE orders SET status='pending_ship',pay_expires_at=NULL WHERE id=? AND status='pending_payment'",
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
    let paymentStage = 'full'
    if (orderType === 'machine') {
      const requested = req.body.paymentStage || req.body.payMode
      const current = await loadMachineRow(orderId, req.user.id)
      const fallback = current && current.pay_status === 'partial'
        ? 'balance'
        : (req.body.payMode === 'full' ? 'full' : 'deposit')
      paymentStage = normalizeMachineStage(requested, fallback)
      if (current && current.pay_status === 'unpaid' && ['deposit', 'full'].includes(paymentStage)) {
        await db.query('UPDATE machine_orders SET pay_mode=? WHERE id=? AND farmer_id=? AND pay_status=\'unpaid\'',
          [paymentStage, orderId, req.user.id])
      }
    }

    const [[user]] = await db.query('SELECT openid FROM users WHERE id=?', [req.user.id])
    if (!user || !user.openid) return fail(res, '请先使用微信登录绑定 openid 后再支付', 409)

    const order = orderType === 'machine'
      ? await loadMachineOrder(orderId, req.user.id, paymentStage)
      : await loadSupplyOrder(orderId, req.user.id)
    if (orderType === 'machine') {
      const stageCheck = validateMachineStage(order)
      if (!stageCheck.ok) return fail(res, stageCheck.msg, stageCheck.code)
    }
    const receiver = validateReceiver(order)
    if (!receiver.ok) return fail(res, receiver.msg, receiver.code)

    const cfg = wxpay.getServiceProviderConfig()
    if (!cfg) return fail(res, '微信支付服务商配置不完整', 501)

    const chargeFen = getWechatPayChargeFen(order)
    const prepay = await wxpay.partnerJsapiPrepay({
      cfg,
      openid: user.openid,
      order: {
        description: orderDescription(orderType, order),
        outTradeNo: outTradeNo(orderType, order),
        amountFen: chargeFen,
        subMchid: order.subMchid,
        profitSharing: shouldUseProfitSharing(order),
        attach: {
          orderType, orderId: order.id, paymentStage: order.paymentStage,
          subMchid: order.subMchid,
          paymentMode: order.isSelfOperated ? 'self_operated' : 'partner',
          testMode: isWechatPayTestMode() ? 'small_amount' : 'off', expectedPaidFen: chargeFen
        }
      }
    })
    if (!prepay || !prepay.prepay_id) return fail(res, '微信支付未返回预支付单号', 502)

    return ok(res, {
      orderType, orderId: order.id, paymentStage: order.paymentStage,
      payParams: wxpay.buildRequestPaymentParams({ appid: cfg.spAppid, privateKey: cfg.privateKey, prepayId: prepay.prepay_id }),
      testMode: isWechatPayTestMode() ? 'small_amount' : 'off', chargeFen
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
    const paymentStage = orderType === 'machine'
      ? normalizeMachineStage(req.body.paymentStage, req.body.payMode === 'full' ? 'full' : 'deposit')
      : 'full'
    const order = orderType === 'machine'
      ? await loadMachineOrder(orderId, req.user.id, paymentStage)
      : await loadAnySupplyOrder(orderId, req.user.id)
    if (!order) return fail(res, '订单不存在或无权访问', 404)

    if (orderType === 'machine') {
      const alreadyPaid = paymentStage === 'deposit' ? order.depositStatus === 'paid' : order.balanceStatus === 'paid'
      if (alreadyPaid) return ok(res, null, '支付状态已同步')
      const stageCheck = validateMachineStage(order)
      if (!stageCheck.ok) return fail(res, stageCheck.msg, stageCheck.code)
    } else if (order.status === 'pending_ship') {
      return ok(res, null, '支付状态已同步')
    }

    const receiver = validateReceiver(order)
    if (!receiver.ok) return fail(res, receiver.msg, receiver.code)
    const cfg = wxpay.getServiceProviderConfig()
    if (!cfg) return fail(res, '微信支付服务商配置不完整', 501)

    const transaction = await wxpay.queryPartnerTransaction({
      cfg, outTradeNo: outTradeNo(orderType, order), subMchid: order.subMchid
    })
    if (transaction.trade_state !== 'SUCCESS') {
      return fail(res, `微信支付未完成：${transaction.trade_state || 'UNKNOWN'}`, 409)
    }
    if (transaction.sub_mchid && transaction.sub_mchid !== order.subMchid) return fail(res, '微信支付子商户号与订单不一致')
    const paidFen = transaction.amount && (transaction.amount.payer_total || transaction.amount.total)
    if (getWechatPayChargeFen(order) !== Number(paidFen)) return fail(res, '微信支付金额与订单金额不一致')

    const changed = orderType === 'machine'
      ? await markMachinePaid(order, req.user.id, transaction)
      : await markSupplyPaid(orderId, req.user.id)
    if (!changed) return fail(res, '订单状态已变化，请刷新后重试', 409)
    if (shouldUseProfitSharing(order)) {
      try { await profitSharing.savePendingOrder({ order, transaction }) } catch (error) {
        console.error('[profit-sharing-record]', error.message)
      }
    }
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
    const { orderType, orderId, paymentStage } = parseNotifyOrder(transaction)
    if (!orderId) return res.status(400).json({ code: 'FAIL', message: 'invalid order info' })
    const paidFen = transaction.amount && (transaction.amount.payer_total || transaction.amount.total)
    const result = await markPaidByNotify(orderType, orderId, paymentStage, paidFen, transaction)
    if (!result.ok) return res.status(400).json({ code: 'FAIL', message: result.message })
    if (result.order && shouldUseProfitSharing(result.order)) {
      try { await profitSharing.savePendingOrder({ order: result.order, transaction }) } catch (error) {
        console.error('[profit-sharing-record]', error.message)
      }
    }
    return res.json({ code: 'SUCCESS', message: 'success' })
  } catch (error) {
    console.error('[wechat-notify]', error)
    return res.status(500).json({ code: 'FAIL', message: 'wechat pay notify failed' })
  }
})

router.post('/wechat/refund-notify', async (req, res) => {
  try {
    const cfg = wxpay.getNotifyConfig()
    if (!cfg) return res.status(500).json({ code: 'FAIL', message: 'wechat pay notify is not configured' })
    const rawBody = getRawBody(req)
    if (!rawBody || !wxpay.verifyNotifySignature(req, rawBody, cfg)) {
      return res.status(401).json({ code: 'FAIL', message: 'invalid wechat pay signature' })
    }
    const body = JSON.parse(rawBody)
    await refunds.handleRefundNotify(wxpay.decryptNotifyResource(body.resource, cfg.apiV3Key))
    return res.json({ code: 'SUCCESS', message: 'success' })
  } catch (error) {
    console.error('[wechat-refund-notify]', error)
    return res.status(error.statusCode || 500).json({ code: 'FAIL', message: error.message || 'wechat refund notify failed' })
  }
})

module.exports = router
