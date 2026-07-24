const crypto = require('crypto')

function getKey() {
  const raw = String(process.env.IDENTITY_DATA_KEY || '').trim()
  if (!raw || /^(TODO|your_|xxx)/i.test(raw)) {
    const error = new Error('实名认证加密密钥未配置：请设置 IDENTITY_DATA_KEY')
    error.statusCode = 501
    throw error
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest()
}

function encrypt(value) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

function decrypt(value) {
  const parts = String(value || '').split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('实名认证数据格式无效')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(parts[1], 'base64'))
  decipher.setAuthTag(Buffer.from(parts[2], 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8')
}

function maskIdNumber(value) {
  const text = String(value || '')
  return text.length >= 10 ? `${text.slice(0, 6)}********${text.slice(-4)}` : '********'
}

module.exports = { encrypt, decrypt, maskIdNumber }
