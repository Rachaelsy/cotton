require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      merchant_id INT UNSIGNED NOT NULL COMMENT '商户user_id',
      name        VARCHAR(128) NOT NULL               COMMENT '商品名称',
      category    VARCHAR(64)  DEFAULT NULL            COMMENT '分类',
      price       DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '售价（元）',
      unit        VARCHAR(32)  DEFAULT NULL            COMMENT '单位',
      stock       INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '库存',
      status      ENUM('on','off') NOT NULL DEFAULT 'on' COMMENT '在售/下架',
      description TEXT         DEFAULT NULL            COMMENT '商品描述',
      icon        VARCHAR(8)   DEFAULT '📦'           COMMENT '商品图标emoji',
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_merchant (merchant_id),
      INDEX idx_status   (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农资商品表'
  `)
  console.log('✅ products 表已创建')
  process.exit(0)
}

migrate().catch(err => { console.error('❌', err.message); process.exit(1) })
