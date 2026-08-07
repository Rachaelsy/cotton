const db = require('./database')

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS pest_recognition_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      image_url VARCHAR(500) NOT NULL DEFAULT '',
      reply TEXT,
      diagnosis_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_pest_recognition_user_created (user_id, created_at),
      CONSTRAINT fk_pest_recognition_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('[migrate] pest recognition records ready')
}

if (require.main === module) {
  run()
    .catch(error => { console.error(error); process.exitCode = 1 })
    .finally(() => db.end())
}

module.exports = { run }
