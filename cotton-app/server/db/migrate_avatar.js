require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='avatar_url'`
  )
  if (!cols.length) {
    await db.query(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(256) DEFAULT NULL COMMENT '头像图片路径'`)
    console.log('✅ 已添加 users.avatar_url 字段')
  } else {
    console.log('ℹ️  avatar_url 已存在，跳过')
  }
  process.exit(0)
}

migrate().catch(err => { console.error('❌', err.message); process.exit(1) })
