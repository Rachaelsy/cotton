const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const placeholderPattern = /TODO|change[_-]?in[_-]?production|replace|your[_-]?secret|example/i

function isSecureJwtSecret(value) {
  const secret = String(value || '').trim()
  return secret.length >= 32 && !placeholderPattern.test(secret)
}

function readEnvValue(source, key) {
  const pattern = new RegExp(`^[\\t ]*${key}[\\t ]*=[\\t ]*(.*)$`)
  let value = ''
  for (const line of String(source || '').replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(pattern)
    if (match) value = match[1].trim()
  }
  return value
}

function setEnvValue(source, key, value) {
  const text = String(source || '')
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  const hadTrailingNewline = /[\r\n]$/.test(text)
  const pattern = new RegExp(`^[\\t ]*${key}[\\t ]*=`)
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const output = []
  let replaced = false

  for (const line of lines) {
    if (!pattern.test(line)) {
      output.push(line)
      continue
    }
    if (!replaced) output.push(`${key}=${value}`)
    replaced = true
  }
  if (!replaced) output.push(`${key}=${value}`)

  while (output.length > 1 && output[output.length - 1] === '') output.pop()
  return `${output.join(newline)}${hadTrailingNewline || !text ? newline : ''}`
}

function ensureJwtSecret(envPath, generate = () => crypto.randomBytes(48).toString('base64url')) {
  const resolved = path.resolve(envPath)
  if (!fs.existsSync(resolved)) throw new Error(`环境文件不存在：${resolved}`)
  const source = fs.readFileSync(resolved, 'utf8')
  const current = readEnvValue(source, 'JWT_SECRET')
  if (isSecureJwtSecret(current)) {
    const normalized = setEnvValue(source, 'JWT_SECRET', current)
    if (normalized !== source) fs.writeFileSync(resolved, normalized, 'utf8')
    try { fs.chmodSync(resolved, 0o600) } catch {}
    return { changed: false, normalized: normalized !== source, path: resolved }
  }

  const next = String(generate())
  if (!isSecureJwtSecret(next)) throw new Error('生成的 JWT_SECRET 不符合安全要求')
  fs.writeFileSync(resolved, setEnvValue(source, 'JWT_SECRET', next), 'utf8')
  try { fs.chmodSync(resolved, 0o600) } catch {}
  return { changed: true, normalized: true, path: resolved }
}

if (require.main === module) {
  const envPath = process.argv[2] || path.join(__dirname, '../cotton-app/server/.env')
  try {
    const result = ensureJwtSecret(envPath)
    console.log(result.changed
      ? '[secrets] 已生成新的 JWT_SECRET；现有登录状态会失效，请重新登录'
      : result.normalized
        ? '[secrets] JWT_SECRET 已通过安全检查，并已规范环境文件换行'
        : '[secrets] JWT_SECRET 已通过安全检查')
  } catch (error) {
    console.error(`[secrets] ${error.message}`)
    process.exit(1)
  }
}

module.exports = { ensureJwtSecret, isSecureJwtSecret, readEnvValue, setEnvValue }
