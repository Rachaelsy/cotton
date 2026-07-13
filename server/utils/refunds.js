const defaultDb = require('../db/database')
const defaultWxpay = require('./wechat-pay')

let db = defaultDb
let wxpay = defaultWxpay

function isWechatPayTestMode(env = process.env) {
  return String(env.WECHAT_PAY_TEST_MODE || '').trim().toLowerCase() === 'small_amount'
}

function amountFen(amount) {
  return Math.round(Number(amount || 0) * 100)
}

function getWechatPayChargeFen(order, env = process.env) {
  const forcedFen = Number(env.WECHAT_PAY_FORCE_TEST_FEN || 0)
  if (isWechatPayTestMode(env) && Number.isInteger(forcedFen) && forcedFen > 0) return forcedFen
  return amountFen(order.total || order.amount || 0)
}

function supplyOutTradeNo(order) {
  return `SUPPLY_${order.order_no || order.orderNo}_${order.id}`
}

function outRefundNo(order, sequence = Date.now()) {
  const base = `RF_SUPPLY_${order.id}_${sequence}`
  return base.slice(0, 64)
}

function outProfitSharingReturnNo(order, sequence = Date.now()) {
  const base = `PSR_SUPPLY_${order.id}_${sequence}`
  return base.slice(0, 64)
}

function normalizeRefundStatus(data) {
  const status = String((data && (data.refund_status || data.status)) || '').toUpperCase()
  if (!status) return 'PROCESSING'
  return status
}

function isActiveRefundStatus(status) {
  return ['PENDING', 'PROCESSING', 'SUCCESS', 'ABNORMAL'].includes(String(status || '').toUpperCase())
}

function isSuccessRefundStatus(status) {
  return String(status || '').toUpperCase() === 'SUCCESS'
}

function isSuccessProfitSharingState(state) {
  return ['SUCCESS', 'FINISHED'].includes(String(state || '').toUpperCase())
}

function mysqlDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function getRefundNotifyUrl(cfg, env = process.env) {
  const explicit = String(env.WECHAT_PAY_REFUND_NOTIFY_URL || '').trim()
  if (explicit && !/^(TODO|your_|xxx)/i.test(explicit)) return explicit
  const payNotify = String((cfg && cfg.notifyUrl) || '').trim()
  if (!payNotify) return ''
  if (payNotify.endsWith('/wechat/notify')) return payNotify.replace('/wechat/notify', '/wechat/refund-notify')
  if (payNotify.endsWith('/notify')) return payNotify.replace('/notify', '/refund-notify')
  return ''
}

async function loadSupplyRefundOrder(orderId, merchantId) {
  const params = [orderId]
  let merchantFilter = ''
  if (merchantId) {
    merchantFilter = ' AND i.merchant_id=?'
    params.push(merchantId)
  }
  const [[order]] = await db.query(
    `SELECT o.id, o.order_no, o.total, o.status, o.pay_method, o.fund_status,
            COUNT(DISTINCT i.merchant_id) AS merchant_count,
            MIN(i.merchant_id) AS merchant_id,
            MIN(m.sub_mchid) AS sub_mchid
     FROM orders o
     JOIN order_items i ON i.order_id=o.id
     JOIN merchants m ON m.id=i.merchant_id
     WHERE o.id=?${merchantFilter}
     GROUP BY o.id`,
    params
  )
  return order || null
}

function validateRefundableSupplyOrder(order) {
  if (!order) {
    const error = new Error('订单不存在或无权访问')
    error.statusCode = 404
    throw error
  }
  if (Number(order.merchant_count || 0) !== 1) {
    const error = new Error('该订单包含多个商户，暂不能整单退款')
    error.statusCode = 409
    throw error
  }
  if (!order.sub_mchid) {
    const error = new Error('收款商户尚未绑定微信支付子商户号，无法发起退款')
    error.statusCode = 409
    throw error
  }
  if (String(order.pay_method || '').toLowerCase() !== 'wechat') {
    const error = new Error('该订单不是微信支付订单，不能发起微信退款')
    error.statusCode = 409
    throw error
  }
  if (order.status === 'refunded') {
    const error = new Error('订单已退款')
    error.statusCode = 409
    throw error
  }
  if (!['pending_ship', 'shipped', 'completed', 'refund'].includes(order.status)) {
    const error = new Error('当前订单状态不能退款')
    error.statusCode = 409
    throw error
  }
}

async function findActiveRefund(orderId) {
  const [[row]] = await db.query(
    `SELECT * FROM wechat_refunds
     WHERE order_type='supply' AND order_id=?
     ORDER BY id DESC LIMIT 1`,
    [orderId]
  )
  return row || null
}

