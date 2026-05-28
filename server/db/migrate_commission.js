require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'merchants' AND COLUMN_NAME = 'commission_rate'`
  )
  if (!cols.length) {
    await db.query(`ALTER TABLE merchants ADD COLUMN commission_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00`)
    console.log('✅ 已添加 merchants.commission_rate 字段（默认 5.00%）')
  } else {
    console.log('ℹ️  commission_rate 字段已存在，跳过')
  }
  process.exit(0)
}

migrate().catch(e => { console.error(e.message); process.exit(1) })
