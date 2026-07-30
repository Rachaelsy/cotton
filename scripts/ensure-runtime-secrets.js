const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const placeholderPattern = /TODO|change[_-]?in[_-]?production|replace|your[_-]?secret|example/i

function isSecureSecret(value) {
  const secret = String(value || '').trim()
  return secret.length >= 32 && !placeholderPattern.test(secret)
}

function isSecureJwtSecret(value) {
  return isSecureSecret(value)
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

function loadEnvFile(envPath) {
  const resolved = path.resolve(envPath)
  if (!fs.existsSync(resolved)) throw new Error(`Environment file does not exist: ${resolved}`)
  return { resolved, source: fs.readFileSync(resolved, 'utf8') }
}

function writeEnvFile(resolved, source) {
  fs.writeFileSync(resolved, source, 'utf8')
  try { fs.chmodSync(resolved, 0o600) } catch {}
}

function generateSecureSecret(generate) {
  const value = String(generate())
  if (!isSecureSecret(value)) throw new Error('Generated runtime secret does not meet security requirements')
  return value
}

function ensureSecret(source, key, generate) {
  const current = readEnvValue(source, key)
  const changed = !isSecureSecret(current)
  const value = changed ? generateSecureSecret(generate) : current
  const nextSource = setEnvValue(source, key, value)
  return { source: nextSource, changed, normalized: nextSource !== source }
}

function ensureJwtSecret(envPath, generate = () => crypto.randomBytes(48).toString('base64url')) {
  const { resolved, source } = loadEnvFile(envPath)
  const result = ensureSecret(source, 'JWT_SECRET', generate)
  if (result.normalized) writeEnvFile(resolved, result.source)
  else {
    try { fs.chmodSync(resolved, 0o600) } catch {}
  }
  return { changed: result.changed, normalized: result.normalized, path: resolved }
}

function ensureIdentityDataKey(envPath, generate = () => crypto.randomBytes(48).toString('base64url')) {
  const { resolved, source } = loadEnvFile(envPath)
  const result = ensureSecret(source, 'IDENTITY_DATA_KEY', generate)
  if (result.normalized) writeEnvFile(resolved, result.source)
  else {
    try { fs.chmodSync(resolved, 0o600) } catch {}
  }
  return { changed: result.changed, normalized: result.normalized, path: resolved }
}

function ensureRuntimeSecrets(envPath, generators = {}) {
  const { resolved, source } = loadEnvFile(envPath)
  const jwt = ensureSecret(
    source,
    'JWT_SECRET',
    generators.jwt || (() => crypto.randomBytes(48).toString('base64url'))
  )
  const identityData = ensureSecret(
    jwt.source,
    'IDENTITY_DATA_KEY',
    generators.identityData || (() => crypto.randomBytes(48).toString('base64url'))
  )

  const normalized = identityData.source !== source
  if (normalized) writeEnvFile(resolved, identityData.source)
  else {
    try { fs.chmodSync(resolved, 0o600) } catch {}
  }

  return {
    changed: jwt.changed || identityData.changed,
    normalized,
    jwt: { changed: jwt.changed },
    identityData: { changed: identityData.changed },
    path: resolved
  }
}

if (require.main === module) {
  const envPath = process.argv[2] || path.join(__dirname, '../cotton-app/server/.env')
  try {
    const result = ensureRuntimeSecrets(envPath)
    console.log(result.jwt.changed
      ? '[secrets] Generated a new JWT_SECRET; existing login sessions will expire'
      : '[secrets] JWT_SECRET passed the security check')
    console.log(result.identityData.changed
      ? '[secrets] Generated IDENTITY_DATA_KEY; back it up securely and never rotate it after data is encrypted'
      : '[secrets] IDENTITY_DATA_KEY passed the security check and was left unchanged')
  } catch (error) {
    console.error(`[secrets] ${error.message}`)
    process.exit(1)
  }
}

module.exports = {
  ensureIdentityDataKey,
  ensureJwtSecret,
  ensureRuntimeSecrets,
  isSecureJwtSecret,
  isSecureSecret,
  readEnvValue,
  setEnvValue
}
