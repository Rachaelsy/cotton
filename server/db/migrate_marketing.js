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
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      merchant_id         INT UNSIGNED NOT NULL,
      kind                VARCHAR(16) NOT NULL COMMENT 'coupon/promotion',
      type                VARCHAR(32) NOT NULL,
      name                VARCHAR(80) NOT NULL,
      description         VARCHAR(255) NOT NULL DEFAULT '',
      scope_type          VARCHAR(16) NOT NULL DEFAULT 'all' COMMENT 'all/category/products',
      category            VARCHAR(64) NOT NULL DEFAULT '',
      threshold_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
      threshold_quantity  INT UNSIGNED NOT NULL DEFAULT 0,
      discount_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount_rate       DECIMAL(6,2) NOT NULL DEFAULT 100 COMMENT '实际支付百分比，如90表示9折',
      max_discount        DECIMAL(10,2) NOT NULL DEFAULT 0,
      special_price       DECIMAL(10,2) NOT NULL DEFAULT 0,
      buy_quantity        INT UNSIGNED NOT NULL DEFAULT 0,
      gift_quantity       INT UNSIGNED NOT NULL DEFAULT 0,
      total_quota         INT UNSIGNED DEFAULT NULL,
      per_user_limit      INT UNSIGNED NOT NULL DEFAULT 1,
      claimed_count       INT UNSIGNED NOT NULL DEFAULT 0,
      used_count          INT UNSIGNED NOT NULL DEFAULT 0,
      rules_json          TEXT DEFAULT NULL,
      stackable           TINYINT(1) NOT NULL DEFAULT 0,
      starts_at           DATETIME NOT NULL,
      ends_at             DATETIME NOT NULL,
      status              VARCHAR(16) NOT NULL DEFAULT 'draft',
      rejection_reason    VARCHAR(255) NOT NULL DEFAULT '',
      submitted_at        DATETIME DEFAULT NULL,
      reviewed_by         INT UNSIGNED DEFAULT NULL,
      reviewed_at         DATETIME DEFAULT NULL,
      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_marketing_merchant (merchant_id, status),
      INDEX idx_marketing_active (kind, status, starts_at, ends_at),
      CONSTRAINT fk_marketing_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商户优惠券与促销活动'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS marketing_campaign_products (
      id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      campaign_id     INT UNSIGNED NOT NULL,
      product_id      INT UNSIGNED NOT NULL,
      role            VARCHAR(16) NOT NULL DEFAULT 'eligible',
      promo_price     DECIMAL(10,2) DEFAULT NULL,
      quota           INT UNSIGNED DEFAULT NULL,
      available_stock INT UNSIGNED DEFAULT NULL,
      sold_count      INT UNSIGNED NOT NULL DEFAULT 0,
      UNIQUE KEY uniq_campaign_product_role (campaign_id, product_id, role),
      INDEX idx_campaign_product (product_id, campaign_id),
      CONSTRAINT fk_campaign_product_campaign FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
      CONSTRAINT fk_campaign_product_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销活动适用商品与秒杀库存'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_coupons (
      id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      campaign_id     INT UNSIGNED NOT NULL,
      user_id         INT UNSIGNED NOT NULL,
      coupon_code     VARCHAR(40) NOT NULL UNIQUE,
      status          VARCHAR(16) NOT NULL DEFAULT 'available',
      locked_order_id INT UNSIGNED DEFAULT NULL,
      claimed_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_at       DATETIME DEFAULT NULL,
      used_at         DATETIME DEFAULT NULL,
      returned_at     DATETIME DEFAULT NULL,
      expires_at      DATETIME NOT NULL,
      INDEX idx_user_coupon_user (user_id, status, expires_at),
      INDEX idx_user_coupon_campaign (campaign_id, user_id),
      INDEX idx_user_coupon_order (locked_order_id),
      CONSTRAINT fk_user_coupon_campaign FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_coupon_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农户领取的优惠券'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_promotions (
      id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id        INT UNSIGNED NOT NULL,
      order_item_id   INT UNSIGNED DEFAULT NULL,
      campaign_id     INT UNSIGNED NOT NULL,
      user_coupon_id  BIGINT UNSIGNED DEFAULT NULL,
      kind            VARCHAR(16) NOT NULL,
      type            VARCHAR(32) NOT NULL,
      campaign_name   VARCHAR(80) NOT NULL,
      product_id      INT UNSIGNED DEFAULT NULL,
      quantity        INT UNSIGNED NOT NULL DEFAULT 0,
      discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      status          VARCHAR(16) NOT NULL DEFAULT 'locked',
      created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_order_promotion_order (order_id, status),
      INDEX idx_order_promotion_campaign (campaign_id, status),
      CONSTRAINT fk_order_promotion_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_order_promotion_campaign FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单营销优惠快照与库存占用'
  `)

  await addColumnIfMissing('orders', 'original_subtotal', "original_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER address")
  await addColumnIfMissing('orders', 'promotion_discount', "promotion_discount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER original_subtotal")
  await addColumnIfMissing('orders', 'coupon_discount', "coupon_discount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER promotion_discount")
  await addColumnIfMissing('orders', 'merchant_discount', "merchant_discount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER coupon_discount")
  await addColumnIfMissing('orders', 'commission_base', "commission_base DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER merchant_discount")
  await addColumnIfMissing('orders', 'user_coupon_id', "user_coupon_id BIGINT UNSIGNED DEFAULT NULL AFTER commission_base")

  await addColumnIfMissing('order_items', 'original_price', "original_price DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER spec")
  await addColumnIfMissing('order_items', 'promotion_price', "promotion_price DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER original_price")
  await addColumnIfMissing('order_items', 'promotion_discount', "promotion_discount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER subtotal")
  await addColumnIfMissing('order_items', 'coupon_discount', "coupon_discount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER promotion_discount")
  await addColumnIfMissing('order_items', 'marketing_campaign_id', "marketing_campaign_id INT UNSIGNED DEFAULT NULL AFTER coupon_discount")

  // 优惠券固定每人限领一次；清理没有订单关联的重复可用券，保留最早领取的一张。
  await db.query(`
    DELETE duplicate_coupon
      FROM user_coupons duplicate_coupon
      JOIN user_coupons other_coupon
        ON other_coupon.campaign_id=duplicate_coupon.campaign_id
       AND other_coupon.user_id=duplicate_coupon.user_id
       AND other_coupon.id<>duplicate_coupon.id
      LEFT JOIN orders o ON o.user_coupon_id=duplicate_coupon.id
      LEFT JOIN order_promotions op ON op.user_coupon_id=duplicate_coupon.id
     WHERE duplicate_coupon.status='available'
       AND duplicate_coupon.locked_order_id IS NULL
       AND o.id IS NULL AND op.id IS NULL
       AND (other_coupon.status IN ('locked','used') OR other_coupon.id<duplicate_coupon.id)
  `)
  await db.query("UPDATE marketing_campaigns SET per_user_limit=1 WHERE kind='coupon'")
  await db.query(`
    UPDATE marketing_campaigns c
    LEFT JOIN (SELECT campaign_id,COUNT(*) AS total FROM user_coupons GROUP BY campaign_id) claimed
      ON claimed.campaign_id=c.id
       SET c.claimed_count=COALESCE(claimed.total,0)
     WHERE c.kind='coupon'
  `)

  await db.query(`UPDATE orders SET original_subtotal=subtotal WHERE original_subtotal=0 AND subtotal>0`)
  await db.query(`UPDATE orders SET commission_base=subtotal WHERE commission_base=0 AND subtotal>0`)
  await db.query(`UPDATE order_items SET original_price=price WHERE original_price=0 AND price>0`)
  await db.query(`UPDATE order_items SET promotion_price=price WHERE promotion_price=0 AND price>0`)
  console.log('[migrate] merchant marketing tables and order discount fields ready')
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[migrate-marketing]', error)
    process.exit(1)
  })
