// 本地开发演示商品。生产环境不会由入口脚本自动执行。
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

const products = [
  ['塔河2号包衣棉种 20kg', '棉花种子', 298, '袋', 60, '2025年喀什地区品种对比试验品种。实际销售前须补齐审定编号、许可证、检验批次和发芽率等标签信息。', '🌱'],
  ['棉田复合肥 18-18-18 50kg', '化肥', 188, '袋', 120, '均衡型颗粒复合肥，在线下单前请核对总养分、执行标准、生产批次和配送范围。', '🌾'],
  ['大量元素水溶肥 20-20-20+TE 20kg', '化肥', 168, '袋', 90, '棉田滴灌用均衡型水溶肥，具体施用量需结合土壤、苗情和水肥计划。', '💧'],
  ['花铃期高钾水溶肥 15-5-30+TE 20kg', '化肥', 176, '袋', 75, '花铃期高钾型水溶肥，购买时核对养分含量、执行标准和批次标签。', '🌿'],
  ['70%吡虫啉水分散粒剂 100g', '农药', 38, '袋', 150, '用于棉田前必须核对实物标签的登记作物、防治对象、剂量和安全间隔期。', '🧪'],
  ['聚乙烯棉田地膜 0.010mm', '农膜', 186, '卷', 80, '棉田铺膜用聚乙烯农膜，幅宽、卷长和克重需按播种铺膜机型确认。', '📜'],
  ['单翼迷宫滴灌带 16mm×1000m', '滴灌', 328, '卷', 50, '16mm单翼迷宫式滴灌带，滴头间距、壁厚、流量和工作压力下单前确认。', '💧'],
  ['2英寸叠片过滤器套装', '滴灌', 268, '套', 35, '滴灌首部过滤套装，实际过滤精度、设计流量、接口形式和承压等级以商户清单为准。', '🔧'],
  ['新陆中61号包衣棉种 20kg', '棉花种子', 318, '袋', 45, '南疆棉区棉花品种商品，供货前须核对审定区域、种子标签、生产经营许可和检验批次。', '🌱'],
  ['农业用尿素 46% 50kg', '化肥', 118, '袋', 180, '颗粒尿素，适用于按土壤、苗情和滴灌施肥方案补充氮素，商品指标以实物标签为准。', '🌾'],
  ['磷酸二铵 64% 50kg', '化肥', 245, '袋', 95, '颗粒磷酸二铵，可用于棉田基肥配置，实际用量需结合土壤检测和整体施肥方案。', '🌾'],
  ['腐植酸水溶肥 20kg', '化肥', 158, '袋', 70, '可纳入棉田滴灌施肥方案，使用前应确认产品含量、溶解性和管路兼容性。', '💧'],
  ['棉田诱虫黄板 25cm×20cm 20片', '农药', 26, '包', 220, '棉田虫情监测与物理防控用品，可辅助观察有翅蚜、烟粉虱等害虫动态。', '🟨'],
  ['PE滴灌主管 63mm×100m', '滴灌', 365, '卷', 40, '棉田滴灌输水用PE主管，壁厚和承压等级需按流量、距离和轮灌区方案选择。', '💧'],
  ['滴灌旁通阀 16mm 50只装', '滴灌', 68, '包', 130, '支管与滴灌带连接及分行控制配件，请核对滴灌带、开孔器和密封圈规格。', '🔧']
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

  let inserted = 0
  for (const product of products) {
    const [[existing]] = await db.query(
      'SELECT id FROM products WHERE merchant_id=? AND name=? LIMIT 1',
      [merchant.id, product[0]]
    )
    if (existing) continue
    await db.query(
      `INSERT INTO products
        (merchant_id,name,category,price,unit,stock,status,description,icon)
       VALUES (?,?,?,?,?,?,'on',?,?)`,
      [merchant.id, ...product]
    )
    inserted += 1
  }
  console.log(`✅ 已补充 ${inserted} 条本地演示商品（商品库共核对 ${products.length} 条）`)
}

run()
  .catch(error => {
    console.error(`❌ 演示商品写入失败：${error.message}`)
    process.exitCode = 1
  })
  .finally(() => db.end())
