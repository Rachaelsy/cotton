const path = require('path')

const IMAGE_TYPES = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/webp', new Set(['.webp'])],
  ['image/gif', new Set(['.gif'])],
  ['image/avif', new Set(['.avif'])],
  ['image/bmp', new Set(['.bmp'])],
  ['image/x-ms-bmp', new Set(['.bmp'])]
])

const IDENTITY_IMAGE_TYPES = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/webp', new Set(['.webp'])]
])

const APPLYMENT_IMAGE_TYPES = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/bmp', new Set(['.bmp'])],
  ['image/x-ms-bmp', new Set(['.bmp'])]
])

const VIDEO_TYPES = new Map([
  ['video/mp4', new Set(['.mp4'])],
  ['video/webm', new Set(['.webm'])],
  ['video/quicktime', new Set(['.mov'])],
  ['video/x-m4v', new Set(['.m4v'])],
  ['video/ogg', new Set(['.ogv'])]
])

function extension(file) {
  return path.extname(String(file && file.originalname || '')).toLowerCase()
}

function accepts(types, file) {
  const allowedExtensions = types.get(String(file && file.mimetype || '').toLowerCase())
  return Boolean(allowedExtensions && allowedExtensions.has(extension(file)))
}

function makeFileFilter({ types, message }) {
  return (_req, file, callback) => {
    if (accepts(types, file)) return callback(null, true)
    const error = new Error(message)
    error.code = 'UPLOAD_TYPE_INVALID'
    return callback(error)
  }
}

function combinedTypes(...maps) {
  return new Map(maps.flatMap(map => [...map.entries()]))
}

function safeExtension(file, types = IMAGE_TYPES) {
  const mime = String(file && file.mimetype || '').toLowerCase()
  const allowedExtensions = types.get(mime)
  if (!allowedExtensions || !allowedExtensions.has(extension(file))) return ''
  if (mime === 'image/jpeg') return '.jpg'
  return [...allowedExtensions][0]
}

const MEDIA_TYPES = combinedTypes(IMAGE_TYPES, VIDEO_TYPES)

module.exports = {
  APPLYMENT_IMAGE_TYPES,
  IDENTITY_IMAGE_TYPES,
  IMAGE_TYPES,
  MEDIA_TYPES,
  VIDEO_TYPES,
  accepts,
  makeFileFilter,
  safeExtension
}
