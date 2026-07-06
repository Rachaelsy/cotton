#!/bin/sh
set -e

echo "⏳ 等待 MySQL 就绪..."
until node -e "
const m = require('mysql2/promise');
m.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
}).then(c => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done
echo "✅ MySQL 已就绪"

echo "📋 创建基础表结构..."
node -e "
const fs = require('fs');
const m = require('mysql2/promise');
m.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  multipleStatements: true
}).then(async c => {
  const sql = fs.readFileSync('/app/db/schema.sql', 'utf8');
  await c.query(sql);
  await c.end();
  console.log('✅ 基础表结构已创建');
}).catch(e => { console.error('schema error:', e.message); process.exit(1); });
"

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
node db/migrate_farm_records.js       2>/dev/null || true
node db/migrate_machines.js           2>/dev/null || true
node db/migrate_order_delete.js       2>/dev/null || true
node db/migrate_delivery_range.js     2>/dev/null || true
node db/migrate_wechat_service_provider.js 2>/dev/null || true
node db/seed.js                       2>/dev/null || true
node db/seed_machines.js              2>/dev/null || true
echo "✅ 数据库初始化完成"

echo "🚀 启动服务..."
exec node index.js
