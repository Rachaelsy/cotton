const assert = require('assert')
const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..', '..')

function readRootFile(...parts) {
  return fs.readFileSync(path.join(rootDir, ...parts), 'utf8')
}

function assertWebApplymentPage(html, prefix, label) {
  const requiredFields = [
    'business_code',
    'contact_name',
    'contact_mobile',
    'contact_email',
    'subject_type',
    'license_copy',
    'license_number',
    'merchant_name',
    'legal_person',
    'id_card_copy',
    'id_card_national',
    'id_card_name',
    'id_card_number',
    'card_period_begin',
    'card_period_end',
    'merchant_shortname',
    'service_phone',
    'mini_program_appid',
    'mini_program_pic',
    'settlement_id',
    'qualification_type',
    'bank_account_type',
    'account_bank',
    'bank_branch_id',
    'account_name',
    'account_number',
    'sub_mchid'
  ]

  for (const field of requiredFields) {
    assert.ok(html.includes(`id="${prefix}${field}"`), `${label} should expose ${field}`)
  }

  for (const field of ['license_copy', 'id_card_copy', 'id_card_national', 'mini_program_pic']) {
    assert.ok(html.includes(`uploadApplymentMedia('${field}'`), `${label} should upload ${field}`)
  }
}

function assertScriptSyntax(html, label) {
  const match = html.match(/<script>([\s\S]*)<\/script>/)
  assert.ok(match, `${label} should contain inline script`)
  new Function(match[1])
}

function run() {
  const merchantDashboard = readRootFile('server', 'public', 'merchant', 'dashboard.html')
  const operatorDashboard = readRootFile('server', 'public', 'operator', 'dashboard.html')

  assert.ok(merchantDashboard.includes('id="nav-pay"'), 'merchant dashboard should add pay nav')
  assert.ok(merchantDashboard.includes('id="panel-pay"'), 'merchant dashboard should add pay panel')
  assert.ok(merchantDashboard.includes('applymentApi'), 'merchant dashboard should call shared applyment API')
  assert.ok(merchantDashboard.includes('/api/wechat-applyment'), 'merchant dashboard should not use merchant API prefix for applyment')
  assert.ok(merchantDashboard.includes('buildMerchantRawApplyment'), 'merchant dashboard should build raw applyment payload')
  assert.ok(merchantDashboard.includes('submitMerchantApplyment'), 'merchant dashboard should submit applyment')
  assert.ok(merchantDashboard.includes('syncMerchantApplyment'), 'merchant dashboard should sync applyment status')
  assert.ok(merchantDashboard.includes('bindMerchantSubMchid'), 'merchant dashboard should bind existing sub_mchid')
  assert.ok(merchantDashboard.includes('/media'), 'merchant dashboard should upload WeChat Pay media')
  assertWebApplymentPage(merchantDashboard, 'm-pay-', 'merchant dashboard')
  assertScriptSyntax(merchantDashboard, 'merchant dashboard')

  assert.ok(operatorDashboard.includes('data-panel="pay"'), 'operator dashboard should add pay applyment nav')
  assert.ok(operatorDashboard.includes('/wechat-applyment/mine'), 'operator dashboard should load applyment status')
  assert.ok(operatorDashboard.includes('/wechat-applyment/draft'), 'operator dashboard should save applyment draft')
  assert.ok(operatorDashboard.includes('/wechat-applyment/submit'), 'operator dashboard should submit applyment')
  assert.ok(operatorDashboard.includes('/wechat-applyment/sync'), 'operator dashboard should sync applyment status')
  assert.ok(operatorDashboard.includes('/wechat-applyment/media'), 'operator dashboard should upload WeChat Pay media')
  assert.ok(operatorDashboard.includes('buildOperatorRawApplyment'), 'operator dashboard should build raw applyment payload')
  assertWebApplymentPage(operatorDashboard, 'op-pay-', 'operator dashboard')
  assertScriptSyntax(operatorDashboard, 'operator dashboard')

  console.log('wechat applyment UI tests passed')
}

run()
