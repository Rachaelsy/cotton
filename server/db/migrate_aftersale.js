// server/db/migrate_aftersale.js — 创建售后申请表
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS aftersale_requests (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      order_id        INT NOT NULL,
      order_no        VARCHAR(32) NOT NULL,
      merchant_id     INT NOT NULL,
      user_id         INT NOT NULL,
      farmer_name     VARCHAR(64) DEFAULT '',
      aftersale_type  VARCHAR(32) NOT NULL COMMENT '退货退款/仅退款/换货',
      reason          VARCHAR(64) NOT NULL,
      other_reason    VARCHAR(200) DEFAULT '',
      description     TEXT,
      status          VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/approved/rejected',
      handle_note     VARCHAR(500) DEFAULT '',
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  console.log('[migrate] aftersale_requests 表已就绪')
  process.exit(0)
}

migrate().catch(e => { console.error(e); process.exit(1) })
