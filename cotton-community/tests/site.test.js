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
const learning = read('public/site/learning.js')
const publicModules = read('public/site/public-modules.js')
const publicService = read('routes/public-service.js')
const expertStudio = read('routes/expert-studio.js')

const context = { window: {} }
vm.runInNewContext(dataSource, context)
const data = context.window.COTTON_SITE_DATA

assert(server.includes("require('./routes/site')"), 'community should mount the public service website router')
assert(server.includes("app.use('/knowledge/site'"), 'community should serve shared website assets')
assert(server.includes("app.use('/', noCache, siteRouter)"), 'community should serve same-domain public and business subsites')

for (const routePath of [
  "'/'",
  "'/public'",
  "'/public/training'",
  "'/public/training/:id'",
  "'/public/courses'",
  "'/public/courses/:id'",
  "'/public/forum'",
  "'/public/forum/:id'",
  "'/public/login'",
  "'/public/privacy'",
  "'/public/consult'",
  "'/public/experts'",
  "'/public/experts/:id'",
  "'/public/policies'",
  "'/public/policies/:id'",
  "'/public/finance'",
  "'/public/finance/:id'",
  "'/public/machinery'",
  "'/public/machinery/:id'",
  "'/public/supplies'",
  "'/public/supplies/:id'",
  "'/public/processing'",
  "'/public/processing/:id'",
  "'/public/varieties'",
  "'/public/varieties/:id'",
  "'/public/pests'",
  "'/public/pests/:id'",
  "'/public/activities'",
  "'/public/activities/:id'",
  "'/business'",
  "'/business/products'",
  "'/business/products/:id'",
  "'/business/machinery'",
  "'/business/machinery/:id'",
  "'/business/news'",
  "'/business/news/:id'",
  "'/business/about'",
  "'/business/contact'"
]) {
  assert(route.includes(routePath), `site router should include ${routePath}`)
}

assert(route.includes("router.get('/public/academy'") && route.includes("res.redirect(301, '/public/courses')"), 'legacy academy should redirect into public courses')
assert(route.includes("router.get('/products', redirectWithQuery('/business/products'))"), 'legacy product routes should redirect to business')
assert(route.includes("router.get('/machinery', redirectWithQuery('/business/machinery'))"), 'legacy machinery routes should redirect to business')
assert(route.includes("router.get('/training', redirectWithQuery('/public/training'))"), 'legacy training routes should redirect to public service')
assert(route.includes("router.get('/academy'") && route.includes("res.redirect(301, '/public/courses')"), 'legacy academy route should stay compatible without serving the old page')

assert(shell.includes('/public/') && shell.includes('/business/'), 'shared shell should expose same-domain platform entrances')
assert(shell.includes('href="/platform/admin"') && shell.includes('业务平台登录'), 'both subsites should expose the unified business login')
assert(route.includes("router.get(['/', '/index.html'], redirectWithQuery('/public/'))"), 'community root should redirect directly to the public platform')
assert(!app.includes('function renderHub()') && !shell.includes('棉知双平台'), 'the removed dual-platform landing page must not return')
assert(app.includes('function renderPublicHome()') && app.includes('function renderBusinessHome()'), 'public and business platforms need separate home views')
assert(app.includes('function renderMachinery()') && app.includes('function renderMachineryDetail('), 'business machinery should have list and detail views')
assert(app.includes('function renderExperts()'), 'expert consultation should live in the public platform')
assert(app.includes('function renderPolicies()') && publicModules.includes('async function renderPests()') && app.includes('function renderActivities()'), 'public service areas should have independent views')
assert(app.includes("pageGroup === 'courses'") && app.includes("pageGroup === 'forum'") && app.includes("pageGroup === 'login'"), 'integrated public learning routes should be rendered by the shared shell')
assert(app.includes('相关农技培训') && app.includes('相关商业资料'), 'the two platforms should cross-link related content')
assert(app.includes("platform === 'public'") && app.includes("platform === 'business'"), 'routing should enforce platform-specific views')
assert(app.includes('/api/public-service') && app.includes("localStorage.getItem('knowledge_token')"), 'expert consultation should reuse shared login and API data')
assert(publicService.includes('FROM experts') && publicService.includes('INSERT INTO expert_questions'), 'expert consultation should reuse shared expert tables')

const businessHome = app.slice(app.indexOf('function renderBusinessHome()'), app.indexOf('function renderProducts()'))
assert(!businessHome.includes('棉花全生育期培训'), 'business homepage must not include training')
assert(!businessHome.includes('带着田间问题继续交流'), 'business homepage must not include technical consultation')
assert(businessHome.includes("item.category !== 'policy'"), 'business homepage must filter policy content into the public platform')
assert(businessHome.includes('农资供应') && businessHome.includes('农机服务') && businessHome.includes('数字履约'), 'business homepage should explain the core business chain')

assert(shell.includes('/knowledge/site/learning.js'), 'shared site should load integrated course and forum behavior')
assert(shell.includes('/knowledge/site/public-modules.js'), 'shared site should load database-backed public service modules')
assert(learning.includes('renderCourses') && learning.includes('renderCourseDetail') && learning.includes('renderForum') && learning.includes('renderForumDetail') && learning.includes('renderLogin'), 'public learning views should be feature complete')
for (const renderer of ['renderPolicies', 'renderExperts', 'renderFinance', 'renderPests', 'renderProducts', 'renderProcessing', 'renderVarieties']) {
  assert(publicModules.includes(renderer), `database-backed website module is missing ${renderer}`)
}
for (const endpoint of ['/api/policies', '/api/expert-studio/public', '/api/service-products', '/api/processing-factories', '/api/cotton-varieties', '/api/pest-knowledge']) {
  assert(publicModules.includes(endpoint), `public website should read shared endpoint ${endpoint}`)
}
assert(expertStudio.includes("router.get('/public'") && expertStudio.includes("router.get('/public/:id'"), 'expert studio should expose published content to the website')
assert(app.includes("pageGroup === 'finance'") && app.includes("pageGroup === 'processing'") && app.includes("pageGroup === 'varieties'"), 'public module routes should be rendered inside the website shell')
assert(learning.includes('/public/courses') || learning.includes("publicLink('/courses"), 'course links should stay inside the public platform')
assert(!app.includes('图文课程 / 登录'), 'courses and login must not share one header action')

