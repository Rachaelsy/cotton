// server/db/migrate_experts.js — 独立专家账号表
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const db = require('./database')

async function addColumn(table, name, ddl) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, name]
  )
  if (rows.length) {
    console.log(`⏭  ${table}.${name} 已存在，跳过`)
    return
  }
  await db.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  console.log(`✅ ${table}.${name} 已添加`)
}

async function addIndex(table, name, ddl) {
  const [rows] = await db.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, name]
  )
  if (rows.length) {
    console.log(`⏭  ${table}.${name} 已存在，跳过`)
    return
  }
  await db.query(`ALTER TABLE ${table} ADD INDEX ${name} ${ddl}`)
  console.log(`✅ ${table}.${name} 已添加`)
}

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS experts (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      name VARCHAR(64) NOT NULL,
      title VARCHAR(64) DEFAULT '',
      org VARCHAR(128) DEFAULT 'Cotton 棉花平台',
      avatar VARCHAR(16) DEFAULT '专',
      specialties VARCHAR(512) DEFAULT '[]',
      bio TEXT,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_experts_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专家后台账号'
  `)
  console.log('✅ experts 表已就绪')

  await addColumn('expert_contents', 'expert_id', 'expert_id INT UNSIGNED DEFAULT NULL COMMENT "发布专家ID"')
  await addIndex('expert_contents', 'idx_expert_contents_expert', '(expert_id)')

  process.exit(0)
}

run().catch(error => {
  console.error('❌ experts 迁移失败:', error.message)
  process.exit(1)
})
