// server/db/migrate_fund_status.js — 资金状态字段 + 提现记录表
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function addCol(table, col, def) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`, [table, col]
  )
  if (!rows.length) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${col} ${def}`)
    console.log(`[migrate] 已添加 ${table}.${col}`)
  } else {
    console.log(`[migrate] ${table}.${col} 已存在，跳过`)
  }
}

async function migrate() {
  // 发货时间（用于 10 天自动确认收货计算）
  await addCol('orders', 'shipped_at',    'TIMESTAMP NULL')
  // 确认收货时间（用于 7 天售后冻结计算）
  await addCol('orders', 'confirmed_at',  'TIMESTAMP NULL')
  // 是否系统自动确认
  await addCol('orders', 'auto_confirmed', 'TINYINT(1) DEFAULT 0')
  // 资金状态：pending(未完成) / frozen(冻结中) / available(可提现) / withdrawn(已提现)
  await addCol('orders', 'fund_status',   "VARCHAR(20) DEFAULT 'pending'")

  // 提现申请表
  await db.query(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      merchant_id INT NOT NULL,
      amount      DECIMAL(10,2) NOT NULL,
      status      VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/paid/rejected',
      note        VARCHAR(500) DEFAULT '',
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at     TIMESTAMP NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  console.log('[migrate] withdrawals 表已就绪')

  console.log('[migrate] 完成')
  process.exit(0)
}

migrate().catch(e => { console.error(e); process.exit(1) })
