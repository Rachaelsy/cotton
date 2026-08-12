const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '..', 'cotton-public')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const app = JSON.parse(read('app.json'))

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
