// server/db/migrate_orders.js — 创建订单表
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_no      VARCHAR(32)  NOT NULL UNIQUE        COMMENT '订单号（如 MG2026052501）',
      user_id       INT UNSIGNED DEFAULT NULL           COMMENT '正式农户 user_id',
      guest_id      BIGINT UNSIGNED DEFAULT NULL        COMMENT '微信游客身份 ID',
      farmer_name   VARCHAR(32)  DEFAULT ''             COMMENT '农户姓名',
      farmer_phone  VARCHAR(20)  DEFAULT ''             COMMENT '农户手机号',
      receiver_name VARCHAR(32)  NOT NULL DEFAULT ''    COMMENT '收货人',
      receiver_phone VARCHAR(20) NOT NULL DEFAULT ''    COMMENT '收货人电话',
      address       VARCHAR(256) NOT NULL DEFAULT ''    COMMENT '收货地址',
      subtotal      DECIMAL(10,2) NOT NULL DEFAULT 0    COMMENT '商品合计',
      delivery_fee  DECIMAL(10,2) NOT NULL DEFAULT 0    COMMENT '运费',
      total         DECIMAL(10,2) NOT NULL DEFAULT 0    COMMENT '实付金额',
      pay_method    VARCHAR(20)  NOT NULL DEFAULT 'wechat' COMMENT '支付方式',
      wechat_out_trade_no VARCHAR(32) NOT NULL DEFAULT '' COMMENT '微信商户订单号',
      wechat_transaction_id VARCHAR(64) NOT NULL DEFAULT '' COMMENT '微信支付交易号',
      payment_mode  VARCHAR(16) NOT NULL DEFAULT '' COMMENT 'wechat/mock',
      paid_at       DATETIME DEFAULT NULL,
      status        VARCHAR(20)  NOT NULL DEFAULT 'pending_ship' COMMENT '状态',
      logistics_no  VARCHAR(64)  DEFAULT NULL           COMMENT '物流单号',
      note          VARCHAR(256) DEFAULT ''             COMMENT '买家备注',
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_guest_id (guest_id),
      INDEX idx_status  (status),
      INDEX idx_created (created_at),
      INDEX idx_orders_wechat_transaction (wechat_transaction_id)
    ) ENGINE=InnoDB COMMENT='订单主表'
  `)
  console.log('✅ orders 表已创建')

  await db.query(`
    ALTER TABLE orders
    MODIFY delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '运费'
  `)
  console.log('✅ orders.delivery_fee 默认值已设为 0')

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id    INT UNSIGNED NOT NULL              COMMENT '关联 orders.id',
      merchant_id INT UNSIGNED NOT NULL              COMMENT '商户 ID（用于商户筛选）',
      product_id  INT UNSIGNED DEFAULT NULL          COMMENT '商品 ID（可为空）',
      name        VARCHAR(128) NOT NULL DEFAULT ''   COMMENT '商品名称',
      icon        VARCHAR(16)  DEFAULT '📦'          COMMENT '商品图标',
      spec        VARCHAR(64)  DEFAULT ''            COMMENT '规格',
      price       DECIMAL(10,2) NOT NULL DEFAULT 0   COMMENT '单价',
      qty         INT UNSIGNED NOT NULL DEFAULT 1    COMMENT '数量',
      subtotal    DECIMAL(10,2) NOT NULL DEFAULT 0   COMMENT '小计',
      INDEX idx_order_id    (order_id),
      INDEX idx_merchant_id (merchant_id),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB COMMENT='订单商品明细'
  `)
  console.log('✅ order_items 表已创建')

  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
