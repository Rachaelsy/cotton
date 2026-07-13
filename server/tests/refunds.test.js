const assert = require('assert')

const refunds = require('../utils/refunds')
const wxpay = require('../utils/wechat-pay')

async function run() {
  const order = { id: 9, order_no: 'MG202607130001', total: '10.01' }
  assert.strictEqual(refunds.amountFen(10.01), 1001)
  assert.strictEqual(refunds.supplyOutTradeNo(order), 'SUPPLY_MG202607130001_9')
  assert.match(refunds.outRefundNo(order, 12345), /^RF_SUPPLY_9_12345$/)
  assert.match(refunds.outProfitSharingReturnNo(order, 12345), /^PSR_SUPPLY_9_12345$/)
  assert.strictEqual(refunds.normalizeRefundStatus({ refund_status: 'success' }), 'SUCCESS')
  assert.strictEqual(refunds.isActiveRefundStatus('PROCESSING'), true)
  assert.strictEqual(refunds.isSuccessRefundStatus('SUCCESS'), true)

  assert.strictEqual(
    refunds.getRefundNotifyUrl({ notifyUrl: 'https://cyaia.cn/api/pay/wechat/notify' }, {}),
    'https://cyaia.cn/api/pay/wechat/refund-notify'
  )
  assert.strictEqual(
    refunds.getRefundNotifyUrl({ notifyUrl: 'https://cyaia.cn/api/pay/wechat/notify' }, {
      WECHAT_PAY_REFUND_NOTIFY_URL: 'https://pay.example.com/refund'
    }),
    'https://pay.example.com/refund'
  )
  assert.strictEqual(refunds.getWechatPayChargeFen(order, {}), 1001)
  assert.strictEqual(refunds.getWechatPayChargeFen(order, {
    WECHAT_PAY_TEST_MODE: 'small_amount',
    WECHAT_PAY_FORCE_TEST_FEN: '1'
  }), 1)

  const body = wxpay.buildPartnerRefundBody({
    refund: {
      subMchid: '1700000001',
      outTradeNo: 'SUPPLY_MG202607130001_9',
      outRefundNo: 'RF_SUPPLY_9_12345',
      reason: '售后退款',
      notifyUrl: 'https://cyaia.cn/api/pay/wechat/refund-notify',
      refundFen: 1001,
      totalFen: 1001
    }
  })
  assert.deepStrictEqual(body, {
    sub_mchid: '1700000001',
    out_trade_no: 'SUPPLY_MG202607130001_9',
    out_refund_no: 'RF_SUPPLY_9_12345',
    reason: '售后退款',
    notify_url: 'https://cyaia.cn/api/pay/wechat/refund-notify',
    amount: { refund: 1001, total: 1001, currency: 'CNY' }
  })

  console.log('refund utility tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
