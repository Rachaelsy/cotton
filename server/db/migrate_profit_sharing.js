require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS wechat_profit_sharing_orders (
      id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_type        VARCHAR(20) NOT NULL DEFAULT 'supply',
      order_id          INT UNSIGNED NOT NULL,
      out_order_no      VARCHAR(64) NOT NULL,
      transaction_id    VARCHAR(64) NOT NULL,
      sub_mchid         VARCHAR(32) NOT NULL,
      receiver_account  VARCHAR(32) NOT NULL DEFAULT '',
      amount_fen        INT UNSIGNED NOT NULL DEFAULT 0,
      commission_rate   DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      state             VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      wechat_order_id   VARCHAR(64) NOT NULL DEFAULT '',
      result_payload    MEDIUMTEXT,
      error_msg         VARCHAR(512) NOT NULL DEFAULT '',
      created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_order (order_type, order_id),
      UNIQUE KEY uniq_out_order_no (out_order_no),
      INDEX idx_state (state),
      INDEX idx_transaction_id (transaction_id),
      INDEX idx_sub_mchid (sub_mchid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='WeChat Pay profit sharing orders'
  `)
  console.log('[migrate] wechat_profit_sharing_orders ready')
  process.exit(0)
}

migrate().catch(error => {
  console.error('[migrate] profit sharing failed:', error.message)
  process.exit(1)
})
