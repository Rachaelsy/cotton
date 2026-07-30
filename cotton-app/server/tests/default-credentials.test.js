const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { isProductionDefaultCredential } = require('../utils/default-credentials')

function run() {
  assert.strictEqual(
    isProductionDefaultCredential('13800000001', 'test123', 'production'),
    true
  )
  assert.strictEqual(
    isProductionDefaultCredential('13800000001', 'test123', 'development'),
    false
  )
  assert.strictEqual(
    isProductionDefaultCredential('13800000001', 'another-password', 'production'),
    false
  )
  assert.strictEqual(
    isProductionDefaultCredential('13800138000', 'test123', 'production'),
    false
  )

  for (const route of ['auth.js', 'merchant.js', 'operator.js', 'expert-admin.js']) {
    const source = fs.readFileSync(path.join(__dirname, '../routes', route), 'utf8')
    assert.ok(source.includes('isProductionDefaultCredential'), `${route} should block production demo credentials`)
  }

  const compose = fs.readFileSync(path.join(__dirname, '../../../docker-compose.yml'), 'utf8')
  assert.ok(compose.includes('NODE_ENV: ${APP_NODE_ENV:-production}'))
  console.log('default credential tests passed')
}

run()
