const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

const server = read('server.js')
const route = read('routes/site.js')
const shell = read('public/site/index.html')
const app = read('public/site/app.js')
const styles = read('public/site/styles.css')
const dataSource = read('public/site/data.js')
const commerce = read('routes/commerce.js')

const context = { window: {} }
vm.runInNewContext(dataSource, context)
const data = context.window.COTTON_SITE_DATA

assert(server.includes("require('./routes/site')"), 'server should mount the website router')
assert(server.includes("app.use('/knowledge/site'"), 'server should expose shared website assets')
assert(route.includes("router.get(['/', '/index.html'], redirectWithQuery('/business/'))"), 'root should open the ecommerce website')

for (const routePath of [
  "'/business'", "'/business/'", "'/business/login'", "'/business/privacy'",
  "'/business/products'", "'/business/products/:id'", "'/business/machinery'",
  "'/business/machinery/:id'", "'/business/merchants'", "'/business/local'",
  "'/business/activities'", "'/business/cart'", "'/business/favorites'",
  "'/business/account'", "'/business/orders'", "'/business/help'",
  "'/business/about'", "'/business/contact'"
]) assert(route.includes(routePath), `missing ecommerce route ${routePath}`)

assert(route.includes("router.get('/public/login', redirectWithQuery('/business/login'))"), 'old login URL should redirect to ecommerce login')
assert(route.includes("router.get('/public/*', redirectWithQuery('/business/'))"), 'retired public-service URLs should redirect to ecommerce')
assert(!shell.includes('喀什优棉公共服务平台') && !shell.includes('/public/'), 'the website shell must not expose public-service content')
assert(!shell.includes('/knowledge/site/learning.js') && !shell.includes('/knowledge/site/public-modules.js'), 'public-service bundles must not load on the ecommerce site')
assert(shell.includes('川月智能') && shell.includes('/business/login'), 'the ecommerce brand and login must be visible')

assert(app.includes('function renderCommerceHome()'), 'ecommerce home is missing')
for (const block of ['simple-about-company', 'simple-about-contact', 'simple-about-message']) {
  assert(app.includes(block) && styles.includes(`.${block}`), `about page block is incomplete: ${block}`)
}
assert(app.includes('公司简介') && app.includes('联系我们') && app.includes('在线留言'), 'about page should stay focused on company, contact and message content')
assert(app.includes('陆家嘴环路958号') && app.includes('021-66286003') && app.includes('lijiale@cyaia.cn'), 'about page contact details are incomplete')
assert(data.company.registeredAddress.includes('陆家嘴环路958号'), 'company registration/contact address should remain available')
assert(data.company.serviceCoverage === '新疆喀什地区', 'business service coverage should target Kashgar')
assert(app.includes('data.company.serviceCoverage') && !app.includes('<dt>覆盖范围</dt><dd>${escapeHtml(data.company.address)}'), 'contact and footer should use service coverage instead of the Shanghai address')
assert(app.includes('aboutMessageForm') && app.includes("referenceType: 'online_message'"), 'about page message form should submit to the backend')
assert(app.includes('function renderCommerceLogin()'), 'ecommerce login and registration page is missing')
assert(app.includes("'/api/community-auth/login'") && app.includes("'/api/community-auth/register'"), 'ecommerce account forms should use the real auth API')
assert(app.includes('commercePersonalRegisterForm') && app.includes('commerceMerchantRegisterForm'), 'registration should separate personal and merchant accounts')
for (const field of ['name="email"', 'name="captcha_code"', 'name="company_name"', 'name="business_license"', 'name="product_category"', 'name="registered_address"']) {
  assert(app.includes(field), `registration field is missing: ${field}`)
}
assert(app.includes("'/api/community-auth/captcha'") && app.includes("'/api/community-auth/register/merchant'"), 'captcha and merchant registration APIs should be connected')
assert(styles.includes('.register-kind-tabs') && styles.includes('.auth-captcha-control'), 'registration type and captcha controls should be styled')
assert(app.includes('consent auth-consent') && app.includes('我已阅读并同意'), 'registration agreement should use the compact consent layout')
assert(styles.includes('.public-auth-card input:not([type="checkbox"])') && styles.includes('label.auth-consent'), 'registration checkbox must not inherit full-width text-input styles')
assert(app.includes("pageGroup === 'login'") && app.includes("pageGroup === 'privacy'"), 'ecommerce account routes should render')
assert(app.includes("businessLink('/login')"), 'protected ecommerce pages should use ecommerce login')
const businessAccountSource = app.slice(app.indexOf('function renderAccount()'), app.indexOf('async function renderOrders()'))
for (const entry of ['我的订单', '我的收藏', '购物车', '退出登录']) {
  assert(businessAccountSource.includes(entry), `business account should include ${entry}`)
}
for (const removedEntry of ['<b>单</b>', '<b>购</b>', '<b>藏</b>', '<b>发</b>', '发布信息']) {
  assert(!businessAccountSource.includes(removedEntry), `business account should remove ${removedEntry}`)
}
assert(businessAccountSource.includes("localStorage.removeItem('knowledge_token')") && businessAccountSource.includes("localStorage.removeItem('knowledge_user')"), 'business logout should clear the local session')
assert(styles.includes('.business-account-card') && styles.includes('.business-account-links') && styles.includes('.business-account-logout'), 'business account redesign styles are incomplete')
for (const section of ['隐私政策', '服务条款', '常见问题', '售后服务']) {
  assert(shell.includes(section) && app.includes(section), `help center should include ${section}`)
}
assert(app.includes('faq-item') && app.includes('afterSalesForm'), 'help center should provide expandable questions and an after-sales form')
assert(!app.slice(app.indexOf('function renderProductDetail'), app.indexOf('function renderMachinery')).includes('相关农技培训'), 'product details should not expose public learning content')
assert(!app.slice(app.indexOf('function renderMachineryDetail'), app.indexOf('function renderTraining')).includes('相关农技培训'), 'machinery details should not expose public learning content')

