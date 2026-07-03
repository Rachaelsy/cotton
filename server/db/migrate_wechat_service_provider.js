// server/db/migrate_wechat_service_provider.js — 服务商支付/进件字段
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function addColumn(table, column, definition) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    console.log(`✅ ${table}.${column} 已添加`)
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log(`⏭  ${table}.${column} 已存在，跳过`)
    else throw e
  }
}

async function addIndex(table, indexName, expression) {
  try {
    await db.query(`ALTER TABLE ${table} ADD INDEX ${indexName} ${expression}`)
    console.log(`✅ ${table}.${indexName} 已添加`)
  } catch (e) {
    if (e.code === 'ER_DUP_KEYNAME') console.log(`⏭  ${table}.${indexName} 已存在，跳过`)
    else throw e
  }
}

async function migrateMerchantFields() {
  await addColumn('merchants', 'sub_mchid', "VARCHAR(32) DEFAULT NULL COMMENT '微信支付子商户号'")
  await addColumn('merchants', 'wechat_applyment_id', "VARCHAR(64) DEFAULT NULL COMMENT '微信支付进件申请单号'")
  await addColumn('merchants', 'wechat_business_code', "VARCHAR(64) DEFAULT NULL COMMENT '平台侧微信进件业务申请编号'")
  await addColumn('merchants', 'wechat_applyment_state', "VARCHAR(32) DEFAULT NULL COMMENT '微信进件状态'")
  await addColumn('merchants', 'wechat_applyment_msg', "VARCHAR(512) DEFAULT NULL COMMENT '微信进件状态说明/驳回原因'")
  await addColumn('merchants', 'wechat_applyment_payload', "MEDIUMTEXT DEFAULT NULL COMMENT '微信进件资料草稿 JSON'")
  await addColumn('merchants', 'wechat_applyment_updated_at', "DATETIME DEFAULT NULL COMMENT '微信进件状态更新时间'")
  await addIndex('merchants', 'idx_merchants_sub_mchid', '(sub_mchid)')
  await addIndex('merchants', 'idx_merchants_wechat_business_code', '(wechat_business_code)')
}

async function migrateOperatorFields() {
  await addColumn('operators', 'sub_mchid', "VARCHAR(32) DEFAULT NULL COMMENT '微信支付子商户号'")
  await addColumn('operators', 'wechat_applyment_state', "VARCHAR(32) DEFAULT NULL COMMENT '微信进件状态'")
  await addColumn('operators', 'wechat_applyment_msg', "VARCHAR(512) DEFAULT NULL COMMENT '微信进件状态说明/驳回原因'")
  await addIndex('operators', 'idx_operators_sub_mchid', '(sub_mchid)')
}

async function migrateApplymentFiles() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS merchant_applyment_files (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      merchant_id INT UNSIGNED NOT NULL,
      field_name  VARCHAR(64) NOT NULL DEFAULT '',
      local_path  VARCHAR(255) NOT NULL DEFAULT '',
      media_id    VARCHAR(128) NOT NULL DEFAULT '',
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_merchant_field (merchant_id, field_name),
      INDEX idx_media_id (media_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='微信支付商户进件图片素材'
  `)
  console.log('✅ merchant_applyment_files 表已就绪')
}

async function run() {
  await migrateMerchantFields()
  await migrateOperatorFields()
  await migrateApplymentFiles()
  console.log('🎉 服务商支付字段迁移完成')
  process.exit(0)
}

run().catch(e => {
  console.error('❌', e.message)
  process.exit(1)
})
