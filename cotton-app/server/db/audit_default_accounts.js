require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const bcrypt = require('bcryptjs')
const { BLOCKED_PASSWORDS } = require('../utils/password-policy')

const USER_DEFAULTS = [
  { phone: '10000000000', password: 'Admin@Cotton2026', label: '默认管理员' },
  { phone: '13800000001', password: 'test123', label: '测试农户' },
  { phone: '13800000002', password: 'test123', label: '测试商户' },
  { phone: '13800000003', password: 'test123', label: '测试农机手' },
  { phone: '13900000001', password: 'merchant123', label: '测试商户' }
]

const EXPERT_DEFAULTS = [
  { phone: '10000000001', password: 'Expert@Cotton2026', label: '默认专家' }
]

async function matchesKnownPassword(hash, password) {
  if (!hash) return false
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

async function auditDefaultAccounts(database) {
  if (!database || typeof database.query !== 'function') {
    throw new Error('缺少数据库连接')
  }
  const findings = []
  const userPhones = USER_DEFAULTS.map(item => item.phone)
  const expertPhones = EXPERT_DEFAULTS.map(item => item.phone)

  const [users] = await database.query(
    'SELECT phone,password,is_active,is_admin FROM users WHERE phone IN (?) OR (is_admin=1 AND is_active=1)',
    [userPhones]
  )
  const matchedPhones = new Set()
  for (const account of USER_DEFAULTS) {
    const row = users.find(user => user.phone === account.phone)
    if (row && row.is_active && await matchesKnownPassword(row.password, account.password)) {
      findings.push({
        type: row.is_admin ? 'admin' : 'user',
        phone: account.phone,
        label: account.label
      })
      matchedPhones.add(account.phone)
    }
  }

  for (const row of users) {
    if (!row.is_admin || !row.is_active || matchedPhones.has(row.phone)) continue
    for (const blockedPassword of BLOCKED_PASSWORDS) {
      if (await matchesKnownPassword(row.password, blockedPassword)) {
        findings.push({
          type: 'admin',
          phone: row.phone,
          label: '使用常见测试口令的管理员'
        })
        break
      }
    }
  }

  const [experts] = await database.query(
    'SELECT phone,password,is_active FROM experts WHERE phone IN (?)',
    [expertPhones]
  )
  for (const account of EXPERT_DEFAULTS) {
    const row = experts.find(expert => expert.phone === account.phone)
    if (row && row.is_active && await matchesKnownPassword(row.password, account.password)) {
      findings.push({ type: 'expert', phone: account.phone, label: account.label })
    }
  }
  return findings
}

async function run(database) {
  const findings = await auditDefaultAccounts(database)
  if (!findings.length) {
    console.log('✅ 未发现仍使用项目默认口令的启用账号')
    return
  }

  console.error('❌ 发现仍使用项目默认口令的启用账号：')
  findings.forEach(item => console.error(`- ${item.label} ${item.phone}`))
  console.error('管理员请执行 npm run admin:bootstrap -- --phone=手机号 --reset 重置；其他测试账号请在后台停用或删除。')
  process.exitCode = 2
}

if (require.main === module) {
  const database = require('./database')
  run(database)
    .catch(error => {
      console.error(`❌ 默认账号审计失败：${error.message}`)
      process.exitCode = 1
    })
    .finally(() => database.end())
}

module.exports = {
  USER_DEFAULTS,
  EXPERT_DEFAULTS,
  auditDefaultAccounts
}
