const assert = require('assert')
const fs = require('fs')
const path = require('path')

const authSource = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'cotton-public', 'utils', 'auth.js'),
  'utf8'
)

assert(
  authSource.includes("else if (path === '/api/auth/verify')"),
  'a 401 from an individual business API must not clear the whole miniapp session'
)
assert(
  !/if \(res\.statusCode === 401\)[\s\S]{0,180}else \{\s*clearToken\(\)/.test(authSource),
  'generic business API failures must not sign the farmer out'
)
assert(
  authSource.includes("console.warn('[api-unauthorized]'"),
  'the failing endpoint should remain observable without deleting the session'
)

console.log('public miniapp session tests passed')
