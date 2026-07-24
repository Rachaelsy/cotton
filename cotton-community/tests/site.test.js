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

const context = { window: {} }
vm.runInNewContext(dataSource, context)
const data = context.window.COTTON_SITE_DATA

assert(server.includes("require('./routes/site')"), 'community should mount the public service website router')
assert(server.includes("app.use('/knowledge/site'"), 'community should serve shared website assets')

for (const routePath of [
  "'/'",
  "'/products'",
  "'/products/:id'",
  "'/training'",
  "'/training/:id'",
  "'/news'",
  "'/news/:id'",
  "'/about'",
  "'/contact'"
]) {
  assert(route.includes(routePath), `site router should include ${routePath}`)
}

assert(route.includes("router.get('/academy'"), 'existing interactive academy should remain available')
assert(shell.includes('/knowledge/products') && shell.includes('/knowledge/training'), 'primary navigation should expose products and training')
assert(shell.includes('/knowledge/news') && shell.includes('/knowledge/about'), 'primary navigation should expose news and about pages')
assert(shell.includes('/knowledge/contact') && shell.includes('/knowledge/academy'), 'website should expose contact and interactive learning')

assert(data.products.length >= 8, 'first version should include a useful product catalog')
assert(data.training.length >= 6, 'training should cover the cotton growth cycle')
assert(data.news.length >= 6, 'news should include enough mock content for all categories')

for (const category of ['seed', 'fertilizer', 'pesticide', 'film', 'irrigation']) {
  assert(data.products.some(product => product.category === category), `missing product category ${category}`)
}

for (const category of ['planting', 'seedling', 'water', 'pest', 'boll', 'harvest']) {
  assert(data.training.some(article => article.category === category), `missing training category ${category}`)
}

for (const category of ['policy', 'industry', 'company']) {
  assert(data.news.some(article => article.category === category), `missing news category ${category}`)
}

assert(app.includes('renderProductDetail') && app.includes('renderTrainingDetail') && app.includes('renderNewsDetail'), 'list pages should have working detail views')
assert(app.includes("localStorage.setItem('cotton-service-requests'"), 'contact form should provide a usable first-version interaction')
assert(!shell.includes('购物车') && !app.includes('购物车') && !app.includes('/pay'), 'public website should not expose cart or payment flows')
assert(styles.includes('@media (max-width: 820px)') && styles.includes('@media (max-width: 560px)'), 'website should include tablet and mobile layouts')
assert(styles.includes('/assets/product-catalog-v1.png'), 'product catalog should use the generated product photography')
assert(!styles.includes('linear-gradient'), 'website should not use gradient-based hero artwork')
assert(fs.existsSync(path.join(root, 'public/assets/product-catalog-v1.png')), 'generated product catalog image is missing')

console.log('public service website tests passed')
