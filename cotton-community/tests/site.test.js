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
const publicService = read('routes/public-service.js')
const academyHtml = read('public/knowledge/index.html')
const academyJs = read('public/knowledge/index.js')
const academyDetailJs = read('public/knowledge/detail.js')
const forumJs = read('public/knowledge/forum.js')

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
  "'/public/consult'",
  "'/public/experts'",
  "'/public/policies'",
  "'/public/policies/:id'",
  "'/public/pests'",
  "'/public/pests/:id'",
  "'/public/activities'",
  "'/public/activities/:id'",
  "'/business'",
  "'/business/products'",
  "'/business/products/:id'",
  "'/business/news'",
  "'/business/news/:id'",
  "'/business/about'",
  "'/business/contact'"
]) {
  assert(route.includes(routePath), `site router should include ${routePath}`)
}

assert(route.includes("router.get('/public/academy'"), 'interactive academy should belong to the public platform')
assert(route.includes("router.get('/products', redirectWithQuery('/business/products'))"), 'legacy product routes should redirect to business')
assert(route.includes("router.get('/training', redirectWithQuery('/public/training'))"), 'legacy training routes should redirect to public service')
assert(route.includes("router.get('/academy', redirectWithQuery('/public/academy'))"), 'legacy academy route should stay compatible')

assert(shell.includes('/public/') && shell.includes('/business/'), 'shared shell should expose same-domain platform entrances')
assert(shell.includes('href="/platform/admin"'), 'both subsites should expose a convenient admin entrance')
assert(app.includes('function renderHub()'), 'root page should render the dual-platform hub')
assert(app.includes('function renderPublicHome()') && app.includes('function renderBusinessHome()'), 'public and business platforms need separate home views')
assert(app.includes('function renderExperts()'), 'expert consultation should live in the public platform')
assert(app.includes('function renderPolicies()') && app.includes('function renderPests()') && app.includes('function renderActivities()'), 'public service areas should have independent views')
assert(app.includes('CONNECTED DATA') && app.includes('统一账号'), 'hub should explain shared data boundaries')
assert(app.includes('相关公益培训') && app.includes('相关商业资料'), 'the two platforms should cross-link related content')
assert(app.includes("platform === 'public'") && app.includes("platform === 'business'"), 'routing should enforce platform-specific views')
assert(app.includes('/api/public-service') && app.includes("localStorage.getItem('knowledge_token')"), 'expert consultation should reuse shared login and API data')
assert(publicService.includes('FROM experts') && publicService.includes('INSERT INTO expert_questions'), 'expert consultation should reuse shared expert tables')

const businessHome = app.slice(app.indexOf('function renderBusinessHome()'), app.indexOf('function renderProducts()'))
assert(!businessHome.includes('棉花全生育期培训'), 'business homepage must not include training')
assert(!businessHome.includes('互动学堂继续交流'), 'business homepage must not include technical consultation')
assert(businessHome.includes("item.category !== 'policy'"), 'business homepage must filter policy content into the public platform')

assert(academyHtml.includes('/public/'), 'academy should link back to the public platform')
assert(academyJs.includes('/public/detail.html'), 'academy course links should use public routes')
assert(academyDetailJs.includes('/public/detail.html'), 'related academy content should use public routes')
assert(forumJs.includes('/public/academy?view=forum'), 'forum should return to the public question area')

assert(data.products.length >= 8, 'first version should include a useful product catalog')
assert(data.training.length >= 6, 'training should cover the cotton growth cycle')
assert(data.news.length >= 6, 'news should include enough sourced content for all categories')
assert(data.pests.length >= 6, 'public platform should include a useful pest knowledge library')
assert(data.activities.length >= 4, 'public platform should include first-version public activities')
assert(data.news.filter(item => item.category === 'policy').length >= 3, 'public policy area should include enough first-version content')

for (const category of ['seed', 'fertilizer', 'pesticide', 'film', 'irrigation']) {
  assert(data.products.some(product => product.category === category), `missing product category ${category}`)
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

for (const item of data.pests) {
  assert(item.source && /^https:\/\//.test(item.sourceUrl), `pest article ${item.id} should retain its source`)
}

for (const item of data.news) {
  assert(item.source && /^https:\/\//.test(item.sourceUrl), `news item ${item.id} should retain its source`)
}

assert(app.includes('renderProductDetail') && app.includes('renderTrainingDetail') && app.includes('renderNewsDetail'), 'list pages should have working detail views')
assert(app.includes('function sourceReference(') && app.includes('查看政策原文') && app.includes('查看植保技术资料'), 'sourced content should expose original links')
assert(app.includes("localStorage.setItem('cotton-service-requests'"), 'contact form should provide a usable first-version interaction')
assert(app.includes("localStorage.setItem('cotton-public-activity-interest'"), 'public activity detail should provide a usable interest form')
assert(!shell.includes('购物车') && !app.includes('购物车') && !app.includes('/pay'), 'public website should not expose cart or payment flows')
assert(!shell.includes('0991-0000000') && !shell.includes('演示地址') && !app.includes('第一版模拟'), 'website should not publish placeholder contact or mock-content claims')
assert(!data.news.some(item => item.category === 'company'), 'business news should not invent company updates')
assert(styles.includes('@media (max-width: 820px)') && styles.includes('@media (max-width: 560px)'), 'website should include tablet and mobile layouts')
assert(styles.includes('.platform-hub') && styles.includes('.platform-gateways'), 'dual-platform hub styles are missing')
assert(styles.includes('.consultation-layout') && styles.includes('.cross-platform-band'), 'public consultation or shared content styles are missing')
assert(styles.includes('.public-sector-grid') && styles.includes('.expert-grid') && styles.includes('.activity-grid'), 'public service area styles are missing')
assert(styles.includes('/assets/product-catalog-v1.png'), 'product catalog should use the generated product photography')
assert(!styles.includes('linear-gradient'), 'website should not use gradient-based hero artwork')
assert(fs.existsSync(path.join(root, 'public/assets/product-catalog-v1.png')), 'generated product catalog image is missing')

console.log('public service website tests passed')
