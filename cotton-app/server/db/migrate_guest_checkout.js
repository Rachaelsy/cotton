require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function hasColumn(table, column) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1`,
    [table, column]
  )
  return rows.length > 0
}

async function hasIndex(table, indexName) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? LIMIT 1`,
    [table, indexName]
  )
  return rows.length > 0
}

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS wechat_guests (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      openid VARCHAR(64) NOT NULL,
      unionid VARCHAR(64) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_wechat_guests_openid (openid),
      INDEX idx_wechat_guests_unionid (unionid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序免登录下单微信游客身份'
  `)

  await db.query(
    "ALTER TABLE orders MODIFY user_id INT UNSIGNED NULL COMMENT '正式农户 user_id，游客订单为空'"
  )
  if (!(await hasColumn('orders', 'guest_id'))) {
    await db.query(
      "ALTER TABLE orders ADD COLUMN guest_id BIGINT UNSIGNED NULL AFTER user_id"
    )
  }
  if (!(await hasIndex('orders', 'idx_guest_id'))) {
    await db.query('ALTER TABLE orders ADD INDEX idx_guest_id (guest_id)')
  }

  console.log('[migrate] guest checkout identity and order ownership ready')
  process.exit(0)
}

run().catch(error => {
  console.error('[migrate] guest checkout failed:', error.message)
  process.exit(1)
})
