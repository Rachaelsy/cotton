const assert = require('assert')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const { generateStrongPassword, validateStrongPassword } = require('../utils/password-policy')
const { auditDefaultAccounts } = require('../db/audit_default_accounts')

const root = path.join(__dirname, '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

async function testDefaultAccountAudit() {
  const userHash = await bcrypt.hash('test123', 4)
  const adminHash = await bcrypt.hash('A-strong-new-admin-password1!', 4)
  const expertHash = await bcrypt.hash('Expert@Cotton2026', 4)
  const database = {
    async query(sql) {
      if (sql.includes('FROM users')) {
        return [[
          { phone: '13800000001', password: userHash, is_active: 1, is_admin: 0 },
          { phone: '10000000000', password: adminHash, is_active: 1, is_admin: 1 }
        ]]
      }
      return [[
        { phone: '10000000001', password: expertHash, is_active: 1 }
      ]]
    }
  }
  const findings = await auditDefaultAccounts(database)
  assert.deepStrictEqual(
    findings.map(item => item.phone).sort(),
    ['10000000001', '13800000001']
  )
}

async function run() {
  const entrypoint = read('docker-entrypoint.sh')
  const adminMigration = read('db/migrate_admin.js')
  const expertMigration = read('db/migrate_experts.js')
  const productMigration = read('db/migrate_products.js')
  const adminRoute = read('routes/admin.js')
  const authRoute = read('routes/auth.js')
  const marketingRoute = read('routes/marketing.js')
  const dashboard = read('public/admin/dashboard.html')

  assert.ok(entrypoint.includes('SEED_DEMO_DATA:-false'))
  assert.ok(entrypoint.includes('SEED_DEMO_DATA cannot be enabled in production'))
  assert.ok(entrypoint.includes('node db/seed_products.js'))
  assert.ok(!entrypoint.includes('run_optional_node'))
  assert.ok(!adminMigration.includes('Admin@Cotton2026'))
  assert.ok(!expertMigration.includes('Expert@Cotton2026'))
  assert.ok(!productMigration.includes('13800000002'))

  assert.strictEqual(validateStrongPassword('short'), '密码至少需要 12 位')
  assert.ok(validateStrongPassword('alllowercase123!'))
  assert.strictEqual(validateStrongPassword('A-valid-password123!'), '')
  assert.strictEqual(validateStrongPassword(generateStrongPassword()), '')

  assert.ok(adminRoute.includes("admin_auth_version=admin_auth_version+1"))
  assert.ok(adminRoute.includes("router.post('/change-password'"))
  assert.ok(adminRoute.includes('ADMIN_JWT_EXPIRES'))
  assert.ok(adminRoute.includes('must_change_password'))
  assert.ok(adminRoute.includes('PASSWORD_CHANGE_REQUIRED'))
  assert.ok(marketingRoute.includes('account.admin_auth_version'))
  assert.ok(marketingRoute.includes('payload.must_change_password'))
  assert.ok(dashboard.includes('data-panel="accountSecurity"'))
  assert.ok(dashboard.includes('changeAdminPassword(event)'))
  assert.ok(dashboard.includes('openRequiredPasswordChange()'))
  assert.ok(authRoute.includes("const DEFAULT_FARMER_LOCATION = '喀什地区莎车县'"))
  assert.ok(authRoute.includes("String(profile.location || '').trim().slice(0, 128) || DEFAULT_FARMER_LOCATION"))

  await testDefaultAccountAudit()
  console.log('production bootstrap tests passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
