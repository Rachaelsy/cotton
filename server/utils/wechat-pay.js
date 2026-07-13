const crypto = require('crypto')
const https = require('https')
const fs = require('fs')
const path = require('path')

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

function resolveEnvFilePath(filePath) {
  const text = String(filePath || '').trim()
  if (!text) return ''
  const candidates = path.isAbsolute(text)
    ? [text]
    : [
        path.resolve(process.cwd(), text),
        path.resolve(__dirname, '..', text),
        path.resolve(__dirname, '..', '..', text)
      ]
  return candidates.find(candidate => fs.existsSync(candidate)) || ''
}

function readEnvText(env, valueName, pathName) {
  let value = readEnvValue(env, valueName)
  const filePath = readEnvValue(env, pathName)
  const resolvedPath = resolveEnvFilePath(filePath)
  if (!value && resolvedPath) value = fs.readFileSync(resolvedPath, 'utf8')
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
  const mchid = cfg.mchid || cfg.spMchid
  return {
    timestamp: ts,
    nonce,
    authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${ts}",serial_no="${cfg.serialNo}",signature="${signature}"`
  }
}

function buildWechatRequestHeaders({ cfg, method, urlPath, bodyText = '', timestamp, nonceStr, wechatpaySerial = false }) {
  const auth = buildAuthorizationHeader({ cfg, method, urlPath, bodyText, timestamp, nonceStr })
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'cotton-wechatpay/1.0',
    Authorization: auth.authorization
  }
  if (wechatpaySerial && cfg.encryptSerialNo) {
    headers['Wechatpay-Serial'] = cfg.encryptSerialNo
  }
  return headers
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
    const headers = buildWechatRequestHeaders({
      cfg,
      method,
      urlPath,
      bodyText,
      wechatpaySerial: options.wechatpaySerial
    })
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
          const detail = Array.isArray(json.detail)
            ? json.detail.map(item => item.issue || item.field || item.location).filter(Boolean).join('; ')
            : ''
          const text = [json.code, json.message, detail].filter(Boolean).join(': ')
          const error = new Error(text || `WeChat Pay HTTP ${response.statusCode}`)
          error.statusCode = response.statusCode
          error.wxpay = json
          return reject(error)
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

