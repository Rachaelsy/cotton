require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function addColumnIfMissing(column, ddl) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND COLUMN_NAME=?`,
    [column]
  )
  if (!rows.length) {
    await db.query(`ALTER TABLE orders ADD COLUMN ${ddl}`)
    console.log(`[migrate] orders.${column} added`)
  }
}

async function migrate() {
  await addColumnIfMissing('logistics_company', "logistics_company VARCHAR(32) NOT NULL DEFAULT '' COMMENT '快递公司编码'")
  await addColumnIfMissing('logistics_company_name', "logistics_company_name VARCHAR(64) NOT NULL DEFAULT '' COMMENT '快递公司名称'")
  await addColumnIfMissing('logistics_state', "logistics_state VARCHAR(16) NOT NULL DEFAULT '' COMMENT '微信物流轨迹动作码'")
  await addColumnIfMissing('logistics_status', "logistics_status VARCHAR(32) NOT NULL DEFAULT '' COMMENT '最新物流状态名称'")
  await addColumnIfMissing('logistics_latest', "logistics_latest TEXT COMMENT '最新物流节点内容'")
  await addColumnIfMissing('logistics_arrival_time', "logistics_arrival_time VARCHAR(32) NOT NULL DEFAULT '' COMMENT '预计送达时间'")
  await addColumnIfMissing('logistics_subscribed', 'logistics_subscribed TINYINT(1) NOT NULL DEFAULT 0')
  await addColumnIfMissing('logistics_subscribe_attempted_at', 'logistics_subscribe_attempted_at DATETIME DEFAULT NULL')
  await addColumnIfMissing('logistics_updated_at', 'logistics_updated_at DATETIME DEFAULT NULL')
  await addColumnIfMissing('logistics_queried_at', 'logistics_queried_at DATETIME DEFAULT NULL')
  await addColumnIfMissing('logistics_error', "logistics_error VARCHAR(512) NOT NULL DEFAULT ''")
  await addColumnIfMissing('logistics_raw', 'logistics_raw MEDIUMTEXT')
  await addColumnIfMissing('wechat_logistics_order_id', "wechat_logistics_order_id VARCHAR(128) NOT NULL DEFAULT '' COMMENT '微信物流助手全局订单ID'")
  await addColumnIfMissing('wechat_logistics_biz_id', "wechat_logistics_biz_id VARCHAR(64) NOT NULL DEFAULT '' COMMENT '绑定快递客户编码'")
  await addColumnIfMissing('wechat_logistics_waybill_data', "wechat_logistics_waybill_data MEDIUMTEXT COMMENT '微信电子面单数据'")

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_logistics_events (
      id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id    INT UNSIGNED NOT NULL,
      event_hash  CHAR(32) NOT NULL,
      event_time  DATETIME DEFAULT NULL,
      status      VARCHAR(32) NOT NULL DEFAULT '',
      status_code VARCHAR(32) NOT NULL DEFAULT '',
      location    VARCHAR(255) NOT NULL DEFAULT '',
      area_name   VARCHAR(255) NOT NULL DEFAULT '',
      context     TEXT NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_order_event (order_id, event_hash),
      INDEX idx_order_time (order_id, event_time),
      CONSTRAINT fk_logistics_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='微信物流助手运单轨迹'
  `)

  console.log('[migrate] logistics fields and events ready')
  process.exit(0)
}

migrate().catch(error => {
  console.error('[migrate] logistics failed:', error.message)
  process.exit(1)
})
