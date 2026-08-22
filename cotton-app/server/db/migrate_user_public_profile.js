require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function hasColumn(name) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME=?`,
    [name]
  )
  return rows.length > 0
}

async function migrate() {
  if (!await hasColumn('nickname')) {
    await db.query("ALTER TABLE users ADD COLUMN nickname VARCHAR(32) DEFAULT NULL COMMENT '用户公开昵称' AFTER real_name")
    console.log('[migrate] users.nickname ready')
  } else {
    console.log('[migrate] users.nickname exists, skipped')
  }
  await db.end()
}

migrate().catch(error => {
  console.error('[migrate-user-public-profile]', error)
  process.exit(1)
})
