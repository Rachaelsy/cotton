require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const db = require('./database')

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [table, column]
  )
  return rows.length > 0
}

async function addColumn(table, column, ddl) {
  if (await columnExists(table, column)) return
  await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
}

async function indexExists(table, indexName) {
  const [rows] = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?`,
    [table, indexName]
  )
  return rows.length > 0
}

async function migrateMachinePayments() {
  await db.query("ALTER TABLE machine_orders MODIFY pay_status VARCHAR(16) NOT NULL DEFAULT 'unpaid' COMMENT 'unpaid/partial/paid/refunded'")
  await addColumn('machine_orders', 'deposit_status', "VARCHAR(16) NOT NULL DEFAULT 'unpaid' AFTER pay_status")
  await addColumn('machine_orders', 'balance_status', "VARCHAR(16) NOT NULL DEFAULT 'not_due' AFTER deposit_status")
  await addColumn('machine_orders', 'deposit_paid_amount', "DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER balance_status")
  await addColumn('machine_orders', 'balance_paid_amount', "DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER deposit_paid_amount")
  await addColumn('machine_orders', 'deposit_transaction_id', "VARCHAR(64) NOT NULL DEFAULT '' AFTER transaction_id")
  await addColumn('machine_orders', 'balance_transaction_id', "VARCHAR(64) NOT NULL DEFAULT '' AFTER deposit_transaction_id")
  await addColumn('machine_orders', 'deposit_paid_at', 'DATETIME DEFAULT NULL AFTER paid_at')
  await addColumn('machine_orders', 'balance_paid_at', 'DATETIME DEFAULT NULL AFTER deposit_paid_at')
  await addColumn('machine_orders', 'refund_status', "VARCHAR(24) NOT NULL DEFAULT '' AFTER fund_status")

  await db.query(`
    UPDATE machine_orders
       SET deposit_status=CASE
             WHEN pay_status='paid' AND pay_mode='deposit' THEN 'paid'
             WHEN pay_status='paid' AND pay_mode='full' THEN 'skipped'
             ELSE deposit_status END,
           balance_status=CASE
             WHEN pay_status='paid' AND pay_mode='full' THEN 'paid'
             WHEN pay_status='paid' AND pay_mode='deposit' THEN 'unpaid'
             ELSE balance_status END,
           deposit_paid_amount=CASE
             WHEN pay_status='paid' AND pay_mode='deposit' AND deposit_paid_amount=0 THEN paid_amount
             ELSE deposit_paid_amount END,
           balance_paid_amount=CASE
             WHEN pay_status='paid' AND pay_mode='full' AND balance_paid_amount=0 THEN paid_amount
             ELSE balance_paid_amount END,
           deposit_transaction_id=CASE
             WHEN pay_status='paid' AND pay_mode='deposit' AND deposit_transaction_id='' THEN transaction_id
             ELSE deposit_transaction_id END,
           balance_transaction_id=CASE
             WHEN pay_status='paid' AND pay_mode='full' AND balance_transaction_id='' THEN transaction_id
             ELSE balance_transaction_id END,
           deposit_paid_at=CASE
             WHEN pay_status='paid' AND pay_mode='deposit' AND deposit_paid_at IS NULL THEN paid_at
             ELSE deposit_paid_at END,
           balance_paid_at=CASE
             WHEN pay_status='paid' AND pay_mode='full' AND balance_paid_at IS NULL THEN paid_at
             ELSE balance_paid_at END
  `)
  await db.query("UPDATE machine_orders SET pay_status='partial' WHERE pay_status='paid' AND pay_mode='deposit' AND balance_status!='paid'")
}

async function migrateLiveLocation() {
  await addColumn('operators', 'live_latitude', 'DECIMAL(10,7) DEFAULT NULL')
  await addColumn('operators', 'live_longitude', 'DECIMAL(10,7) DEFAULT NULL')
  await addColumn('operators', 'live_accuracy', 'DECIMAL(10,2) DEFAULT NULL')
  await addColumn('operators', 'live_location_updated_at', 'DATETIME DEFAULT NULL')
}

async function migrateProfitSharingStages() {
  await addColumn('wechat_profit_sharing_orders', 'payment_stage', "VARCHAR(16) NOT NULL DEFAULT 'full' AFTER order_id")
  await db.query(`
    UPDATE wechat_profit_sharing_orders ps
    LEFT JOIN machine_orders mo ON ps.order_type='machine' AND mo.id=ps.order_id
       SET ps.payment_stage=CASE
         WHEN ps.order_type='machine' AND mo.pay_mode='deposit' THEN 'deposit'
         WHEN ps.order_type='machine' THEN 'full'
         ELSE 'full' END
  `)
  if (await indexExists('wechat_profit_sharing_orders', 'uniq_order')) {
    await db.query('ALTER TABLE wechat_profit_sharing_orders DROP INDEX uniq_order')
  }
  if (!(await indexExists('wechat_profit_sharing_orders', 'uniq_order_stage'))) {
    await db.query('ALTER TABLE wechat_profit_sharing_orders ADD UNIQUE KEY uniq_order_stage (order_type,order_id,payment_stage)')
  }
}

async function migrateWeatherObservations() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS weather_observations (
      id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      plot_id       INT UNSIGNED NOT NULL,
      observed_hour DATETIME NOT NULL,
      latitude      DECIMAL(10,7) NOT NULL,
      longitude     DECIMAL(10,7) NOT NULL,
      temperature   DECIMAL(6,2) DEFAULT NULL,
      precipitation DECIMAL(10,2) NOT NULL DEFAULT 0,
      provider      VARCHAR(32) NOT NULL DEFAULT '',
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_plot_hour (plot_id, observed_hour),
      INDEX idx_plot_time (plot_id, observed_hour)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='地块真实逐小时气象观测档案'
  `)
}

async function migrateFarmerVerification() {
  await addColumn('users', 'onboarding_completed', "TINYINT(1) NOT NULL DEFAULT 0 AFTER is_verified")
  await db.query(`
    CREATE TABLE IF NOT EXISTS farmer_verifications (
      id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id         INT UNSIGNED NOT NULL,
      real_name       VARCHAR(32) NOT NULL,
      id_number       VARCHAR(512) NOT NULL COMMENT 'AES-GCM encrypted identity number',
      id_number_mask  VARCHAR(32) NOT NULL,
      id_front_path   VARCHAR(255) NOT NULL,
      id_back_path    VARCHAR(255) NOT NULL,
      status          VARCHAR(16) NOT NULL DEFAULT 'pending',
      reject_reason   VARCHAR(255) NOT NULL DEFAULT '',
      reviewed_by     INT UNSIGNED DEFAULT NULL,
      reviewed_at     DATETIME DEFAULT NULL,
      created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农户实名认证审核记录'
  `)
  await db.query("ALTER TABLE farmer_verifications MODIFY id_number VARCHAR(512) NOT NULL COMMENT 'AES-GCM encrypted identity number'")
}

async function migrate() {
  await migrateMachinePayments()
  await migrateLiveLocation()
  await migrateProfitSharingStages()
  await migrateWeatherObservations()
  await migrateFarmerVerification()
  console.log('[migrate] farmer improvements ready')
  process.exit(0)
}

migrate().catch(error => {
  console.error('[migrate] farmer improvements failed:', error.message)
  process.exit(1)
})
