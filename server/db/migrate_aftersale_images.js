// server/db/migrate_aftersale_images.js — 为售后表添加 images 字段
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'aftersale_requests' AND COLUMN_NAME = 'images'`
  )
  if (!cols.length) {
    await db.query(`ALTER TABLE aftersale_requests ADD COLUMN images TEXT`)
    console.log('[migrate] 已添加 images 字段')
  } else {
    console.log('[migrate] images 字段已存在，跳过')
  }
  console.log('[migrate] aftersale_requests.images 字段已就绪')
  process.exit(0)
}

migrate().catch(e => { console.error(e); process.exit(1) })
