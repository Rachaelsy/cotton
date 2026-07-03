const assert = require('assert')
const express = require('express')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'wechat-applyment-test-secret'
delete process.env.WECHAT_PAY_SP_APPID
delete process.env.WECHAT_PAY_SP_MCH_ID
delete process.env.WECHAT_PAY_MCH_ID
delete process.env.WECHAT_PAY_SERIAL_NO
delete process.env.WECHAT_PAY_NOTIFY_URL
delete process.env.WECHAT_PAY_PRIVATE_KEY

const dbPath = require.resolve('../db/database')
const queryLog = []
const merchantRow = {
  id: 9,
  user_id: 42,
  company_name: '测试农资店',
  business_license: '91653101TEST',
  product_category: '农资',
  sub_mchid: null,
  wechat_applyment_id: null,
  wechat_business_code: null,
  wechat_applyment_state: null,
  wechat_applyment_msg: null,
  wechat_applyment_payload: null,
  wechat_applyment_updated_at: null
}

const mockDb = {
  async query(sql, params = []) {
    queryLog.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
    if (/FROM merchants WHERE id=\?/i.test(sql)) return [[merchantRow], []]
    if (/FROM merchants m WHERE m\.id=\?/i.test(sql)) return [[merchantRow], []]
    if (/UPDATE merchants SET sub_mchid=/i.test(sql)) {
      merchantRow.sub_mchid = params[0]
      merchantRow.wechat_applyment_state = 'FINISH'
      return [{ affectedRows: 1 }, []]
    }
    if (/UPDATE merchants SET wechat_applyment_payload=/i.test(sql)) {
      merchantRow.wechat_applyment_payload = params[0]
      merchantRow.wechat_business_code = params[1]
      merchantRow.wechat_applyment_state = 'DRAFT'
      return [{ affectedRows: 1 }, []]
    }
    throw new Error(`Unexpected SQL in test: ${sql}`)
  }
}

require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
const router = require('../routes/wechat-applyment')

async function request(baseUrl, token, method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  return { status: response.status, json: await response.json() }
}

async function run() {
  const app = express()
  app.use(express.json())
  app.use('/api/wechat-applyment', router)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const token = jwt.sign({ id: 42, role: 'merchant', merchant_id: 9 }, process.env.JWT_SECRET)

  try {
    const unauthorized = await request(baseUrl, '', 'GET', '/api/wechat-applyment/mine')
    assert.strictEqual(unauthorized.status, 401)

    const mine = await request(baseUrl, token, 'GET', '/api/wechat-applyment/mine')
    assert.strictEqual(mine.status, 200)
    assert.strictEqual(mine.json.data.merchant_id, 9)
    assert.strictEqual(mine.json.data.payment_enabled, false)

    const invalidSub = await request(baseUrl, token, 'POST', '/api/wechat-applyment/sub-mchid', { sub_mchid: 'abc' })
    assert.strictEqual(invalidSub.status, 400)

    const savedSub = await request(baseUrl, token, 'POST', '/api/wechat-applyment/sub-mchid', { sub_mchid: '1700000001' })
    assert.strictEqual(savedSub.status, 200)
    assert.strictEqual(merchantRow.sub_mchid, '1700000001')

    const draft = await request(baseUrl, token, 'POST', '/api/wechat-applyment/draft', {
      contact: { name: '张三', mobile: '13800138000' },
      business_code: 'COTTON_TEST_001'
    })
    assert.strictEqual(draft.status, 200)
    assert.strictEqual(merchantRow.wechat_business_code, 'COTTON_TEST_001')
    assert.strictEqual(JSON.parse(merchantRow.wechat_applyment_payload).contact.name, '张三')

    const submit = await request(baseUrl, token, 'POST', '/api/wechat-applyment/submit')
    assert.strictEqual(submit.status, 501)
    assert.match(submit.json.msg, /微信支付服务商/)

    console.log('wechat applyment route tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
