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
run_optional_node() {
  script="$1"
  echo "-> $script"
  if ! node "$script"; then
    echo "WARNING: $script failed; continuing startup for compatibility" >&2
  fi
}

run_optional_node db/migrate_products.js
run_optional_node db/migrate_admin.js
run_optional_node db/migrate_merchant_approval.js
run_optional_node db/migrate_openid.js
run_optional_node db/migrate_product_image.js
run_optional_node db/migrate_orders.js
run_optional_node db/migrate_logistics.js
run_optional_node db/migrate_product_detail.js
run_optional_node db/migrate_merchant_wechat.js
run_optional_node db/migrate_aftersale.js
run_optional_node db/migrate_aftersale_images.js
run_optional_node db/migrate_fund_status.js
run_optional_node db/migrate_messages.js
run_optional_node db/migrate_commission.js
run_optional_node db/migrate_pay_expires.js
run_optional_node db/migrate_reviews.js
run_optional_node db/migrate_plots.js
run_optional_node db/migrate_farm_records.js
run_optional_node db/migrate_machines.js
run_optional_node db/migrate_order_delete.js
run_optional_node db/migrate_delivery_range.js
run_optional_node db/migrate_wechat_service_provider.js
run_optional_node db/migrate_profit_sharing.js
run_optional_node db/migrate_commission_requests.js
run_optional_node db/migrate_wechat_refunds.js
run_optional_node db/migrate_experts.js
run_optional_node db/migrate_expert_contents.js
run_optional_node db/migrate_expert_questions.js
run_optional_node db/migrate_farmer_improvements.js
run_optional_node db/migrate_feedbacks.js
run_optional_node db/seed.js
run_optional_node db/seed_machines.js
echo "✅ 数据库初始化完成"

echo "🚀 启动服务..."
exec node index.js
