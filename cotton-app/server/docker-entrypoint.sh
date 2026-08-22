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
run_migration() {
  script="$1"
  echo "-> $script"
  node "$script"
}

run_migration db/migrate_products.js
run_migration db/migrate_admin.js
run_migration db/migrate_privacy_consent.js
run_migration db/migrate_merchant_approval.js
run_migration db/migrate_openid.js
run_migration db/migrate_miniapp_identities.js
run_migration db/migrate_user_public_profile.js
run_migration db/migrate_product_image.js
run_migration db/migrate_orders.js
run_migration db/migrate_guest_checkout.js
run_migration db/migrate_logistics.js
run_migration db/migrate_product_detail.js
run_migration db/migrate_merchant_wechat.js
run_migration db/migrate_aftersale.js
run_migration db/migrate_aftersale_images.js
run_migration db/migrate_fund_status.js
run_migration db/migrate_messages.js
run_migration db/migrate_commission.js
run_migration db/migrate_pay_expires.js
run_migration db/migrate_reviews.js
run_migration db/migrate_plots.js
run_migration db/migrate_farm_records.js
run_migration db/migrate_machines.js
run_migration db/migrate_order_delete.js
run_migration db/migrate_delivery_range.js
run_migration db/migrate_wechat_service_provider.js
run_migration db/migrate_profit_sharing.js
run_migration db/migrate_commission_requests.js
run_migration db/migrate_wechat_refunds.js
run_migration db/migrate_supply_payment_trace.js
run_migration db/migrate_experts.js
run_migration db/migrate_expert_contents.js
run_migration db/migrate_expert_questions.js
run_migration db/migrate_farmer_improvements.js
run_migration db/migrate_machine_reliability.js
run_migration db/migrate_feedbacks.js
run_migration db/migrate_marketing.js
run_migration db/migrate_points.js
run_migration db/migrate_pest_recognitions.js
run_migration db/migrate_private_applyment_files.js
run_migration db/migrate_encrypt_applyment_drafts.js

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  if [ "${NODE_ENV:-development}" = "production" ]; then
    echo "ERROR: SEED_DEMO_DATA cannot be enabled in production" >&2
    exit 1
  fi
  echo "🌱 写入本地演示数据..."
  node db/seed.js
  node db/seed_products.js
  node db/seed_machines.js
else
  echo "⏭  未启用 SEED_DEMO_DATA，跳过演示账号、商品和农机数据"
fi
echo "✅ 数据库初始化完成"

echo "🚀 启动服务..."
exec node ${NODE_ARGS:-} index.js
