// WeChat Pay service-provider partner JSAPI routes.
const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const { notifyNewOrder } = require('../utils/notify')
const wxpay = require('../utils/wechat-pay')
const profitSharing = require('../utils/profit-sharing')
const refunds = require('../utils/refunds')
const marketing = require('../utils/marketing')
const paymentOrderNo = require('../utils/payment-order-no')
const machineLifecycle = require('../utils/machine-order-lifecycle')
const paymentAttach = require('../utils/payment-attach')

const router = express.Router()
const ok = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function farmerAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return fail(res, '请先登录', 401)
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    if (req.user.role !== 'farmer') return fail(res, '仅农户可支付订单', 403)
    next()
  } catch {
    fail(res, '登录已过期，请重新登录', 401)
  }
}

const fen = amount => Math.round(Number(amount || 0) * 100)

function isWechatPayTestMode() {
  return String(process.env.WECHAT_PAY_TEST_MODE || '').trim().toLowerCase() === 'small_amount'
}

function isMockPaymentMode(env = process.env) {
  return String(env.NODE_ENV || '').trim().toLowerCase() !== 'production' &&
    String(env.WECHAT_PAY_TEST_MODE || '').trim().toLowerCase() === 'mock' &&
    String(env.WECHAT_PAY_MOCK_ENABLED || '').trim().toLowerCase() === 'true'
}

function getWechatPayChargeFen(order) {
  const forcedFen = Number(process.env.WECHAT_PAY_FORCE_TEST_FEN || 0)
  if (isWechatPayTestMode() && Number.isInteger(forcedFen) && forcedFen > 0) return forcedFen
  return fen(order.amount)
}

function formatWechatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

function isPastTime(value) {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now()
}

function validateSupplyNotExpired(order) {
  if (!order || order.kind !== 'supply' || order.status !== 'pending_payment') return { ok: true }
  if (!isPastTime(order.payExpiresAt)) return { ok: true }
  return { ok: false, msg: '订单已超时，请重新下单', code: 410 }
}

function normalizeMachineStage(stage, fallback = 'deposit') {
  return ['deposit', 'balance', 'full'].includes(stage) ? stage : fallback
}

