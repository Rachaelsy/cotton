#!/bin/sh
set -e

echo "⏳ 等待 MySQL 就绪..."
until node -e "
const mysql = require('mysql2/promise');
mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
}).then(() => process.exit(0)).catch(() => process.exit(1))
" 2>/dev/null; do
  sleep 2
done
echo "✅ MySQL 已就绪"

echo "🗄️  运行数据库迁移..."
node db/migrate_products.js           2>/dev/null || true
node db/migrate_admin.js              2>/dev/null || true
node db/migrate_merchant_approval.js  2>/dev/null || true
node db/migrate_product_image.js      2>/dev/null || true
node db/migrate_orders.js             2>/dev/null || true
node db/migrate_product_detail.js     2>/dev/null || true
node db/migrate_merchant_wechat.js    2>/dev/null || true
node db/migrate_aftersale.js          2>/dev/null || true
node db/migrate_aftersale_images.js   2>/dev/null || true
node db/migrate_fund_status.js        2>/dev/null || true
node db/migrate_messages.js           2>/dev/null || true
node db/migrate_commission.js         2>/dev/null || true
node db/migrate_pay_expires.js        2>/dev/null || true
node db/migrate_reviews.js            2>/dev/null || true
node db/migrate_plots.js              2>/dev/null || true
node db/seed.js                       2>/dev/null || true
echo "✅ 数据库初始化完成"

echo "🚀 启动服务..."
exec node index.js
