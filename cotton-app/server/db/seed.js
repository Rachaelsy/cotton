// server/db/seed.js — 插入测试账号
// 用法：node db/seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const bcrypt = require('bcryptjs')
const db     = require('./database')

const TEST_ACCOUNTS = [
  {
    phone:    '13800000001',
    password: 'test123',
    role:     'farmer',
    real_name: '古丽巴哈尔（测试农户）',
    profile: {
      location:  '喀什·疏附县',
      land_size: 486,
      crop_type: '棉花'
    }
  },
  {
    phone:    '13800000002',
    password: 'test123',
    role:     'merchant',
    real_name: '阿里木（测试商户）',
    profile: {
      company_name:     '疏附县农资有限公司',
      business_license: '91650100TEST0001',
      product_category: '化肥、农药'
    }
  }
]

async function seed() {
  for (const acc of TEST_ACCOUNTS) {
    // 检查是否已存在
    const [rows] = await db.query('SELECT id FROM users WHERE phone=?', [acc.phone])
    if (rows.length > 0) {
      console.log(`⏭  ${acc.phone} 已存在，跳过`)
      continue
    }

    const hash = await bcrypt.hash(acc.password, 10)
    const [result] = await db.query(
      'INSERT INTO users (phone,password,role,real_name) VALUES (?,?,?,?)',
      [acc.phone, hash, acc.role, acc.real_name]
    )
    const userId = result.insertId

    if (acc.role === 'farmer') {
      const p = acc.profile
      await db.query(
        'INSERT INTO farmers (user_id,location,land_size,crop_type) VALUES (?,?,?,?)',
        [userId, p.location, p.land_size, p.crop_type]
      )
    } else {
      const p = acc.profile
      await db.query(
        'INSERT INTO merchants (user_id,company_name,business_license,product_category,apply_status) VALUES (?,?,?,?,?)',
        [userId, p.company_name, p.business_license, p.product_category, 'approved']
      )
    }

    console.log(`✅ 已创建 ${acc.role === 'farmer' ? '农户' : '商户'} 测试账号：${acc.phone} / ${acc.password}`)
  }

  console.log('\n测试账号汇总：')
  console.log('  农户  手机号：13800000001  密码：test123')
  console.log('  商户  手机号：13800000002  密码：test123')
  process.exit(0)
}

seed().catch(err => { console.error('❌ 插入失败：', err.message); process.exit(1) })
