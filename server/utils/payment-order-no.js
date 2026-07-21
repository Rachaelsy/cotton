const crypto = require('crypto')

const MAX_OUT_TRADE_NO_LENGTH = 32

function digest(value, length) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, length)
}

function compactOutTradeNo(prefix, order, stage = '') {
  const orderNo = String(order.order_no || order.orderNo || '')
  const orderId = Number(order.id)
  const stageName = String(stage || '').toUpperCase()
  const legacy = [prefix === 'S' ? 'SUPPLY' : 'MACHINE', orderNo, orderId, stageName]
    .filter(Boolean)
    .join('_')
  if (legacy.length <= MAX_OUT_TRADE_NO_LENGTH) return legacy

  const stageCode = { DEPOSIT: 'D', BALANCE: 'B', FULL: 'F' }[stageName] || ''
  const lead = [prefix, orderId, stageCode].filter(value => value !== '').join('_') + '_'
  return `${lead}${digest(legacy, MAX_OUT_TRADE_NO_LENGTH - lead.length)}`
}

function supplyOutTradeNo(order) {
  const stored = String(order.wechat_out_trade_no || order.wechatOutTradeNo || '').trim()
  return stored || compactOutTradeNo('S', order)
}

function machineOutTradeNo(order, stage) {
  const paymentStage = String(stage || order.paymentStage || 'full').toUpperCase()
  return compactOutTradeNo('M', order, paymentStage)
}

module.exports = {
  MAX_OUT_TRADE_NO_LENGTH,
  supplyOutTradeNo,
  machineOutTradeNo
}