function sanitizeUploadFilename(filename) {
  const name = String(filename || 'wechatpay-media')
    .replace(/[\\/\r\n"]/g, '_')
    .slice(0, 120)
  return name || 'wechatpay-media'
}

function buildMediaUploadBody({ filename, buffer, mimeType = 'application/octet-stream', boundary }) {
  const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '')
  const safeFilename = sanitizeUploadFilename(filename)
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex')
  const meta = JSON.stringify({ filename: safeFilename, sha256 })
  const formBoundary = boundary || `----cotton-wechatpay-${randomString(24)}`
  const head = Buffer.from(
    `--${formBoundary}\r\n` +
    'Content-Disposition: form-data; name="meta"\r\n' +
    'Content-Type: application/json\r\n\r\n' +
    `${meta}\r\n` +
    `--${formBoundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${safeFilename}"\r\n` +
    `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`
  )
  const tail = Buffer.from(`\r\n--${formBoundary}--\r\n`)
  return {
    meta,
    boundary: formBoundary,
    contentType: `multipart/form-data; boundary=${formBoundary}`,
    bodyBuffer: Buffer.concat([head, fileBuffer, tail])
  }
}

function uploadMediaImage(cfg, file) {
  return new Promise((resolve, reject) => {
    const urlPath = '/v3/merchant/media/upload'
    const upload = buildMediaUploadBody(file)
    // WeChat Pay signs only the JSON meta string for media upload, not the multipart body.
    const auth = buildAuthorizationHeader({ cfg, method: 'POST', urlPath, bodyText: upload.meta })
    const req = https.request({
      hostname: API_HOST,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': upload.contentType,
        'Content-Length': upload.bodyBuffer.length,
        Accept: 'application/json',
        Authorization: auth.authorization,
        'User-Agent': 'cotton-wechatpay/1.0'
      }
    }, response => {
      let raw = ''
      response.on('data', chunk => { raw += chunk })
      response.on('end', () => {
        let json = {}
        try { json = raw ? JSON.parse(raw) : {} } catch {}
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error(json.message || json.code || `微信支付素材上传 HTTP ${response.statusCode}`))
        }
        resolve(json)
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => {
      req.destroy()
      reject(new Error('微信支付素材上传超时'))
    })
    req.write(upload.bodyBuffer)
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
  if (order.profitSharing) body.settle_info = { profit_sharing: true }
  return body
}

function partnerJsapiPrepay({ cfg, order, openid }) {
  return wechatRequest('POST', '/v3/pay/partner/transactions/jsapi', buildPartnerJsapiBody({ cfg, order, openid }), cfg)
}

function buildJsapiBody({ cfg, order, openid }) {
  return {
    appid: cfg.appid || cfg.spAppid,
    mchid: cfg.mchid || cfg.spMchid,
    description: String(order.description || '').slice(0, 120),
    out_trade_no: order.outTradeNo,
    notify_url: cfg.notifyUrl,
    amount: { total: Number(order.amountFen), currency: 'CNY' },
    payer: { openid },
    attach: JSON.stringify(order.attach || {})
  }
}

function jsapiPrepay({ cfg, order, openid }) {
  return wechatRequest('POST', '/v3/pay/transactions/jsapi', buildJsapiBody({ cfg, order, openid }), cfg)
}

function queryPartnerTransaction({ cfg, outTradeNo, subMchid }) {
  const path = `/v3/pay/partner/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?sp_mchid=${encodeURIComponent(cfg.spMchid)}&sub_mchid=${encodeURIComponent(subMchid)}`
  return wechatRequest('GET', path, null, cfg)
}

function queryTransaction({ cfg, outTradeNo }) {
  const mchid = cfg.mchid || cfg.spMchid
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(mchid)}`
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

function addProfitSharingReceiver(cfg, receiver) {
  return wechatRequest('POST', '/v3/profitsharing/receivers/add', receiver, cfg, receiver && receiver.name ? { wechatpaySerial: true } : {})
}

function requestProfitSharing(cfg, payload) {
  return wechatRequest('POST', '/v3/profitsharing/orders', payload, cfg)
}

function requestProfitSharingReturn(cfg, payload) {
  return wechatRequest('POST', '/v3/profitsharing/return-orders', payload, cfg)
}

function queryProfitSharingOrder(cfg, { subMchid, transactionId, outOrderNo }) {
  const query = new URLSearchParams({
    sub_mchid: subMchid,
    transaction_id: transactionId,
    out_order_no: outOrderNo
  })
  return wechatRequest('GET', `/v3/profitsharing/orders?${query.toString()}`, null, cfg)
}

function queryProfitSharingMerchantConfig(cfg, subMchid) {
  return wechatRequest('GET', `/v3/profitsharing/merchant-configs/${encodeURIComponent(subMchid)}`, null, cfg)
}

function buildPartnerRefundBody({ refund }) {
  const body = {
    sub_mchid: refund.subMchid,
    out_refund_no: refund.outRefundNo,
    reason: String(refund.reason || '').slice(0, 80),
    amount: {
      refund: Number(refund.refundFen),
      total: Number(refund.totalFen),
      currency: refund.currency || 'CNY'
    }
  }
  if (refund.transactionId) body.transaction_id = refund.transactionId
  else body.out_trade_no = refund.outTradeNo
  if (refund.notifyUrl) body.notify_url = refund.notifyUrl
  if (refund.fundsAccount) body.funds_account = refund.fundsAccount
  return body
}

function partnerRefund({ cfg, refund }) {
  return wechatRequest('POST', '/v3/refund/domestic/refunds', buildPartnerRefundBody({ refund }), cfg)
}

function queryPartnerRefund({ cfg, subMchid, outRefundNo }) {
  const query = new URLSearchParams({ sub_mchid: subMchid })
  return wechatRequest('GET', `/v3/refund/domestic/refunds/${encodeURIComponent(outRefundNo)}?${query.toString()}`, null, cfg)
}

module.exports = {
  getServiceProviderConfig,
  getNotifyConfig,
  randomString,
  signMessage,
  buildAuthorizationHeader,
  buildWechatRequestHeaders,
  buildRequestPaymentParams,
  encryptSensitive,
  decryptNotifyResource,
  verifyNotifySignature,
  wechatRequest,
  buildJsapiBody,
  jsapiPrepay,
  buildPartnerJsapiBody,
  partnerJsapiPrepay,
  queryTransaction,
  queryPartnerTransaction,
  submitApplyment,
  queryApplymentByBusinessCode,
  queryApplymentById,
  buildMediaUploadBody,
  uploadMediaImage,
  addProfitSharingReceiver,
  requestProfitSharing,
  requestProfitSharingReturn,
  queryProfitSharingOrder,
  queryProfitSharingMerchantConfig,
  buildPartnerRefundBody,
  partnerRefund,
  queryPartnerRefund
}
