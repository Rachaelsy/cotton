const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const repo = path.resolve(root, '..')
const read = file => fs.readFileSync(path.join(repo, file), 'utf8')
const marketRoute = require('../routes/market')

const sample = 'var hq_str_nf_CF0="棉花连续,102203,13500,13620,13410,13470,13560,13580,13580,13540,13480,2,4,70851,426879,郑州商品交易所,棉花,2026-08-13";'
const quote = marketRoute.parseSinaQuote(sample, new Date('2026-08-13T02:22:05.000Z'))
assert.equal(quote.symbol, 'CF0')
assert.equal(quote.price, 13580)
assert.equal(quote.previousSettlement, 13480)
assert.equal(quote.change, 100)
assert.equal(quote.changePercent, 0.74)
assert.equal(quote.providerTime, '2026-08-13 10:22:03')
assert.equal(quote.open, 13500)
assert.equal(quote.high, 13620)
assert.equal(quote.low, 13410)
assert.equal(quote.available, true)

const appJson = JSON.parse(read('cotton-public/app.json'))
assert(appJson.pages.includes('pages/finance/index'))
assert(appJson.pages.includes('pages/finance/channel'))
assert(appJson.pages.includes('pages/finance/detail'))

const home = read('cotton-public/pages/finance/index.wxml')
const homeJs = read('cotton-public/pages/finance/index.js')
const channel = read('cotton-public/pages/finance/channel.wxml')
const data = read('cotton-public/utils/finance-data.js')
const server = read('cotton-community/server.js')
const nginx = read('deploy/nginx.conf')

assert(home.includes('优棉金融') && homeJs.includes("contract: '棉花主力连续'"))
assert(homeJs.includes("'/api/market/cotton-futures'"))
assert(homeJs.includes('setInterval') && homeJs.includes('30000'))
for (const label of ['种植贷', '棉花保险', '期货基础', '金融政策解读']) {
  assert(data.includes(`title: '${label}'`), `missing finance module ${label}`)
}
assert(channel.includes('办理与学习路径') && channel.includes('专题内容'))
assert(server.includes("app.use('/api/market', require('./routes/market'))"))
assert(nginx.includes('location ^~ /api/market/'))
assert(!home.includes('非实时行情'))
assert(home.includes('行情信息可能存在延迟'))

console.log('Youmian finance tests passed')
