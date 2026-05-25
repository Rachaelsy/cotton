// server/db/migrate_admin.js — 添加 is_admin 字段 + 创建管理员账号
// 用法：node db/migrate_admin.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const bcrypt = require('bcryptjs')
const db     = require('./database')

async function run() {
  // 1. 添加 is_admin 字段（幂等：IGNORE 错误）
  try {
    await db.query('ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 COMMENT "是否管理员"')
    console.log('✅ 已添加 is_admin 字段')
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭  is_admin 字段已存在，跳过')
    } else {
      throw e
    }
  }

  // 2. 创建管理员账号
  const adminPhone    = '10000000000'
  const adminPassword = 'Admin@Cotton2026'
  const adminName     = '系统管理员'

  const [rows] = await db.query('SELECT id FROM users WHERE phone=?', [adminPhone])
  if (rows.length > 0) {
    // 确保 is_admin = 1
    await db.query('UPDATE users SET is_admin=1 WHERE phone=?', [adminPhone])
    console.log(`⏭  管理员账号 ${adminPhone} 已存在，已确保 is_admin=1`)
  } else {
    const hash = await bcrypt.hash(adminPassword, 10)
    await db.query(
      'INSERT INTO users (phone,password,role,real_name,is_admin) VALUES (?,?,?,?,1)',
      [adminPhone, hash, 'farmer', adminName]
    )
    console.log(`✅ 已创建管理员账号：${adminPhone} / ${adminPassword}`)
  }

  console.log('\n管理员账号：')
  console.log(`  手机号：${adminPhone}`)
  console.log(`  密  码：${adminPassword}`)
  console.log(`  后台地址：http://localhost:3000/admin/`)
  process.exit(0)
}

run().catch(err => { console.error('❌ 失败：', err.message); process.exit(1) })
