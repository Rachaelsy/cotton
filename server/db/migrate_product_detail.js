require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  try {
    await db.query(`ALTER TABLE products ADD COLUMN detail TEXT DEFAULT NULL COMMENT '商品详细介绍'`)
    console.log('✅ products.detail 列已添加')
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭  products.detail 列已存在，跳过')
    } else {
      throw e
    }
  }
  process.exit(0)
}

migrate().catch(err => { console.error('❌', err.message); process.exit(1) })
