const assert = require('assert')
const express = require('express')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'payments-route-test-secret'

const dbPath = require.resolve('../db/database')
const wxpayPath = require.resolve('../utils/wechat-pay')
const calls = []
let orderMode = 'ready'

const mockDb = {
  async query(sql, params = []) {
    const compact = sql.replace(/\s+/g, ' ').trim()
    calls.push({ type: 'sql', sql: compact, params })
    if (/SELECT openid FROM users WHERE id=\?/i.test(sql)) {
      return [[{ openid: 'openid-under-sp-appid' }], []]
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
      return [[{
        id: 8,
        order_no: 'MG202607030001',
        total: '25.80',
          status: 'pending_payment',
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
    assert.strictEqual(prepayCall.order.profitSharing, true)

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
    assert.strictEqual(selfPartnerCall.order.attach.paymentMode, 'self_operated')

    calls.length = 0
    orderMode = 'selfMissingSub'
    const selfMissingSub = await request(baseUrl, token, { orderType: 'supply', orderId: 9 })
    assert.strictEqual(selfMissingSub.status, 409)
    assert.match(selfMissingSub.json.msg, /自营.*子商户号|sub_mchid/)

    console.log('payments route tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
