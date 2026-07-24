// server/db/migrate_merchant_wechat.js — 给 merchants 表添加 wechat_id 字段
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  try {
    await db.query(
      `ALTER TABLE merchants ADD COLUMN wechat_id VARCHAR(64) DEFAULT NULL COMMENT '商户客服微信号'`
    )
    console.log('[migrate] merchants.wechat_id 字段已添加')
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('[migrate] wechat_id 字段已存在，跳过')
    } else {
      throw e
    }
  }
  process.exit(0)
}

migrate().catch(e => { console.error(e); process.exit(1) })