assert(data.products.length >= 15, 'product catalog should include the expanded Kashgar cotton-production range')
assert(data.machinery.length >= 6, 'machinery services should remain available')
for (const category of ['seed', 'fertilizer', 'pesticide', 'film', 'irrigation']) {
  assert(data.products.some(product => product.category === category), `missing product category ${category}`)
}
for (const product of data.products) {
  assert(product.name && Number(product.price) > 0 && product.unit, `catalog product should include name, price and unit: ${product.id}`)
}
for (const name of ['塔河2号包衣棉种', '18-18-18', '70%吡虫啉', '0.010mm', '16mm×1000m']) {
  assert(dataSource.includes(name), `catalog should include common cotton production product: ${name}`)
}
for (const name of ['新陆中61号包衣棉种', '农业用尿素 46%', '磷酸二铵 64%', '棉田诱虫黄板', 'PE滴灌主管', '滴灌旁通阀']) {
  assert(dataSource.includes(name), `expanded catalog should include Kashgar cotton-production product: ${name}`)
}
const productCardSource = app.slice(app.indexOf('function productCard'), app.indexOf('function machineryCard'))
assert(productCardSource.includes('product-card-cart') && productCardSource.includes('data-cart-product'), 'product card should place the cart action over the image')
for (const removedCardContent of ['item-category', 'summary', 'tag-row', 'data-favorite-product', 'commerce-card-actions']) {
  assert(!productCardSource.includes(removedCardContent), `product card should not display ${removedCardContent}`)
}
assert(styles.includes('.product-card-cart') && styles.includes('.product-card-media'), 'product card cart overlay styles are missing')
assert(app.includes('<button class="button primary full" type="submit">登录</button>') && !app.includes('type="submit">登录川月智能</button>'), 'commerce login submit button should read 登录')
assert(app.includes('id="productQuantity"') && app.includes('data-quantity-change'), 'product detail should provide quantity selection')
assert(app.includes('data-buy-product') && app.includes('立即购买'), 'product detail should provide buy-now action')
assert(app.includes("if (!localStorage.getItem('knowledge_token'))") && app.includes('请先登录后再加入购物车'), 'adding to cart should require login')
assert(styles.includes('.quantity-stepper') && styles.includes('.product-purchase-actions'), 'product purchase controls should be styled')
assert(!dataSource.includes('不提供线上交易') && !app.includes('不提供线上交易'), 'ecommerce pages must not claim that online transactions are unavailable')
for (const text of ['在线下单', '订单确认页', '商品价']) {
  assert(app.includes(text) || dataSource.includes(text), `ecommerce transaction wording should include ${text}`)
}
for (const category of ['land', 'planting', 'protection', 'harvest', 'transport']) {
  assert(data.machinery.some(item => item.category === category), `missing machinery category ${category}`)
}

assert(app.includes('/api/products') && app.includes('/api/commerce/merchants') && app.includes('/api/commerce/listings'), 'ecommerce pages should read database-backed data')
assert(commerce.includes("router.get('/merchants'") && commerce.includes("router.get('/listings'") && commerce.includes("router.post('/listings'"), 'commerce API should support merchant and local-market pages')
assert(shell.includes('/portal/register.html?role=merchant') && shell.includes('商户入驻'), 'merchant registration should remain available')
assert(shell.includes('沪ICP备2026040489号-1'), 'ICP filing number should remain in the footer')
assert(styles.includes('@media (max-width: 820px)') && styles.includes('@media (max-width: 560px)'), 'responsive layouts are missing')

console.log('ecommerce website tests passed')
