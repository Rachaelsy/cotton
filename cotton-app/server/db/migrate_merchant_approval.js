// server/db/migrate_merchant_approval.js — 商户审批字段迁移
// 用法：node db/migrate_merchant_approval.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function run() {
  // 1. apply_status 字段
  try {
    await db.query(`ALTER TABLE merchants ADD COLUMN apply_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved' COMMENT '入驻审批状态'`)
    console.log('✅ 已添加 apply_status 字段（已有商户默认 approved）')
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('⏭  apply_status 已存在，跳过')
    else throw e
  }

  // 2. reject_reason 字段
  try {
    await db.query(`ALTER TABLE merchants ADD COLUMN reject_reason VARCHAR(256) DEFAULT NULL COMMENT '拒绝原因'`)
    console.log('✅ 已添加 reject_reason 字段')
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('⏭  reject_reason 已存在，跳过')
    else throw e
  }

  console.log('\n迁移完成。已有商户的 apply_status 均为 approved，新申请默认 pending。')
  process.exit(0)
}

run().catch(err => { console.error('❌', err.message); process.exit(1) })