async function findSuccessfulProfitSharing(orderId) {
  const [[row]] = await db.query(
    `SELECT * FROM wechat_profit_sharing_orders
     WHERE order_type='supply' AND order_id=? AND amount_fen > 0
     ORDER BY id DESC LIMIT 1`,
    [orderId]
  )
  if (!row || !isSuccessProfitSharingState(row.state)) return null
  return row
}

async function findProfitSharingReturn(orderId) {
  const [[row]] = await db.query(
    `SELECT id, profit_sharing_return_no, profit_sharing_return_state
     FROM wechat_refunds
     WHERE order_type='supply' AND order_id=?
       AND profit_sharing_return_state IN ('SUCCESS','FINISHED','PROCESSING')
     ORDER BY id DESC LIMIT 1`,
    [orderId]
  )
  return row || null
}

function isWechatTransactionMissing(error) {
  const wx = error && error.wxpay || {}
  const text = `${wx.code || ''} ${wx.message || ''} ${error && error.message || ''}`.toUpperCase()
  return (
    text.includes('ORDERNOTEXIST') ||
    text.includes('ORDER_NOT_EXIST') ||
    text.includes('TRANSACTION_NOT_EXIST') ||
    text.includes('RESOURCE_NOT_EXISTS') ||
    text.includes('NOT FOUND') ||
    text.includes('不存在')
  )
}

async function loadPaidWechatTransaction({ cfg, order, totalFen }) {
  let transaction
  try {
    transaction = await wxpay.queryPartnerTransaction({
      cfg,
      outTradeNo: supplyOutTradeNo(order),
      subMchid: order.sub_mchid
    })
  } catch (error) {
    if (isWechatTransactionMissing(error)) {
      const friendly = new Error('该订单没有真实微信支付记录，可能是早期模拟支付订单，不能发起微信退款')
      friendly.statusCode = 409
      throw friendly
    }
    throw error
  }

  if (!transaction || transaction.trade_state !== 'SUCCESS') {
    const error = new Error(`微信支付订单未支付成功，不能退款：${transaction && transaction.trade_state || 'UNKNOWN'}`)
    error.statusCode = 409
    throw error
  }
  if (transaction.sub_mchid && transaction.sub_mchid !== order.sub_mchid) {
    const error = new Error('微信交易子商户号与订单收款商户不一致，不能退款')
    error.statusCode = 409
    throw error
  }
  const paidFen = Number(transaction.amount && (transaction.amount.payer_total || transaction.amount.total) || 0)
  if (paidFen && paidFen !== Number(totalFen)) {
    const error = new Error('微信实付金额与订单退款金额不一致，请核对订单后再退款')
    error.statusCode = 409
    throw error
  }
  return transaction
}

function extractRefundMeta(result) {
  const amount = result.amount || {}
  return {
    status: normalizeRefundStatus(result),
    refundId: result.refund_id || '',
    transactionId: result.transaction_id || '',
    channel: result.channel || '',
    userReceivedAccount: result.user_received_account || '',
    refundFen: Number(amount.refund || 0),
    totalFen: Number(amount.total || 0),
    successTime: mysqlDate(result.success_time)
  }
}

async function markRefundSuccess(row) {
  if (!row || row.order_type !== 'supply') return
  await db.query(
    "UPDATE orders SET status='refunded', fund_status='refunded' WHERE id=?",
    [row.order_id]
  )
  if (row.aftersale_id) {
    await db.query(
      "UPDATE aftersale_requests SET status='approved' WHERE id=?",
      [row.aftersale_id]
    )
  }
}

