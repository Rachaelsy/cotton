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
  assert.throws(() => wxpay.encryptSensitive('张三', {}), /平台证书/)

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

  console.log('wechat pay utility tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
