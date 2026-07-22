const assert = require('assert')
const express = require('express')
const jwt = require('jsonwebtoken')
const paymentAttach = require('../utils/payment-attach')

process.env.JWT_SECRET = 'payments-route-test-secret'

const dbPath = require.resolve('../db/database')
const wxpayPath = require.resolve('../utils/wechat-pay')
const calls = []
let orderMode = 'ready'
let machineMode = 'full'
let prepayError = null

const mockDb = {
  async query(sql, params = []) {
    const compact = sql.replace(/\s+/g, ' ').trim()
    calls.push({ type: 'sql', sql: compact, params })
    if (/SELECT openid FROM users WHERE id=\?/i.test(sql)) {
      return [[{ openid: 'openid-under-sp-appid' }], []]
    }
    if (/UPDATE machine_orders SET pay_mode=\?/i.test(compact)) {
      machineMode = params[0]
      return [{ affectedRows: 1 }]
    }
    if (/UPDATE machine_orders SET status='cancelled',reject_reason='支付超时自动取消'/i.test(compact)) {
      return [{ affectedRows: 0 }]
    }
    if (/UPDATE orders SET wechat_out_trade_no=\?/i.test(compact)) {
      return [{ affectedRows: 1 }]
    }
    if (/FROM machine_orders mo JOIN operators op/i.test(compact)) {
      const balance = machineMode === 'balance'
      return [[{
        id: 18,
        order_no: 'MO202607140001',
        machine_name: '采棉机',
        total_price: '800.00',
        deposit: '80.00',
        operator_id: 3,
        status: balance ? 'completed' : 'pending',
        pay_mode: machineMode === 'full' ? 'full' : 'deposit',
        pay_status: balance ? 'partial' : 'unpaid',
        pay_expires_at: '2099-01-01T00:00:00.000Z',
        paid_amount: balance ? '80.00' : '0.00',
        deposit_status: balance ? 'paid' : 'unpaid',
        balance_status: 'unpaid',
        deposit_paid_amount: balance ? '80.00' : '0.00',
        balance_paid_amount: '0.00',
        deposit_transaction_id: balance ? 'wx-deposit-tx' : '',
        balance_transaction_id: '',
        sub_mchid: '1700000003',
        commission_rate: '7.50'
      }], []]
    }
    if (/COUNT\(DISTINCT i\.merchant_id\).*FROM orders o/i.test(compact)) {
      if (orderMode === 'missingSub') {
        return [[{
          id: 8,
          order_no: 'MG202607030001',
          total: '25.80',
          status: 'pending_payment',
          merchant_count: 1,
          sub_mchid: null
        }], []]
      }
      if (orderMode === 'multiMerchant') {
        return [[{
          id: 8,
          order_no: 'MG202607030001',
          total: '25.80',
          status: 'pending_payment',
          merchant_count: 2,
          sub_mchid: '1700000001'
        }], []]
      }
      if (orderMode === 'selfOperated') {
        return [[{
          id: 9,
          order_no: 'MG202607030002',
          total: '9.90',
          status: 'pending_payment',
          merchant_count: 1,
          merchant_id: 7,
          sub_mchid: '1700000999',
          commission_rate: '0.00',
          self_operated: 1
        }], []]
      }
      if (orderMode === 'selfMissingSub') {
        return [[{
          id: 9,
          order_no: 'MG202607030002',
          total: '9.90',
          status: 'pending_payment',
          merchant_count: 1,
          merchant_id: 7,
          sub_mchid: null,
          commission_rate: '0.00',
          self_operated: 1
        }], []]
      }
      if (orderMode === 'expired') {
        return [[{
          id: 8,
          order_no: 'MG202607030001',
          total: '25.80',
          status: 'pending_payment',
          pay_expires_at: '2000-01-01T00:00:00.000Z',
          merchant_count: 1,
          merchant_id: 6,
          sub_mchid: '1700000001',
          commission_rate: '5.00'
        }], []]
      }
      return [[{
        id: 8,
        order_no: 'MG202607030001',
        total: '25.80',
          status: 'pending_payment',
          pay_expires_at: '2099-01-01T00:00:00.000Z',
          merchant_count: 1,
          merchant_id: 6,
          sub_mchid: '1700000001',
          commission_rate: '5.00'
        }], []]
    }
    throw new Error(`Unexpected SQL in test: ${sql}`)
  }
}