async function createSupplyRefund({ orderId, merchantId, aftersaleId = null, reason = '' }) {
  const order = await loadSupplyRefundOrder(orderId, merchantId)
  validateRefundableSupplyOrder(order)

  const existing = await findActiveRefund(order.id)
  if (existing && isActiveRefundStatus(existing.status)) {
    if (isSuccessRefundStatus(existing.status)) await markRefundSuccess(existing)
    return { alreadyExists: true, refund: existing, status: existing.status }
  }

  const cfg = wxpay.getServiceProviderConfig()
  if (!cfg) {
    const error = new Error('微信支付服务商未配置，无法发起真实退款')
    error.statusCode = 501
    throw error
  }

  const totalFen = getWechatPayChargeFen(order)
  if (!totalFen || totalFen <= 0) {
    const error = new Error('订单支付金额异常，无法退款')
    error.statusCode = 409
    throw error
  }
  const transaction = await loadPaidWechatTransaction({ cfg, order, totalFen })

  const refund = {
    subMchid: order.sub_mchid,
    outTradeNo: supplyOutTradeNo(order),
    transactionId: transaction.transaction_id || '',
    outRefundNo: outRefundNo(order),
    reason: reason || '商户同意售后退款',
    notifyUrl: getRefundNotifyUrl(cfg),
    refundFen: totalFen,
    totalFen,
    currency: 'CNY',
    fundsAccount: String(process.env.WECHAT_PAY_REFUND_FUNDS_ACCOUNT || '').trim()
  }
  if (!refund.fundsAccount) delete refund.fundsAccount
  const payload = wxpay.buildPartnerRefundBody({ refund })

  await db.query(
    `INSERT INTO wechat_refunds
     (order_type, order_id, aftersale_id, out_trade_no, out_refund_no, sub_mchid,
      amount_fen, total_fen, currency, reason, status, request_payload)
     VALUES ('supply',?,?,?,?,?,?,?,?,?,'PENDING',?)`,
    [
      order.id,
      aftersaleId || null,
      refund.outTradeNo,
      refund.outRefundNo,
      refund.subMchid,
      refund.refundFen,
      refund.totalFen,
      refund.currency,
      refund.reason,
      JSON.stringify(payload)
    ]
  )

  try {
    await returnProfitSharingIfNeeded({
      order,
      cfg,
      outRefundNo: refund.outRefundNo,
      reason: refund.reason
    })
    const result = await wxpay.partnerRefund({ cfg, refund })
    const meta = extractRefundMeta(result)
    await db.query(
      `UPDATE wechat_refunds
       SET wechat_refund_id=?, transaction_id=?, amount_fen=IF(? > 0, ?, amount_fen),
           total_fen=IF(? > 0, ?, total_fen), status=?, channel=?,
           user_received_account=?, success_time=?, result_payload=?, error_code='', error_msg=''
       WHERE out_refund_no=?`,
      [
        meta.refundId,
        meta.transactionId,
        meta.refundFen,
        meta.refundFen,
        meta.totalFen,
        meta.totalFen,
        meta.status,
        meta.channel,
        meta.userReceivedAccount,
        meta.successTime,
        JSON.stringify(result),
        refund.outRefundNo
      ]
    )
    const [[saved]] = await db.query('SELECT * FROM wechat_refunds WHERE out_refund_no=?', [refund.outRefundNo])
    if (isSuccessRefundStatus(meta.status)) await markRefundSuccess(saved)
    return { alreadyExists: false, refund: saved, status: meta.status, result }
  } catch (error) {
    const wx = error.wxpay || {}
    await db.query(
      `UPDATE wechat_refunds
       SET status='FAILED', error_code=?, error_msg=?, result_payload=?
       WHERE out_refund_no=?`,
      [
        wx.code || '',
        error.message || wx.message || '微信退款失败',
        JSON.stringify(wx || {}),
        refund.outRefundNo
      ]
    )
    throw error
  }
}

async function returnProfitSharingIfNeeded({ order, cfg, outRefundNo, reason }) {
  let profitSharing = null
  try {
    profitSharing = await findSuccessfulProfitSharing(order.id)
  } catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') return null
    throw error
  }
  if (!profitSharing) return null

  const existingReturn = await findProfitSharingReturn(order.id)
  if (existingReturn) return null

  const outReturnNo = outProfitSharingReturnNo(order)
  const payload = {
    sub_mchid: profitSharing.sub_mchid || order.sub_mchid,
    out_order_no: profitSharing.out_order_no,
    out_return_no: outReturnNo,
    return_mchid: profitSharing.receiver_account || cfg.spMchid,
    amount: Number(profitSharing.amount_fen || 0),
    description: String(reason || 'refund').slice(0, 80)
  }
  if (profitSharing.wechat_order_id) payload.order_id = profitSharing.wechat_order_id

  const result = await wxpay.requestProfitSharingReturn(cfg, payload)
  const state = String(result.result || result.state || result.status || 'PROCESSING').toUpperCase()
  await db.query(
    `UPDATE wechat_refunds
     SET profit_sharing_return_no=?, profit_sharing_return_state=?,
         profit_sharing_return_payload=?
     WHERE out_refund_no=?`,
    [outReturnNo, state, JSON.stringify(result || {}), outRefundNo]
  )
  return result
}

