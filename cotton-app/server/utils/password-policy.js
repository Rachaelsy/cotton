const crypto = require('crypto')

const BLOCKED_PASSWORDS = new Set([
  'Admin@Cotton2026',
  'Expert@Cotton2026',
  'test123',
  'password',
  '12345678'
])

function validateStrongPassword(value) {
  const password = String(value || '')
  if (password.length < 12) return '密码至少需要 12 位'
  if (password.length > 72) return '密码不能超过 72 位'
  if (!/[a-z]/.test(password)) return '密码需要包含小写字母'
  if (!/[A-Z]/.test(password)) return '密码需要包含大写字母'
  if (!/\d/.test(password)) return '密码需要包含数字'
  if (!/[^A-Za-z0-9]/.test(password)) return '密码需要包含特殊字符'
  if (BLOCKED_PASSWORDS.has(password)) return '不能继续使用项目默认或常见测试密码'
  return ''
}

function generateStrongPassword() {
  return `Ct!${crypto.randomBytes(15).toString('base64url')}8aA`
}

module.exports = {
  BLOCKED_PASSWORDS,
  generateStrongPassword,
  validateStrongPassword
}