function outTradeNo(orderType, order) {
  return orderType === 'machine'
    ? paymentOrderNo.machineOutTradeNo(order, order.paymentStage)
    : paymentOrderNo.supplyOutTradeNo(order)
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
      const compact = paymentAttach.parseCompactPaymentAttach(attach)
      if (compact) return compact
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
  const compactSupply = tradeNo.match(/^S_(\d+)_/)
  if (compactSupply) return { orderType: 'supply', orderId: Number(compactSupply[1]), paymentStage: 'full' }
  const compactMachine = tradeNo.match(/^M_(\d+)_([DBF])_/)
  if (compactMachine) {
    const stage = { D: 'deposit', B: 'balance', F: 'full' }[compactMachine[2]]
    return { orderType: 'machine', orderId: Number(compactMachine[1]), paymentStage: stage }
  }
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

function validateMockOrder(order) {
  if (!order) return { ok: false, msg: '订单不存在或无权访问', code: 404 }
  if (order.kind === 'supply' && Number(order.merchantCount) !== 1) {
    return { ok: false, msg: '该订单包含多个商户，请拆分订单后分别支付', code: 409 }
  }
  return { ok: true }
}

function mapWechatPrepayError(error, orderType) {
  const code = String(error && error.wxpay && error.wxpay.code || '')
  const message = String(error && error.wxpay && error.wxpay.message || error && error.message || '')
  if (code === 'NO_AUTH' && message.includes('受理关系不存在')) {
    const receiver = orderType === 'machine' ? '该农机手' : '该商户'
    return {
      code: 409,
      msg: `${receiver}的子商户号未与当前微信支付服务商建立受理关系，请完成特约商户进件或授权后重试`
    }
  }
  return null
}

function shouldUseProfitSharing(order) {
  if (!order || !['supply', 'machine'].includes(order.kind) || order.isSelfOperated) return false
  if (String(process.env.WECHAT_PAY_PROFIT_SHARING_ENABLED || 'true') === 'false') return false
  return profitSharing.calculateOrderCommissionFen(order) > 0
}

async function loadSupplyOrder(orderId, userId, statuses = ['pending_payment']) {
  const placeholders = statuses.map(() => '?').join(',')
  const [[row]] = await db.query(
    `SELECT o.id,o.order_no,o.total,o.original_subtotal,o.commission_base,o.status,o.pay_expires_at,
            o.wechat_out_trade_no,o.wechat_transaction_id,o.payment_mode,o.paid_at,
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
    commissionBase: Number(row.commission_base || row.original_subtotal || row.total || 0),
    payExpiresAt: row.pay_expires_at,
    wechatOutTradeNo: row.wechat_out_trade_no || '',
    wechatTransactionId: row.wechat_transaction_id || '',
    paymentMode: row.payment_mode || '', paidAt: row.paid_at,
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
    `SELECT o.id,o.order_no,o.total,o.original_subtotal,o.commission_base,o.status,o.pay_expires_at,
            o.wechat_out_trade_no,o.wechat_transaction_id,o.payment_mode,o.paid_at,
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
            mo.pay_expires_at,
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
    payExpiresAt: row.pay_expires_at,
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
  } else {
    if (order.workStatus !== 'pending') {
      return { ok: false, msg: order.workStatus === 'cancelled' ? '预约已取消，不能继续付款' : '当前订单状态不能支付首笔款项', code: 409 }
    }
    if (machineLifecycle.isPast(order.payExpiresAt)) {
      return { ok: false, msg: '订单已超时，请重新预约', code: 410 }
    }
    if (order.status !== 'unpaid') {
      return { ok: false, msg: '首笔款项已支付，不能重复付款', code: 409 }
    }
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
              deposit_transaction_id=?,paid_at=NOW(),deposit_paid_at=NOW(),fund_status='frozen',pay_expires_at=NULL
        WHERE id=? AND farmer_id=? AND status='pending' AND pay_status='unpaid'`,
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
            balance_transaction_id=?,paid_at=NOW(),balance_paid_at=NOW(),fund_status='frozen',pay_expires_at=NULL
      WHERE id=? AND farmer_id=? AND status='pending' AND pay_status='unpaid'`,
    [order.amount, order.amount, transactionId, transactionId, order.id, userId]
  )
  return result.affectedRows > 0
}

async function markMachinePaidByNotify(order, transaction) {
  const transactionId = transaction.transaction_id || ''
  if (order.paymentStage === 'deposit') {
    const [result] = await db.query(
      `UPDATE machine_orders SET pay_mode='deposit',pay_status='partial',deposit_status='paid',
              balance_status='unpaid',deposit_paid_amount=?,paid_amount=?,transaction_id=?,
              deposit_transaction_id=?,paid_at=NOW(),deposit_paid_at=NOW(),fund_status='frozen',pay_expires_at=NULL
        WHERE id=? AND status IN ('pending','cancelled') AND pay_status='unpaid'`,
      [order.amount, order.amount, transactionId, transactionId, order.id]
    )
    return result.affectedRows > 0
  } else if (order.paymentStage === 'balance') {
    const [result] = await db.query(
      `UPDATE machine_orders SET pay_status='paid',balance_status='paid',balance_paid_amount=?,
              paid_amount=deposit_paid_amount+?,balance_transaction_id=?,balance_paid_at=NOW(),fund_status='frozen'
        WHERE id=? AND pay_status='partial' AND deposit_status='paid' AND balance_status!='paid'`,
      [order.amount, order.amount, transactionId, order.id]
    )
    return result.affectedRows > 0
  } else {
    const [result] = await db.query(
      `UPDATE machine_orders SET pay_mode='full',pay_status='paid',deposit_status='skipped',
              balance_status='paid',balance_paid_amount=?,paid_amount=?,transaction_id=?,
              balance_transaction_id=?,paid_at=NOW(),balance_paid_at=NOW(),fund_status='frozen',pay_expires_at=NULL
        WHERE id=? AND status IN ('pending','cancelled') AND pay_status='unpaid'`,
      [order.amount, order.amount, transactionId, transactionId, order.id]
    )
    return result.affectedRows > 0
  }
}

async function recordSupplyPaymentTrace(order, transaction, paymentMode = 'wechat') {
  const transactionId = transaction && transaction.transaction_id || ''
  await db.query(
    `UPDATE orders SET wechat_out_trade_no=?,wechat_transaction_id=?,payment_mode=?,paid_at=COALESCE(paid_at,NOW())
      WHERE id=?`,
    [outTradeNo('supply', order), transactionId, paymentMode, order.id]
  )
}

async function markSupplyPaid(order, userId, transaction, paymentMode = 'wechat') {
  const ownerSql = userId == null ? '' : ' AND user_id=?'
  const params = [
    outTradeNo('supply', order), transaction && transaction.transaction_id || '', paymentMode, order.id
  ]
  if (userId != null) params.push(userId)
  const [result] = await db.query(
    `UPDATE orders SET status='pending_ship',pay_expires_at=NULL,wechat_out_trade_no=?,
            wechat_transaction_id=?,payment_mode=?,paid_at=COALESCE(paid_at,NOW())
      WHERE id=?${ownerSql} AND status='pending_payment'`,
    params
  )
  if (result.affectedRows > 0) {
    await marketing.markOrderPaid(order.id)
    const [items] = await db.query('SELECT merchant_id FROM order_items WHERE order_id=?', [order.id])
    notifyNewOrder(order.id, order.orderNo || '', items).catch(error => console.error('[notify-order]', error))
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
    if (order.workStatus === 'cancelled' && order.paymentStage !== 'balance') {
      if (!alreadyPaid) {
        const changed = await markMachinePaidByNotify(order, transaction)
        if (!changed) return { ok: false, message: 'cancelled machine payment could not be recorded' }
      }
      try {
        await refunds.createMachineRefund({
          orderId,
          reason: '预约支付超时后收到微信成功回调，系统自动原路退款'
        })
      } catch (error) {
        console.error('[machine-late-payment-refund]', error)
        return { ok: false, message: 'late machine payment refund failed' }
      }
      return { ok: true, order, skipProfitSharing: true }
    }
    if (!alreadyPaid) {
      const valid = validateMachineStage(order)
      if (!valid.ok) return { ok: false, message: valid.msg }
      const changed = await markMachinePaidByNotify(order, transaction)
      if (!changed) {
        const latest = await loadMachineOrderForNotify(orderId, paymentStage)
        const paidNow = latest && (paymentStage === 'deposit'
          ? latest.depositStatus === 'paid'
          : latest.balanceStatus === 'paid')
        if (!paidNow) return { ok: false, message: 'machine order status changed' }
      }
    }
    return { ok: true, order }
  }

  if (order.status === 'pending_ship') {
    await recordSupplyPaymentTrace(order, transaction, 'wechat')
    await marketing.markOrderPaid(orderId)
    return { ok: true, order }
  }
  if (order.status !== 'pending_payment') return { ok: false, message: 'supply order status invalid' }
  const changed = await markSupplyPaid(order, null, transaction, 'wechat')
  if (!changed) return { ok: false, message: 'supply order status changed' }
  return { ok: true, order }
}

router.get('/wechat/mode', farmerAuth, (_req, res) => {
  const mode = isMockPaymentMode() ? 'mock' : (isWechatPayTestMode() ? 'small_amount' : 'real')
  return ok(res, { mode, mock: mode === 'mock' })
})

router.post('/wechat/prepay', farmerAuth, async (req, res) => {
  const orderType = req.body.orderType === 'machine' ? 'machine' : 'supply'
  const orderId = Number(req.body.orderId)
  if (!orderId) return fail(res, '缺少订单编号')

  try {
    const mockPayment = isMockPaymentMode()
    let paymentStage = 'full'
    if (orderType === 'machine') {
      await machineLifecycle.expireUnpaidMachineOrders({ farmerId: req.user.id, orderId })
      const requested = req.body.paymentStage || req.body.payMode
      const current = await loadMachineRow(orderId, req.user.id)
      const fallback = current && current.pay_status === 'partial'
        ? 'balance'
        : (req.body.payMode === 'full' ? 'full' : 'deposit')
      paymentStage = normalizeMachineStage(requested, fallback)
      if (current && current.pay_status === 'unpaid' && ['deposit', 'full'].includes(paymentStage)) {
        await db.query('UPDATE machine_orders SET pay_mode=? WHERE id=? AND farmer_id=? AND status=\'pending\' AND pay_status=\'unpaid\'',
          [paymentStage, orderId, req.user.id])
      }
    }

    let user = null
    if (!mockPayment) {
      [[user]] = await db.query('SELECT openid FROM users WHERE id=?', [req.user.id])
      if (!user || !user.openid) return fail(res, '请先使用微信登录绑定 openid 后再支付', 409)
    }

    const order = orderType === 'machine'
      ? await loadMachineOrder(orderId, req.user.id, paymentStage)
      : await loadSupplyOrder(orderId, req.user.id)
    if (orderType === 'machine') {
      const stageCheck = validateMachineStage(order)
      if (!stageCheck.ok) return fail(res, stageCheck.msg, stageCheck.code)
    } else {
      const expiryCheck = validateSupplyNotExpired(order)
      if (!expiryCheck.ok) return fail(res, expiryCheck.msg, expiryCheck.code)
    }
    const receiver = mockPayment ? validateMockOrder(order) : validateReceiver(order)
    if (!receiver.ok) return fail(res, receiver.msg, receiver.code)

    if (mockPayment) {
      return ok(res, {
        orderType,
        orderId: order.id,
        paymentStage: order.paymentStage,
        payParams: null,
        mock: true,
        testMode: 'mock',
        chargeFen: fen(order.amount)
      }, '模拟支付已就绪')
    }

    const cfg = wxpay.getServiceProviderConfig()
    if (!cfg) return fail(res, '微信支付服务商配置不完整', 501)

    const chargeFen = getWechatPayChargeFen(order)
    const paymentOutTradeNo = outTradeNo(orderType, order)
    if (orderType === 'supply' && !order.wechatOutTradeNo) {
      await db.query(
        "UPDATE orders SET wechat_out_trade_no=? WHERE id=? AND wechat_out_trade_no=''",
        [paymentOutTradeNo, order.id]
      )
      order.wechatOutTradeNo = paymentOutTradeNo
    }
    const prepay = await wxpay.partnerJsapiPrepay({
      cfg,
      openid: user.openid,
      order: {
        description: orderDescription(orderType, order),
        outTradeNo: paymentOutTradeNo,
        timeExpire: formatWechatTime(order.payExpiresAt),
        amountFen: chargeFen,
        subMchid: order.subMchid,
        profitSharing: shouldUseProfitSharing(order),
        attach: paymentAttach.buildPaymentAttach(orderType, order)
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
    const mapped = mapWechatPrepayError(error, orderType)
    if (mapped) return fail(res, mapped.msg, mapped.code)
    return fail(res, error.message || '微信支付预下单失败', 500)
  }
})

router.post('/wechat/confirm', farmerAuth, async (req, res) => {
  const orderType = req.body.orderType === 'machine' ? 'machine' : 'supply'
  const orderId = Number(req.body.orderId)
  if (!orderId) return fail(res, '缺少订单编号')
  try {
    const mockPayment = isMockPaymentMode()
    if (orderType === 'machine') {
      await machineLifecycle.expireUnpaidMachineOrders({ farmerId: req.user.id, orderId })
    }
    const paymentStage = orderType === 'machine'
      ? normalizeMachineStage(req.body.paymentStage, req.body.payMode === 'full' ? 'full' : 'deposit')
      : 'full'
    const order = orderType === 'machine'
      ? await loadMachineOrder(orderId, req.user.id, paymentStage)
      : await loadAnySupplyOrder(orderId, req.user.id)
    if (orderType === 'supply') {
      const expiryCheck = validateSupplyNotExpired(order)
      if (!expiryCheck.ok) return fail(res, expiryCheck.msg, expiryCheck.code)
    }
    if (!order) return fail(res, '订单不存在或无权访问', 404)

    if (orderType === 'machine') {
      const alreadyPaid = paymentStage === 'deposit' ? order.depositStatus === 'paid' : order.balanceStatus === 'paid'
      if (alreadyPaid) return ok(res, null, '支付状态已同步')
      const stageCheck = validateMachineStage(order)
      if (!stageCheck.ok) return fail(res, stageCheck.msg, stageCheck.code)
    } else if (order.status === 'pending_ship') {
      return ok(res, null, '支付状态已同步')
    }

    const receiver = mockPayment ? validateMockOrder(order) : validateReceiver(order)
    if (!receiver.ok) return fail(res, receiver.msg, receiver.code)

    if (mockPayment) {
      const transaction = {
        transaction_id: `MOCK_${orderType.toUpperCase()}_${order.id}_${Date.now()}`,
        trade_state: 'SUCCESS',
        amount: { total: fen(order.amount), payer_total: fen(order.amount) }
      }
      const changed = orderType === 'machine'
        ? await markMachinePaid(order, req.user.id, transaction)
        : await markSupplyPaid(order, req.user.id, transaction, 'mock')
      if (!changed) return fail(res, '订单状态已变化，请刷新后重试', 409)
      return ok(res, { mock: true, transactionId: transaction.transaction_id }, '模拟支付成功')
    }

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
      : await markSupplyPaid(order, req.user.id, transaction, 'wechat')
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
    if (result.order && !result.skipProfitSharing && shouldUseProfitSharing(result.order)) {
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
