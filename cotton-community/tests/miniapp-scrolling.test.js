const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '..', 'cotton-public')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const app = JSON.parse(read('app.json'))
const homeWxml = read('pages/index/index.wxml')
const homeWxss = read('pages/index/index.wxss')
const homeJs = read('pages/index/index.js')
const loginWxml = read('pages/login/index.wxml')
const i18n = read('utils/i18n.js')
const expertJs = read('pages/expert/index.js')
const academyData = read('utils/academy-data.js')
const academyHome = read('pages/academy/index.wxml')
const academyCourse = read('pages/academy/course.wxml')

for (const icon of ['fields', 'pest', 'weather', 'policy', 'expert', 'records', 'academy', 'finance', 'machine', 'supplies', 'processing', 'varieties']) {
  assert(homeWxml.includes(`/images/home-icons/${icon}.png`), `home page is missing the ${icon} service icon`)
  assert(fs.existsSync(path.join(root, 'images', 'home-icons', `${icon}.png`)), `home page icon file is missing: ${icon}.png`)
}
assert(!/<i\b[^>]*>[田识气讯讲记学金]<\/i>/.test(homeWxml), 'home page should use designed service icons instead of single-character placeholders')
assert(homeWxss.includes('.tool-icon-art') && homeWxss.includes('.production-icon-art'), 'home service icons should use compact local image styles')
assert(!homeWxss.includes('data:image/svg+xml'), 'home page should avoid large inline SVG data that can break WebView synchronization')
assert(homeJs.includes("academy: '/pages/academy/index'") && !homeJs.includes("key === 'academy'") && !homeJs.includes("正在开发中"), 'finished academy should open from the public mini program home page')
for (const level of ["key: 'basic'", "key: 'intermediate'", "key: 'advanced'"]) {
  assert(academyData.includes(level), `academy is missing course level ${level}`)
}
assert(academyData.includes('const COURSES = []') && academyData.includes('const SERIES = []'), 'academy demo content should remain empty until real videos are published')
assert(academyData.includes("name: '初级课程'") && academyData.includes("name: '中级课程'") && academyData.includes("name: '高级课程'") && academyHome.includes('level-tabs'), 'academy home should expose three learning levels')
assert(academyCourse.includes('<video') && academyCourse.includes('autoplay="true"') && academyCourse.includes('class="comment-section"'), 'academy course detail should support short-video learning and comments')
assert(i18n.includes("brand: '喀什优棉公共服务平台'") && !i18n.includes('棉花智能体') && !i18n.includes('智慧棉花管理平台'), 'login and registration copy should use the unified public service platform name')
assert(loginWxml.includes('wx:if="{{copy.brandSub}}"') && expertJs.includes("org: '喀什优棉公共服务平台'"), 'obsolete brand subtitles and expert fallback organization should not expose old platform names')

assert.notStrictEqual(
  app.renderer,
  'skyline',
  'the whole mini program must not force Skyline because natural document pages need page scrolling'
)

for (const pagePath of app.pages) {
  const jsonPath = `${pagePath}.json`
  const absoluteJson = path.join(root, jsonPath)
  if (!fs.existsSync(absoluteJson)) continue

  const pageConfig = JSON.parse(read(jsonPath))
  if (pageConfig.renderer !== 'skyline') continue

  const wxml = read(`${pagePath}.wxml`)
  assert(
    /<scroll-view\b[^>]*\bscroll-y(?:\s|=|>)/.test(wxml),
    `${pagePath} forces Skyline but has no vertical scroll-view`
  )
}

console.log('mini program page scrolling tests passed')
