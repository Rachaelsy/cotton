const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  CURRENT_PRIVACY_CONSENT_VERSION,
  validatePrivacyConsent
} = require('../utils/privacy-consent')

const serverDir = path.join(__dirname, '..')
const read = (...parts) => fs.readFileSync(path.join(serverDir, ...parts), 'utf8')

assert.equal(validatePrivacyConsent({}), '请先阅读并同意个人信息使用说明')
assert.match(
  validatePrivacyConsent({ privacy_consent: true, privacy_consent_version: 'old' }),
  /已更新/
)
assert.equal(validatePrivacyConsent({
  privacy_consent: true,
  privacy_consent_version: CURRENT_PRIVACY_CONSENT_VERSION
}), null)

const schema = read('db', 'schema.sql')
const entrypoint = read('docker-entrypoint.sh')
const adminRoutes = read('routes', 'admin.js')
const operatorRoutes = read('routes', 'operator.js')

assert(schema.includes('privacy_consent_version'))
assert(schema.includes('privacy_consent_at'))
assert(entrypoint.includes('migrate_privacy_consent.js'))
assert(adminRoutes.includes('validatePrivacyConsent(req.body)'))
assert(operatorRoutes.includes('validatePrivacyConsent(req.body)'))
assert(adminRoutes.includes('privacy_consent_at'))
assert(operatorRoutes.includes('privacy_consent_at'))

console.log('privacy consent tests passed')
