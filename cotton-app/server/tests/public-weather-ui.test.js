const assert = require('assert')
const fs = require('fs')
const path = require('path')

const publicRoot = path.resolve(__dirname, '..', '..', '..', 'cotton-public')
const pageJs = fs.readFileSync(path.join(publicRoot, 'pages', 'weather', 'index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(publicRoot, 'pages', 'weather', 'index.wxml'), 'utf8')
const pageWxss = fs.readFileSync(path.join(publicRoot, 'pages', 'weather', 'index.wxss'), 'utf8')

assert.match(pageJs, /const KASHGAR_CENTER/)
assert.match(pageJs, /const sources = \[locationItem, \.\.\.plots\]/)
assert.match(pageJs, /\/api\/weather\/location\?lat=/)
assert.match(pageJs, /\/api\/weather\/plot\/\$\{plot\.id\}/)
assert.match(pageJs, /decorateForecast/)
assert.match(pageJs, /buildWeatherHighlights/)
assert.match(pageJs, /onToggleLocationPicker/)
assert.match(pageJs, /onChooseWeatherSource/)
assert.match(pageJs, /pickerTop/)

assert.match(pageWxml, /copy\.next24Hours/)
assert.match(pageWxml, /wx:for="\{\{forecastDays\}\}"/)
assert.match(pageWxml, /wx:for="\{\{weatherHighlights\}\}"/)
assert.match(pageWxml, /copy\.aiAdvice/)
assert.match(pageWxml, /weatherDataError/)
assert.match(pageWxml, /class="location-dropdown"/)
assert.match(pageWxml, /wx:for="\{\{fields\}\}"/)
assert.match(pageWxml, /catchtap="onChooseWeatherSource"/)
assert.ok(
  pageWxml.indexOf('class="location-dropdown"') > pageWxml.indexOf('class="picker-mask"'),
  'location dropdown should render at page root above the mask instead of overflowing from the header'
)

assert.match(pageWxss, /\.hero-card/)
assert.match(pageWxss, /\.forecast-day/)
assert.match(pageWxss, /\.decision-grid/)
assert.match(pageWxss, /\.location-picker-trigger/)
assert.match(pageWxss, /\.location-dropdown/)
assert.match(pageWxss, /\.location-dropdown\s*\{[\s\S]*position:\s*fixed/)

console.log('public weather UI tests passed')
