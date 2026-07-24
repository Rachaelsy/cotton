const assert = require('assert')
const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..', '..')

function readRootFile(...parts) {
  return fs.readFileSync(path.join(rootDir, ...parts), 'utf8')
}

function run() {
  const weatherJs = readRootFile('pages', 'weather', 'index.js')
  const weatherWxml = readRootFile('pages', 'weather', 'index.wxml')
  const weatherWxss = readRootFile('pages', 'weather', 'index.wxss')
  const i18n = readRootFile('utils', 'i18n.js')

  assert.ok(weatherJs.includes('weatherDataError'), 'weather page should track weather API failure separately from page load failure')
  assert.ok(weatherJs.includes('buildWeatherUnavailableModel'), 'weather page should build an empty in-page model when weather data fails')
  assert.ok(weatherJs.includes('loadError: \'\''), 'weather API failure path should keep page-level loadError empty after plots load')
  assert.ok(weatherWxml.includes('wx-weather-error'), 'weather page should render an inline data error notice')
  assert.ok(weatherWxml.includes('weatherDataError'), 'weather page should bind inline weather failure text')
  assert.ok(!weatherWxml.includes('wx:elif="{{loadError}}"'), 'page-level loadError should not block the weather module after entering the page')
  assert.ok(!/wx:else[^>\n]*wx:for|wx:for[^>\n]*wx:else/.test(weatherWxml), 'weather page should not combine wx:else and wx:for on the same node')
  assert.ok(weatherWxss.includes('.wx-weather-error'), 'weather page should style inline weather failure notice')
  assert.ok(i18n.includes('weatherDataFailTitle'), 'language copy should include weather data failure title')
  assert.ok(i18n.includes('weatherDataEmpty'), 'language copy should include empty weather data labels')
}

run()
console.log('weather page failure UI tests passed')
