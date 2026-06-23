// server/db/migrate_delivery_range.js — 可配送范围字段
// 机具(service_radius) + 商户(基地定位 + delivery_radius)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function addCol(table, col, def) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
    console.log(`✅ ${table}.${col} 已添加`)
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log(`ℹ️  ${table}.${col} 已存在，跳过`)
    else if (e.code === 'ER_NO_SUCH_TABLE') console.log(`⏭  ${table} 表不存在，跳过`)
    else throw e
  }
}

async function migrate() {
  // 机具可配送（作业服务）半径，单位 km
  await addCol('machines', 'service_radius', "DECIMAL(6,1) NOT NULL DEFAULT 50")
  // 商户基地定位 + 可配送半径
  await addCol('merchants', 'latitude', 'DECIMAL(10,7) DEFAULT NULL')
  await addCol('merchants', 'longitude', 'DECIMAL(10,7) DEFAULT NULL')
  await addCol('merchants', 'location_name', "VARCHAR(128) NOT NULL DEFAULT ''")
  await addCol('merchants', 'delivery_radius', "DECIMAL(6,1) NOT NULL DEFAULT 50")
  console.log('✅ 可配送范围字段就绪')
  process.exit(0)
}

migrate().catch(err => { console.error('❌', err.message); process.exit(1) })
