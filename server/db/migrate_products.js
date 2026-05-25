require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      merchant_id INT UNSIGNED NOT NULL COMMENT '商户user_id',
      name        VARCHAR(128) NOT NULL               COMMENT '商品名称',
      category    VARCHAR(64)  DEFAULT NULL            COMMENT '分类',
      price       DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '售价（元）',
      unit        VARCHAR(32)  DEFAULT NULL            COMMENT '单位',
      stock       INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '库存',
      status      ENUM('on','off') NOT NULL DEFAULT 'on' COMMENT '在售/下架',
      description TEXT         DEFAULT NULL            COMMENT '商品描述',
      icon        VARCHAR(8)   DEFAULT '📦'           COMMENT '商品图标emoji',
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_merchant (merchant_id),
      INDEX idx_status   (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农资商品表'
  `)
  console.log('✅ products 表已创建')

  // 查询测试商户ID
  const [[m1]] = await db.query("SELECT id FROM users WHERE phone='13800000002'")
  const [[m2]] = await db.query("SELECT id FROM users WHERE phone='13900000001'")

  if (!m1 || !m2) {
    console.log('❌ 找不到测试商户，请先运行 seed.js')
    process.exit(1)
  }

  // 检查是否已有数据
  const [[cnt]] = await db.query('SELECT COUNT(*) as n FROM products')
  if (cnt.n > 0) {
    console.log(`⏭  products 已有 ${cnt.n} 条数据，跳过种子插入`)
    process.exit(0)
  }

  const seeds = [
    // 疏附县农资有限公司 (13800000002)
    [m1.id, '吡虫啉可湿性粉剂 500g', '农药', 45.00, '袋', 200, 'on', '棉花蚜虫专用，见效快', '🧪'],
    [m1.id, '氯氟氰菊酯乳油 100ml', '农药', 28.00, '瓶', 150, 'on', '广谱杀虫，安全低毒', '🧴'],
    [m1.id, '复合肥料（尿素）50kg', '化肥', 45.00, '袋', 500, 'on', '氮含量46%，适合棉花追肥', '🌾'],
    [m1.id, '磷酸二铵 50kg', '化肥', 95.00, '袋', 300, 'on', '氮磷双效，底肥首选', '💊'],
    [m1.id, '棉花催熟剂 1L', '植调剂', 62.00, '升', 80, 'on', '加速吐絮，提高采收效率', '⚗️'],
    [m1.id, '硫酸钾 25kg', '化肥', 68.00, '袋', 120, 'on', '增甜提质，抗倒伏', '🪨'],
    // 疏附县鑫农农资有限公司 (13900000001)
    [m2.id, '棉花专用地膜（黑色）', '农膜', 120.00, '卷', 60, 'on', '宽幅1.4m，厚度0.012mm', '📜'],
    [m2.id, '滴灌带（薄壁型）1000m', '灌溉设备', 280.00, '卷', 40, 'on', '16mm管径，流量均匀稳定', '💧'],
    [m2.id, '新陆早57号棉花种子 5kg', '种子', 128.00, '袋', 200, 'on', '早熟抗病，高产优质', '🌱'],
    [m2.id, '中棉所96号棉花种子 5kg', '种子', 135.00, '袋', 180, 'on', '铃重5.5g，衣分43%', '🫘'],
    [m2.id, '高效氯氰菊酯 250ml', '农药', 32.00, '瓶', 220, 'on', '广谱速效杀虫剂', '🔬'],
    [m2.id, '腐殖酸水溶肥 20kg', '化肥', 85.00, '桶', 90, 'on', '活化土壤，促根壮苗', '🪣'],
  ]

  for (const s of seeds) {
    await db.query(
      'INSERT INTO products (merchant_id,name,category,price,unit,stock,status,description,icon) VALUES (?,?,?,?,?,?,?,?,?)',
      s
    )
  }

  console.log(`✅ 已插入 ${seeds.length} 条商品测试数据`)
  process.exit(0)
}

migrate().catch(err => { console.error('❌', err.message); process.exit(1) })
