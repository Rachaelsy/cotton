// server/db/database.js — MySQL 连接池
const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host:            process.env.DB_HOST || 'localhost',
  port:            parseInt(process.env.DB_PORT) || 3306,
  database:        process.env.DB_NAME || 'cotton_db',
  user:            process.env.DB_USER || 'root',
  password:        process.env.DB_PASS || '',
  waitForConnections: true,
  connectionLimit: 10,
  charset:         'utf8mb4'
})

// 测试连接
pool.getConnection()
  .then(conn => { console.log('✅ MySQL 连接成功'); conn.release() })
  .catch(err => console.error('❌ MySQL 连接失败:', err.message))

module.exports = pool
