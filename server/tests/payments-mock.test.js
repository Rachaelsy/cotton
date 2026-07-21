const assert = require('assert')
const express = require('express')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'mock-payment-route-test-secret'
process.env.NODE_ENV = 'development'
process.env.WECHAT_PAY_TEST_MODE = 'mock'
process.env.WECHAT_PAY_MOCK_ENABLED = 'true'

const dbPath = require.resolve('../db/database')
const wxpayPath = require.resolve('../utils/wechat-pay')
const marketingPath = require.resolve('../utils/marketing')
const notifyPath = require.resolve('../utils/notify')
const calls = []
let orderStatus = 'pending_payment'

const orderRow = () => ({
  id: 8,
  order_no: 'MG202607210001',
  total: '95.00',
  original_subtotal: '100.00',
  commission_base: '100.00',
  status: orderStatus,
  pay_expires_at: '2099-01-01T00:00:00.000Z',
  merchant_count: 1,
  merchant_id: 6,
  sub_mchid: null,
  commission_rate: '5.00',
  self_operated: 0
})

const mockDb = {
  async query(sql, params = []) {
    const compact = String(sql).replace(/\s+/g, ' ').trim()
    calls.push({ type: 'sql', sql: compact, params })
    if (/SELECT openid FROM users/i.test(compact)) return [[{ openid: 'real-openid' }], []]
    if (/COUNT\(DISTINCT i\.merchant_id\).*FROM orders o/i.test(compact)) return [[orderRow()], []]
    if (/UPDATE orders SET status='pending_ship'/i.test(compact)) {
      if (orderStatus !== 'pending_payment') return [{ affectedRows: 0 }]
      orderStatus = 'pending_ship'
      return [{ affectedRows: 1 }]
    }
    if (/SELECT order_no FROM orders/i.test(compact)) return [[{ order_no: orderRow().order_no }], []]
    if (/SELECT merchant_id FROM order_items/i.test(compact)) return [[], []]
    throw new Error(`Unexpected SQL in mock payment test: ${compact}`)
  }
}

const mockWxpay = {
  getServiceProviderConfig() {
    calls.push({ type: 'real-wechat-config' })
    return null
  },
  getNotifyConfig() { return null },
  partnerJsapiPrepay() { throw new Error('mock mode must not call WeChat prepay') },
  queryPartnerTransaction() { throw new Error('mock mode must not query WeChat') }
}

let marketingPaidCount = 0
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
require.cache[wxpayPath] = { id: wxpayPath, filename: wxpayPath, loaded: true, exports: mockWxpay }
require.cache[marketingPath] = {
  id: marketingPath,
  filename: marketingPath,
  loaded: true,
  exports: { async markOrderPaid() { marketingPaidCount += 1 } }
}
require.cache[notifyPath] = {
  id: notifyPath,
  filename: notifyPath,
  loaded: true,
  exports: { async notifyNewOrder() {} }
}

const paymentsRouter = require('../routes/payments')

async function post(baseUrl, token, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  })
  return { status: response.status, json: await response.json() }
}

async function get(baseUrl, token, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
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
    const mode = await get(baseUrl, token, '/api/pay/wechat/mode')
    assert.strictEqual(mode.status, 200)
    assert.deepStrictEqual(mode.json.data, { mode: 'mock', mock: true })

    const prepay = await post(baseUrl, token, '/api/pay/wechat/prepay', { orderType: 'supply', orderId: 8 })
    assert.strictEqual(prepay.status, 200)
    assert.strictEqual(prepay.json.data.mock, true)
    assert.strictEqual(prepay.json.data.payParams, null)
    assert.strictEqual(prepay.json.data.chargeFen, 9500)
    assert(!calls.some(call => call.type === 'real-wechat-config'))
    assert(!calls.some(call => /SELECT openid FROM users/i.test(call.sql || '')))

    const confirm = await post(baseUrl, token, '/api/pay/wechat/confirm', { orderType: 'supply', orderId: 8 })
    assert.strictEqual(confirm.status, 200)
    assert.strictEqual(confirm.json.data.mock, true)
    assert.match(confirm.json.data.transactionId, /^MOCK_SUPPLY_8_/)
    assert.strictEqual(orderStatus, 'pending_ship')
    assert.strictEqual(marketingPaidCount, 1)

    const repeat = await post(baseUrl, token, '/api/pay/wechat/confirm', { orderType: 'supply', orderId: 8 })
    assert.strictEqual(repeat.status, 200)
    assert.strictEqual(marketingPaidCount, 1, 'repeat confirmation must be idempotent')

    process.env.NODE_ENV = 'production'
    orderStatus = 'pending_payment'
    calls.length = 0
    const production = await post(baseUrl, token, '/api/pay/wechat/prepay', { orderType: 'supply', orderId: 8 })
    assert.strictEqual(production.status, 409)
    assert.match(production.json.msg, /子商户号/)
    assert(calls.some(call => /SELECT openid FROM users/i.test(call.sql || '')), 'production must use the real payment path')
    const productionMode = await get(baseUrl, token, '/api/pay/wechat/mode')
    assert.deepStrictEqual(productionMode.json.data, { mode: 'real', mock: false })

    const payPage = require('fs').readFileSync(
      require('path').join(__dirname, '../../subpkg-supplies/supplies-pay/index.js'), 'utf8'
    )
    assert(payPage.includes('if (!prepay.data.mock) await this._requestPayment'))
    assert(payPage.includes("'/api/pay/wechat/mode'"))
    console.log('mock payment route tests passed')
  } finally {
    process.env.NODE_ENV = 'test'
    process.env.WECHAT_PAY_TEST_MODE = ''
    process.env.WECHAT_PAY_MOCK_ENABLED = ''
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
