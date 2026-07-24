const assert = require('assert')
const express = require('express')
const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const {
  principalFromPayload,
  ownerCondition
} = require('../middleware/principal')

const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

async function run() {
  const guestPayload = jwt.verify(
    jwt.sign({ guestId: 91, role: 'guest', type: 'wechat_guest' }, 'guest-secret'),
    'guest-secret'
  )
  const guest = principalFromPayload(guestPayload)
  assert.deepStrictEqual({ type: guest.type, id: guest.id }, { type: 'guest', id: 91 })
  assert.deepStrictEqual(ownerCondition(guest, 'o'), { sql: 'o.guest_id=?', params: [91] })

  const farmer = principalFromPayload({ id: 12, role: 'farmer' })
  assert.deepStrictEqual(ownerCondition(farmer), { sql: 'user_id=?', params: [12] })
  assert.strictEqual(principalFromPayload({ id: 3, role: 'merchant' }), null)

  const authRoute = read('server/routes/auth.js')
  const ordersRoute = read('server/routes/orders.js')
  const paymentRoute = read('server/routes/payments.js')
  const logisticsRoute = read('server/routes/logistics.js')
  const marketingRoute = read('server/routes/marketing.js')
  const migration = read('server/db/migrate_guest_checkout.js')
  const dockerEntrypoint = read('server/docker-entrypoint.sh')
  const authClient = read('utils/auth.js')
  const checkout = read('subpkg-supplies/supplies-checkout/index.js')
  const payPage = read('subpkg-supplies/supplies-pay/index.js')
  const machineDetail = read('pages/machine/detail.js')

  assert(authRoute.includes("router.post('/wechat-guest'"), 'server should exchange wx.login code for a guest session')
  assert(authRoute.includes('claimGuestOrders'), 'account login should claim orders made by the same device guest')
  assert(migration.includes('CREATE TABLE IF NOT EXISTS wechat_guests'), 'migration should create guest identity storage')
  assert(migration.includes('MODIFY user_id INT UNSIGNED NULL'), 'orders should permit a guest owner instead of a fake user')
  assert(migration.includes('guest_id BIGINT UNSIGNED NULL'), 'orders should store guest ownership')
  assert(dockerEntrypoint.includes('run_optional_node db/migrate_guest_checkout.js'), 'Docker startup should apply the guest checkout migration')
  assert(ordersRoute.includes("router.post('/', principalAuth"), 'anonymous requests without a WeChat identity must not reserve stock')
  assert(ordersRoute.includes('orderNo, userId, guestId'), 'created orders should persist exactly one owner')
  assert(ordersRoute.includes("return fail(res, '请登录后使用优惠券', 403)"), 'guest coupon rejection must not invalidate the guest session')
  assert(marketingRoute.includes("return fail(res, '请登录后使用优惠券', 403)"), 'guest quote rejection must remain a business error')
  assert(paymentRoute.includes('loadPayerOpenid(req.principal)'), 'payment should resolve OpenID from the active principal')
  assert(paymentRoute.includes("SELECT openid FROM wechat_guests"), 'guest payment should use guest OpenID')
  assert(paymentRoute.includes("if (req.principal.type !== 'user') return fail(res, '农机租赁需要登录农户账户'"), 'machine rental should stay account-only')
  assert(logisticsRoute.includes('COALESCE(u.openid,g.openid)'), 'guest orders should retain logistics lookup support')
  assert(authClient.includes('wx.login({') && authClient.includes('ensureGuestSession'), 'mini program should establish guest identity silently')
  assert(checkout.includes("auth.guestRequest('POST', '/api/orders'"), 'checkout should submit with the guest-capable identity')
  assert(checkout.includes("identity.type === 'user' ? (group.user_coupon_id || undefined) : undefined"), 'guest checkout should discard coupons left by an earlier login')
  assert(checkout.includes('content: e.message || this.data.copy.network'), 'checkout should surface the actual order error')
  assert(payPage.includes("auth.guestRequest('POST', '/api/pay/wechat/prepay'"), 'payment should preserve guest identity')
  assert(machineDetail.includes('auth.isLoggedIn()'), 'machine booking login boundary should remain in place')

  process.env.JWT_SECRET = 'guest-checkout-route-secret'
  process.env.WX_APPID = 'wx-guest-test-appid'
  process.env.WX_SECRET = 'wx-guest-test-secret'
  const dbPath = require.resolve('../db/database')
  const mockDb = {
    async query(sql) {
      const compact = String(sql).replace(/\s+/g, ' ').trim()
      if (/INSERT INTO wechat_guests/i.test(compact)) return [{ affectedRows: 1 }]
      if (/SELECT id FROM wechat_guests WHERE openid=\?/i.test(compact)) return [[{ id: 55 }], []]
      throw new Error(`Unexpected guest auth SQL: ${compact}`)
    }
  }
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
  const originalFetch = global.fetch
  global.fetch = async () => ({
    ok: true,
    async json() { return { openid: 'guest-openid-55', unionid: 'guest-unionid-55' } }
  })
  const authRouter = require('../routes/auth')
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  try {
    const response = await originalFetch(`http://127.0.0.1:${server.address().port}/api/auth/wechat-guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginCode: 'wx-test-code' })
    })
    const result = await response.json()
    assert.strictEqual(response.status, 200)
    const payload = jwt.verify(result.data.token, process.env.JWT_SECRET)
    assert.strictEqual(payload.role, 'guest')
    assert.strictEqual(payload.guestId, 55)
  } finally {
    global.fetch = originalFetch
    await new Promise(resolve => server.close(resolve))
  }

  console.log('guest checkout tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
