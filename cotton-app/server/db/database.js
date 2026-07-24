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
  charset:         'utf8mb4',
  // The product operates in China. Keep DATETIME parsing and SQL NOW() on the
  // same clock even when the cloud host itself runs in UTC.
  timezone:        '+08:00'
})

pool.on('connection', connection => {
  connection.query("SET time_zone = '+08:00'", error => {
    if (error) console.error('MySQL 时区初始化失败:', error.message)
  })
})

// 测试连接
pool.getConnection()
  .then(conn => { console.log('✅ MySQL 连接成功'); conn.release() })
  .catch(err => console.error('❌ MySQL 连接失败:', err.message))

module.exports = pool
