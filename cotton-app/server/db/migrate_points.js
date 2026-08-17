require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function addColumnIfMissing(table, column, definition) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1`,
    [table, column]
  )
  if (!rows.length) await db.query(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
}

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS farmer_points_accounts (
      user_id       INT UNSIGNED PRIMARY KEY,
      balance       INT UNSIGNED NOT NULL DEFAULT 0,
      locked_points INT UNSIGNED NOT NULL DEFAULT 0,
      total_earned  INT UNSIGNED NOT NULL DEFAULT 0,
      total_used    INT UNSIGNED NOT NULL DEFAULT 0,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_points_account_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农户积分账户'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS farmer_points_transactions (
      id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id        INT UNSIGNED NOT NULL,
      type           VARCHAR(32) NOT NULL,
      points         INT NOT NULL,
      status         VARCHAR(16) NOT NULL DEFAULT 'completed',
      order_id       INT UNSIGNED DEFAULT NULL,
      content_id     INT UNSIGNED DEFAULT NULL,
      reference_key  VARCHAR(96) NOT NULL,
      balance_after  INT UNSIGNED NOT NULL DEFAULT 0,
      description    VARCHAR(255) NOT NULL DEFAULT '',
      operator_id    INT UNSIGNED DEFAULT NULL,
      settled_at     DATETIME DEFAULT NULL,
      cancelled_at   DATETIME DEFAULT NULL,
      created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_points_reference (reference_key),
      INDEX idx_points_user_created (user_id,created_at),
      INDEX idx_points_order (order_id,type,status),
      INDEX idx_points_content (content_id,user_id),
      CONSTRAINT fk_points_transaction_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农户积分收支账本'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS community_sso_tickets (
      id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ticket_hash CHAR(64) NOT NULL,
      user_id     INT UNSIGNED NOT NULL,
      expires_at  DATETIME NOT NULL,
      used_at     DATETIME DEFAULT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_community_sso_ticket (ticket_hash),
      INDEX idx_community_sso_expiry (expires_at,used_at),
      CONSTRAINT fk_community_sso_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序到公共服务平台的一次性登录票据'
  `)

  await addColumnIfMissing(
    'orders',
    'points_used',
    'points_used INT UNSIGNED NOT NULL DEFAULT 0 AFTER user_coupon_id'
  )
  await addColumnIfMissing(
    'orders',
    'points_discount',
    'points_discount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER points_used'
  )

  await db.query(`
    INSERT IGNORE INTO farmer_points_accounts (user_id)
    SELECT u.id FROM users u
    JOIN farmers f ON f.user_id=u.id
    WHERE u.is_active=1
  `)
  await db.query('DELETE FROM community_sso_tickets WHERE expires_at<NOW() OR used_at IS NOT NULL')
  console.log('[migrate] farmer points accounts, ledger, order fields and community SSO ready')
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[migrate-points]', error)
    process.exit(1)
  })
