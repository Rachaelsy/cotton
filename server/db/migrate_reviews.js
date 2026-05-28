require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id    INT UNSIGNED NOT NULL,
      merchant_id INT UNSIGNED NOT NULL,
      user_id     INT UNSIGNED NOT NULL,
      farmer_name VARCHAR(64)  NOT NULL DEFAULT '',
      rating      TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT '1-5星',
      content     TEXT DEFAULT NULL,
      reply       TEXT DEFAULT NULL,
      replied_at  DATETIME DEFAULT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_order (order_id),
      INDEX idx_merchant (merchant_id),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='买家评价'
  `)
  console.log('✅ reviews 表已创建')
  process.exit(0)
}

migrate().catch(err => { console.error('❌', err.message); process.exit(1) })
