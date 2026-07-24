require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  try {
    await db.query(`ALTER TABLE reviews ADD COLUMN is_anonymous TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否匿名评价'`)
    console.log('✅ 已添加 reviews.is_anonymous 字段')
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('⏭  is_anonymous 字段已存在，跳过')
    else throw e
  }
  process.exit(0)
}

migrate().catch(err => { console.error('❌', err.message); process.exit(1) })
