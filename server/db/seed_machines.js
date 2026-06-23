// server/db/seed_machines.js — 农机租赁演示数据（幂等）
// 一个已审批的农机手 + 4 台机具（含真实喀什·疏附县坐标）
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const bcrypt = require('bcryptjs')
const db = require('./database')

const OP_PHONE = '13800000003'

async function seed() {
  const [exist] = await db.query('SELECT id FROM users WHERE phone=?', [OP_PHONE])
  let userId
  if (exist.length) {
    userId = exist[0].id
    console.log(`⏭  机手账号 ${OP_PHONE} 已存在`)
  } else {
    const hash = await bcrypt.hash('test123', 10)
    const [u] = await db.query(
      'INSERT INTO users (phone,password,role,real_name) VALUES (?,?,?,?)',
      [OP_PHONE, hash, 'operator', '艾力（测试机手）']
    )
    userId = u.insertId
    console.log(`✅ 创建机手账号 ${OP_PHONE} / test123`)
  }

  // operators（基地：喀什·疏附县 ≈ 39.38, 75.86）
  let [op] = await db.query('SELECT id FROM operators WHERE user_id=?', [userId])
  let operatorId
  if (op.length) {
    operatorId = op[0].id
    await db.query("UPDATE operators SET apply_status='approved' WHERE id=?", [operatorId])
  } else {
    const [r] = await db.query(
      `INSERT INTO operators
       (user_id,org_name,contact,phone,service_area,latitude,longitude,location_name,apply_status,response_time)
       VALUES (?,?,?,?,?,?,?,?,'approved',?)`,
      [userId, '艾力农机合作社', '艾力', OP_PHONE, '喀什·疏附县',
       39.3800000, 75.8600000, '喀什地区疏附县托克扎克镇', '15分钟']
    )
    operatorId = r.insertId
  }
  console.log(`✅ 机手/合作社就绪（operator_id=${operatorId}，已审批）`)

  const machines = [
    {
      name: '大疆 T50 植保无人机', category: '打药机', icon: '🚁',
      price: 8, price_orig: 10, unit: '亩', lat: 39.3820000, lng: 75.8650000,
      loc: '疏附县托克扎克镇 · 基地',
      badges: ['喷幅9m', '效率300亩/天'],
      params: [{ val: '40 L', lbl: '药箱量' }, { val: '9 米', lbl: '喷幅' }, { val: '300亩/天', lbl: '作业效率' }, { val: '13分钟/次', lbl: '电池续航' }]
    },
    {
      name: '约翰迪尔 CP690 采棉机', category: '采棉机', icon: '🌾',
      price: 120, price_orig: 140, unit: '亩', lat: 39.4200000, lng: 75.9200000,
      loc: '疏附县乌帕尔镇',
      badges: ['6行作业', '自动打包'],
      params: [{ val: '6行', lbl: '采收行数' }, { val: '6 米', lbl: '割幅' }, { val: '50亩/天', lbl: '作业效率' }, { val: '12m³', lbl: '棉箱容量' }]
    },
    {
      name: '天鹅 2BMZ-12 播种机', category: '播种机', icon: '🌱',
      price: 30, price_orig: 35, unit: '亩', lat: 39.3500000, lng: 75.8000000,
      loc: '疏附县农业园区',
      badges: ['12行', 'GPS导航'],
      params: [{ val: '12行', lbl: '播种行数' }, { val: '3 米', lbl: '工作幅宽' }, { val: '60亩/天', lbl: '作业效率' }, { val: '120 L', lbl: '种子箱' }]
    },
    {
      name: '雷沃 1GQN-200 旋耕机', category: '旋耕机', icon: '⚙️',
      price: 25, price_orig: null, unit: '亩', lat: 39.5000000, lng: 76.0500000,
      loc: '疏附县布拉克苏乡',
      badges: ['200cm幅宽', '深翻25cm'],
      params: [{ val: '200 cm', lbl: '幅宽' }, { val: '25 cm', lbl: '耕深' }, { val: '40亩/天', lbl: '作业效率' }, { val: '拖拉机配套', lbl: '动力匹配' }]
    }
  ]

  const [had] = await db.query('SELECT COUNT(*) AS n FROM machines WHERE operator_id=?', [operatorId])
  if (had[0].n > 0) {
    console.log(`⏭  机具已存在（${had[0].n} 台），跳过插入`)
  } else {
    for (const m of machines) {
      await db.query(
        `INSERT INTO machines
         (operator_id,name,category,icon,price,price_orig,unit,latitude,longitude,location_name,spec_badges,params,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'on')`,
        [operatorId, m.name, m.category, m.icon, m.price, m.price_orig, m.unit,
         m.lat, m.lng, m.loc, JSON.stringify(m.badges), JSON.stringify(m.params)]
      )
    }
    console.log(`✅ 已插入 ${machines.length} 台演示机具`)
  }

  console.log('\n农机手测试账号：手机号 13800000003  密码 test123（网页机手后台）')
  process.exit(0)
}

seed().catch(err => { console.error('❌', err.message); process.exit(1) })
