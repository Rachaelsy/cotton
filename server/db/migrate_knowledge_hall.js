require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const db = require('./database')

async function hasColumn(table, column) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [table, column]
  )
  return Number(row.total || 0) > 0
}

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS knowledge_contents (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      type ENUM('video','article','gallery') NOT NULL DEFAULT 'article',
      title VARCHAR(160) NOT NULL,
      subtitle VARCHAR(255) DEFAULT '',
      category_key VARCHAR(40) NOT NULL DEFAULT 'planting',
      category_name VARCHAR(64) NOT NULL DEFAULT '栽培技术',
      cover_url VARCHAR(500) DEFAULT '',
      video_url VARCHAR(500) DEFAULT '',
      images_json MEDIUMTEXT,
      content MEDIUMTEXT,
      tags_json VARCHAR(1000) DEFAULT '[]',
      quiz_json MEDIUMTEXT,
      duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
      difficulty ENUM('intro','intermediate','advanced') NOT NULL DEFAULT 'intro',
      source_name VARCHAR(120) DEFAULT '棉花智能体知识中心',
      status ENUM('draft','published') NOT NULL DEFAULT 'draft',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      view_count INT UNSIGNED NOT NULL DEFAULT 0,
      comment_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_by INT UNSIGNED DEFAULT NULL,
      published_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status_sort (status,is_featured,sort_order,id),
      INDEX idx_category (category_key,status),
      INDEX idx_type (type,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公共知识讲堂内容'
  `)

  if (!(await hasColumn('knowledge_contents', 'quiz_json'))) {
    await db.query('ALTER TABLE knowledge_contents ADD COLUMN quiz_json MEDIUMTEXT AFTER tags_json')
    console.log('[migrate] knowledge_contents.quiz_json added')
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS knowledge_comments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      content_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      parent_id BIGINT UNSIGNED DEFAULT NULL,
      nickname VARCHAR(64) NOT NULL DEFAULT '学习用户',
      avatar_url VARCHAR(500) DEFAULT '',
      body VARCHAR(800) NOT NULL,
      status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_content_status (content_id,status,id),
      INDEX idx_user (user_id,id),
      CONSTRAINT fk_knowledge_comment_content FOREIGN KEY (content_id) REFERENCES knowledge_contents(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识讲堂评论'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS knowledge_progress (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      content_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      progress_seconds INT UNSIGNED NOT NULL DEFAULT 0,
      duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
      progress_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      last_viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_knowledge_progress (content_id,user_id),
      INDEX idx_user_viewed (user_id,last_viewed_at),
      CONSTRAINT fk_knowledge_progress_content FOREIGN KEY (content_id) REFERENCES knowledge_contents(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识讲堂观看和阅读进度'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS knowledge_favorites (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      content_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_knowledge_favorite (content_id,user_id),
      INDEX idx_user_created (user_id,created_at),
      CONSTRAINT fk_knowledge_favorite_content FOREIGN KEY (content_id) REFERENCES knowledge_contents(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识讲堂收藏'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS knowledge_questions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      nickname VARCHAR(64) NOT NULL DEFAULT '棉友',
      title VARCHAR(160) NOT NULL,
      body TEXT NOT NULL,
      category_key VARCHAR(40) NOT NULL DEFAULT 'other',
      category_name VARCHAR(64) NOT NULL DEFAULT '其他问题',
      tags_json VARCHAR(1000) DEFAULT '[]',
      images_json MEDIUMTEXT,
      status ENUM('open','solved','hidden') NOT NULL DEFAULT 'open',
      accepted_answer_id BIGINT UNSIGNED DEFAULT NULL,
      view_count INT UNSIGNED NOT NULL DEFAULT 0,
      answer_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_forum_status (status,updated_at,id),
      INDEX idx_forum_user (user_id,id),
      INDEX idx_forum_category (category_key,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识讲堂公开问答'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS knowledge_answers (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      question_id BIGINT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      nickname VARCHAR(64) NOT NULL DEFAULT '棉友',
      body TEXT NOT NULL,
      images_json MEDIUMTEXT,
      status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',
      vote_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_answer_question (question_id,status,id),
      INDEX idx_answer_user (user_id,id),
      CONSTRAINT fk_knowledge_answer_question FOREIGN KEY (question_id) REFERENCES knowledge_questions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识讲堂问题回答'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS knowledge_answer_votes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      answer_id BIGINT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_answer_vote (answer_id,user_id),
      INDEX idx_vote_user (user_id,id),
      CONSTRAINT fk_knowledge_vote_answer FOREIGN KEY (answer_id) REFERENCES knowledge_answers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识讲堂回答点赞'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS knowledge_web_login_tickets (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      token_hash CHAR(64) NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_knowledge_web_ticket (token_hash),
      INDEX idx_knowledge_ticket_expiry (expires_at,used_at),
      INDEX idx_knowledge_ticket_user (user_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序与微信网页登录一次性票据'
  `)

  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM knowledge_contents')
  if (Number(total) === 0) {
    const heroCover = '/admin/assets/knowledge-hero-v2.webp'
    const seedlingCover = '/admin/assets/course-seedling-v2.webp'
    const scoutingCover = '/admin/assets/course-scouting-v2.webp'
    const waterCover = '/admin/assets/course-water-v2.webp'
    await db.query(
      `INSERT INTO knowledge_contents
       (type,title,subtitle,category_key,category_name,cover_url,video_url,images_json,content,tags_json,
        duration_seconds,difficulty,source_name,status,is_featured,sort_order,published_at)
       VALUES ?`,
      [[
        ['video', '棉花全生育期管理入门', '从播种到采收，先建立一套清晰的田间管理节奏', 'planting', '栽培技术', heroCover, '', '[]',
          '这是一节面向初学者的总览课。\n\n一、播种前：检查地块平整度、墒情、种子质量和滴灌带位置。\n\n二、苗期：重点关注出苗整齐度、缺苗断垄和低温冷害。\n\n三、蕾期与花铃期：水肥管理要看长势、天气和土壤，不盲目加量。\n\n四、吐絮期：减少无效投入，关注脱叶催熟时机和采收质量。',
          JSON.stringify(['全生育期', '新手入门', '田间管理']), 720, 'intro', '棉花智能体知识中心', 'published', 1, 10, new Date()],
        ['article', '播种前地块准备清单', '把影响出苗整齐度的关键事项一次检查完', 'planting', '栽培技术', seedlingCover, '', '[]',
          '播种前不要只看日期，要同时确认地温、墒情和天气趋势。\n\n建议按顺序检查：土地是否平整，残膜和秸秆是否清理，滴灌带位置是否准确，种子发芽率是否可靠，播种深度是否适合当前土壤。\n\n完成播种后要及时记录品种、播量、日期和地块，方便后续对比出苗情况。',
          JSON.stringify(['播种', '整地', '出苗']), 360, 'intro', '棉花智能体知识中心', 'published', 1, 20, new Date()],
        ['article', '棉蚜与红蜘蛛快速区分', '从危害位置、叶片表现和虫体特征判断', 'pest', '病虫害防治', scoutingCover, '', '[]',
          '棉蚜常聚集在嫩叶、嫩梢，叶片容易卷曲并出现黏液。红蜘蛛多在叶背活动，叶面先出现密集失绿小点，严重时发黄干枯。\n\n田间判断时要随机查看多株棉花，并同时翻看叶片正反面。不要只凭一片叶就决定大面积用药。无法确认时先拍清楚虫体和叶背，再咨询当地农技人员。',
          JSON.stringify(['棉蚜', '红蜘蛛', '虫害识别']), 420, 'intermediate', '棉花智能体知识中心', 'published', 0, 30, new Date()],
        ['gallery', '滴灌水肥管理观察要点', '每次滴水前后应该在田里看什么', 'water', '水肥管理', waterCover, '', JSON.stringify([waterCover]),
          '滴水前观察土壤干湿、棉株顶部生长和天气预报；滴水中检查首部压力、滴灌带破损和末端出水；滴水后查看湿润范围是否均匀。\n\n追肥应结合棉株长势和目标产量，记录肥料名称、用量和日期。出现旺长、早衰或盐分积累迹象时，应先判断原因再调整方案。',
          JSON.stringify(['滴灌', '追肥', '田间观察']), 300, 'intermediate', '棉花智能体知识中心', 'published', 0, 40, new Date()]
      ]]
    )
  }

  const coverUpdates = [
    ['棉花全生育期管理入门', '/admin/assets/knowledge-hero-v2.webp'],
    ['播种前地块准备清单', '/admin/assets/course-seedling-v2.webp'],
    ['棉蚜与红蜘蛛快速区分', '/admin/assets/course-scouting-v2.webp'],
    ['滴灌水肥管理观察要点', '/admin/assets/course-water-v2.webp']
  ]
  for (const [title, coverUrl] of coverUpdates) {
    await db.query(
      `UPDATE knowledge_contents SET cover_url=?
       WHERE title=? AND (cover_url='' OR cover_url='/admin/assets/cotton-field-sky.png')`,
      [coverUrl, title]
    )
  }
  await db.query(
    `UPDATE knowledge_contents SET images_json=?
     WHERE title='滴灌水肥管理观察要点'
       AND (images_json='[]' OR images_json=? OR images_json='["/admin/assets/cotton-field-sky.png"]')`,
    [JSON.stringify(['/admin/assets/course-water-v2.webp']), JSON.stringify(['/admin/assets/cotton-field-sky.png'])]
  )

  const practicalCourseTitle = '棉花苗期14天田间诊断课：查苗、定苗与风险判断'
  const practicalCover = '/admin/assets/cotton-seedling-inspection-v1.jpg'
  const practicalLeafInspection = '/admin/assets/cotton-seedling-leaf-inspection-v1.jpg'
  const practicalImages = [
    practicalCover,
    '/admin/assets/course-seedling-v2.webp',
    practicalLeafInspection
  ]
  const [[practicalCourse]] = await db.query(
    'SELECT id FROM knowledge_contents WHERE title=? LIMIT 1',
    [practicalCourseTitle]
  )
  if (!practicalCourse) {
    const practicalContent = `## 学习目标
完成本课后，你应该能用一张巡田记录表回答四个问题：苗出得齐不齐、缺苗集中在哪里、什么时候定苗、异常是水分与土壤问题还是病虫风险。

> 本课用于建立田间观察顺序。各地播期、密度和防治阈值不同，最终操作要结合当地农技部门意见、品种说明和实时天气。

[[image:${practicalCover}|子叶展平并长出第一片真叶的棉苗。检查时同时记录叶色、茎秆和行内整齐度。]]

## 第一站：播后第5天开始固定点查苗
不要沿着地头走一遍就下结论。建议在同一地块固定5个观察点，每个点沿播种行连续查看一段距离，并记录已出苗、缺苗、弱苗和膜孔情况。连续几天使用同一位置，才能判断是在继续出苗，还是已经形成稳定缺口。

- 看整齐度：同一观察段里，棉苗生育进度是否接近。
- 看分布：缺苗是零星出现、成段出现，还是只集中在低洼或迎风位置。
- 看膜孔与板结：苗是否顶膜、膜孔是否封土不严、雨后表土是否形成硬壳。
- 看滴灌带：位置是否偏移、接口是否漏水、同一支管首尾湿润是否明显不同。

农业农村部棉花前期技术指导意见提出，膜下棉播种约5天后应加强日常观察，出苗达到约70%时及时做好放苗管理。这里的“70%”是巡田信号，不是所有地块机械套用的唯一阈值。

[[image:/admin/assets/course-seedling-v2.webp|固定观察点比随机看几株更可靠。把缺苗位置画在简图上，第二天回到同一点复查。]]

## 第二站：先判断缺苗形态，再决定处理
零星缺苗常与单粒种子、局部覆土或膜孔有关；连续成段缺苗更需要检查播种深度、土壤板结、滴灌湿润带和播种机作业；低洼处集中弱苗则要警惕积水、低温或土壤通气不良。

发现问题后先拍照、定位并复查，不要一看到黄苗就立刻加肥，也不要在原因不清楚时反复滴水。过量水肥可能掩盖真正原因，还会增加根系和病害风险。

## 第三站：定苗看叶龄，也看整齐度
机械化生产技术指导意见建议，两片子叶展平后开始定苗，在1至2片真叶时结束。操作上应去弱留健、保持单株，并优先保证整行长势均匀。当地品种、行株距或精量播种模式有特殊要求时，以当地技术方案为准。

定苗前再做一次全田快速复核：如果仍有较多晚出苗，应先确认低温、墒情或板结是否正在影响出苗，不要只按日历日期机械完成。

[[image:${practicalLeafInspection}|翻看叶片正反面并比较相邻植株。异常判断要看分布和变化趋势，不能只凭一片叶。]]

## 第四站：异常苗按“位置—植株—变化”判断
先看异常出现在哪里，再看整株表现，最后看两天内是否扩大。苗期重点关注蚜虫、蓟马、盲蝽、苗病以及低温、大风和阶段性干旱风险，但是否需要防治必须结合田间发生量、当地预警和登记农药标签。

- 只在田边或迎风口明显：优先检查风沙、膜损和边行水分。
- 沿滴灌带呈规律变化：优先检查压力、堵塞、漏水与湿润范围。
- 嫩叶集中受害或叶背有虫体：拍清虫体和叶片正反面，记录受害株比例。
- 成片萎蔫或茎基部异常：减少踩踏扩散，尽快请当地农技人员现场诊断。

## 一张巡田记录表
每次记录日期、地块、观察点、出苗数、弱苗数、缺苗长度、叶龄、土壤表面状态、滴灌情况、虫体或病斑照片，以及第二天复查结果。连续记录比一次性的“看起来还行”更能支持正确决策。

## 资料依据
本课依据农业农村部种植业管理司、农业农村部棉花专家指导组和全国农业技术推广服务中心公开发布的棉花前期生产与机械化生产技术指导意见整理。不同棉区生态条件差异明显，课程不替代当地处方和田间诊断。`
    const practicalQuiz = [
      {
        question: '关于棉花定苗时间，哪项更符合课程中的观察原则？',
        options: ['出苗当天立即全部定苗', '两片子叶展平后开始，在1至2片真叶时结束', '等到现蕾后再定苗', '只看日历，不看叶龄'],
        correctIndex: 1,
        explanation: '定苗需要结合叶龄和整齐度。两片子叶展平后开始、1至2片真叶时结束，是公开机械化生产技术指导中的参考窗口。'
      },
      {
        question: '巡田发现连续成段缺苗，第一步最合适的做法是什么？',
        options: ['马上加大施肥量', '立刻连续滴水两天', '固定位置复查播种深度、板结和滴灌湿润带', '只补拍一张近距离叶片照片'],
        correctIndex: 2,
        explanation: '成段缺苗往往具有作业或环境上的共同原因。先定位并检查播种、土壤和滴灌分布，再决定补救，能避免盲目加水加肥。'
      },
      {
        question: '为什么课程建议在同一地块设置固定观察点？',
        options: ['方便只看长势最好的地方', '便于连续比较出苗和异常是否扩大', '可以完全代替全田巡查', '为了减少记录内容'],
        correctIndex: 1,
        explanation: '固定点的价值在于可比较。相同位置连续记录，才能区分“仍在出苗”和“已经形成稳定缺口”，也能判断异常是否扩大。'
      },
      {
        question: '看到少量黄苗后，哪种处理顺序更稳妥？',
        options: ['立即加肥', '立即喷药', '先看异常分布、整株表现和变化趋势，再结合当地预警判断', '忽略到现蕾期'],
        correctIndex: 2,
        explanation: '黄苗可能与低温、水分、板结、根系或病虫有关。先观察位置、植株和变化，再结合当地信息诊断，能减少误判和不必要投入。'
      }
    ]
    await db.query(
      `INSERT INTO knowledge_contents
       (type,title,subtitle,category_key,category_name,cover_url,video_url,images_json,content,tags_json,quiz_json,
        duration_seconds,difficulty,source_name,status,is_featured,sort_order,published_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [
        'article', practicalCourseTitle, '用固定观察点和一张记录表，完成出苗、缺苗、定苗与苗期异常的第一轮判断',
        'planting', '栽培技术', practicalCover, '', JSON.stringify(practicalImages), practicalContent,
        JSON.stringify(['苗期管理', '查苗', '定苗', '田间诊断']), JSON.stringify(practicalQuiz),
        900, 'intro', '农业农村部棉花技术指导资料整理', 'published', 1, 15
      ]
    )
    console.log(`[migrate] practical knowledge course created: ${practicalCourseTitle}`)
  }
  await db.query(
    `UPDATE knowledge_contents
        SET images_json=?,
            content=REPLACE(content, ?, ?)
      WHERE title=?`,
    [
      JSON.stringify(practicalImages),
      '[[image:/admin/assets/course-scouting-v2.webp|翻看叶片正反面并比较相邻植株。异常判断要看分布和变化趋势，不能只凭一片叶。]]',
      `[[image:${practicalLeafInspection}|翻看叶片正反面并比较相邻植株。异常判断要看分布和变化趋势，不能只凭一片叶。]]`,
      practicalCourseTitle
    ]
  )

  console.log('[migrate] knowledge hall tables ready')
  process.exit(0)
}

run().catch(error => {
  console.error('[migrate] knowledge hall failed:', error.message)
  process.exit(1)
})
