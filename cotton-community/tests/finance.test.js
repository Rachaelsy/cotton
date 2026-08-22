const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const repo = path.resolve(root, '..')
const read = file => fs.readFileSync(path.join(repo, file), 'utf8')

const appJson = JSON.parse(read('cotton-public/app.json'))
assert(appJson.pages.includes('pages/finance/index'))
assert(appJson.pages.includes('pages/finance/channel'))
assert(appJson.pages.includes('pages/finance/detail'))

const home = read('cotton-public/pages/finance/index.wxml')
const homeJs = read('cotton-public/pages/finance/index.js')
const channel = read('cotton-public/pages/finance/channel.wxml')
const channelJs = read('cotton-public/pages/finance/channel.js')
const data = read('cotton-public/utils/finance-data.js')
const policiesRoute = read('cotton-community/routes/policies.js')
const policyAdmin = read('cotton-community/public/knowledge/policy-admin.html')
const publicModules = read('cotton-community/public/site/public-modules.js')
const server = read('cotton-community/server.js')
const nginx = read('deploy/nginx.conf')
const compose = read('docker-compose.yml')
const envExample = read('.env.example')
const communityEnvExample = read('cotton-community/.env.example')

assert(home.includes('优棉金融'))
assert(home.includes('金融知识导航'))
assert(home.includes('不展示期货行情'))
assert(!home.includes('期货实时行情'))
assert(!homeJs.includes('/api/market'))
assert(!homeJs.includes('setInterval'))

for (const label of ['种植贷', '棉花保险', '期货基础', '金融政策解读']) {
  assert(data.includes(`title: '${label}'`), `missing finance module ${label}`)
}

assert(channel.includes('article-body') && channel.includes('评论') && channel.includes('收藏') && channel.includes('class="action-group"') && !channel.includes('办理与学习路径'), 'each finance topic should open as one clean article page with right-aligned actions')
assert(channelJs.includes('/api/policies?type=finance&section=') && channelJs.includes('markdownToRichTextNodes'), 'finance article pages should load editable Markdown from the backend')
assert(policiesRoute.includes("new Set(['loan', 'insurance', 'futures', 'finance-policy'])"), 'the article API should validate all four finance topics')
assert(policyAdmin.includes('id="financePanel"') && policyAdmin.includes('id="homepagePanel"'), 'admin should provide finance editing and homepage curation panels')

assert(!server.includes("app.use('/api/market'"), 'the retired quote API must not be mounted')
assert(!nginx.includes('/api/market/'), 'nginx must not expose the retired quote API')
assert(!compose.includes('FINANCE_QUOTE') && !compose.includes('TUSHARE_TOKEN'), 'compose must not pass quote-provider credentials')
assert(!envExample.includes('FINANCE_QUOTE') && !envExample.includes('TUSHARE_TOKEN'), 'the root environment template must not advertise quote providers')
assert(!communityEnvExample.includes('FINANCE_QUOTE') && !communityEnvExample.includes('TUSHARE_TOKEN'), 'the community environment template must not advertise quote providers')
assert(!publicModules.includes('/api/market') && !publicModules.includes('finance-quote'), 'the public website must not request or render futures quotes')
assert(publicModules.includes('不展示行情'), 'the public website should state the finance service boundary')

console.log('Youmian finance tests passed')
