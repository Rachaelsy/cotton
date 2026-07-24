const assert = require('assert')
const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..', '..')

function readRootFile(...parts) {
  return fs.readFileSync(path.join(rootDir, ...parts), 'utf8')
}

function run() {
  const appJson = JSON.parse(readRootFile('app.json'))
  const homeWxml = readRootFile('pages', 'index', 'index.wxml')
  const homeJs = readRootFile('pages', 'index', 'index.js')
  const homeWxss = readRootFile('pages', 'index', 'index.wxss')
  const myJs = readRootFile('pages', 'my', 'index.js')
  const myWxml = readRootFile('pages', 'my', 'index.wxml')
  const i18n = readRootFile('utils', 'i18n.js')
  const machineJs = readRootFile('pages', 'machine', 'index.js')
  const regions = readRootFile('utils', 'regions.js')

  assert.ok(
    appJson.tabBar.list.some(item => item.pagePath === 'pages/ai/index'),
    'bottom tabBar should keep the AI entry'
  )
  assert.ok(!homeWxml.includes('ai-hero-card'), 'home page should not render the top AI hero card')
  assert.ok(!homeWxml.includes('aiHeroTitle'), 'home page should not bind AI hero title')
  assert.ok(!homeWxml.includes('aiHeroSub'), 'home page should not bind AI hero subtitle')
  assert.ok(!homeWxml.includes('aiHeroAction'), 'home page should not bind AI hero action')
  assert.ok(!homeJs.includes('onGoAI()'), 'home page should not keep the top-card tap handler')
  assert.ok(!homeJs.includes('aiPreferVoice'), 'home page should not force voice mode from a removed card')
  assert.ok(!homeWxss.includes('.ai-hero-card'), 'home styles should not keep removed AI hero card CSS')
  assert.ok(!i18n.includes('aiHeroTitle'), 'home copy should not keep removed AI hero title strings')
  assert.ok(!homeWxml.includes('wc-date'), 'home weather card should not show a separate date line')
  assert.ok(homeWxml.includes('copy.refreshWeather'), 'home weather card should offer a compact location weather refresh affordance')
  assert.ok(homeWxml.includes('onRefreshWeatherLocation'), 'home weather card should refresh current-location weather without opening the plot picker')
  assert.ok(homeJs.includes('wx.getLocation'), 'home weather preview should request the current device location')
  assert.ok(homeJs.includes('/api/weather/location'), 'home weather preview should request weather by current latitude and longitude')
  assert.ok(!homeJs.includes('/api/weather/plot'), 'home weather preview should not request plot weather')
  assert.ok(!homeJs.includes('model.locationLabel'), 'home weather preview should not expose source-heavy location labels')
  assert.ok(!homeJs.includes('tipText: model.tipText'), 'home weather preview should use short home tips instead of full weather-source copy')
  assert.ok(!homeWxml.includes('sourceInfo'), 'home weather card should not render weather source details')
  assert.ok(!homeWxml.includes('notif-dot'), 'home notification button should not show a fake unread dot')
  assert.ok(!homeWxss.includes('.notif-dot'), 'home styles should not retain the fake unread dot')
  assert.ok(appJson.pages.includes('pages/feedback/index'), 'feedback page should be registered in the mini app')
  assert.ok(!myWxml.includes('open-type="contact"'), 'profile page should not use native WeChat customer service')
  assert.ok(myWxml.includes('bindtap="onFeedback"'), 'profile page should open the platform feedback page')
  assert.ok(myJs.includes("'/pages/feedback/index'"), 'profile feedback handler should navigate to the feedback page')
  assert.ok(myWxml.includes('copy.feedback') && myWxml.includes('copy.feedbackSub'), 'customer service entry should use localized copy')
  assert.ok(i18n.includes("feedback: '意见反馈与客服'"), 'Chinese copy should name the feedback and customer service entry')
  assert.ok(i18n.includes("aboutContent: '专为新疆棉农打造的智能农业管理平台'"), 'about dialog should keep concise product copy')
  assert.ok(!i18n.includes('support@cotton.app'), 'about dialog should not expose the retired support email')
  assert.ok(homeJs.includes("const DEVELOPING_MODULES = ['trade', 'loans', 'insurance']"), 'unfinished modules should remain visible but use the developing notice')
  assert.ok(!homeJs.includes("trade: '/pages/trade/index'"), 'trade module should not open static demo data')
  assert.ok(!homeJs.includes("loans: '/pages/loans/index'"), 'loan module should not open fictional credit data')
  assert.ok(!homeJs.includes("insurance: '/pages/insurance/index'"), 'insurance module should not open its placeholder page')
  assert.ok(machineJs.includes('this.locateCurrent({ showFailToast: true })'), 'machine rental should try real-time location on first load')
  assert.ok(machineJs.includes('lat: fallback.lat') && machineJs.includes('lng: fallback.lng'), 'machine rental should fall back to a concrete Kashgar point when location fails')
  assert.ok(machineJs.includes('locationFallback'), 'machine rental should tell users when it falls back after location failure')
  assert.ok(regions.includes('喀什市') && regions.includes('疏附县') && regions.includes('塔什库尔干县'), 'machine rental should keep Kashgar region choices available')
}

run()
console.log('home UI tests passed')
