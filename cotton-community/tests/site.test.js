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
  "'/business/search'",
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
for (const feature of ['commerce-carousel-slide', 'simple-core-section', 'home-campaign-section', 'campaign-countdown']) {
  assert(app.includes(feature) && styles.includes(`.${feature}`), `homepage campaign feature is missing: ${feature}`)
}
for (const control of ['data-carousel-dot', 'data-carousel-previous', 'data-carousel-next', 'data-campaign-countdown']) {
  assert(app.includes(control), `homepage campaign control is missing: ${control}`)
}
assert(app.includes('setInterval(() => showSlide(activeSlide + 1), 6000)'), 'homepage carousel should rotate automatically')
assert(styles.includes('.commerce-carousel-footer.shell') && styles.includes('left: 22px') && styles.includes('right: 22px'), 'homepage carousel arrows should align to the banner edges')
assert(app.includes('promotionEndsAt: row.promotion_ends_at') && app.includes('item.hasPromotion'), 'homepage campaigns should use approved active product promotions')
assert(app.includes('row.display_price ?? row.final_price ?? row.price'), 'active promotion price should be used on the website')
assert(!app.includes('<nav class="commerce-category-strip"'), 'homepage should not repeat the header category navigation')
assert(app.indexOf('<section class="section-block simple-core-section">') < app.indexOf('<section class="section-block home-campaign-section">'), 'core business should follow the homepage banner before product promotions')
assert(!app.includes('<section class="section-block commerce-products-section">'), 'homepage should not repeat a second product section')
for (const headerFeature of ['businessCommerceTools', 'headerGlobalSearchForm', 'all-category-menu', 'header-account-links', 'header-hot-searches']) {
  assert(shell.includes(headerFeature) || app.includes(headerFeature), `commerce header feature is missing: ${headerFeature}`)
}
assert(app.includes('category-chevron') && styles.includes('.category-chevron'), 'category menu should use a stable CSS chevron')
for (const headerLabel of ['全部分类', '农资', '农机', '病虫害', '耗材', '购物车', '个人中心', '订单', '收藏']) {
  assert(app.includes(headerLabel), `commerce header entry is missing: ${headerLabel}`)
}
const headerCategorySource = app.slice(app.indexOf('<div class="all-category-panel">'), app.indexOf('</div>', app.indexOf('<div class="all-category-panel">')))
assert(!headerCategorySource.includes('课程') && !headerCategorySource.includes('正在建设'), 'commerce categories should not show unfinished course content')
assert(app.includes('function renderGlobalSearch()') && app.includes('loadCommerceMerchants()'), 'global search should combine products and merchants')
assert(app.includes("businessLink('/search')") && app.includes("pageGroup === 'search'"), 'global search route is incomplete')
for (const block of ['simple-about-company', 'simple-about-contact', 'simple-about-message']) {
  assert(app.includes(block) && styles.includes(`.${block}`), `about page block is incomplete: ${block}`)
}
assert(app.includes('<strong>进入商品中心</strong>') && app.includes('<strong>查看生产服务</strong>'), 'core business links should use a separated action layout')
assert(styles.includes('.simple-core-grid article > a') && styles.includes('margin: 30px -42px 0'), 'core business actions should have deliberate spacing from the feature list')
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
assert(new Set(data.machinery.map(item => item.image)).size === data.machinery.length, 'each cotton production service should use a distinct image')
for (const asset of [
  'service-land-preparation-v2.jpg',
  'service-seeding-mulching-v2.jpg',
  'service-drone-protection-v2.jpg',
  'service-interrow-management-v2.jpg',
  'service-cotton-harvest-v2.jpg',
  'service-cotton-transport-v2.jpg'
]) {
  assert(fs.existsSync(path.join(root, 'public', 'assets', asset)), `generated service image is missing: ${asset}`)
}
for (const category of ['seed', 'fertilizer', 'pesticide', 'film', 'irrigation']) {
  assert(data.products.some(product => product.category === category), `missing product category ${category}`)
}
for (const product of data.products) {
  assert(product.name && Number(product.price) > 0 && product.unit, `catalog product should include name, price and unit: ${product.id}`)
}
assert(new Set(data.products.map(product => product.visual)).size === data.products.length, 'each catalog product should use a distinct generated visual')
for (const asset of ['product-catalog-a-v2.jpg', 'product-catalog-b-v2.jpg', 'product-catalog-c-v2.jpg', 'product-catalog-d-v2.jpg']) {
  assert(styles.includes(`/assets/${asset}`), `generated product catalog asset is not connected: ${asset}`)
  assert(fs.existsSync(path.join(root, 'public', 'assets', asset)), `generated product catalog asset is missing: ${asset}`)
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
assert(shell.includes('© 2026 上海川月信息科技有限公司 版权所有'), 'footer should show the legal company copyright owner')
assert(shell.includes('footer-copyright') && styles.includes('.footer-copyright'), 'footer copyright strip should use the centered dark layout')
assert(styles.includes('@media (max-width: 820px)') && styles.includes('@media (max-width: 560px)'), 'responsive layouts are missing')

console.log('ecommerce website tests passed')
