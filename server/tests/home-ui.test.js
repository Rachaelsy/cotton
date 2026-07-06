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
  const i18n = readRootFile('utils', 'i18n.js')

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
}

run()
console.log('home UI tests passed')
