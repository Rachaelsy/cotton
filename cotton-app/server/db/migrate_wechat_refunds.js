require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function addColumnIfMissing(column, ddl) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='wechat_refunds' AND COLUMN_NAME=?`,
    [column]
  )
  if (!rows.length) await db.query(`ALTER TABLE wechat_refunds ADD COLUMN ${ddl}`)
}

async function addIndexIfMissing(indexName, ddl) {
  const [rows] = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='wechat_refunds' AND INDEX_NAME=?`,
    [indexName]
  )
  if (!rows.length) await db.query(`ALTER TABLE wechat_refunds ADD INDEX ${indexName} ${ddl}`)
}

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS wechat_refunds (
      id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_type            VARCHAR(20) NOT NULL DEFAULT 'supply',
      order_id              INT UNSIGNED NOT NULL,
      payment_stage         VARCHAR(16) NOT NULL DEFAULT 'full',
      aftersale_id          INT UNSIGNED DEFAULT NULL,
      out_trade_no          VARCHAR(64) NOT NULL DEFAULT '',
      out_refund_no         VARCHAR(64) NOT NULL,
      wechat_refund_id      VARCHAR(64) NOT NULL DEFAULT '',
      transaction_id        VARCHAR(64) NOT NULL DEFAULT '',
      sub_mchid             VARCHAR(32) NOT NULL DEFAULT '',
      amount_fen            INT UNSIGNED NOT NULL DEFAULT 0,
      total_fen             INT UNSIGNED NOT NULL DEFAULT 0,
      currency              VARCHAR(8) NOT NULL DEFAULT 'CNY',
      reason                VARCHAR(255) NOT NULL DEFAULT '',
      status                VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      channel               VARCHAR(32) NOT NULL DEFAULT '',
      user_received_account VARCHAR(128) NOT NULL DEFAULT '',
      success_time          DATETIME DEFAULT NULL,
      request_payload       MEDIUMTEXT,
      result_payload        MEDIUMTEXT,
      notify_payload        MEDIUMTEXT,
      profit_sharing_return_no      VARCHAR(64) NOT NULL DEFAULT '',
      profit_sharing_return_state   VARCHAR(32) NOT NULL DEFAULT '',
      profit_sharing_return_payload MEDIUMTEXT,
      error_code            VARCHAR(64) NOT NULL DEFAULT '',
      error_msg             VARCHAR(512) NOT NULL DEFAULT '',
      created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_out_refund_no (out_refund_no),
      INDEX idx_order (order_type, order_id),
      INDEX idx_order_stage (order_type, order_id, payment_stage),
      INDEX idx_aftersale (aftersale_id),
      INDEX idx_status (status),
      INDEX idx_sub_mchid (sub_mchid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='WeChat Pay refund orders'
  `)
  await addColumnIfMissing('profit_sharing_return_no', "profit_sharing_return_no VARCHAR(64) NOT NULL DEFAULT ''")
  await addColumnIfMissing('profit_sharing_return_state', "profit_sharing_return_state VARCHAR(32) NOT NULL DEFAULT ''")
  await addColumnIfMissing('profit_sharing_return_payload', 'profit_sharing_return_payload MEDIUMTEXT')
  await addColumnIfMissing('payment_stage', "payment_stage VARCHAR(16) NOT NULL DEFAULT 'full' AFTER order_id")
  await addIndexIfMissing('idx_order_stage', '(order_type,order_id,payment_stage)')
  console.log('[migrate] wechat_refunds ready')
  process.exit(0)
}

migrate().catch(error => {
  console.error('[migrate] wechat refunds failed:', error.message)
  process.exit(1)
})
