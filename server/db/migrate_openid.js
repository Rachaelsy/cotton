// server/db/migrate_openid.js — 添加 openid 字段，允许 password 为空（微信用户）
require('dotenv').config()
const db = require('./database')

async function main() {
  // 添加 openid 列（若已存在则跳过）
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS openid VARCHAR(64) DEFAULT NULL
  `).catch(() => {
    // MySQL 8.0 可能不支持 IF NOT EXISTS，逐一处理
  })

  // 用 MODIFY 允许 password 为 NULL（微信登录用户无密码）
  await db.query(`
    ALTER TABLE users
    MODIFY COLUMN password VARCHAR(72) NULL DEFAULT NULL
  `)

  console.log('✅ openid 字段已添加，password 已改为可空')
  process.exit(0)
}

main().catch(e => { console.error('❌ 迁移失败:', e.message); process.exit(1) })
