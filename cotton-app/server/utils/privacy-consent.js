const CURRENT_PRIVACY_CONSENT_VERSION = '2026-07-30'

function validatePrivacyConsent(body = {}) {
  if (body.privacy_consent !== true) return '请先阅读并同意个人信息使用说明'
  if (String(body.privacy_consent_version || '') !== CURRENT_PRIVACY_CONSENT_VERSION) {
    return '个人信息使用说明已更新，请刷新页面后重新确认'
  }
  return null
}

module.exports = {
  CURRENT_PRIVACY_CONSENT_VERSION,
  validatePrivacyConsent
}
