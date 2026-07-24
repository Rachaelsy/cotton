// server/db/migrate_order_delete.js — 订单按角色软删除（隐藏）字段
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function addCol(table, col) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${col} TINYINT NOT NULL DEFAULT 0`)
    console.log(`✅ ${table}.${col} 已添加`)
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log(`ℹ️  ${table}.${col} 已存在，跳过`)
    else if (e.code === 'ER_NO_SUCH_TABLE') console.log(`⏭  ${table} 表不存在，跳过`)
    else throw e
  }
}

async function migrate() {
  // 农资订单：农户/商户各自隐藏
  await addCol('orders', 'farmer_deleted')
  await addCol('orders', 'merchant_deleted')
  // 农机预约订单：农户/机主各自隐藏
  await addCol('machine_orders', 'farmer_deleted')
  await addCol('machine_orders', 'operator_deleted')
  console.log('✅ 订单软删除字段就绪')
  process.exit(0)
}

migrate().catch(err => { console.error('❌', err.message); process.exit(1) })
