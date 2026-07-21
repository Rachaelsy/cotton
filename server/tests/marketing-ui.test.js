const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', '..')
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8')

function assertInlineScriptsParse(html, name) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  assert.ok(scripts.length, `${name} should contain an inline script`)
  scripts.forEach((match, index) => {
    assert.doesNotThrow(() => new Function(match[1]), `${name} inline script ${index + 1} should parse`)
  })
}

function run() {
  const app = JSON.parse(read('app.json'))
  const supplies = app.subpackages.find(item => item.root === 'subpkg-supplies')
  assert.ok(supplies.pages.includes('marketing-coupons/index'))
  assert.strictEqual(app.renderer, 'skyline', 'existing Skyline renderer must remain unchanged')

  const merchant = read('server', 'public', 'merchant', 'dashboard.html')
  assert.ok(merchant.includes('id="nav-marketing"'))
  assert.ok(merchant.includes('创建营销活动'))
  assert.ok(merchant.includes('秒杀库存'))
  assert.ok(merchant.includes('/merchant/campaigns'))
  assert.ok(merchant.includes('function campaignDisplayStatus(item)'))
  assert.ok(merchant.includes("datetimeLocal(item.starts_at).replace('T',' ')"), 'campaign times should be rendered in the merchant local timezone')
  assert.ok(merchant.includes("approved:'已通过', scheduled:'待开始'"))
  assert.ok(merchant.includes("campaign?.starts_at || new Date()"), 'new campaigns should start immediately by default')
  assert.ok(!merchant.includes('Date.now() + 10 * 60000'), 'new campaigns must not silently wait ten minutes')
  assertInlineScriptsParse(merchant, 'merchant dashboard')

  const admin = read('server', 'public', 'admin', 'dashboard.html')
  assert.ok(admin.includes('data-panel="marketing"'))
  assert.ok(admin.includes('营销活动审核'))
  assert.ok(admin.includes('/admin/campaigns'))
  assert.ok(admin.includes('驳回原因'))
  assertInlineScriptsParse(admin, 'admin dashboard')

  const couponPage = read('subpkg-supplies', 'marketing-coupons', 'index.js')
  const checkout = read('subpkg-supplies', 'supplies-checkout', 'index.js')
  const cart = read('subpkg-supplies', 'supplies-cart', 'index.js')
  const suppliesPage = read('subpkg-supplies', 'supplies', 'index.js')
  const suppliesWxml = read('subpkg-supplies', 'supplies', 'index.wxml')
  const storeWxml = read('subpkg-supplies', 'supplies-store', 'index.wxml')
  assert.ok(couponPage.includes('/api/marketing/coupons'))
  assert.ok(couponPage.includes('/claim'))
  assert.ok(checkout.includes('/api/marketing/quote'))
  assert.ok(checkout.includes('user_coupon_id'))
  assert.ok((checkout.match(/items:\s*group\.items/g) || []).length >= 2, 'marketing quote merges must preserve original cart item ids')
  assert.ok(cart.includes('/api/marketing/quote/best'), 'cart estimate should automatically include the best coupon')
  assert.ok(suppliesPage.includes('getBestCartSummary'), 'supplies estimate should include the best coupon')
  assert.ok(!read('subpkg-supplies', 'supplies-cart', 'index.wxml').includes('优惠¥30'))
  assert.ok(!suppliesPage.includes('wx.getLocation'), 'supplies list must not use current location as the shipping address')
  assert.ok(suppliesWxml.includes('class="quick-cart"'), 'supplies list should show an immediate bottom cart summary')
  assert.ok(suppliesWxml.includes('{{item.cartQty}}'), 'supplies list should show the selected quantity beside each product')
  assert.ok(storeWxml.includes('class="quick-cart"'), 'merchant store should show the same bottom cart summary')

  const route = read('server', 'routes', 'marketing.js')
  assert.ok(route.includes("router.patch('/admin/campaigns/:id/review'"))
  assert.ok(route.includes("router.post('/merchant/campaigns'"))
  assert.ok(route.includes("router.post('/quote'"))
  assert.ok(route.includes("router.post('/quote/best'"))

  console.log('marketing UI and wiring tests passed')
}

run()
