// server/db/migrate_wechat_service_provider.js - WeChat Pay service-provider fields
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function addColumn(table, column, definition) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    console.log(`[migrate] ${table}.${column} added`)
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') console.log(`[migrate] ${table}.${column} exists, skipped`)
    else throw error
  }
}

async function addIndex(table, indexName, expression) {
  try {
    await db.query(`ALTER TABLE ${table} ADD INDEX ${indexName} ${expression}`)
    console.log(`[migrate] ${table}.${indexName} added`)
  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME') console.log(`[migrate] ${table}.${indexName} exists, skipped`)
    else throw error
  }
}

async function migrateApplymentFields(table) {
  await addColumn(table, 'sub_mchid', "VARCHAR(32) DEFAULT NULL COMMENT 'WeChat Pay sub merchant id'")
  await addColumn(table, 'wechat_applyment_id', "VARCHAR(64) DEFAULT NULL COMMENT 'WeChat Pay applyment id'")
  await addColumn(table, 'wechat_business_code', "VARCHAR(64) DEFAULT NULL COMMENT 'WeChat Pay applyment business code'")
  await addColumn(table, 'wechat_applyment_state', "VARCHAR(32) DEFAULT NULL COMMENT 'WeChat Pay applyment state'")
  await addColumn(table, 'wechat_applyment_msg', "VARCHAR(512) DEFAULT NULL COMMENT 'WeChat Pay applyment message'")
  await addColumn(table, 'wechat_applyment_payload', "MEDIUMTEXT DEFAULT NULL COMMENT 'WeChat Pay applyment draft JSON'")
  await addColumn(table, 'wechat_applyment_updated_at', "DATETIME DEFAULT NULL COMMENT 'WeChat Pay applyment updated time'")
  await addIndex(table, `idx_${table}_sub_mchid`, '(sub_mchid)')
  await addIndex(table, `idx_${table}_wechat_business_code`, '(wechat_business_code)')
}

async function migrateApplymentFiles() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS merchant_applyment_files (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      merchant_id  INT UNSIGNED NOT NULL,
      field_name   VARCHAR(64) NOT NULL DEFAULT '',
      local_path   VARCHAR(255) NOT NULL DEFAULT '',
      media_id     VARCHAR(128) NOT NULL DEFAULT '',
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_merchant_field (merchant_id, field_name),
      INDEX idx_media_id (media_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='WeChat Pay merchant applyment media'
  `)
  console.log('[migrate] merchant_applyment_files ready')
}

async function run() {
  await migrateApplymentFields('merchants')
  await migrateApplymentFields('operators')
  await migrateApplymentFiles()
  console.log('[migrate] WeChat Pay service-provider fields ready')
  process.exit(0)
}

run().catch(error => {
  console.error('[migrate] WeChat Pay service-provider fields failed:', error.message)
  process.exit(1)
})
