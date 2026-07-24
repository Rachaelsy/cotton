const assert = require('assert')
const fs = require('fs')
const path = require('path')

process.env.WX_APPID = 'wx-platform-appid'
const wxpayPath = require.resolve('../utils/wechat-pay')
let mediaIndex = 0
require.cache[wxpayPath] = {
  id: wxpayPath,
  filename: wxpayPath,
  loaded: true,
  exports: {
    async uploadMediaImage() { mediaIndex += 1; return { media_id: `media-${mediaIndex}` } },
    encryptSensitive(value) { return `encrypted(${value})` }
  }
}
const service = require('../utils/applyment-registration')

async function run() {
  const uploadDir = path.join(__dirname, '../public/uploads/applyment-test')
  fs.mkdirSync(uploadDir, { recursive: true })
  const imagePath = path.join(uploadDir, 'material.jpg')
  fs.writeFileSync(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
  try {
    const draft = service.buildRegistrationDraft({
      phone: '13800000000', real_name: '测试负责人', company_name: '测试农机合作社',
      business_license: '91650000TEST0001', id_card_number: '650100199001010000',
      card_period_begin: '2020-01-01', card_period_end: 'long_term',
      merchant_shortname: '测试农机', service_phone: '13800000000',
      account_bank: '中国农业银行', account_name: '测试负责人', account_number: '6228000000000000',
      license_copy_url: '/uploads/applyment-test/material.jpg',
      id_card_copy_url: '/uploads/applyment-test/material.jpg',
      id_card_national_url: '/uploads/applyment-test/material.jpg',
      mini_program_pic_url: '/uploads/applyment-test/material.jpg'
    })
    assert.strictEqual(draft.raw_applyment.business_info.sales_info.mini_program_info.mini_program_appid, 'wx-platform-appid')
    assert.strictEqual(draft.raw_applyment.settlement_info.settlement_id, '719')

    const enterpriseDraft = service.buildRegistrationDraft({
      subject_type: 'SUBJECT_TYPE_ENTERPRISE'
    }, { qualificationType: '零售批发/生活娱乐/其他' })
    assert.strictEqual(enterpriseDraft.raw_applyment.settlement_info.settlement_id, '716')
    assert.strictEqual(enterpriseDraft.raw_applyment.settlement_info.qualification_type, '零售批发/生活娱乐/其他')
    assert.strictEqual(service.resolveSettlementId({ subject_type: 'SUBJECT_TYPE_OTHERS' }), '727')

    const payload = await service.prepareApplymentPayload({}, draft, 'COTTON_OPERATOR_TEST')
    assert.strictEqual(payload.business_code, 'COTTON_OPERATOR_TEST')
    const mediaIds = [
      payload.subject_info.business_license_info.license_copy,
      payload.subject_info.identity_info.id_card_info.id_card_copy,
      payload.subject_info.identity_info.id_card_info.id_card_national,
      payload.business_info.sales_info.mini_program_info.mini_program_pics[0]
    ]
    assert(mediaIds.every(value => /^media-\d$/.test(value)))
    assert.strictEqual(new Set(mediaIds).size, 4)
    assert.match(payload.contact_info.contact_name, /^encrypted\(/)
    assert.match(payload.bank_account_info.account_number, /^encrypted\(/)

    const portal = fs.readFileSync(path.join(__dirname, '../public/portal/register.html'), 'utf8')
    const adminRoute = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8')
    assert.match(portal, /id="card_period_begin"/)
    assert.match(portal, /id="bank_account_type"/)
    assert.match(adminRoute, /submitOperatorApplyment\(operator\)/)
    console.log('applyment registration tests passed')
  } finally {
    fs.rmSync(uploadDir, { recursive: true, force: true })
  }
}

run().catch(error => { console.error(error); process.exit(1) })
