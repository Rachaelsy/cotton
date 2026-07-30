// 本地开发演示商品。生产环境不会由入口脚本自动执行。
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

const products = [
  ['吡虫啉可湿性粉剂 500g', '农药', 45, '袋', 200, '棉花蚜虫防治用药，使用前请核对登记作物与标签剂量', '🧪'],
  ['氯氟氰菊酯乳油 100ml', '农药', 28, '瓶', 150, '请按产品标签和当地植保建议使用', '🧴'],
  ['尿素 50kg', '化肥', 45, '袋', 500, '氮肥示例商品，实际施用量需结合土壤与长势', '🌾'],
  ['磷酸二铵 50kg', '化肥', 95, '袋', 300, '磷氮复合肥示例商品', '💊'],
  ['棉花地膜', '农膜', 120, '卷', 60, '规格与厚度以商户实际资料为准', '📜'],
  ['滴灌带 1000m', '灌溉设备', 280, '卷', 40, '管径、壁厚与流量为下单前必核参数', '💧']
]

async function run() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境禁止写入演示商品')
  }

  const [[merchant]] = await db.query(
    `SELECT u.id
       FROM users u
       JOIN merchants m ON m.user_id=u.id
      WHERE u.phone='13800000002'
      LIMIT 1`
  )
  if (!merchant) throw new Error('请先执行 node db/seed.js 创建本地演示商户')

  const [[count]] = await db.query(
    'SELECT COUNT(*) AS total FROM products WHERE merchant_id=?',
    [merchant.id]
  )
  if (Number(count.total) > 0) {
    console.log('⏭  演示商户已有商品，跳过写入')
    return
  }

  for (const product of products) {
    await db.query(
      `INSERT INTO products
        (merchant_id,name,category,price,unit,stock,status,description,icon)
       VALUES (?,?,?,?,?,?,'on',?,?)`,
      [merchant.id, ...product]
    )
  }
  console.log(`✅ 已写入 ${products.length} 条本地演示商品`)
}

run()
  .catch(error => {
    console.error(`❌ 演示商品写入失败：${error.message}`)
    process.exitCode = 1
  })
  .finally(() => db.end())
