const assert = require('assert')
const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..', '..')
const authSource = fs.readFileSync(path.join(rootDir, 'utils', 'auth.js'), 'utf8')

function extractConst(name) {
  const match = authSource.match(new RegExp(`const\\s+${name}\\s*=\\s*['"]([^'"]+)['"]`))
  return match && match[1]
}

function run() {
  const env = extractConst('ENV')
  const prodUrl = extractConst('PROD_URL')
  const releaseCheck = process.env.RELEASE_CLIENT_CONFIG === '1'

  assert.ok(['prod', 'server', 'real', 'sim'].includes(env), 'client ENV should be a known target')
  if (releaseCheck) {
    assert.strictEqual(env, 'prod', 'client should use production HTTPS API in release testing')
  }
  assert.strictEqual(prodUrl, 'https://cyaia.cn', 'production API should use the HTTPS host that currently responds')
  assert.ok(!prodUrl.endsWith('/'), 'production API base URL should not end with a slash')
  assert.ok(!prodUrl.includes('www.cyaia.cn'), 'www.cyaia.cn HTTPS endpoint is not currently reachable')

  console.log('client config tests passed')
}

run()
