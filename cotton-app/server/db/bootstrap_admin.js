require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const bcrypt = require('bcryptjs')
const db = require('./database')
const { generateStrongPassword, validateStrongPassword } = require('../utils/password-policy')

function argValue(name) {
  const prefix = `--${name}=`
  const item = process.argv.slice(2).find(value => value.startsWith(prefix))
  return item ? item.slice(prefix.length).trim() : ''
}

async function run() {
  const phone = argValue('phone') || String(process.env.BOOTSTRAP_ADMIN_PHONE || '').trim()
  const name = argValue('name') || String(process.env.BOOTSTRAP_ADMIN_NAME || '系统管理员').trim()
  const suppliedPassword = argValue('password') || String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '')
  const password = suppliedPassword || generateStrongPassword()
  const reset = process.argv.includes('--reset')
  const promote = process.argv.includes('--promote')

  if (!/^1\d{10}$/.test(phone)) {
    throw new Error('请通过 --phone=11位手机号 指定管理员账号')
  }
  const passwordError = validateStrongPassword(password)
  if (passwordError) throw new Error(passwordError)

  const [rows] = await db.query(
    'SELECT id,is_admin FROM users WHERE phone=? LIMIT 1',
    [phone]
  )
  const existing = rows[0]

  if (existing && !existing.is_admin && !promote) {
    throw new Error('该手机号已是普通用户；如确认授予管理员权限，请追加 --promote')
  }
  if (existing && existing.is_admin && !reset) {
    console.log('管理员账号已存在，未修改密码；如需重置请追加 --reset')
    return
  }

  const hash = await bcrypt.hash(password, 12)
  if (existing) {
    await db.query(
      `UPDATE users
          SET password=?,real_name=?,is_admin=1,is_active=1,
              admin_auth_version=admin_auth_version+1
        WHERE id=?`,
      [hash, name || '系统管理员', existing.id]
    )
    console.log('✅ 管理员账号已更新，所有旧管理员登录状态已失效')
  } else {
    await db.query(
      `INSERT INTO users
        (phone,password,role,real_name,is_admin,is_active,admin_auth_version)
       VALUES (?,?, 'farmer', ?,1,1,0)`,
      [phone, hash, name || '系统管理员']
    )
    console.log('✅ 管理员账号已创建')
  }

  if (!suppliedPassword) {
    console.log('一次性初始密码（仅本次显示）：')
    console.log(password)
    console.log('登录后请立即在“账户安全”中修改密码。')
  }
}

if (require.main === module) {
  run()
    .catch(error => {
      console.error(`❌ 管理员初始化失败：${error.message}`)
      process.exitCode = 1
    })
    .finally(() => db.end())
}

module.exports = {
  run
}
