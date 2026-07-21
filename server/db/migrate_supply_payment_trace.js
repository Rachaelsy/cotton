require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function addColumnIfMissing(column, definition) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND COLUMN_NAME=? LIMIT 1`,
    [column]
  )
  if (!rows.length) await db.query(`ALTER TABLE orders ADD COLUMN ${definition}`)
}

async function addIndexIfMissing(indexName, definition) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND INDEX_NAME=? LIMIT 1`,
    [indexName]
  )
  if (!rows.length) await db.query(`ALTER TABLE orders ADD INDEX ${indexName} ${definition}`)
}

async function run() {
  await addColumnIfMissing(
    'wechat_out_trade_no',
    "wechat_out_trade_no VARCHAR(32) NOT NULL DEFAULT '' AFTER pay_method"
  )
  await addColumnIfMissing(
    'wechat_transaction_id',
    "wechat_transaction_id VARCHAR(64) NOT NULL DEFAULT '' AFTER wechat_out_trade_no"
  )
  await addColumnIfMissing(
    'payment_mode',
    "payment_mode VARCHAR(16) NOT NULL DEFAULT '' COMMENT 'wechat/mock' AFTER wechat_transaction_id"
  )
  await addColumnIfMissing('paid_at', 'paid_at DATETIME DEFAULT NULL AFTER payment_mode')
  await addIndexIfMissing('idx_orders_wechat_transaction', '(wechat_transaction_id)')

  await db.query(`
    UPDATE orders o
    JOIN (
      SELECT order_id,MAX(out_trade_no) AS out_trade_no,MAX(transaction_id) AS transaction_id,
             MAX(COALESCE(success_time,created_at)) AS paid_at
        FROM wechat_refunds
       WHERE order_type='supply' AND transaction_id<>''
       GROUP BY order_id
    ) wr ON wr.order_id=o.id
       SET o.wechat_out_trade_no=IF(o.wechat_out_trade_no='',wr.out_trade_no,o.wechat_out_trade_no),
           o.wechat_transaction_id=IF(o.wechat_transaction_id='',wr.transaction_id,o.wechat_transaction_id),
           o.payment_mode='wechat',o.paid_at=COALESCE(o.paid_at,wr.paid_at)
  `)
  await db.query(`
    UPDATE orders o
    JOIN (
      SELECT order_id,MAX(transaction_id) AS transaction_id,MAX(created_at) AS paid_at
        FROM wechat_profit_sharing_orders
       WHERE order_type='supply' AND transaction_id<>''
       GROUP BY order_id
    ) ps ON ps.order_id=o.id
       SET o.wechat_transaction_id=IF(o.wechat_transaction_id='',ps.transaction_id,o.wechat_transaction_id),
           o.payment_mode='wechat',o.paid_at=COALESCE(o.paid_at,ps.paid_at)
  `)

  console.log('[migrate] supply WeChat payment trace fields ready')
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[migrate-supply-payment-trace]', error)
    process.exit(1)
  })