const mockWxpay = {
  getServiceProviderConfig() {
    return {
      spAppid: 'wxspapp',
      spMchid: '1900000109',
      mchid: '1900000109',
      privateKey: 'PRIVATE KEY'
    }
  },
  getNotifyConfig() { return null },
  async partnerJsapiPrepay({ cfg, order, openid }) {
    calls.push({ type: 'partnerJsapiPrepay', cfg, order, openid })
    if (prepayError) throw prepayError
    return { prepay_id: 'prepay-id-for-test' }
  },
  async jsapiPrepay({ cfg, order, openid }) {
    calls.push({ type: 'jsapiPrepay', cfg, order, openid })
    return { prepay_id: 'direct-prepay-id-for-test' }
  },
  buildRequestPaymentParams({ prepayId }) {
    calls.push({ type: 'buildRequestPaymentParams', prepayId })
    return {
      timeStamp: '1710000000',
      nonceStr: 'nonce',
      package: `prepay_id=${prepayId}`,
      signType: 'RSA',
      paySign: 'signed'
    }
  },
  queryPartnerTransaction() {
    throw new Error('queryPartnerTransaction should not be called by prepay test')
  },
  decryptNotifyResource() {
    throw new Error('decryptNotifyResource should not be called by prepay test')
  },
  verifyNotifySignature() {
    return false
  }
}

require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
require.cache[wxpayPath] = { id: wxpayPath, filename: wxpayPath, loaded: true, exports: mockWxpay }
const paymentsRouter = require('../routes/payments')

