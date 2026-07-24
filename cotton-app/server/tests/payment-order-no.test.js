const assert = require('assert')
const orderNo = require('../utils/payment-order-no')

function run() {
  const legacySupply = orderNo.supplyOutTradeNo({ id: 9, order_no: 'MG202607130001' })
  assert.strictEqual(legacySupply, 'SUPPLY_MG202607130001_9')

  const longSupplyOrder = { id: 13, order_no: 'MG20260721143436633BA9A4A' }
  const compactSupply = orderNo.supplyOutTradeNo(longSupplyOrder)
  assert.match(compactSupply, /^S_13_[a-f0-9]+$/)
  assert(compactSupply.length <= orderNo.MAX_OUT_TRADE_NO_LENGTH)
  assert.strictEqual(compactSupply, orderNo.supplyOutTradeNo(longSupplyOrder))
  assert.strictEqual(
    orderNo.supplyOutTradeNo({ ...longSupplyOrder, wechat_out_trade_no: legacySupply }),
    legacySupply
  )

  const machineOrder = { id: 18, order_no: 'MO202607140001' }
  const deposit = orderNo.machineOutTradeNo(machineOrder, 'deposit')
  const balance = orderNo.machineOutTradeNo(machineOrder, 'balance')
  assert.match(deposit, /^M_18_D_[a-f0-9]+$/)
  assert.match(balance, /^M_18_B_[a-f0-9]+$/)
  assert.notStrictEqual(deposit, balance)
  assert(deposit.length <= orderNo.MAX_OUT_TRADE_NO_LENGTH)
  assert(balance.length <= orderNo.MAX_OUT_TRADE_NO_LENGTH)

  console.log('payment order number tests passed')
}

run()
