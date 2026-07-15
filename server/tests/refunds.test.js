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

  delete process.env.WECHAT_PAY_TEST_MODE
  delete process.env.WECHAT_PAY_FORCE_TEST_FEN
  const sqlCalls = []
  let refundRequest = null
  let profitSharingReturn = null
  const mockDb = {
    async query(sql, params = []) {
      sqlCalls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
      if (/FROM machine_orders mo\s+JOIN operators/i.test(sql)) {
        return [[{
          id: 18, kind: 'machine', order_no: 'MO202607140001', pay_mode: 'deposit',
          pay_status: 'partial', deposit_status: 'paid', balance_status: 'unpaid',
          deposit: '80.00', deposit_paid_amount: '80.00', paid_amount: '80.00',
          deposit_transaction_id: 'wx-deposit-transaction', transaction_id: 'wx-deposit-transaction',
          sub_mchid: '1700000003'
        }], []]
      }
      if (/SELECT \* FROM wechat_refunds WHERE order_type='machine'/i.test(sql)) return [[undefined], []]
      if (/SELECT \* FROM wechat_profit_sharing_orders/i.test(sql)) {
        return [[{
          id: 55, order_type: 'machine', order_id: 18, payment_stage: 'deposit',
          state: 'SUCCESS', out_order_no: 'PS_MACHINE_18_DEPOSIT', wechat_order_id: 'wx-ps-55',
          sub_mchid: '1700000003', receiver_account: '1900000001', amount_fen: 800
        }], []]
      }
      if (/profit_sharing_return_state IN/i.test(sql)) return [[undefined], []]
      if (/SELECT \* FROM wechat_refunds WHERE out_refund_no=\?/i.test(sql)) {
        return [[{ id: 31, order_type: 'machine', order_id: 18, status: 'SUCCESS' }], []]
      }
      return [{ affectedRows: 1 }]
    }
  }
  const mockWxpay = {
    getServiceProviderConfig: () => ({ notifyUrl: 'https://cyaia.cn/api/pay/wechat/notify' }),
    buildPartnerRefundBody: ({ refund }) => ({ sub_mchid: refund.subMchid, amount: { refund: refund.refundFen, total: refund.totalFen } }),
    async partnerRefund({ refund }) {
      refundRequest = refund
      return { refund_id: 'wx-refund-31', status: 'SUCCESS', amount: { refund: 8000 } }
    },
    async requestProfitSharingReturn(_cfg, payload) {
      profitSharingReturn = payload
      return { result: 'SUCCESS' }
    }
  }
  refunds.__setDbForTest(mockDb)
  refunds.__setWxpayForTest(mockWxpay)
  const machineRefund = await refunds.createMachineRefund({ orderId: 18, farmerId: 42, reason: '农户取消预约' })
  assert.strictEqual(machineRefund.status, 'SUCCESS')
  assert.strictEqual(refundRequest.transactionId, 'wx-deposit-transaction')
  assert.strictEqual(refundRequest.refundFen, 8000)
  assert.strictEqual(refundRequest.totalFen, 8000)
  assert.strictEqual(refundRequest.outTradeNo, 'MACHINE_MO202607140001_18_DEPOSIT')
  assert.strictEqual(profitSharingReturn.out_order_no, 'PS_MACHINE_18_DEPOSIT')
  assert.strictEqual(profitSharingReturn.amount, 800)
  assert(sqlCalls.some(call => /UPDATE machine_orders SET pay_status='refunded'/.test(call.sql)))
  refunds.__setDbForTest()
  refunds.__setWxpayForTest()

  console.log('refund utility tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
