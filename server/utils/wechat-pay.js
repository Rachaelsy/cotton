const crypto = require('crypto')
const https = require('https')
const fs = require('fs')

const API_HOST = 'api.mch.weixin.qq.com'

function normalizePem(value) {
  return value ? String(value).replace(/\\n/g, '\n') : ''
}

function readEnvValue(env, name) {
  const value = env[name]
  if (!value) return ''
  const text = String(value).trim()
  return /^(TODO|your_|xxx)/i.test(text) ? '' : text
}

function readEnvText(env, valueName, pathName) {
  let value = readEnvValue(env, valueName)
  const filePath = readEnvValue(env, pathName)
  if (!value && filePath && fs.existsSync(filePath)) value = fs.readFileSync(filePath, 'utf8')
  return normalizePem(value)
}

function getServiceProviderConfig({ env = process.env } = {}) {
  const spAppid = readEnvValue(env, 'WECHAT_PAY_SP_APPID') || readEnvValue(env, 'WECHAT_APPID') || readEnvValue(env, 'WX_APPID')
  const spMchid = readEnvValue(env, 'WECHAT_PAY_SP_MCH_ID') || readEnvValue(env, 'WECHAT_PAY_MCH_ID')
  const serialNo = readEnvValue(env, 'WECHAT_PAY_SERIAL_NO')
  const notifyUrl = readEnvValue(env, 'WECHAT_PAY_NOTIFY_URL')
  const privateKey = readEnvText(env, 'WECHAT_PAY_PRIVATE_KEY', 'WECHAT_PAY_PRIVATE_KEY_PATH')
  if (!spAppid || !spMchid || !serialNo || !notifyUrl || !privateKey) return null
  return {
    appid: spAppid,
    mchid: spMchid,
    spAppid,
    spMchid,
    serialNo,
    notifyUrl,
    privateKey
  }
}

function getNotifyConfig({ env = process.env } = {}) {
  const cfg = getServiceProviderConfig({ env })
  if (!cfg) return null
  const apiV3Key = readEnvValue(env, 'WECHAT_PAY_API_V3_KEY')
  const wechatpayPublicKeyId = readEnvValue(env, 'WECHAT_PAY_PUBLIC_KEY_ID')
  const wechatpayPublicKey = readEnvText(env, 'WECHAT_PAY_PUBLIC_KEY', 'WECHAT_PAY_PUBLIC_KEY_PATH')
  const platformSerialNo = readEnvValue(env, 'WECHAT_PAY_PLATFORM_SERIAL_NO')
  const platformCert = readEnvText(env, 'WECHAT_PAY_PLATFORM_CERT', 'WECHAT_PAY_PLATFORM_CERT_PATH')
  const verifySerialNo = wechatpayPublicKey ? wechatpayPublicKeyId : platformSerialNo
  const verifyKey = wechatpayPublicKey || platformCert
  if (!apiV3Key || !verifyKey || !verifySerialNo) return null
  return {
    ...cfg,
    apiV3Key,
    platformSerialNo: verifySerialNo,
    platformCert: verifyKey,
    wechatpayPublicKeyId,
    wechatpayPublicKey,
    encryptSerialNo: verifySerialNo,
    encryptPublicKey: verifyKey
  }
}

function randomString(size = 32) {
  return crypto.randomBytes(size).toString('hex').slice(0, size)
}

function signMessage(privateKey, message) {
  return crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64')
}

function buildAuthorizationHeader({ cfg, method, urlPath, bodyText = '', timestamp, nonceStr }) {
  const ts = timestamp || String(Math.floor(Date.now() / 1000))
  const nonce = nonceStr || randomString()
  const message = `${method}\n${urlPath}\n${ts}\n${nonce}\n${bodyText}\n`
  const signature = signMessage(cfg.privateKey, message)
  return {
    timestamp: ts,
    nonce,
    authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.spMchid}",nonce_str="${nonce}",timestamp="${ts}",serial_no="${cfg.serialNo}",signature="${signature}"`
  }
}

function buildRequestPaymentParams({ appid, privateKey, prepayId, timestamp, nonceStr }) {
  const timeStamp = timestamp || String(Math.floor(Date.now() / 1000))
  const nonce = nonceStr || randomString()
  const pkg = `prepay_id=${prepayId}`
  const paySign = signMessage(privateKey, `${appid}\n${timeStamp}\n${nonce}\n${pkg}\n`)
  return { timeStamp, nonceStr: nonce, package: pkg, signType: 'RSA', paySign }
}