async function request(baseUrl, token, body) {
  const response = await fetch(`${baseUrl}/api/pay/wechat/prepay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  })
  return { status: response.status, json: await response.json() }
}

async function run() {
  assert.deepStrictEqual(
    paymentAttach.parseCompactPaymentAttach('{"t":"s","i":8}'),
    { orderType: 'supply', orderId: 8, paymentStage: 'full' }
  )
  assert.deepStrictEqual(
    paymentAttach.parseCompactPaymentAttach('{"t":"m","i":18,"s":"b"}'),
    { orderType: 'machine', orderId: 18, paymentStage: 'balance' }
  )
  const app = express()
  app.use(express.json())
  app.use('/api/pay', paymentsRouter)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const token = jwt.sign({ id: 42, role: 'farmer' }, process.env.JWT_SECRET)

  try {
    orderMode = 'missingSub'
    const missingSub = await request(baseUrl, token, { orderType: 'supply', orderId: 8 })
    assert.strictEqual(missingSub.status, 409)
    assert.match(missingSub.json.msg, /子商户号/)

    orderMode = 'multiMerchant'
    const multiMerchant = await request(baseUrl, token, { orderType: 'supply', orderId: 8 })
    assert.strictEqual(multiMerchant.status, 409)
    assert.match(multiMerchant.json.msg, /多个商户/)

    calls.length = 0
    orderMode = 'ready'
    const success = await request(baseUrl, token, { orderType: 'supply', orderId: 8 })
    assert.strictEqual(success.status, 200)
    assert.strictEqual(success.json.data.payParams.package, 'prepay_id=prepay-id-for-test')
    const prepayCall = calls.find(item => item.type === 'partnerJsapiPrepay')
    assert(prepayCall, 'route should call partner JSAPI prepay')
    assert.strictEqual(prepayCall.order.subMchid, '1700000001')
    assert.strictEqual(prepayCall.openid, 'openid-under-sp-appid')
    assert.strictEqual(prepayCall.order.amountFen, 2580)
    assert.strictEqual(prepayCall.order.timeExpire, '2099-01-01T00:00:00+00:00')
    assert.strictEqual(prepayCall.order.profitSharing, true)
    assert.deepStrictEqual(prepayCall.order.attach, { t: 's', i: 8 })
    assert(Buffer.byteLength(JSON.stringify(prepayCall.order.attach), 'utf8') <= 128)

    calls.length = 0
    orderMode = 'selfOperated'
    const direct = await request(baseUrl, token, { orderType: 'supply', orderId: 9 })
    assert.strictEqual(direct.status, 200)
    assert.strictEqual(direct.json.data.payParams.package, 'prepay_id=prepay-id-for-test')
    const selfPartnerCall = calls.find(item => item.type === 'partnerJsapiPrepay')
    assert(selfPartnerCall, 'self-operated service-provider order should still call partner JSAPI prepay')
    assert.strictEqual(selfPartnerCall.order.subMchid, '1700000999')
    assert.strictEqual(selfPartnerCall.order.amountFen, 990)
    assert.strictEqual(selfPartnerCall.order.profitSharing, false)
    assert.deepStrictEqual(selfPartnerCall.order.attach, { t: 's', i: 9 })

    calls.length = 0
    orderMode = 'selfMissingSub'
    const selfMissingSub = await request(baseUrl, token, { orderType: 'supply', orderId: 9 })
    assert.strictEqual(selfMissingSub.status, 409)
    assert.match(selfMissingSub.json.msg, /自营.*子商户号|sub_mchid/)

    calls.length = 0
    orderMode = 'expired'
    const expired = await request(baseUrl, token, { orderType: 'supply', orderId: 8 })
    assert.strictEqual(expired.status, 410)
    assert(!calls.some(item => item.type === 'partnerJsapiPrepay'), 'expired order should not call WeChat prepay')

    calls.length = 0
    machineMode = 'deposit'
    const machineDeposit = await request(baseUrl, token, {
      orderType: 'machine', orderId: 18, paymentStage: 'deposit'
    })
    assert.strictEqual(machineDeposit.status, 200)
    const depositPrepay = calls.find(item => item.type === 'partnerJsapiPrepay')
    assert.strictEqual(depositPrepay.order.amountFen, 8000)
    assert.deepStrictEqual(depositPrepay.order.attach, { t: 'm', i: 18, s: 'd' })
    assert(Buffer.byteLength(JSON.stringify(depositPrepay.order.attach), 'utf8') <= 128)
    assert.match(depositPrepay.order.outTradeNo, /^M_18_D_/)
    assert(depositPrepay.order.outTradeNo.length <= 32)

    calls.length = 0
    machineMode = 'balance'
    const machineBalance = await request(baseUrl, token, {
      orderType: 'machine', orderId: 18, paymentStage: 'balance'
    })
    assert.strictEqual(machineBalance.status, 200)
    const balancePrepay = calls.find(item => item.type === 'partnerJsapiPrepay')
    assert.strictEqual(balancePrepay.order.amountFen, 72000)
    assert.deepStrictEqual(balancePrepay.order.attach, { t: 'm', i: 18, s: 'b' })
    assert.match(balancePrepay.order.outTradeNo, /^M_18_B_/)
    assert(balancePrepay.order.outTradeNo.length <= 32)

    calls.length = 0
    machineMode = 'full'
    const machine = await request(baseUrl, token, { orderType: 'machine', orderId: 18, payMode: 'full' })
    assert.strictEqual(machine.status, 200)
    const machinePrepay = calls.find(item => item.type === 'partnerJsapiPrepay')
    assert(machinePrepay, 'machine order should call partner JSAPI prepay')
    assert.strictEqual(machinePrepay.order.subMchid, '1700000003')
    assert.strictEqual(machinePrepay.order.amountFen, 80000)
    assert.strictEqual(machinePrepay.order.profitSharing, true)
    assert.deepStrictEqual(machinePrepay.order.attach, { t: 'm', i: 18, s: 'f' })

    prepayError = Object.assign(new Error('NO_AUTH: 受理关系不存在'), {
      statusCode: 403,
      wxpay: { code: 'NO_AUTH', message: '受理关系不存在' }
    })
    const noRelationship = await request(baseUrl, token, { orderType: 'machine', orderId: 18, payMode: 'full' })
    assert.strictEqual(noRelationship.status, 409)
    assert.match(noRelationship.json.msg, /农机手.*受理关系/)
    prepayError = null

    console.log('payments route tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
