const wxpay = require('./wechat-pay')

let dbOverride = null

function getDb() {
  return dbOverride || require('../db/database')
}

function __setDbForTest(db) {
  dbOverride = db
}

function calculateCommissionFen(amount, commissionRate) {
  const totalFen = Math.round(Number(amount || 0) * 100)
  const rate = Number(commissionRate || 0)
  if (!totalFen || !rate) return 0
  return Math.max(0, Math.round(totalFen * rate / 100))
}

function buildProfitSharingOutOrderNo(orderType, orderId) {
  return `PS_${String(orderType || 'ORDER').toUpperCase()}_${orderId}`
}

function getPlatformReceiverAccount(cfg = {}) {
  return String(process.env.WECHAT_PAY_PROFIT_SHARING_RECEIVER_MCH_ID || cfg.spMchid || '').trim()
}

function getPlatformReceiverName() {
  const value = String(process.env.WECHAT_PAY_PROFIT_SHARING_RECEIVER_NAME || '').trim()
  return /^(TODO|your_|xxx)/i.test(value) ? '' : value
}

function getProfitSharingFreezeDays() {
  const days = Number(process.env.WECHAT_PAY_PROFIT_SHARING_FREEZE_DAYS == null
    ? 7
    : process.env.WECHAT_PAY_PROFIT_SHARING_FREEZE_DAYS)
  return Number.isFinite(days) && days >= 0 ? days : 7
}

