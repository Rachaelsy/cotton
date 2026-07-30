const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  APPLYMENT_IMAGE_TYPES,
  IDENTITY_IMAGE_TYPES,
  IMAGE_TYPES,
  MEDIA_TYPES,
  accepts,
  makeFileFilter,
  safeExtension
} = require('../utils/upload-policy')

function filterResult(filter, file) {
  return new Promise(resolve => {
    filter({}, file, (error, accepted) => resolve({ error, accepted }))
  })
}

async function run() {
  const jpg = { originalname: 'field.JPEG', mimetype: 'image/jpeg' }
  const spoofed = { originalname: 'field.svg', mimetype: 'image/jpeg' }
  const svg = { originalname: 'field.svg', mimetype: 'image/svg+xml' }
  const mp4 = { originalname: 'lesson.mp4', mimetype: 'video/mp4' }
  const disguisedVideo = { originalname: 'lesson.html', mimetype: 'video/mp4' }

  assert.strictEqual(accepts(IMAGE_TYPES, jpg), true)
  assert.strictEqual(safeExtension(jpg), '.jpg')
  assert.strictEqual(accepts(IMAGE_TYPES, spoofed), false)
  assert.strictEqual(accepts(IMAGE_TYPES, svg), false)
  assert.strictEqual(accepts(MEDIA_TYPES, mp4), true)
  assert.strictEqual(accepts(MEDIA_TYPES, disguisedVideo), false)
  assert.strictEqual(accepts(IDENTITY_IMAGE_TYPES, { originalname: 'id.gif', mimetype: 'image/gif' }), false)
  assert.strictEqual(accepts(APPLYMENT_IMAGE_TYPES, { originalname: 'license.bmp', mimetype: 'image/bmp' }), true)

  const result = await filterResult(makeFileFilter({
    types: IMAGE_TYPES,
    message: 'invalid image'
  }), svg)
  assert.strictEqual(result.accepted, undefined)
  assert.strictEqual(result.error.code, 'UPLOAD_TYPE_INVALID')

  const indexSource = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8')
  const requestSafetySource = fs.readFileSync(path.join(__dirname, '../middleware/request-safety.js'), 'utf8')
  const uploadRouteSource = fs.readFileSync(path.join(__dirname, '../routes/upload.js'), 'utf8')
  assert.ok(indexSource.includes('app.use(createApiErrorHandler())'))
  assert.ok(requestSafetySource.includes("error?.code === 'UPLOAD_TYPE_INVALID'"))
  assert.ok(requestSafetySource.includes("error?.name === 'MulterError'"))
  assert.ok(uploadRouteSource.includes("../private/applyments"))
  assert.ok(uploadRouteSource.includes("data: { url: '/private/applyments/' + req.file.filename }"))

  for (const route of ['admin.js', 'merchant.js', 'expert-admin.js', 'verification.js', 'upload.js', 'ai.js', 'wechat-applyment.js']) {
    const source = fs.readFileSync(path.join(__dirname, '../routes', route), 'utf8')
    assert.ok(source.includes('upload-policy'), `${route} should use the shared upload policy`)
  }

  console.log('upload policy tests passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
