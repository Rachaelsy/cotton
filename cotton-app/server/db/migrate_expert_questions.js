require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const db = require('./database')

async function ensureColumn(name, ddl) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expert_questions' AND COLUMN_NAME = ?`,
    [name]
  )
  if (!rows.length) {
    await db.query(`ALTER TABLE expert_questions ADD COLUMN ${ddl}`)
    console.log(`✅ expert_questions.${name} 已添加`)
  }
}

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS expert_questions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED DEFAULT NULL,
      farmer_name VARCHAR(64) DEFAULT '',
      farmer_phone VARCHAR(32) DEFAULT '',
      category VARCHAR(64) DEFAULT '',
      crop_stage VARCHAR(64) DEFAULT '',
      plot_id INT UNSIGNED DEFAULT NULL,
      plot_name VARCHAR(128) DEFAULT '',
      question TEXT NOT NULL,
      images TEXT DEFAULT NULL,
      status ENUM('pending','replied','closed') NOT NULL DEFAULT 'pending',
      reply TEXT,
      replied_by INT UNSIGNED DEFAULT NULL,
      replied_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_created (user_id, created_at),
      INDEX idx_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专家讲堂农户提问'
  `)
  await ensureColumn('plot_id', 'plot_id INT UNSIGNED DEFAULT NULL AFTER crop_stage')
  await ensureColumn('images', 'images TEXT DEFAULT NULL AFTER question')
  console.log('✅ expert_questions 表已就绪')
  process.exit(0)
}

run().catch(error => {
  console.error('❌ expert_questions 迁移失败:', error.message)
  process.exit(1)
})
