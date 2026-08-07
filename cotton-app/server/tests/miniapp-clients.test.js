const assert = require('assert')
const { CLIENTS, normalizeMiniappClient, resolveMiniappClient } = require('../utils/miniapp-clients')

assert.strictEqual(normalizeMiniappClient('cotton-public'), CLIENTS.PUBLIC)
assert.strictEqual(normalizeMiniappClient('unknown'), CLIENTS.APP)

const fallback = resolveMiniappClient(
  { headers: { 'x-miniapp-client': 'cotton-public' }, body: {} },
  { WX_APPID: 'main-id', WX_SECRET: 'main-secret' }
)
assert.strictEqual(fallback.clientKey, CLIENTS.PUBLIC)
assert.strictEqual(fallback.appid, 'main-id')
assert.strictEqual(fallback.usesDedicatedIdentity, false)

const dedicated = resolveMiniappClient(
  { headers: { 'x-miniapp-client': 'cotton-public' }, body: {} },
  {
    WX_APPID: 'main-id', WX_SECRET: 'main-secret',
    PUBLIC_WX_APPID: 'public-id', PUBLIC_WX_SECRET: 'public-secret'
  }
)
assert.strictEqual(dedicated.appid, 'public-id')
assert.strictEqual(dedicated.secret, 'public-secret')
assert.strictEqual(dedicated.usesDedicatedIdentity, true)

console.log('miniapp client configuration tests passed')
