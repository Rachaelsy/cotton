require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const db = require('./database')

async function run() {
  const columns = [
    {
      name: 'privacy_consent_version',
      ddl: 'privacy_consent_version VARCHAR(32) DEFAULT NULL COMMENT "入驻个人信息授权版本"'
    },
    {
      name: 'privacy_consent_at',
      ddl: 'privacy_consent_at DATETIME DEFAULT NULL COMMENT "入驻个人信息授权时间"'
    }
  ]

  for (const column of columns) {
    const [rows] = await db.query(
      `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME=?`,
      [column.name]
    )
    if (rows.length) {
      console.log(`users.${column.name} 已存在，跳过`)
      continue
    }
    await db.query(`ALTER TABLE users ADD COLUMN ${column.ddl}`)
    console.log(`已添加 users.${column.name}`)
  }

  console.log('入驻个人信息授权字段迁移完成')
  process.exit(0)
}

run().catch(error => {
  console.error('入驻个人信息授权字段迁移失败:', error.message)
  process.exit(1)
})
