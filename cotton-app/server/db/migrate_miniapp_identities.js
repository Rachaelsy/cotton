require('dotenv').config()
const db = require('./database')

async function main() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS mini_program_identities (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      client_key VARCHAR(32) NOT NULL,
      appid VARCHAR(64) NOT NULL,
      openid VARCHAR(64) NOT NULL,
      unionid VARCHAR(64) DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_mini_identity_client_openid (client_key, openid),
      UNIQUE KEY uk_mini_identity_user_client (user_id, client_key),
      KEY idx_mini_identity_unionid (unionid),
      CONSTRAINT fk_mini_identity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('[migrate] mini_program_identities ready')
  process.exit(0)
}

main().catch(error => {
  console.error('[migrate] mini_program_identities failed:', error.message)
  process.exit(1)
})
