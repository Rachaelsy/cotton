const assert = require('assert')
const fs = require('fs')
const path = require('path')

const communityRoot = path.resolve(__dirname, '..')
const miniRoot = path.resolve(communityRoot, '..', 'cotton-public')
const readCommunity = file => fs.readFileSync(path.join(communityRoot, file), 'utf8')
const readMini = file => fs.readFileSync(path.join(miniRoot, file), 'utf8')

const migrate = readCommunity('db/migrate.js')
const route = readCommunity('routes/cotton-varieties.js')
const server = readCommunity('server.js')
const nginx = fs.readFileSync(path.resolve(communityRoot, '..', 'deploy/nginx.conf'), 'utf8')
const adminHtml = readCommunity('public/knowledge/policy-admin.html')
const adminJs = readCommunity('public/knowledge/variety-admin.js')
const app = JSON.parse(readMini('app.json'))
const homeJs = readMini('pages/index/index.js')
const homeWxml = readMini('pages/index/index.wxml')
const indexJs = readMini('pages/varieties/index.js')
const indexWxml = readMini('pages/varieties/index.wxml')
const detailJs = readMini('pages/varieties/detail.js')
const detailWxml = readMini('pages/varieties/detail.wxml')

assert(migrate.includes('CREATE TABLE IF NOT EXISTS community_cotton_varieties'), 'migration should create an independent cotton variety trial table')
for (const field of ['lint_percent','fiber_length_mm','fiber_strength_cn_tex','micronaire_value','uniformity_percent','seed_cotton_yield_kg_mu','weighted_total','overall_rank']) {
  assert(migrate.includes(field), `variety table should include ${field}`)
}
assert(migrate.includes("['HD258',41.3,17,2.55,31.4,1,0.2,34.1,3,0.6,4,1,0.1,86.5,1,0.2,496.2,1,0.15,3.8,1]"), 'the first-ranked HD258 row should match the 2025 source workbook')
assert(migrate.includes("['前海211',47.8,1") && migrate.includes("['禾春洲10号',46.9,2"), 'lint rankings should preserve the supplied 2025 trial values')
assert(migrate.includes('2025年喀什地区棉花品种对比试验各项指标统计表'), 'seed records should preserve the workbook source name')

assert(route.includes("WHERE status='published'") && route.includes('SORT_SQL'), 'public API should only expose published rows and provide controlled sorting')
assert(route.includes('AS trial_count') && detailJs.includes('source.trialCount'), 'detail ranking bars should use the actual trial size for the selected year')
assert(route.includes("router.get('/admin/list'") && route.includes("router.post('/admin'") && route.includes("router.put('/admin/:id'"), 'authenticated admin API should support full variety maintenance')
assert(route.includes("router.patch('/admin/:id/status'") && route.includes("router.delete('/admin/:id'"), 'admin API should support publishing and deletion')
assert(server.includes("app.use('/api/cotton-varieties'"), 'community server should mount the variety API')
assert(nginx.includes('location ^~ /api/cotton-varieties/') && nginx.includes('location = /api/cotton-varieties'), 'production Nginx should proxy variety list and detail APIs')

assert(adminHtml.includes('data-view="varieties"') && adminHtml.includes('id="varietyPanel"') && adminHtml.includes('id="varietyYield"'), 'public admin should expose a dedicated variety management panel')
assert(adminHtml.includes('/knowledge/variety-admin.js') && adminJs.includes('/api/cotton-varieties'), 'admin interface should load and edit database-backed variety records')
assert(adminJs.includes('ranks.lint * .15') && adminJs.includes('ranks.length * .2') && adminJs.includes('ranks.yield * .15'), 'admin should keep the supplied indicator weights auditable')

assert(app.pages.includes('pages/varieties/index') && app.pages.includes('pages/varieties/detail'), 'variety list and detail pages should be registered')
assert(homeJs.includes("varieties: '/pages/varieties/index'") && homeWxml.includes('data-type="varieties"') && homeWxml.includes('品种优选'), 'production services should link to variety selection')
assert(indexJs.includes('/api/cotton-varieties?sort=') && detailJs.includes('`/api/cotton-varieties/${this.varietyId}`'), 'mini program pages should load variety data from the backend')
for (const label of ['综合名次','产量名次','品质名次','衣分名次']) {
  assert(indexJs.includes(label), `variety list should expose the selected ${label}`)
}
assert(indexJs.includes('decorateForSort') && indexJs.includes('qualityScore') && indexWxml.includes('item.displayRank') && !indexWxml.includes('item.overallRank'), 'list cards should display the active metric rank instead of always showing overall rank')
for (const label of ['衣分','纤维长度','断裂比强度','马克隆值','整齐度','籽棉产量']) {
  assert(`${detailJs}\n${detailWxml}`.includes(label), `detail page should display ${label}`)
}
assert(`${indexJs}\n${indexWxml}`.includes('数值越低、综合名次越靠前') && detailWxml.includes('不构成种子审定、销售推荐或产量承诺'), 'mini program should explain ranking direction and decision boundaries')
assert(!indexWxml.includes('.slice(') && !detailWxml.includes('.slice('), 'variety WXML should avoid fragile method calls in bindings')

console.log('cotton variety selection tests passed')
