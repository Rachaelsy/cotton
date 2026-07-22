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

async function indexExists(table, indexName) {
  const [rows] = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?`,
    [table, indexName]
  )
  return rows.length > 0
}

async function migrate() {
  if (!(await columnExists('machine_orders', 'pay_expires_at'))) {
    await db.query('ALTER TABLE machine_orders ADD COLUMN pay_expires_at DATETIME DEFAULT NULL AFTER pay_mode')
  }
  if (!(await columnExists('machine_orders', 'work_end_date'))) {
    await db.query('ALTER TABLE machine_orders ADD COLUMN work_end_date DATE DEFAULT NULL AFTER work_date')
  }
  const billingUnitAdded = !(await columnExists('machine_orders', 'billing_unit'))
  if (billingUnitAdded) {
    await db.query("ALTER TABLE machine_orders ADD COLUMN billing_unit VARCHAR(8) NOT NULL DEFAULT '亩' AFTER unit_price")
  }
  await db.query('UPDATE machine_orders SET work_end_date=work_date WHERE work_end_date IS NULL')
  if (billingUnitAdded) {
    await db.query(`
      UPDATE machine_orders mo LEFT JOIN machines m ON m.id=mo.machine_id
         SET mo.billing_unit=CASE WHEN m.unit='天' THEN '天' ELSE '亩' END
    `)
  }
  if (!(await indexExists('machine_orders', 'idx_machine_work_date'))) {
    await db.query('ALTER TABLE machine_orders ADD INDEX idx_machine_work_date (machine_id,work_date,status)')
  }
  if (!(await indexExists('machine_orders', 'idx_machine_pay_expire'))) {
    await db.query('ALTER TABLE machine_orders ADD INDEX idx_machine_pay_expire (status,pay_status,pay_expires_at)')
  }

  if (!(await columnExists('wechat_refunds', 'payment_stage'))) {
    await db.query("ALTER TABLE wechat_refunds ADD COLUMN payment_stage VARCHAR(16) NOT NULL DEFAULT 'full' AFTER order_id")
  }
  await db.query(`
    UPDATE wechat_refunds r
    LEFT JOIN machine_orders mo ON r.order_type='machine' AND mo.id=r.order_id
       SET r.payment_stage=CASE
         WHEN r.order_type!='machine' THEN 'full'
         WHEN r.out_trade_no REGEXP '(^|_)D(_|$)' OR LOWER(r.out_trade_no) LIKE '%deposit%' THEN 'deposit'
         WHEN r.out_trade_no REGEXP '(^|_)B(_|$)' OR LOWER(r.out_trade_no) LIKE '%balance%' THEN 'balance'
         WHEN r.out_trade_no REGEXP '(^|_)F(_|$)' OR LOWER(r.out_trade_no) LIKE '%full%' THEN 'full'
         WHEN mo.pay_mode='deposit' THEN 'deposit'
         ELSE 'full' END
  `)
  if (!(await indexExists('wechat_refunds', 'idx_order_stage'))) {
    await db.query('ALTER TABLE wechat_refunds ADD INDEX idx_order_stage (order_type,order_id,payment_stage)')
  }

  console.log('[migrate] machine rental reliability fields ready')
  process.exit(0)
}

migrate().catch(error => {
  console.error('[migrate] machine rental reliability failed:', error.message)
  process.exit(1)
})
