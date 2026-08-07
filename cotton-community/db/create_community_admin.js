require('dotenv').config()

const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const db = require('./database')

function randomPassword() {
  return `Y!${crypto.randomBytes(15).toString('base64url')}8a`
}

async function run() {
  const phone = String(process.argv[2] || '').trim()
  const displayName = String(process.argv.slice(3).join(' ') || '公益平台管理员').trim().slice(0, 64)
  if (!/^1\d{10}$/.test(phone)) {
    throw new Error('用法：node db/create_community_admin.js <11位手机号> [管理员名称]')
  }

  const password = randomPassword()
  const hash = await bcrypt.hash(password, 12)
  await db.query(
    `INSERT INTO community_admins
      (phone,password,display_name,permission_key,is_active,auth_version)
     VALUES (?,?,?,'policy_editor',1,0)
     ON DUPLICATE KEY UPDATE
       password=VALUES(password),display_name=VALUES(display_name),permission_key='policy_editor',
       is_active=1,auth_version=auth_version+1`,
    [phone, hash, displayName]
  )

  console.log('公益平台政策管理员已创建或重置。')
  console.log(`登录手机号：${phone}`)
  console.log(`一次性初始密码：${password}`)
  console.log('请立即保存密码；该密码不会写入文件或数据库明文。')
}

run()
  .then(() => db.end())
  .catch(async error => {
    console.error(error.message)
    try { await db.end() } catch {}
    process.exit(1)
  })
