const assert = require('assert')
const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..', '..')

function readRootFile(...parts) {
  return fs.readFileSync(path.join(rootDir, ...parts), 'utf8')
}

function run() {
  const drawWxml = readRootFile('pages', 'fields', 'draw.wxml')
  const drawJs = readRootFile('pages', 'fields', 'draw.js')
  const drawWxss = readRootFile('pages', 'fields', 'draw.wxss')
  const listWxml = readRootFile('pages', 'fields', 'index.wxml')
  const listJs = readRootFile('pages', 'fields', 'index.js')
  const detailWxml = readRootFile('pages', 'fields', 'detail.wxml')
  const detailJs = readRootFile('pages', 'fields', 'detail.js')
  const migration = readRootFile('server', 'db', 'migrate_plots.js')

  assert.ok(drawWxml.includes('reference-images-card'), 'draw form should render a reference image upload card')
  assert.ok(drawWxml.includes('bindtap="onChoosePlotImages"'), 'draw form should provide an image picker action')
  assert.ok(drawWxml.includes('referenceImages'), 'draw form should bind selected reference images')
  assert.ok(drawWxml.includes('onRemovePlotImage'), 'draw form should allow removing a selected image')
  assert.ok(drawJs.includes("wx.chooseMedia") || drawJs.includes("wx.chooseImage"), 'draw page should use WeChat media picker')
  assert.ok(drawJs.includes("auth.uploadFile('/api/upload'"), 'draw page should upload selected images through the common upload API')
  assert.ok(drawJs.includes('reference_images: this.data.referenceImages'), 'plot creation should submit reference images')
  assert.ok(drawWxss.includes('.reference-images-card'), 'draw styles should include the reference image card')
  assert.ok(listJs.includes('parseReferenceImages'), 'field list should parse persisted reference images')
  assert.ok(listWxml.includes('preview-image'), 'field list should show a reference image thumbnail')
  assert.ok(detailJs.includes('referenceImageItems'), 'field detail should prepare image preview URLs')
  assert.ok(detailWxml.includes('reference-detail-card'), 'field detail should render persisted reference images')
  assert.ok(migration.includes('reference_images'), 'plots migration should ensure a reference_images column exists')
}

run()
console.log('field image UI tests passed')
