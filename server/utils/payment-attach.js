const STAGE_TO_CODE = { deposit: 'd', balance: 'b', full: 'f' }
const CODE_TO_STAGE = { d: 'deposit', b: 'balance', f: 'full' }

function buildPaymentAttach(orderType, order) {
  const attach = { t: orderType === 'machine' ? 'm' : 's', i: Number(order.id) }
  if (orderType === 'machine') attach.s = STAGE_TO_CODE[order.paymentStage] || 'f'
  return attach
}

function parseCompactPaymentAttach(value) {
  try {
    const attach = typeof value === 'string' ? JSON.parse(value) : value
    if (!attach || !['m', 's'].includes(attach.t) || !Number(attach.i)) return null
    const orderType = attach.t === 'm' ? 'machine' : 'supply'
    return {
      orderType,
      orderId: Number(attach.i),
      paymentStage: orderType === 'machine' ? (CODE_TO_STAGE[attach.s] || 'full') : 'full'
    }
  } catch {
    return null
  }
}

module.exports = { buildPaymentAttach, parseCompactPaymentAttach }
