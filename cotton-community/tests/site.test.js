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
const publicService = read('routes/public-service.js')

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
  "'/business/machinery/:id'", "'/business/merchants'", "'/business/merchants/:id'", "'/business/academy'", "'/business/academy/:id'", "'/business/local'",
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
assert(app.includes('hero-merchant-button') && app.includes('入驻商家专区') && app.includes("businessLink('/merchants')"), 'homepage banner should link to the settled merchant area')
assert(app.includes("index === 0 ? `<a class=\"button hero-merchant-button\""), 'merchant-area button should only appear on the first homepage slide')
assert(styles.includes('.hero-merchant-button'), 'homepage merchant-area button should be styled')
const merchantButtonStyles = styles.slice(styles.indexOf('.commerce-carousel-slide .hero-actions .hero-merchant-button'), styles.indexOf('.commerce-carousel-slide .hero-actions .hero-merchant-button:hover'))
assert(merchantButtonStyles.includes('border-color: transparent') && !merchantButtonStyles.includes('rgba(255, 255, 255'), 'merchant-area button should not use a white outline')
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
assert(app.includes('<strong>进入官方商城</strong>') && app.includes('<strong>查看生产服务</strong>'), 'core business links should use a separated action layout')
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
  assert(product.name && (Number(product.price) > 0 || product.pricePending) && product.unit, `catalog product should include name, price status and unit: ${product.id}`)
  assert(product.merchantId && product.merchantName, `catalog product should be assigned to a merchant: ${product.id}`)
}
const featuredMerchantIds = [
  'demo-xinjiang-chuanyue',
  'demo-guizhou-guolin-tianhua',
  'demo-xinjiang-wanxiangle',
  'dupont-shandong-agriculture'
]
for (const merchantId of featuredMerchantIds) {
  const expectedCount = merchantId === 'demo-guizhou-guolin-tianhua' ? 7 : merchantId === 'dupont-shandong-agriculture' ? 6 : merchantId === 'demo-xinjiang-chuanyue' ? 5 : 3
  assert(data.products.filter(product => product.merchantId === merchantId).length === expectedCount, `merchant catalog product count is incorrect: ${merchantId}`)
}
assert(new Set(data.products.map(product => product.visual)).size === data.products.length, 'each catalog product should use a distinct generated visual')
for (const asset of ['product-catalog-a-v2.jpg', 'product-catalog-b-v2.jpg', 'product-catalog-c-v2.jpg', 'product-catalog-d-v2.jpg']) {
  assert(styles.includes(`/assets/${asset}`), `generated product catalog asset is not connected: ${asset}`)
  assert(fs.existsSync(path.join(root, 'public', 'assets', asset)), `generated product catalog asset is missing: ${asset}`)
}
for (const asset of ['guolin-zi-qi-dong-lai-clean.png', 'guolin-zi-qi-dong-lai-5-9-38-clean.png', 'guolin-mei-dang-jia-clean.png', 'guolin-mei-dang-jia-8-35-12-clean.png', 'guolin-lei-bo-shi-clean.png', 'guolin-youmian-shiliujin-clean.png', 'guolin-medium-elements-clean.png']) {
  assert(fs.existsSync(path.join(root, 'public', 'assets', asset)), `brochure product image is missing: ${asset}`)
  assert(data.products.some(product => product.image === `/assets/${asset}`), `brochure product image is not connected: ${asset}`)
}
for (const asset of ['dupont-leaf-vitality-1kg.jpg', 'dupont-water-soluble-11-9-36.jpg', 'dupont-microalgae-amino-acids.jpg', 'dupont-polypeptide-fish-protein.jpg', 'dupont-water-soluble-10-40-10.jpg', 'dupont-nengduojian-20kg.jpg']) {
  assert(fs.existsSync(path.join(root, 'public', 'assets', asset)), `Dupont product image is missing: ${asset}`)
  assert(data.products.some(product => product.image === `/assets/${asset}`), `Dupont product image is not connected: ${asset}`)
}
for (const asset of ['chuanyue-tahe-2-seed-v2.png', 'chuanyue-xinluzhong-61-seed.png', 'chuanyue-yuanmian-8-seed.png', 'chuanyue-xinluzhong-66-seed.png', 'chuanyue-yellow-sticky-trap.png', 'wanxiangle-mulch-film-v2.png', 'wanxiangle-drip-tape-v2.png', 'wanxiangle-pe-main-pipe-v2.png']) {
  assert(fs.existsSync(path.join(root, 'public', 'assets', asset)), `merchant product image is missing: ${asset}`)
  assert(data.products.some(product => product.image === `/assets/${asset}`), `merchant product image is not connected: ${asset}`)
}
for (const name of ['塔河2号包衣棉种', '紫气东来', '美当家', '蕾博士', '优棉十六金', '中量元素水溶肥料', '叶面生命素', '0.010mm', '16mm×1000m']) {
  assert(dataSource.includes(name), `catalog should include common cotton production product: ${name}`)
}
for (const name of ['新陆中61号包衣棉种', '源棉8号包衣棉种', '新陆中66号包衣棉种', '棉田诱虫黄板', 'PE滴灌主管', '微藻氨基酸', '多肽鱼蛋白', '能多健']) {
  assert(dataSource.includes(name), `expanded catalog should include Kashgar cotton-production product: ${name}`)
}
for (const brochureProduct of ['10-33-13+TE', '5-9-38+TE', '8-35-12+TE', '5-10-36+TE', '微量元素总量']) {
  assert(dataSource.includes(brochureProduct), `Guolin Tianhua brochure product details are missing: ${brochureProduct}`)
}
for (const [productId, expectedPrice] of [['balanced-cotton-fertilizer', 150], ['ziqi-high-potassium-5-9-38', 115], ['meidangjia-high-phosphorus-8-35-12', 142.5], ['seedling-water-soluble-fertilizer', 102.5], ['leiboshi-youmian-shiliujin', 45], ['diammonium-phosphate-64', 40], ['leiboshi-medium-element-fertilizer', 72]]) {
  assert(data.products.find(product => product.id === productId)?.price === expectedPrice, `converted brochure price is incorrect: ${productId}`)
}
for (const [productId, expectedPrice] of [['dupont-leaf-vitality-1kg', 50], ['dupont-water-soluble-11-9-36', 140], ['dupont-microalgae-amino-acids-500ml', 40], ['dupont-polypeptide-fish-protein-10kg', 260], ['dupont-water-soluble-10-40-10', 140], ['dupont-nengduojian-20kg', 220]]) {
  const product = data.products.find(item => item.id === productId)
  assert(product?.price === expectedPrice && !product.priceEstimated, `Dupont confirmed product price is incorrect: ${productId}`)
}
for (const [productId, expectedPrice] of [['yuanmian-8-cotton-seed', 640], ['xinluzhong-66-cotton-seed', 600]]) {
  const product = data.products.find(item => item.id === productId)
  assert(product?.price === expectedPrice && product.priceEstimated && !product.pricePending, `estimated cotton seed price is incorrect: ${productId}`)
}
assert(!data.products.some(product => product.pricePending), 'official mall should not contain products with pending prices')
const productCardSource = app.slice(app.indexOf('function productCard'), app.indexOf('function machineryCard'))
assert(productCardSource.includes('product-card-cart') && productCardSource.includes('data-cart-product'), 'product card should place the cart action over the image')
for (const removedCardContent of ['item-category', 'summary', 'tag-row', 'data-favorite-product', 'commerce-card-actions']) {
  assert(!productCardSource.includes(removedCardContent), `product card should not display ${removedCardContent}`)
}
assert(styles.includes('.product-card-cart') && styles.includes('.product-card-media'), 'product card cart overlay styles are missing')
assert(app.includes('价格待商家确认') && styles.includes('.commerce-price.pending'), 'products without confirmed prices should show a clear pending-price state')
assert(app.includes('<button class="button primary full" type="submit">登录</button>') && !app.includes('type="submit">登录川月智能</button>'), 'commerce login submit button should read 登录')
assert(app.includes('id="productQuantity"') && app.includes('data-quantity-change'), 'product detail should provide quantity selection')
assert(app.includes('data-buy-product') && app.includes('立即购买'), 'product detail should provide buy-now action')
assert(app.includes("if (!localStorage.getItem('knowledge_token'))") && app.includes('请先登录后再加入购物车'), 'adding to cart should require login')
assert(app.includes('protectedBusinessLink(link(`/contact?machine=${item.id}`))'), 'service consultation should redirect guests to login')
assert(app.includes('protectedBusinessLink(link(`/contact?product=${item.id}`))'), 'product consultation should redirect guests to login')
assert(publicService.includes("router.post('/business-inquiries', consultationAuth"), 'consultation API should enforce authentication')
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
assert(app.includes('data-nav="products">官方商城</a>') && app.includes('data-nav="merchants">入驻商家</a>'), 'header should separate the official store and settled merchant directory')
assert(!app.includes('data-nav="store">官方商城</a>'), 'header should not repeat the official store link')
assert(app.includes(`<a href="${'${link(\'/products\')}'}">官方商城</a>`) && app.includes('返回官方商城'), 'product detail breadcrumb and return action should use official store naming')
assert(!app.includes('>农资产品</a>') && !app.includes('浏览农资产品') && !app.includes('返回产品列表'), 'store entry labels should not use stale product-center naming')
assert(app.includes("setMeta('入驻商家'") && app.includes("pageHero('MERCHANT DIRECTORY', '入驻商家'"), 'merchant directory should be presented as the merchant directory page')
assert(app.includes('data-nav="academy">优棉学堂</a>') && app.includes("pageGroup === 'academy'"), 'header should link to Youmian Academy')
for (const academyFeature of ['academy-path-section', 'academy-tutorial-section', 'academy-guidance-band']) {
  assert(app.includes(academyFeature) && styles.includes(`.${academyFeature}`), `Youmian Academy feature is missing: ${academyFeature}`)
}
assert(app.includes('棉花种植图文教程'), 'Youmian Academy should present its illustrated tutorial section')
assert(data.training.length >= 6 && new Set(data.training.map(item => item.image)).size === data.training.length, 'Youmian Academy should provide distinct illustrated cotton tutorials')
assert(data.training.every(item => item.source && item.sourceUrl && item.sections.length && item.checklist.length), 'each tutorial should include sources, illustrated content and a field checklist')
assert(!app.includes('相关商业资料') && !app.includes('CONNECTED PRODUCTS'), 'Youmian Academy should not contain commercial product recommendations')
assert(shell.includes('/portal/register.html?role=merchant') && shell.includes('商户入驻'), 'merchant registration should remain available')
assert(shell.includes('/assets/chuanyue-logo.png') && !shell.includes('<span class="brand-mark">棉</span>'), 'header should use the ChuanYue logo instead of the text mark')
for (const merchantFeature of ['settled-merchants-section', 'settled-merchant-grid', 'merchantProfileCard', '进入商家主页', '商家入驻']) {
  assert(app.includes(merchantFeature), `home settled merchant section is missing: ${merchantFeature}`)
}
assert(!app.includes('<section class="section-block official-store-section">'), 'homepage should not repeat a standalone official store banner')
assert(app.includes('>进入官方商城</a>`)}'), 'selected products should link to the official store')
const merchantDetailSource = app.slice(app.indexOf('async function renderMerchantDetail'), app.indexOf('async function renderLocalMarket'))
assert(merchantDetailSource.includes('merchant-store-hero') && merchantDetailSource.includes('merchant-store-grid'), 'merchant storefront page should be available')
assert(merchantDetailSource.includes('merchantProducts.map(productCard)') && !merchantDetailSource.includes('merchant-profile-about'), 'merchant storefront should focus on the assigned product catalog instead of the company profile')
assert(styles.includes('.merchant-store-hero') && styles.includes('.merchant-store-products'), 'merchant storefront layout styles are missing')
for (const merchantName of ['新疆川月农业科技有限公司', '贵州国磷天化化工（集团）有限公司', '新疆万祥乐农资有限公司', '杜邦(山东)农业科技有限公司']) {
  assert(commerce.includes(merchantName), `featured merchant is missing: ${merchantName}`)
}
for (const removedMerchantName of ['喀什爱洋农资有限公司', '喀什众友农资销售有限公司']) {
  assert(!commerce.includes(removedMerchantName) && !dataSource.includes(removedMerchantName), `removed merchant should not remain: ${removedMerchantName}`)
}
assert(!commerce.includes('演示字段（不可联系）'), 'confirmed merchant contacts should remain public')
for (const merchantContact of ['奴尔艾力', '13899188660', '梁枫', '18999702088', '唐继军', '18701971977', '周建防', '15305382000']) {
  assert(commerce.includes(merchantContact), `merchant authorized contact is missing: ${merchantContact}`)
}
assert(commerce.includes("name: '新疆川月农业科技有限公司'") && commerce.includes("contactName: '唐继军'\n    phone: '18701971977'".replace("'\n", "',\n")), 'Xinjiang ChuanYue contact mapping is incorrect')
assert(commerce.includes("name: '新疆万祥乐农资有限公司'") && commerce.includes("contactName: '奴尔艾力'\n    phone: '13899188660'".replace("'\n", "',\n")), 'Xinjiang Wanxiangle contact mapping is incorrect')
assert(commerce.includes("name: '贵州国磷天化化工（集团）有限公司'") && commerce.includes("contactName: '梁枫'\n    phone: '18999702088'".replace("'\n", "',\n")), 'Guizhou Guolin Tianhua contact mapping is incorrect')
assert(commerce.includes("name: '杜邦(山东)农业科技有限公司'") && commerce.includes("contactName: '周建防'\n    phone: '15305382000'".replace("'\n", "',\n")), 'Dupont Shandong contact mapping is incorrect')
assert(app.includes('浏览已确认合作商家和经营品类资料'), 'merchant directory should describe the confirmed partner list')
for (const realMerchantId of ['demo-xinjiang-chuanyue', 'demo-guizhou-guolin-tianhua', 'demo-xinjiang-wanxiangle', 'dupont-shandong-agriculture']) {
  const start = commerce.indexOf(`id: '${realMerchantId}'`)
  const record = commerce.slice(start, commerce.indexOf('\n  },', start))
  assert(record.includes('demo: false'), `confirmed merchant should not be marked as demonstration data: ${realMerchantId}`)
}
for (const merchantIntro of ['专注于智慧棉花生产管理', '围绕农业肥料和生产投入品开展业务', '面向莎车县及周边农业生产经营者', '围绕农业种植中的养分补充与土壤管理需求']) {
  assert(commerce.includes(merchantIntro), `merchant company profile is missing: ${merchantIntro}`)
}
assert(!commerce.includes('本条用于演示') && !commerce.includes('本页面仅演示商家资料展示能力'), 'company profiles should not contain interface demonstration filler copy')
assert(styles.includes('.settled-merchant-card .merchant-card-heading{min-height:76px') && styles.includes('.settled-merchant-card>p{min-height:120px'), 'merchant card headings and profile separators should align')
assert(styles.includes('grid-template-rows:52px 52px 94px') && styles.includes('.merchant-card-details>div:last-child{align-items:start'), 'merchant contact, phone and address divider rows should align')
assert(!app.includes('<div><small>${escapeHtml(item.category)}</small><h3>'), 'merchant cards should not show the small category label above the company name')
for (const merchantAddress of ['绿地八方城B-3-2013号商铺', '贵阳世纪城X组团1-5栋', '米卡姆北路426号', '山东省菏泽市北部经济开发区衡山路7号']) {
  assert(commerce.includes(merchantAddress), `merchant supplied address is missing: ${merchantAddress}`)
}
for (const field of ['contactName', 'phone', 'email', 'intro']) {
  assert(commerce.includes(field), `merchant public profile field is missing: ${field}`)
}
assert(shell.includes('沪ICP备2026040489号-1'), 'ICP filing number should remain in the footer')
assert(shell.includes('© 2026 上海川月信息科技有限公司 版权所有'), 'footer should show the legal company copyright owner')
assert(['公司简介', '业务范围', '帮助中心', '联系方式'].every((item) => shell.includes(item)), 'footer should provide the four requested information columns')
assert(shell.includes('lijiale@cyaia.cn') && shell.includes('021-66286003') && shell.includes('华能联合大厦3403A'), 'footer should show the configured company contact details')
assert(!shell.includes('href="tel:021-66286003"') && !shell.includes('href="mailto:lijiale@cyaia.cn"'), 'footer phone and email should be plain text instead of clickable links')
assert(shell.includes('footer-copyright') && styles.includes('.footer-copyright'), 'footer copyright strip should use the centered dark layout')
assert(styles.includes('@media (max-width: 820px)') && styles.includes('@media (max-width: 560px)'), 'responsive layouts are missing')

console.log('ecommerce website tests passed')
