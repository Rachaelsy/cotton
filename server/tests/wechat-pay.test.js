const assert = require('assert')
const crypto = require('crypto')

const wxpay = require('../utils/wechat-pay')

function makeRsaPair() {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  return {
    privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' })
  }
}

function encryptNotifyResource(plain, apiV3Key) {
  const nonce = 'notifyNonce123'
  const associatedData = 'transaction'
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(apiV3Key), Buffer.from(nonce))
  cipher.setAAD(Buffer.from(associatedData))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    algorithm: 'AEAD_AES_256_GCM',
    nonce,
    associated_data: associatedData,
    ciphertext: Buffer.concat([encrypted, tag]).toString('base64')
  }
}

async function run() {
  const { privateKey, publicKey } = makeRsaPair()
  const cfg = wxpay.getServiceProviderConfig({
    env: {
      WECHAT_PAY_SP_APPID: 'wxspapp',
      WECHAT_PAY_SP_MCH_ID: '1900000109',
      WECHAT_PAY_SERIAL_NO: 'SERIAL_NO',
      WECHAT_PAY_NOTIFY_URL: 'https://example.com/api/pay/wechat/notify',
      WECHAT_PAY_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n')
    }
  })
  assert.strictEqual(cfg.spAppid, 'wxspapp')
  assert.strictEqual(cfg.spMchid, '1900000109')
  assert.strictEqual(cfg.mchid, '1900000109')
  assert.strictEqual(wxpay.getServiceProviderConfig({ env: {} }), null)
  assert.strictEqual(wxpay.getServiceProviderConfig({
    env: {
      WECHAT_PAY_SP_APPID: 'TODO_SERVICE_PROVIDER_APPID',
      WECHAT_PAY_SP_MCH_ID: 'TODO_SERVICE_PROVIDER_MCH_ID',
      WECHAT_PAY_SERIAL_NO: 'TODO_API_CERT_SERIAL_NO',
      WECHAT_PAY_NOTIFY_URL: 'TODO_HTTPS_DOMAIN/api/pay/wechat/notify',
      WECHAT_PAY_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n')
    }
  }), null)
  const relativePathCfg = wxpay.getServiceProviderConfig({
    env: {
      WECHAT_PAY_SP_APPID: 'wxspapp',
      WECHAT_PAY_SP_MCH_ID: '1900000109',
      WECHAT_PAY_SERIAL_NO: 'SERIAL_NO',
      WECHAT_PAY_NOTIFY_URL: 'https://example.com/api/pay/wechat/notify',
      WECHAT_PAY_PRIVATE_KEY_PATH: 'tests/fixtures/wechat-test-private-key.txt'
    }
  })
  assert.strictEqual(relativePathCfg.privateKey.includes('BEGIN TEST PRIVATE KEY'), true)

  const signature = wxpay.signMessage(privateKey, 'message-to-sign')
  const verified = crypto
    .createVerify('RSA-SHA256')
    .update('message-to-sign')
    .verify(publicKey, signature, 'base64')
  assert.strictEqual(verified, true)

  const payParams = wxpay.buildRequestPaymentParams({
    appid: 'wxspapp',
    privateKey,
    prepayId: 'wx201410272009395522657a690389285100',
    timestamp: '1710000000',
    nonceStr: 'nonce-for-test'
  })
  assert.strictEqual(payParams.package, 'prepay_id=wx201410272009395522657a690389285100')
  const paySignOk = crypto
    .createVerify('RSA-SHA256')
    .update('wxspapp\n1710000000\nnonce-for-test\nprepay_id=wx201410272009395522657a690389285100\n')
    .verify(publicKey, payParams.paySign, 'base64')
  assert.strictEqual(paySignOk, true)

  const encrypted = wxpay.encryptSensitive('张三', { platformCert: publicKey })
  const decrypted = crypto.privateDecrypt({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha1'
  }, Buffer.from(encrypted, 'base64')).toString('utf8')
  assert.strictEqual(decrypted, '张三')
  assert.throws(() => wxpay.encryptSensitive('张三', {}), /公钥或平台证书/)

  const publicKeyCfg = wxpay.getNotifyConfig({
    env: {
      WECHAT_PAY_SP_APPID: 'wxspapp',
      WECHAT_PAY_SP_MCH_ID: '1900000109',
      WECHAT_PAY_SERIAL_NO: 'SERIAL_NO',
      WECHAT_PAY_NOTIFY_URL: 'https://example.com/api/pay/wechat/notify',
      WECHAT_PAY_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n'),
      WECHAT_PAY_API_V3_KEY: '12345678901234567890123456789012',
      WECHAT_PAY_PUBLIC_KEY_ID: 'PUB_KEY_ID_3000000001',
      WECHAT_PAY_PUBLIC_KEY: publicKey.replace(/\n/g, '\\n')
    }
  })
  assert.strictEqual(publicKeyCfg.platformSerialNo, 'PUB_KEY_ID_3000000001')
  assert.strictEqual(publicKeyCfg.encryptSerialNo, 'PUB_KEY_ID_3000000001')
  assert.strictEqual(publicKeyCfg.wechatpayPublicKey.includes('BEGIN PUBLIC KEY'), true)

  const rawBody = '{"id":"notify-test"}'
  const notifyTimestamp = '1710000000'
  const notifyNonce = 'notify-nonce'
  const notifySignature = wxpay.signMessage(privateKey, `${notifyTimestamp}\n${notifyNonce}\n${rawBody}\n`)
  const notifyReq = {
    headers: {
      'wechatpay-timestamp': notifyTimestamp,
      'wechatpay-nonce': notifyNonce,
      'wechatpay-signature': notifySignature,
      'wechatpay-serial': 'PUB_KEY_ID_3000000001'
    }
  }
  assert.strictEqual(wxpay.verifyNotifySignature(notifyReq, rawBody, publicKeyCfg), true)
  assert.strictEqual(wxpay.verifyNotifySignature({
    headers: { ...notifyReq.headers, 'wechatpay-serial': 'PUB_KEY_ID_3000000002' }
  }, rawBody, publicKeyCfg), false)

  const apiV3Key = '12345678901234567890123456789012'
  const resource = encryptNotifyResource({
    out_trade_no: 'SUPPLY_MG202607030001_8',
    trade_state: 'SUCCESS'
  }, apiV3Key)
  const notifyData = wxpay.decryptNotifyResource(resource, apiV3Key)
  assert.strictEqual(notifyData.trade_state, 'SUCCESS')
  assert.strictEqual(notifyData.out_trade_no, 'SUPPLY_MG202607030001_8')

  const partnerBody = wxpay.buildPartnerJsapiBody({
    cfg,
    order: {
      subMchid: '1700000001',
      description: '棉花农资订单 MG202607030001',
      outTradeNo: 'SUPPLY_MG202607030001_8',
      amountFen: 2580,
      attach: { orderType: 'supply', orderId: 8, subMchid: '1700000001' }
    },
    openid: 'openid-under-sp-appid'
  })
  assert.strictEqual(partnerBody.sp_appid, 'wxspapp')
  assert.strictEqual(partnerBody.sp_mchid, '1900000109')
  assert.strictEqual(partnerBody.sub_mchid, '1700000001')
  assert.deepStrictEqual(partnerBody.payer, { sp_openid: 'openid-under-sp-appid' })
  assert.strictEqual(partnerBody.amount.total, 2580)
  assert.strictEqual(JSON.parse(partnerBody.attach).subMchid, '1700000001')

  const partnerProfitSharingBody = wxpay.buildPartnerJsapiBody({
    cfg,
    order: {
      subMchid: '1700000001',
      description: '棉花农资订单 MG202607030001',
      outTradeNo: 'SUPPLY_MG202607030001_8',
      amountFen: 2580,
      profitSharing: true,
      attach: { orderType: 'supply', orderId: 8, subMchid: '1700000001' }
    },
    openid: 'openid-under-sp-appid'
  })
  assert.deepStrictEqual(partnerProfitSharingBody.settle_info, { profit_sharing: true })

  const media = wxpay.buildMediaUploadBody({
    filename: 'license.png',
    buffer: Buffer.from('image-bytes-for-test'),
    mimeType: 'image/png',
    boundary: '----cotton-test-boundary'
  })
  assert.strictEqual(JSON.parse(media.meta).filename, 'license.png')
  assert.strictEqual(
    JSON.parse(media.meta).sha256,
    crypto.createHash('sha256').update(Buffer.from('image-bytes-for-test')).digest('hex')
  )
  assert.match(media.contentType, /multipart\/form-data; boundary=----cotton-test-boundary/)
  assert.ok(media.bodyBuffer.includes(Buffer.from('name="meta"')))
  assert.ok(media.bodyBuffer.includes(Buffer.from('name="file"; filename="license.png"')))
  assert.ok(media.bodyBuffer.includes(Buffer.from('image-bytes-for-test')))

  console.log('wechat pay utility tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
