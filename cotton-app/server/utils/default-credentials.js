const DEFAULT_CREDENTIALS = new Map([
  ['13800000001', 'test123'],
  ['13800000002', 'test123'],
  ['13800000003', 'test123'],
  ['13900000001', 'merchant123'],
  ['10000000001', 'Expert@Cotton2026']
])

function isProductionDefaultCredential(phone, password, environment = process.env.NODE_ENV) {
  if (environment !== 'production') return false
  return DEFAULT_CREDENTIALS.get(String(phone || '').trim()) === String(password || '')
}

module.exports = {
  DEFAULT_CREDENTIALS,
  isProductionDefaultCredential
}
