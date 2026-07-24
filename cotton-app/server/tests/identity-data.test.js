const assert = require('assert')

process.env.IDENTITY_DATA_KEY = 'test-only-identity-key-with-high-entropy-2026'
const identityData = require('../utils/identity-data')

function run() {
  const idNumber = '11010519491231002X'
  const encrypted = identityData.encrypt(idNumber)
  assert.match(encrypted, /^v1:/)
  assert(!encrypted.includes(idNumber), 'encrypted identity number must not contain plaintext')
  assert.strictEqual(identityData.decrypt(encrypted), idNumber)
  assert.strictEqual(identityData.maskIdNumber(idNumber), '110105********002X')

  process.env.IDENTITY_DATA_KEY = 'another-test-key'
  assert.throws(() => identityData.decrypt(encrypted), /authenticate|Unsupported state/i)

  delete process.env.IDENTITY_DATA_KEY
  assert.throws(() => identityData.encrypt(idNumber), /实名认证加密密钥未配置/)
  console.log('identity data tests passed')
}

run()
