require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'pay_expires_at'`
  )
  if (!cols.length) {
    await db.query(`ALTER TABLE orders ADD COLUMN pay_expires_at TIMESTAMP NULL`)
    console.log('✅ 已添加 orders.pay_expires_at 字段')
  } else {
    console.log('ℹ️  pay_expires_at 已存在，跳过')
  }
  process.exit(0)
}

migrate().catch(e => { console.error(e.message); process.exit(1) })
