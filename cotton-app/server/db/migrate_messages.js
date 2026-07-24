// server/db/migrate_messages.js — 消息中心 + 平台公告表
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  // 商户消息表
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      merchant_id INT NOT NULL,
      type        VARCHAR(30)  NOT NULL COMMENT 'order/aftersale/announcement',
      title       VARCHAR(100) NOT NULL,
      content     TEXT         NOT NULL,
      related_id  INT          DEFAULT NULL COMMENT 'order_id / aftersale_id / announcement_id',
      is_read     TINYINT(1)   DEFAULT 0,
      created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_merchant (merchant_id),
      INDEX idx_read     (merchant_id, is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  console.log('[migrate] messages 表已就绪')

  // 平台公告表
  await db.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      title      VARCHAR(100) NOT NULL,
      content    TEXT         NOT NULL,
      created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  console.log('[migrate] announcements 表已就绪')

  process.exit(0)
}

migrate().catch(e => { console.error(e); process.exit(1) })