function getProfitSharingCutoffDate() {
  const days = getProfitSharingFreezeDays()
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function buildPlatformReceiver({ cfg, subMchid }) {
  const receiver = {
    sub_mchid: subMchid,
    appid: cfg.spAppid,
    type: 'MERCHANT_ID',
    account: getPlatformReceiverAccount(cfg),
    relation_type: 'SERVICE_PROVIDER'
  }
  const receiverName = getPlatformReceiverName()
  if (receiverName) receiver.name = wxpay.encryptSensitive(receiverName, cfg)
  return receiver
}

function buildProfitSharingBody({ cfg, order }) {
  const amount = order.amountFen != null
    ? Number(order.amountFen)
    : calculateCommissionFen(order.amount, order.commissionRate)
  return {
    sub_mchid: order.subMchid,
    appid: cfg.spAppid,
    transaction_id: order.transactionId,
    out_order_no: order.outOrderNo || buildProfitSharingOutOrderNo(order.orderType || 'supply', order.orderId),
    receivers: [{
      type: 'MERCHANT_ID',
      account: getPlatformReceiverAccount(cfg),
      amount,
      description: 'Cotton platform service fee'
    }],
    unfreeze_unsplit: true
  }
}

function normalizeState(result) {
  return String(result && (result.state || result.status) || 'PROCESSING').toUpperCase()
}

function isFinishedState(state) {
  return ['FINISHED', 'SUCCESS'].includes(String(state || '').toUpperCase())
}

function isReceiverAlreadyExists(error) {
  const message = String(error && error.message || '').toUpperCase()
  return (
    message.includes('RELATIONSHIP_ALREADY_EXIST') ||
    message.includes('RECEIVER_ALREADY_EXIST') ||
    message.includes('ALREADY')
  )
}

async function ensurePlatformReceiver(cfg, subMchid) {
  const sensitiveCfg = wxpay.getNotifyConfig() || cfg
  const receiver = buildPlatformReceiver({ cfg: sensitiveCfg, subMchid })
  if (!receiver.name) {
    throw new Error('WECHAT_PAY_PROFIT_SHARING_RECEIVER_NAME is required for MERCHANT_ID profit-sharing receiver')
  }
  try {
    return await wxpay.addProfitSharingReceiver(sensitiveCfg, receiver)
  } catch (error) {
    if (isReceiverAlreadyExists(error)) return { existed: true }
    throw error
  }
}

async function savePendingOrder({ order, transaction }) {
  const amountFen = calculateCommissionFen(order.amount, order.commissionRate)
  if (!amountFen) return null

  const transactionId = transaction.transaction_id || transaction.transactionId || ''
  if (!transactionId) throw new Error('Missing WeChat Pay transaction_id for profit sharing')

  const db = getDb()
  const cfg = wxpay.getServiceProviderConfig() || {}
  const orderType = order.kind === 'machine' ? 'machine' : 'supply'
  const outOrderNo = buildProfitSharingOutOrderNo(orderType, order.id)
  await db.query(`
    INSERT INTO wechat_profit_sharing_orders
      (order_type, order_id, out_order_no, transaction_id, sub_mchid, receiver_account,
       amount_fen, commission_rate, state, result_payload, error_msg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', '', '')
    ON DUPLICATE KEY UPDATE
      out_order_no=VALUES(out_order_no),
      transaction_id=VALUES(transaction_id),
      sub_mchid=VALUES(sub_mchid),
      receiver_account=VALUES(receiver_account),
      amount_fen=VALUES(amount_fen),
      commission_rate=VALUES(commission_rate),
      state=IF(state='SUCCESS' OR state='FINISHED', state, 'PENDING'),
      error_msg='',
      updated_at=NOW()
  `, [
    orderType,
    order.id,
    outOrderNo,
    transactionId,
    order.subMchid,
    getPlatformReceiverAccount(cfg),
    amountFen,
    Number(order.commissionRate || 0)
  ])

  return { outOrderNo, amountFen }
}

async function syncProcessingRow(row, cfg, db) {
  const result = await wxpay.queryProfitSharingOrder(cfg, {
    subMchid: row.sub_mchid,
    transactionId: row.transaction_id,
    outOrderNo: row.out_order_no
  })
  const state = normalizeState(result)
  await db.query(`
    UPDATE wechat_profit_sharing_orders
       SET state=?, wechat_order_id=?, result_payload=?, error_msg='', updated_at=NOW()
     WHERE id=?
  `, [
    state,
    result.order_id || row.wechat_order_id || '',
    JSON.stringify(result || {}),
    row.id
  ])
  if (isFinishedState(state)) await markOrderFundsAvailable(db, row)
  return result
}

async function settleProfitSharingRow(row, cfg = wxpay.getServiceProviderConfig()) {
  if (!cfg) throw new Error('WeChat Pay service-provider config is missing')

  const db = getDb()
  if (String(row.state || '').toUpperCase() === 'PROCESSING') {
    return syncProcessingRow(row, cfg, db)
  }

  const body = buildProfitSharingBody({
    cfg,
    order: {
      orderType: row.order_type,
      orderId: row.order_id,
      subMchid: row.sub_mchid,
      transactionId: row.transaction_id,
      outOrderNo: row.out_order_no,
      amountFen: row.amount_fen,
      commissionRate: row.commission_rate
    }
  })

  await ensurePlatformReceiver(cfg, row.sub_mchid)
  const result = await wxpay.requestProfitSharing(cfg, body)
  const state = normalizeState(result)
  await db.query(`
    UPDATE wechat_profit_sharing_orders
       SET state=?, wechat_order_id=?, result_payload=?, error_msg='', updated_at=NOW()
     WHERE id=?
  `, [
    state,
    result.order_id || '',
    JSON.stringify(result || {}),
    row.id
  ])
  if (isFinishedState(state)) await markOrderFundsAvailable(db, row)
  return result
}

async function markProfitSharingFailed(row, error) {
  const db = getDb()
  await db.query(`
    UPDATE wechat_profit_sharing_orders
       SET state='FAILED', error_msg=?, updated_at=NOW()
     WHERE id=?
  `, [String(error.message || error).slice(0, 500), row.id])
}

async function markOrderFundsAvailable(db, row) {
  if (row.order_type === 'machine') {
    await db.query("UPDATE machine_orders SET fund_status='available' WHERE id=? AND fund_status='frozen'", [row.order_id])
  } else {
    await db.query("UPDATE orders SET fund_status='available' WHERE id=? AND fund_status='frozen'", [row.order_id])
  }
}

async function releaseEligibleProfitSharing() {
  const db = getDb()
  let rows = []
  try {
    const result = await db.query(`
      SELECT ps.* FROM wechat_profit_sharing_orders ps
      LEFT JOIN orders o ON ps.order_type='supply' AND o.id=ps.order_id
      LEFT JOIN machine_orders mo ON ps.order_type='machine' AND mo.id=ps.order_id
       WHERE ps.state IN ('PENDING', 'FAILED', 'PROCESSING')
         AND (
           (ps.order_type='supply' AND o.fund_status='frozen'
             AND o.confirmed_at IS NOT NULL AND o.confirmed_at <= ?
             AND NOT EXISTS (
               SELECT 1 FROM aftersale_requests a
                WHERE a.order_id=o.id AND a.status != 'rejected'
             ))
           OR
           (ps.order_type='machine' AND mo.fund_status='frozen'
             AND mo.pay_status='paid' AND mo.status='completed'
             AND mo.completed_at IS NOT NULL AND mo.completed_at <= ?)
         )
       ORDER BY ps.id ASC
       LIMIT 20
    `, [getProfitSharingCutoffDate(), getProfitSharingCutoffDate()])
    rows = result[0]
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return { total: 0, success: 0, skipped: true }
    throw error
  }
  let success = 0
  for (const row of rows) {
    try {
      await settleProfitSharingRow(row)
      success += 1
    } catch (error) {
      console.error('[profit-sharing]', error.message)
      await markProfitSharingFailed(row, error)
    }
  }
  return { total: rows.length, success }
}

module.exports = {
  calculateCommissionFen,
  buildProfitSharingOutOrderNo,
  getPlatformReceiverAccount,
  getPlatformReceiverName,
  getProfitSharingFreezeDays,
  getProfitSharingCutoffDate,
  buildPlatformReceiver,
  buildProfitSharingBody,
  buildSupplyProfitSharingBody: buildProfitSharingBody,
  normalizeState,
  isFinishedState,
  ensurePlatformReceiver,
  savePendingOrder,
  savePendingSupplyOrder: savePendingOrder,
  settleProfitSharingRow,
  releaseEligibleProfitSharing,
  releaseEligibleSupplyProfitSharing: releaseEligibleProfitSharing,
  __setDbForTest
}
