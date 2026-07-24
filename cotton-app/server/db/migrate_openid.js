// server/db/migrate_openid.js - add openid field for WeChat login/payment users
require('dotenv').config()
const db = require('./database')

async function hasColumn(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  )
  return Number(rows[0]?.count || 0) > 0
}

async function main() {
  if (!(await hasColumn('users', 'openid'))) {
    await db.query('ALTER TABLE users ADD COLUMN openid VARCHAR(64) DEFAULT NULL')
    console.log('[migrate] users.openid added')
  } else {
    console.log('[migrate] users.openid exists, skipped')
  }

  if (!(await hasColumn('users', 'unionid'))) {
    await db.query('ALTER TABLE users ADD COLUMN unionid VARCHAR(64) DEFAULT NULL AFTER openid')
    await db.query('ALTER TABLE users ADD UNIQUE INDEX uk_users_unionid (unionid)')
    console.log('[migrate] users.unionid added')
  } else {
    console.log('[migrate] users.unionid exists, skipped')
  }

  await db.query('ALTER TABLE users MODIFY COLUMN password VARCHAR(72) NULL DEFAULT NULL')
  console.log('[migrate] Mini Program WeChat identities ready; password nullable')
  process.exit(0)
}

main().catch(error => {
  console.error('[migrate] openid failed:', error.message)
  process.exit(1)
})