assert(data.products.length >= 8, 'first version should include a useful product catalog')
assert(data.machinery.length >= 6, 'business platform should include the main cotton machinery services')
assert(data.training.length >= 6, 'training should cover the cotton growth cycle')
assert(data.news.length >= 6, 'news should include enough sourced content for all categories')
assert(data.activities.length >= 4, 'public platform should include first-version public activities')
assert(data.news.filter(item => item.category === 'policy').length >= 3, 'public policy area should include enough first-version content')

for (const category of ['seed', 'fertilizer', 'pesticide', 'film', 'irrigation']) {
  assert(data.products.some(product => product.category === category), `missing product category ${category}`)
}

for (const category of ['land', 'planting', 'protection', 'harvest', 'transport']) {
  assert(data.machinery.some(item => item.category === category), `missing machinery category ${category}`)
}

for (const category of ['planting', 'seedling', 'water', 'pest', 'boll', 'harvest']) {
  assert(data.training.some(article => article.category === category), `missing training category ${category}`)
}

for (const category of ['policy', 'industry', 'quality']) {
  assert(data.news.some(article => article.category === category), `missing news category ${category}`)
}

for (const article of data.training) {
  assert(article.source && /^https:\/\//.test(article.sourceUrl), `training article ${article.id} should retain its source`)
}

for (const item of data.news) {
  assert(item.source && /^https:\/\//.test(item.sourceUrl), `news item ${item.id} should retain its source`)
}

assert(app.includes('renderProductDetail') && app.includes('renderMachineryDetail') && app.includes('renderTrainingDetail') && app.includes('renderNewsDetail'), 'list pages should have working detail views')
assert(app.includes('function sourceReference(') && app.includes('查看政策原文') && publicModules.includes('查看来源 →'), 'sourced content should expose original links')
assert(app.includes("publicServiceRequest('/business-inquiries'"), 'business contact form should submit a real service request')
assert(app.includes("publicServiceRequest('/activity-interests'"), 'public activity detail should submit a real interest request')
assert(publicService.includes("router.post('/business-inquiries'") && publicService.includes("router.post('/activity-interests'"), 'public service API should persist both request types')
assert(publicService.includes("router.post('/privacy-requests'") && publicService.includes("'privacy'"), 'logged-in users should be able to submit personal data requests')
assert(publicService.includes('INSERT INTO community_service_requests'), 'service requests should be saved in the shared database')
assert(publicService.includes("'农机服务'") && app.includes('referenceType'), 'machinery inquiries should use the real business request flow')
assert(!app.includes('保存需求到本机') && !app.includes('保存参与意向到本机') && !app.includes('仅保存在当前设备'), 'production forms should not behave like local-only demos')
assert(!learning.includes('课程直接归入公益平台') && !app.includes('已归入公益平台'), 'visitor-facing copy should not expose internal platform migration wording')
assert(!app.includes('公益平台') && !learning.includes('公益平台') && !shell.includes('公益平台'), 'visitor-facing platform name should consistently use public service platform')
assert(!shell.includes('购物车') && !app.includes('购物车') && !app.includes('/pay'), 'public website should not expose cart or payment flows')
assert(!shell.includes('0991-0000000') && !shell.includes('演示地址') && !app.includes('第一版模拟'), 'website should not publish placeholder contact or mock-content claims')
assert(!data.news.some(item => item.category === 'company'), 'business news should not invent company updates')
assert(styles.includes('@media (max-width: 820px)') && styles.includes('@media (max-width: 560px)'), 'website should include tablet and mobile layouts')
assert(!styles.includes('.platform-hub') && !styles.includes('.platform-gateways'), 'removed dual-platform landing styles should not remain')
assert(styles.includes('.consultation-layout') && styles.includes('.cross-platform-band'), 'public consultation or shared content styles are missing')
assert(styles.includes('.public-sector-grid') && styles.includes('.expert-grid') && styles.includes('.activity-grid'), 'public service area styles are missing')
assert(styles.includes('.machinery-grid') && styles.includes('.machinery-flow') && styles.includes('.business-pillar-grid'), 'business machinery or core business styles are missing')
assert(styles.includes('.learning-course-grid') && styles.includes('.public-auth-layout') && styles.includes('.forum-page-layout'), 'integrated course, login and forum styles are missing')
assert(styles.includes('/assets/product-catalog-v1.png'), 'product catalog should use the generated product photography')
assert(!styles.includes('linear-gradient'), 'website should not use gradient-based hero artwork')
assert(fs.existsSync(path.join(root, 'public/assets/product-catalog-v1.png')), 'generated product catalog image is missing')
for (const asset of ['business-machinery-v1.jpg', 'business-drone-service-v1.jpg']) {
  const assetPath = path.join(root, 'public/assets', asset)
  assert(fs.existsSync(assetPath) && fs.statSync(assetPath).size > 100000, `business asset ${asset} is missing or too small`)
}

console.log('public service website tests passed')
