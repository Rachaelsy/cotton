require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const db = require('./database')

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS expert_contents (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      type ENUM('video','article','qa') NOT NULL DEFAULT 'video',
      title VARCHAR(160) NOT NULL,
      subtitle VARCHAR(255) DEFAULT '',
      category_key VARCHAR(40) DEFAULT 'planting',
      category_name VARCHAR(64) DEFAULT '',
      teacher VARCHAR(64) DEFAULT '',
      teacher_title VARCHAR(64) DEFAULT '',
      org VARCHAR(128) DEFAULT '',
      expert_avatar VARCHAR(16) DEFAULT '👨‍🌾',
      expert_tags VARCHAR(512) DEFAULT '[]',
      intro TEXT,
      content MEDIUMTEXT,
      cover_url VARCHAR(255) DEFAULT '',
      video_url VARCHAR(255) DEFAULT '',
      duration VARCHAR(32) DEFAULT '',
      price_type ENUM('free','paid') NOT NULL DEFAULT 'free',
      price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      quiz_json MEDIUMTEXT,
      ai_prompt TEXT,
      students INT UNSIGNED NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      is_published TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_type (type),
      INDEX idx_category (category_key),
      INDEX idx_publish_sort (is_published, sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专家讲堂内容'
  `)

  const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM expert_contents')
  if (Number(count) === 0) {
    await db.query(
      `INSERT INTO expert_contents
       (type,title,subtitle,category_key,category_name,teacher,teacher_title,org,expert_avatar,expert_tags,
        intro,content,duration,price_type,price,quiz_json,ai_prompt,students,sort_order,is_published)
       VALUES ?`,
      [[
        [
          'video',
          '棉花播种前准备与出苗管理',
          '适合喀什棉农的春播基础课',
          'planting',
          '种植技术',
          '王建国',
          '研究员',
          '新疆农科院',
          '👨‍🔬',
          JSON.stringify(['播种', '高产栽培']),
          '讲解整地、滴灌带铺设、播种深度和出苗后查苗补苗。',
          '播种前要检查土地平整度、墒情和滴灌带位置。出苗后重点看缺苗断垄、弱苗和病苗，发现问题及时补苗。',
          '35分钟',
          'free',
          0,
          JSON.stringify([
            {
              question: '棉花播种前最应该先确认什么？',
              options: ['地块墒情和滴灌带位置', '先大量施药', '等苗出来再整地'],
              answer: 0,
              explanation: '墒情和滴灌带位置会直接影响出苗整齐度。'
            }
          ]),
          '你是棉花播种培训教练，请围绕整地、滴灌带、播种深度和出苗管理，用问答方式训练农户。',
          1260,
          10,
          1
        ],
        [
          'article',
          '棉蚜和红蜘蛛田间识别',
          '图文解答常见虫害',
          'pest',
          '病虫害防治',
          '马丽娟',
          '农艺师',
          '喀什地区农技推广站',
          '👩‍🌾',
          JSON.stringify(['虫害识别', '绿色防控']),
          '通过叶片症状、虫体位置和危害表现，帮助农户快速判断常见虫害。',
          '棉蚜多聚集在嫩叶和嫩梢，常导致叶片卷曲、发黏。红蜘蛛常在叶背活动，叶面出现失绿小点，严重时叶片发黄干枯。',
          '8分钟',
          'free',
          0,
          JSON.stringify([
            {
              question: '红蜘蛛常见危害位置在哪里？',
              options: ['叶背', '主根深处', '棉铃内部'],
              answer: 0,
              explanation: '红蜘蛛多在叶背活动，需要翻看叶片背面。'
            }
          ]),
          '你是病虫害识别训练教练，请用简单问题帮助农户区分棉蚜和红蜘蛛。',
          860,
          20,
          1
        ]
      ]]
    )
  }

  console.log('✅ expert_contents 表已就绪')
  process.exit(0)
}

run().catch(err => {
  console.error('❌ expert_contents 迁移失败:', err.message)
  process.exit(1)
})
