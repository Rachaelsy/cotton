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
delete process.env.WECHAT_PAY_PRIVATE_KEY_PATH
delete process.env.WECHAT_PAY_API_V3_KEY
delete process.env.WECHAT_PAY_PUBLIC_KEY_ID
delete process.env.WECHAT_PAY_PUBLIC_KEY_PATH

const dbPath = require.resolve('../db/database')
const wxpayPath = require.resolve('../utils/wechat-pay')
let wxpayUploadEnabled = false
let uploadedMedia = null
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
const operatorRow = {
  id: 3,
  user_id: 43,
  company_name: '测试农机队',
  business_license: '92653101TEST',
  product_category: '农机服务',
  sub_mchid: null,
  wechat_applyment_id: null,
  wechat_business_code: null,
  wechat_applyment_state: null,
  wechat_applyment_msg: null,
  wechat_applyment_payload: null,
  wechat_applyment_updated_at: null
}

function saveDraft(row, params) {
  row.wechat_applyment_payload = params[0]
  row.wechat_business_code = params[1]
  row.wechat_applyment_state = 'DRAFT'
}

function bindSub(row, params) {
  row.sub_mchid = params[0]
  row.wechat_applyment_state = 'FINISH'
}

const mockDb = {
  async query(sql, params = []) {
    const compact = sql.replace(/\s+/g, ' ').trim()
    if (/FROM merchants m WHERE m\.id=\?/i.test(sql)) return [[merchantRow], []]
    if (/FROM operators o WHERE o\.id=\?/i.test(sql)) return [[operatorRow], []]
    if (/UPDATE merchants SET sub_mchid=/i.test(compact)) {
      bindSub(merchantRow, params)
      return [{ affectedRows: 1 }, []]
    }
    if (/UPDATE operators SET sub_mchid=/i.test(compact)) {
      bindSub(operatorRow, params)
      return [{ affectedRows: 1 }, []]
    }
    if (/UPDATE merchants SET wechat_applyment_payload=/i.test(compact)) {
      saveDraft(merchantRow, params)
      return [{ affectedRows: 1 }, []]
    }
    if (/UPDATE operators SET wechat_applyment_payload=/i.test(compact)) {
      saveDraft(operatorRow, params)
      return [{ affectedRows: 1 }, []]
    }
    throw new Error(`Unexpected SQL in test: ${sql}`)
  }
}

require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
require.cache[wxpayPath] = {
  id: wxpayPath,
  filename: wxpayPath,
  loaded: true,
  exports: {
    getServiceProviderConfig() {
      return wxpayUploadEnabled ? { spMchid: '1900000109' } : null
    },
    getNotifyConfig() {
      return null
    },
    async uploadMediaImage(_cfg, file) {
      uploadedMedia = file
      return { media_id: 'MEDIA_ID_TEST' }
    }
  }
}
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
  const merchantToken = jwt.sign({ id: 42, role: 'merchant', merchant_id: 9 }, process.env.JWT_SECRET)
  const operatorToken = jwt.sign({ id: 43, role: 'operator', operator_id: 3 }, process.env.JWT_SECRET)

  try {
    const unauthorized = await request(baseUrl, '', 'GET', '/api/wechat-applyment/mine')
    assert.strictEqual(unauthorized.status, 401)

    const mine = await request(baseUrl, merchantToken, 'GET', '/api/wechat-applyment/mine')
    assert.strictEqual(mine.status, 200)
    assert.strictEqual(mine.json.data.merchant_id, 9)
    assert.strictEqual(mine.json.data.payment_enabled, false)

    const invalidSub = await request(baseUrl, merchantToken, 'POST', '/api/wechat-applyment/sub-mchid', { sub_mchid: 'abc' })
    assert.strictEqual(invalidSub.status, 400)

    const savedSub = await request(baseUrl, merchantToken, 'POST', '/api/wechat-applyment/sub-mchid', { sub_mchid: '1700000001' })
    assert.strictEqual(savedSub.status, 200)
    assert.strictEqual(merchantRow.sub_mchid, '1700000001')

    const merchantDraft = await request(baseUrl, merchantToken, 'POST', '/api/wechat-applyment/draft', {
      contact: { name: '张三', mobile: '13800138000' },
      raw_applyment: {
        contact_info: { contact_type: 'LEGAL', contact_name: '张三', mobile_phone: '13800138000', contact_email: 'a@example.com' }
      },
      business_code: 'COTTON_MERCHANT_001'
    })
    assert.strictEqual(merchantDraft.status, 200)
    assert.strictEqual(merchantRow.wechat_business_code, 'COTTON_MERCHANT_001')
    assert.strictEqual(JSON.parse(merchantRow.wechat_applyment_payload).raw_applyment.contact_info.contact_name, '张三')

    const operatorMine = await request(baseUrl, operatorToken, 'GET', '/api/wechat-applyment/mine')
    assert.strictEqual(operatorMine.status, 200)
    assert.strictEqual(operatorMine.json.data.operator_id, 3)

    const operatorDraft = await request(baseUrl, operatorToken, 'POST', '/api/wechat-applyment/draft', {
      raw_applyment: {
        contact_info: { contact_type: 'LEGAL', contact_name: '李四', mobile_phone: '13900139000', contact_email: 'b@example.com' }
      },
      business_code: 'COTTON_OPERATOR_001'
    })
    assert.strictEqual(operatorDraft.status, 200)
    assert.strictEqual(operatorRow.wechat_business_code, 'COTTON_OPERATOR_001')

    const operatorSub = await request(baseUrl, operatorToken, 'POST', '/api/wechat-applyment/sub-mchid', { sub_mchid: '1700000002' })
    assert.strictEqual(operatorSub.status, 200)
    assert.strictEqual(operatorRow.sub_mchid, '1700000002')

    const missingMediaConfig = await fetch(`${baseUrl}/api/wechat-applyment/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${merchantToken}` },
      body: (() => {
        const fd = new FormData()
        fd.append('file', new Blob([Buffer.from('fake-image')], { type: 'image/png' }), 'license.png')
        return fd
      })()
    })
    const missingMediaConfigJson = await missingMediaConfig.json()
    assert.strictEqual(missingMediaConfig.status, 501)
    assert.match(missingMediaConfigJson.msg, /微信支付/)

    wxpayUploadEnabled = true
    const mediaUpload = await fetch(`${baseUrl}/api/wechat-applyment/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${merchantToken}` },
      body: (() => {
        const fd = new FormData()
        fd.append('file', new Blob([Buffer.from('fake-image')], { type: 'image/png' }), 'license.png')
        return fd
      })()
    })
    const mediaUploadJson = await mediaUpload.json()
    assert.strictEqual(mediaUpload.status, 200)
    assert.strictEqual(mediaUploadJson.data.media_id, 'MEDIA_ID_TEST')
    assert.strictEqual(uploadedMedia.filename, 'license.png')
    assert.strictEqual(uploadedMedia.mimeType, 'image/png')
    assert.ok(Buffer.isBuffer(uploadedMedia.buffer))

    const submit = await request(baseUrl, merchantToken, 'POST', '/api/wechat-applyment/submit')
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
