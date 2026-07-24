require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function addColumn(table, column, definition) {
  const [rows] = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [table, column]
  )
  if (!rows.length) await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

async function migrate() {
  await addColumn('operators', 'commission_rate', "DECIMAL(5,2) NOT NULL DEFAULT 5.00 COMMENT '当前生效的平台佣金比例'")
  await addColumn('machine_orders', 'fund_status', "VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending/frozen/available'")
  await addColumn('machine_orders', 'transaction_id', "VARCHAR(64) NOT NULL DEFAULT '' COMMENT '微信支付交易号'")
  await addColumn('machine_orders', 'paid_amount', "DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '本次实际支付业务金额'")
  await addColumn('machine_orders', 'paid_at', 'DATETIME DEFAULT NULL')

  await db.query(`
    CREATE TABLE IF NOT EXISTS commission_change_requests (
      id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      applicant_type ENUM('merchant','operator') NOT NULL,
      applicant_id   INT UNSIGNED NOT NULL,
      current_rate   DECIMAL(5,2) NOT NULL,
      requested_rate DECIMAL(5,2) NOT NULL,
      reason         VARCHAR(500) NOT NULL,
      status         ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
      review_note    VARCHAR(500) NOT NULL DEFAULT '',
      reviewed_by    INT UNSIGNED DEFAULT NULL,
      reviewed_at    DATETIME DEFAULT NULL,
      created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_commission_applicant (applicant_type, applicant_id, created_at),
      INDEX idx_commission_status (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商户和农机手平台佣金调整申请'
  `)
  console.log('[migrate] commission requests and machine payment fields ready')
  process.exit(0)
}

migrate().catch(error => {
  console.error('[migrate] commission requests failed:', error.message)
  process.exit(1)
})
