require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function ensureColumn(column, definition) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) total FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='academy_courses' AND COLUMN_NAME=?`,
    [column]
  )
  if (!Number(row.total)) await db.query(`ALTER TABLE academy_courses ADD COLUMN ${column} ${definition}`)
}

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS academy_series (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      series_key VARCHAR(80) NOT NULL UNIQUE,
      level ENUM('basic','intermediate','advanced') NOT NULL DEFAULT 'basic',
      title VARCHAR(160) NOT NULL,
      summary VARCHAR(1000) DEFAULT '',
      teacher VARCHAR(100) DEFAULT '平台农技组',
      cover_url VARCHAR(500) DEFAULT '',
      status ENUM('draft','published','offline') NOT NULL DEFAULT 'published',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_academy_series_level (level,status,sort_order,id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优棉学堂系列课程'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS academy_courses (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      course_key VARCHAR(80) NOT NULL UNIQUE,
      level ENUM('basic','intermediate','advanced') NOT NULL DEFAULT 'basic',
      type ENUM('video','article') NOT NULL DEFAULT 'video',
      title VARCHAR(160) NOT NULL,
      summary VARCHAR(1000) DEFAULT '',
      teacher VARCHAR(100) DEFAULT '平台农技组',
      teacher_title VARCHAR(120) DEFAULT '棉花栽培课程',
      cover_url VARCHAR(500) DEFAULT '',
      cover_object_key VARCHAR(500) DEFAULT '',
      video_url VARCHAR(500) DEFAULT '',
      video_object_key VARCHAR(500) DEFAULT '',
      vod_file_id VARCHAR(64) NOT NULL DEFAULT '',
      vod_status ENUM('none','ready','processing','failed') NOT NULL DEFAULT 'none',
      duration_seconds INT UNSIGNED NOT NULL DEFAULT 60,
      objectives_json VARCHAR(2000) DEFAULT '[]',
      status ENUM('draft','published','offline') NOT NULL DEFAULT 'draft',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      view_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_by INT UNSIGNED DEFAULT NULL,
      published_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_academy_status_level (status,level,sort_order,id),
      INDEX idx_academy_featured (is_featured,status,sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优棉学堂课程'
  `)

  await ensureColumn('vod_file_id', "VARCHAR(64) NOT NULL DEFAULT '' AFTER video_object_key")
  await ensureColumn('vod_status', "ENUM('none','ready','processing','failed') NOT NULL DEFAULT 'none' AFTER vod_file_id")
  await ensureColumn('series_key', "VARCHAR(80) NOT NULL DEFAULT '' AFTER course_key")
  await ensureColumn('lesson_no', "INT UNSIGNED NOT NULL DEFAULT 1 AFTER series_key")

  await db.query(`
    CREATE TABLE IF NOT EXISTS academy_comments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      course_id VARCHAR(80) NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      parent_id BIGINT UNSIGNED DEFAULT NULL,
      content VARCHAR(500) NOT NULL,
      status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_academy_comment_course (course_id,status,created_at),
      INDEX idx_academy_comment_parent (parent_id,created_at),
      INDEX idx_academy_comment_user (user_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优棉学堂课程评论'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS academy_comment_likes (
      comment_id BIGINT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (comment_id,user_id),
      INDEX idx_academy_comment_like_user (user_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优棉学堂评论点赞'
  `)

  console.log('[migrate] academy schema ready (no demo courses are seeded)')
}

run().then(() => process.exit(0)).catch(error => {
  console.error('[migrate-academy]', error)
  process.exit(1)
})
