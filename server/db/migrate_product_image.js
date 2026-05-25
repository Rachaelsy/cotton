// server/db/migrate_product_image.js — 商品图片字段迁移
// 用法：node db/migrate_product_image.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function run() {
  try {
    await db.query(`ALTER TABLE products ADD COLUMN image_url VARCHAR(256) DEFAULT NULL COMMENT '商品图片路径'`)
    console.log('✅ 已添加 image_url 字段')
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('⏭  image_url 已存在，跳过')
    else throw e
  }
  process.exit(0)
}

run().catch(err => { console.error('❌', err.message); process.exit(1) })