function encryptSensitive(value, cfg) {
  if (value == null || value === '') return ''
  const publicKey = cfg && (cfg.encryptPublicKey || cfg.wechatpayPublicKey || cfg.platformCert)
  if (!publicKey) throw new Error('缺少微信支付公钥或平台证书，无法加密敏感字段')
  return crypto.publicEncrypt({
    key: publicKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha1'
  }, Buffer.from(String(value), 'utf8')).toString('base64')
}

function decryptNotifyResource(resource, apiV3Key) {
  if (!resource || resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error('unsupported notify resource')
  }
  const encrypted = Buffer.from(resource.ciphertext, 'base64')
  const authTag = encrypted.subarray(encrypted.length - 16)
  const data = encrypted.subarray(0, encrypted.length - 16)
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(apiV3Key, 'utf8'),
    Buffer.from(resource.nonce, 'utf8')
  )
  if (resource.associated_data) decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'))
  decipher.setAuthTag(authTag)
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'))
}

function verifyNotifySignature(req, rawBody, cfg) {
  const timestamp = req.headers['wechatpay-timestamp']
  const nonce = req.headers['wechatpay-nonce']
  const signature = req.headers['wechatpay-signature']
  const serialNo = req.headers['wechatpay-serial']
  if (!timestamp || !nonce || !signature || !serialNo) return false
  if (cfg.platformSerialNo && cfg.platformSerialNo !== serialNo) return false
  const verifyKey = cfg.wechatpayPublicKey || cfg.platformCert
  if (!verifyKey) return false
  const message = `${timestamp}\n${nonce}\n${rawBody}\n`
  return crypto.createVerify('RSA-SHA256').update(message).verify(verifyKey, signature, 'base64')
}

function wechatRequest(method, urlPath, body, cfg, options = {}) {
  return new Promise((resolve, reject) => {
    const bodyText = body ? JSON.stringify(body) : ''
    const auth = buildAuthorizationHeader({ cfg, method, urlPath, bodyText })
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: auth.authorization
    }
    if (options.wechatpaySerial && cfg.encryptSerialNo) {
      headers['Wechatpay-Serial'] = cfg.encryptSerialNo
    }
    const req = https.request({
      hostname: API_HOST,
      path: urlPath,
      method,
      headers
    }, response => {
      let raw = ''
      response.on('data', chunk => { raw += chunk })
      response.on('end', () => {
        let json = {}
        try { json = raw ? JSON.parse(raw) : {} } catch {}
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error(json.message || json.code || `微信支付 HTTP ${response.statusCode}`))
        }
        resolve(json)
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => {
      req.destroy()
      reject(new Error('微信支付请求超时'))
    })
    if (bodyText) req.write(bodyText)
    req.end()
  })
}

function buildPartnerJsapiBody({ cfg, order, openid }) {
  const body = {
    sp_appid: cfg.spAppid,
    sp_mchid: cfg.spMchid,
    sub_mchid: order.subMchid,
    description: String(order.description || '').slice(0, 120),
    out_trade_no: order.outTradeNo,
    notify_url: cfg.notifyUrl,
    amount: { total: Number(order.amountFen), currency: 'CNY' },
    payer: { sp_openid: openid },
    attach: JSON.stringify(order.attach || {})
  }
  return body
}

function partnerJsapiPrepay({ cfg, order, openid }) {
  return wechatRequest('POST', '/v3/pay/partner/transactions/jsapi', buildPartnerJsapiBody({ cfg, order, openid }), cfg)
}

function queryPartnerTransaction({ cfg, outTradeNo, subMchid }) {
  const path = `/v3/pay/partner/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?sp_mchid=${encodeURIComponent(cfg.spMchid)}&sub_mchid=${encodeURIComponent(subMchid)}`
  return wechatRequest('GET', path, null, cfg)
}

function submitApplyment(cfg, payload) {
  return wechatRequest('POST', '/v3/applyment4sub/applyment/', payload, cfg, { wechatpaySerial: true })
}

function queryApplymentByBusinessCode(cfg, businessCode) {
  return wechatRequest('GET', `/v3/applyment4sub/applyment/business_code/${encodeURIComponent(businessCode)}`, null, cfg)
}

function queryApplymentById(cfg, applymentId) {
  return wechatRequest('GET', `/v3/applyment4sub/applyment/applyment_id/${encodeURIComponent(applymentId)}`, null, cfg)
}

module.exports = {
  getServiceProviderConfig,
  getNotifyConfig,
  randomString,
  signMessage,
  buildAuthorizationHeader,
  buildRequestPaymentParams,
  encryptSensitive,
  decryptNotifyResource,
  verifyNotifySignature,
  wechatRequest,
  buildPartnerJsapiBody,
  partnerJsapiPrepay,
  queryPartnerTransaction,
  submitApplyment,
  queryApplymentByBusinessCode,
  queryApplymentById
}