async function handleRefundNotify(payload) {
  const outRefundNoValue = payload && payload.out_refund_no
  if (!outRefundNoValue) {
    const error = new Error('invalid refund notify: missing out_refund_no')
    error.statusCode = 400
    throw error
  }
  const meta = extractRefundMeta(payload)
  await db.query(
    `UPDATE wechat_refunds
     SET status=?, wechat_refund_id=COALESCE(NULLIF(?, ''), wechat_refund_id),
         transaction_id=COALESCE(NULLIF(?, ''), transaction_id),
         channel=COALESCE(NULLIF(?, ''), channel),
         user_received_account=COALESCE(NULLIF(?, ''), user_received_account),
         success_time=COALESCE(?, success_time), notify_payload=?,
         error_code='', error_msg=''
     WHERE out_refund_no=?`,
    [
      meta.status,
      meta.refundId,
      meta.transactionId,
      meta.channel,
      meta.userReceivedAccount,
      meta.successTime,
      JSON.stringify(payload),
      outRefundNoValue
    ]
  )
  const [[row]] = await db.query('SELECT * FROM wechat_refunds WHERE out_refund_no=?', [outRefundNoValue])
  if (row && isSuccessRefundStatus(meta.status)) await markRefundSuccess(row)
  return row || null
}

async function syncRefundRow(row, cfg = wxpay.getServiceProviderConfig()) {
  if (!row || !cfg || !row.sub_mchid || !row.out_refund_no) return null
  const result = await wxpay.queryPartnerRefund({
    cfg,
    subMchid: row.sub_mchid,
    outRefundNo: row.out_refund_no
  })
  const meta = extractRefundMeta(result)
  await db.query(
    `UPDATE wechat_refunds
     SET status=?, wechat_refund_id=COALESCE(NULLIF(?, ''), wechat_refund_id),
         transaction_id=COALESCE(NULLIF(?, ''), transaction_id),
         channel=COALESCE(NULLIF(?, ''), channel),
         user_received_account=COALESCE(NULLIF(?, ''), user_received_account),
         success_time=COALESCE(?, success_time), result_payload=?,
         error_code='', error_msg=''
     WHERE id=?`,
    [
      meta.status,
      meta.refundId,
      meta.transactionId,
      meta.channel,
      meta.userReceivedAccount,
      meta.successTime,
      JSON.stringify(result),
      row.id
    ]
  )
  const [[saved]] = await db.query('SELECT * FROM wechat_refunds WHERE id=?', [row.id])
  if (saved && isSuccessRefundStatus(saved.status)) await markRefundSuccess(saved)
  return saved || null
}

async function syncPendingSupplyRefunds({ merchantId = null, userId = null, orderId = null, limit = 20 } = {}) {
  const cfg = wxpay.getServiceProviderConfig()
  if (!cfg) return { total: 0, synced: 0, skipped: true }

  const params = []
  let join = 'JOIN orders o ON o.id=r.order_id'
  let where = `r.order_type='supply' AND r.status IN ('PENDING','PROCESSING','ABNORMAL')`
  if (merchantId) {
    join += ' JOIN order_items i ON i.order_id=o.id AND i.merchant_id=?'
    params.push(merchantId)
  }
  if (userId) {
    where += ' AND o.user_id=?'
    params.push(userId)
  }
  if (orderId) {
    where += ' AND o.id=?'
    params.push(orderId)
  }
  params.push(Math.max(1, Math.min(Number(limit) || 20, 50)))

  let rows = []
  try {
    const result = await db.query(
      `SELECT r.*
       FROM wechat_refunds r
       ${join}
       WHERE ${where}
       GROUP BY r.id
       ORDER BY r.updated_at ASC
       LIMIT ?`,
      params
    )
    rows = result[0]
  } catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') return { total: 0, synced: 0, skipped: true }
    throw error
  }

  let synced = 0
  for (const row of rows) {
    try {
      await syncRefundRow(row, cfg)
      synced += 1
    } catch (error) {
      console.error('[refund-sync]', error.message)
    }
  }
  return { total: rows.length, synced }
}

function __setDbForTest(mock) {
  db = mock || defaultDb
}

function __setWxpayForTest(mock) {
  wxpay = mock || defaultWxpay
}

module.exports = {
  amountFen,
  getWechatPayChargeFen,
  supplyOutTradeNo,
  outRefundNo,
  outProfitSharingReturnNo,
  normalizeRefundStatus,
  isActiveRefundStatus,
  isSuccessRefundStatus,
  getRefundNotifyUrl,
  loadSupplyRefundOrder,
  createSupplyRefund,
  returnProfitSharingIfNeeded,
  handleRefundNotify,
  syncRefundRow,
  syncPendingSupplyRefunds,
  __setDbForTest,
  __setWxpayForTest
}
