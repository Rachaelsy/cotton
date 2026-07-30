// server/db/migrate_admin.js — 管理员权限与会话版本字段
// 用法：node db/migrate_admin.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const bcrypt = require('bcryptjs')
const db = require('./database')
const { BLOCKED_PASSWORDS } = require('../utils/password-policy')

async function run() {
  const columns = [
    {
      name: 'is_admin',
      ddl: 'is_admin TINYINT(1) NOT NULL DEFAULT 0 COMMENT "是否管理员"'
    },
    {
      name: 'admin_auth_version',
      ddl: 'admin_auth_version INT UNSIGNED NOT NULL DEFAULT 0 COMMENT "管理员登录会话版本"'
    }
  ]

  for (const column of columns) {
    const [rows] = await db.query(
      `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME=?`,
      [column.name]
    )
    if (rows.length) {
      console.log(`⏭  users.${column.name} 已存在，跳过`)
      continue
    }
    await db.query(`ALTER TABLE users ADD COLUMN ${column.ddl}`)
    console.log(`✅ 已添加 users.${column.name}`)
  }

  const [admins] = await db.query(
    'SELECT id,phone,password FROM users WHERE is_admin=1 AND is_active=1'
  )
  for (const admin of admins) {
    let usesBlockedPassword = false
    for (const blockedPassword of BLOCKED_PASSWORDS) {
      if (await bcrypt.compare(blockedPassword, admin.password)) {
        usesBlockedPassword = true
        break
      }
    }
    if (usesBlockedPassword) {
      await db.query(
        'UPDATE users SET admin_auth_version=admin_auth_version+1 WHERE id=?',
        [admin.id]
      )
      console.warn(`⚠️  管理员 ${admin.phone} 仍使用默认或常见测试密码，旧登录状态已失效`)
    }
  }

  console.log('✅ 管理员字段迁移完成；账号请使用 npm run admin:bootstrap 显式创建')
  process.exit(0)
}

run().catch(err => { console.error('❌ 失败：', err.message); process.exit(1) })
