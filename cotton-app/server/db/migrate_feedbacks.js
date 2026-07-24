require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const db = require('./database')

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [table, column]
  )
  return rows.length > 0
}

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id      INT UNSIGNED NOT NULL,
      content      TEXT NOT NULL,
      contact      VARCHAR(100) NOT NULL DEFAULT '',
      images_json  TEXT DEFAULT NULL,
      status       VARCHAR(20) NOT NULL DEFAULT 'pending',
      admin_reply  TEXT DEFAULT NULL,
      replied_by   INT UNSIGNED DEFAULT NULL,
      replied_at   DATETIME DEFAULT NULL,
      user_read_at DATETIME DEFAULT NULL,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_feedback_user (user_id, created_at),
      INDEX idx_feedback_status (status, created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农户意见反馈与客服回复'
  `)

  if (!(await columnExists('feedbacks', 'images_json'))) {
    await db.query('ALTER TABLE feedbacks ADD COLUMN images_json TEXT DEFAULT NULL AFTER contact')
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id      INT UNSIGNED NOT NULL,
      sender_type  ENUM('farmer','admin') NOT NULL,
      sender_id    INT UNSIGNED NOT NULL,
      content      VARCHAR(1000) NOT NULL DEFAULT '',
      image_url    VARCHAR(255) NOT NULL DEFAULT '',
      reply_to_id  INT UNSIGNED DEFAULT NULL,
      reply_to_json TEXT DEFAULT NULL,
      recalled_at  DATETIME DEFAULT NULL,
      hidden_for_farmer TINYINT(1) NOT NULL DEFAULT 0,
      hidden_for_admin  TINYINT(1) NOT NULL DEFAULT 0,
      read_at      DATETIME DEFAULT NULL,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_support_user_message (user_id, id),
      INDEX idx_support_unread (user_id, sender_type, read_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农户与平台客服聊天消息'
  `)

  if (!(await columnExists('support_messages', 'recalled_at'))) {
    await db.query('ALTER TABLE support_messages ADD COLUMN recalled_at DATETIME DEFAULT NULL AFTER image_url')
  }
  if (!(await columnExists('support_messages', 'reply_to_id'))) {
    await db.query('ALTER TABLE support_messages ADD COLUMN reply_to_id INT UNSIGNED DEFAULT NULL AFTER image_url')
  }
  if (!(await columnExists('support_messages', 'reply_to_json'))) {
    await db.query('ALTER TABLE support_messages ADD COLUMN reply_to_json TEXT DEFAULT NULL AFTER reply_to_id')
  }
  if (!(await columnExists('support_messages', 'hidden_for_farmer'))) {
    await db.query('ALTER TABLE support_messages ADD COLUMN hidden_for_farmer TINYINT(1) NOT NULL DEFAULT 0 AFTER recalled_at')
  }
  if (!(await columnExists('support_messages', 'hidden_for_admin'))) {
    await db.query('ALTER TABLE support_messages ADD COLUMN hidden_for_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER hidden_for_farmer')
  }
  console.log('[migrate] feedbacks 和 support_messages 表已就绪')
  process.exit(0)
}

migrate().catch(error => {
  console.error(error)
  process.exit(1)
})
