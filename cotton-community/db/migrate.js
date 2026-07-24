require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const db = require('./database')

async function hasTable(table) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    [table]
  )
  return Number(row.total || 0) > 0
}

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
  if (!await hasTable('users') || !await hasTable('farmers')) {
    throw new Error('共享数据库尚未初始化，请先运行 cotton-app 的数据库迁移')
  }

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

  // 知识讲堂已改为独立网页模块，不再保留小程序到网页的临时登录票据。
  await db.query('DROP TABLE IF EXISTS knowledge_web_login_tickets')
  await db.query(
    `UPDATE knowledge_contents
        SET cover_url=REPLACE(cover_url,'/admin/assets/','/assets/'),
            video_url=REPLACE(video_url,'/admin/assets/','/assets/'),
            images_json=REPLACE(images_json,'/admin/assets/','/assets/'),
            content=REPLACE(content,'/admin/assets/','/assets/')
      WHERE cover_url LIKE '/admin/assets/%'
         OR video_url LIKE '/admin/assets/%'
         OR images_json LIKE '%/admin/assets/%'
         OR content LIKE '%/admin/assets/%'`
  )

  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM knowledge_contents')
  if (Number(total) === 0) {
    const heroCover = '/assets/knowledge-hero-v2.webp'
    const seedlingCover = '/assets/course-seedling-v2.webp'
    const scoutingCover = '/assets/course-scouting-v2.webp'
    const waterCover = '/assets/course-water-v2.webp'
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
    ['棉花全生育期管理入门', '/assets/knowledge-hero-v2.webp'],
    ['播种前地块准备清单', '/assets/course-seedling-v2.webp'],
    ['棉蚜与红蜘蛛快速区分', '/assets/course-scouting-v2.webp'],
    ['滴灌水肥管理观察要点', '/assets/course-water-v2.webp']
  ]
  for (const [title, coverUrl] of coverUpdates) {
    await db.query(
      `UPDATE knowledge_contents SET cover_url=?
       WHERE title=? AND (cover_url='' OR cover_url='/assets/cotton-field-sky.png')`,
      [coverUrl, title]
    )
  }
  await db.query(
    `UPDATE knowledge_contents SET images_json=?
     WHERE title='滴灌水肥管理观察要点'
       AND (images_json='[]' OR images_json=? OR images_json='["/assets/cotton-field-sky.png"]')`,
    [JSON.stringify(['/assets/course-water-v2.webp']), JSON.stringify(['/assets/cotton-field-sky.png'])]
  )

  const practicalCourseTitle = '棉花苗期14天田间诊断课：查苗、定苗与风险判断'
  const practicalCover = '/assets/cotton-seedling-inspection-v1.jpg'
  const practicalLeafInspection = '/assets/cotton-seedling-leaf-inspection-v1.jpg'
  const practicalImages = [
    practicalCover,
    '/assets/course-seedling-v2.webp',
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

[[image:/assets/course-seedling-v2.webp|固定观察点比随机看几株更可靠。把缺苗位置画在简图上，第二天回到同一点复查。]]

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
      '[[image:/assets/course-scouting-v2.webp|翻看叶片正反面并比较相邻植株。异常判断要看分布和变化趋势，不能只凭一片叶。]]',
      `[[image:${practicalLeafInspection}|翻看叶片正反面并比较相邻植株。异常判断要看分布和变化趋势，不能只凭一片叶。]]`,
      practicalCourseTitle
    ]
  )

  const interactiveCourses = [
    {
      type: 'gallery',
      title: '棉田全景巡课：一株棉花的八个关键时刻',
      subtitle: '沿着一条棉行走完整个生育期，学会每个阶段该看什么、记什么',
      categoryKey: 'lifecycle',
      categoryName: '生育期观察',
      coverUrl: '/assets/course-lifecycle-v1.webp',
      images: [
        '/assets/course-lifecycle-v1.webp',
        '/assets/cotton-seedling-inspection-v1.jpg',
        '/assets/course-scouting-v2.webp'
      ],
      tags: ['全生育期', '田间巡查', '生育进程', '采收质量'],
      duration: 1080,
      difficulty: 'intro',
      sortOrder: 12,
      content: `## 先画一张自己的生育期地图
同一块田里，日期只是参考，真正决定管理节奏的是棉株当前处在哪个阶段。学习这门课时，请选一条代表性棉行，把每次观察到的叶龄、株高、蕾铃、吐絮比例和异常位置写在同一张记录表上。

> 互动任务：每到一个观察点，先遮住下面的提示，用“看到什么—说明什么—下一步核对什么”三个问题完成自己的判断。

[[image:/assets/course-lifecycle-v1.webp|一块田可以同时呈现不同生育阶段的管理重点。实际巡田时应在固定点连续观察，而不是把不同地块直接相比。]]

## 观察点一：播种与萌发
先核对播种深度是否一致、种子是否落在湿润带附近、地膜和滴灌带位置是否稳定。播后记录温度、滴水和大风过程，出现缺苗时才能判断它更像种子、土壤、设备还是天气问题。

## 观察点二：出苗与子叶
看出苗整齐度，不只数“出了多少苗”。连续缺苗、低洼处弱苗、迎风口膜损和沿滴灌带规律变化，分别指向不同的排查方向。子叶展开后同时观察茎秆、叶色和膜孔板结。

[[image:/assets/cotton-seedling-inspection-v1.jpg|苗期记录要把单株状态放回整行分布中理解。零星异常与成段异常的处理顺序不同。]]

## 观察点三：真叶与稳苗
进入真叶期后，重点比较叶龄是否整齐、根区水分是否稳定、是否有旺长或僵苗趋势。不要看到叶色浅就直接加肥，先核对温度、根系、土壤盐分和滴灌均匀性。

## 观察点四：现蕾
现蕾意味着营养生长与生殖生长开始同时争夺水肥。巡田时记录第一果枝位置、株高增长速度、顶部节间和蕾的保存情况。管理目标不是追求最高的植株，而是建立协调、通风、能承载铃量的群体。

## 观察点五：开花与结铃
按固定路线观察白花、红花和幼铃在植株上的位置，结合高温、大风和水分变化判断脱落风险。花铃期决策需要同时看天气、土壤湿润、棉株顶部生长和前期施肥记录，不能只看某一天的叶色。

## 观察点六：铃期与早衰风险
记录上、中、下部铃的分布和叶片功能。下部叶提前失绿不一定都缺肥，也可能与根区、盐分、病害或负载有关。先比较异常在田间的分布，再决定是否需要营养或植保干预。

[[image:/assets/course-scouting-v2.webp|花铃期检查应兼顾顶部嫩叶、叶背虫体和中下部铃叶关系，不能只看田面颜色。]]

## 观察点七：吐絮与催熟条件
吐絮期关注铃的成熟度、吐絮进度、天气窗口和田间均匀性。脱叶催熟应以成熟度和当地作业条件为基础，过早会影响纤维和籽棉质量，过晚则可能增加降温、降雨和采收组织风险。

## 观察点八：采收与复盘
采收前检查含杂、回潮、地膜和机采通道；采收后把产量、品质、投入和异常位置叠加回本季记录。复盘的目的不是只评价“高产或低产”，而是找出下一季最值得优先改进的一到两个环节。

## 完成本课的田间作业
建立8个阶段的照片档案，每张照片包含日期、地块、观察点和一句判断。下一次打开课程时，让 AI 根据你的观察记录生成一份“需继续核对的问题清单”。`,
      quiz: [
        {
          question: '为什么课程建议用生育阶段而不是只用日期安排巡田？',
          options: ['日期完全没有用', '不同地块和年份的棉株进程可能不同', '生育阶段可以代替天气记录', '只要看株高就能判断阶段'],
          correctIndex: 1,
          explanation: '日期能提供时间背景，但品种、播期、温度和水分都会影响进程。以实际生育阶段为主，才能让管理动作与棉株需求对应。'
        },
        {
          question: '发现沿滴灌带呈规律变化的弱苗，优先核对什么？',
          options: ['立即全田喷药', '滴灌压力、堵塞、漏水和湿润带', '直接增加氮肥', '只检查田边苗'],
          correctIndex: 1,
          explanation: '规律性分布往往提示共同的系统因素。先检查滴灌设备和水分分布，比直接施肥或喷药更接近问题来源。'
        },
        {
          question: '现蕾后群体管理更合理的目标是什么？',
          options: ['让所有植株尽可能高', '只保留顶部叶片', '协调营养生长与结铃，形成通风且能承载铃量的群体', '停止记录株高'],
          correctIndex: 2,
          explanation: '现蕾后需要兼顾长株与结铃。过旺或过弱都可能影响蕾铃保存和田间通风。'
        },
        {
          question: '决定脱叶催熟时机时，哪组信息最重要？',
          options: ['日历日期和邻田做法', '成熟度、吐絮进度、天气窗口和作业条件', '当天棉价', '只看最早吐絮的一株'],
          correctIndex: 1,
          explanation: '脱叶催熟需要建立在成熟度和田间均匀性上，并同时考虑未来天气和采收组织，不能机械照搬日期。'
        },
        {
          question: '采收后记录最有价值的用途是什么？',
          options: ['只保存一张产量截图', '用于下一季定位最值得优先改进的环节', '证明所有投入都正确', '代替土壤和田间观察'],
          correctIndex: 1,
          explanation: '将产量、品质、投入和异常位置放在一起复盘，才能从结果回溯关键限制因素。'
        }
      ]
    },
    {
      type: 'article',
      title: '滴灌决策实验：今天这遍水该怎么定',
      subtitle: '用天气、土壤、棉株和系统状态完成一次不靠感觉的灌溉判断',
      categoryKey: 'water',
      categoryName: '水肥管理',
      coverUrl: '/assets/course-irrigation-decision-v1.webp',
      images: [
        '/assets/course-irrigation-decision-v1.webp',
        '/assets/course-water-v2.webp'
      ],
      tags: ['滴灌', '灌溉决策', '土壤水分', '系统检查'],
      duration: 960,
      difficulty: 'intermediate',
      sortOrder: 22,
      content: `## 这不是一道“该滴几方水”的固定答案题
地块质地、根系深度、天气、品种和系统流量不同，不能从一张通用表直接得到所有地块的灌水量。本课训练的是决策顺序：先收集证据，再判断是否需要调整时机、持续时间或检查设备。

[[image:/assets/course-irrigation-decision-v1.webp|滴灌决策至少要把棉株、根区土壤、天气和系统运行放在一起看。仪表读数必须和田间湿润分布相互验证。]]

## 输入卡一：未来天气
记录未来三天最高最低温、风、降雨概率和持续高温过程。预报不是命令，而是风险信息：高温会改变蒸散需求，降雨可能改变作业窗口，大风会影响棉株状态和田间检查条件。

## 输入卡二：根区土壤
在代表性位置检查不同深度的湿润状况，不只看地表颜色。地表干不等于根区一定缺水，地表湿也不代表湿润带已经覆盖主要根区。相同位置在滴水前后复查，才能判断水到哪里、保持多久。

## 输入卡三：棉株信号
观察顶部生长、叶片展开、日变化、蕾铃负载和是否存在早衰或旺长。正午短时萎蔫与全天不能恢复不是同一信号；单株异常与整片规律异常也应分开处理。

## 输入卡四：滴灌系统
记录首部压力、支管首尾差异、过滤器状态、接口漏水和末端出水。系统不均匀时，简单延长滴水可能让一部分区域过量，另一部分仍不足，先修复分布问题往往更有效。

[[image:/assets/course-water-v2.webp|同一支管首部、中部和末端都要设置观察点。只在首部看到出水，不能证明整块田灌得均匀。]]

## 情境实验：四张卡给出什么结论
假设未来两天高温，根区上层偏干但下层仍有水，棉株清晨状态正常，支管末端湿润明显慢于首部。此时不能只因为“高温”就把全田滴水时间统一拉长。更稳妥的顺序是先确认末端压力与堵塞，再结合根区和棉株变化决定灌溉调整。

第二种情境：天气温和，地表仍湿，但部分低洼区域棉株持续萎蔫。此时继续加水可能加重根区通气问题，应优先检查积水、根系和病害。

## 把水肥拆开思考
水是肥料进入根区的载体，但“需要滴水”不等于“每次都要增加肥量”。施肥决策还要看生育阶段、长势、前期投入、盐分和目标产量。每次调整只改变少数变量，并保留记录，才能知道变化来自哪里。

## 建立自己的灌溉复盘表
记录开始结束时间、首部压力、首中末观察点、滴前滴后土壤、天气、棉株变化和异常处理。下一次决策先看上一次效果，而不是从零开始凭感觉。`,
      quiz: [
        {
          question: '为什么不能只看地表干湿决定是否滴水？',
          options: ['地表永远是湿的', '根区不同深度的水分可能与地表表现不同', '棉花不需要根区水分', '只看天气预报即可'],
          correctIndex: 1,
          explanation: '根系利用的是根区水分。地表受温度、风和覆盖影响很快，必须结合不同深度和棉株状态判断。'
        },
        {
          question: '支管末端明显慢于首部湿润时，优先做什么？',
          options: ['统一延长全田滴水', '检查压力、过滤、堵塞和漏水', '立即增加肥料浓度', '停止所有田间记录'],
          correctIndex: 1,
          explanation: '先确认系统分布是否正常。若均匀性有问题，单纯延长时间可能同时造成局部过量与局部不足。'
        },
        {
          question: '低洼处地表湿且棉株持续萎蔫，哪种处理更稳妥？',
          options: ['继续加水', '先检查积水、根区通气和病害', '全田补氮', '只看相邻高地'],
          correctIndex: 1,
          explanation: '湿润条件下持续萎蔫不一定缺水，积水导致的缺氧、根系受损或病害都需要优先排查。'
        },
        {
          question: '“需要滴水”和“需要追肥”是什么关系？',
          options: ['完全相同', '每次滴水都必须加肥', '相关但不是同一个判断，需要分别看生育阶段与前期投入', '任何时期都不应水肥同施'],
          correctIndex: 2,
          explanation: '水肥相互影响，但施肥还要结合长势、阶段、土壤和投入记录，不能把两个决策机械绑定。'
        },
        {
          question: '最能提高下一次灌溉判断质量的做法是什么？',
          options: ['记住大概滴了多久', '保留系统、土壤、天气和棉株的滴前滴后记录', '只记录肥料价格', '完全照搬邻田'],
          correctIndex: 1,
          explanation: '滴前滴后对照能说明上一次措施是否达到预期，也是下一次调整最有价值的依据。'
        }
      ]
    },
    {
      type: 'gallery',
      title: '从棉铃到生活：棉纤维、棉籽与副产品',
      subtitle: '认识轧花之后的每一条去向，理解品质、用途与循环利用',
      categoryKey: 'industry',
      categoryName: '棉花产业与用途',
      coverUrl: '/assets/course-cotton-products-v1.webp',
      images: [
        '/assets/course-cotton-products-v1.webp',
        '/assets/knowledge-hero-v2.webp'
      ],
      tags: ['棉纤维', '棉籽', '纺织', '副产品', '产业链'],
      duration: 840,
      difficulty: 'intro',
      sortOrder: 32,
      content: `## 一颗棉铃里不只有“白色棉花”
采收后的籽棉由纤维和棉籽组成，还可能夹带叶屑、铃壳、尘土和残膜。轧花的核心任务是把纤维与棉籽分离，并尽量保持纤维品质。田间采收质量会直接影响后续清理、加工和产品价值。

[[image:/assets/course-cotton-products-v1.webp|棉纤维用于纺织，棉籽还能进入油脂、饲用原料和其他加工链条。具体用途必须符合食品、饲料和加工安全规范。]]

## 路线一：纤维成为纱线和织物
皮棉经过检验、配棉、开清、梳理、并条和纺纱等环节形成纱线，再进入织造、染整和成衣。纤维长度、强力、成熟度、整齐度、颜色和杂质都会影响加工表现。减少地膜、土块和异性纤维混入，是生产端能直接帮助品质提升的事情。

## 路线二：棉籽的多种去向
棉籽可以用于留种，也可以在合规加工后获得棉籽油、棉籽粕等产品。棉籽及其加工产品涉及食品和饲料安全，不能把未经处理的原料直接等同于可食用或可饲喂产品，应由具备条件的企业按标准处理。

## 路线三：短绒与纤维素材料
棉籽表面残留的短纤维称为棉短绒，可进一步用于纤维素相关产品。课程图片中的纸张只是用途示意，实际产品路线取决于原料等级和工业加工标准。

## 路线四：牛仔布并不是另一种植物
牛仔布通常由棉纱织造，并通过纱线结构、靛蓝染色和后整理形成熟悉的外观。不同面料也可能混用其他纤维，因此判断产品成分应查看标签，不能只凭触感或颜色。

## 路线五：副产物与循环利用
轧花和纺织过程中产生的可利用副产物，应根据污染风险、经济性和当地规范分类处理。循环利用的前提是可追溯、符合用途标准，而不是把所有剩余物简单混在一起使用。

[[image:/assets/knowledge-hero-v2.webp|产品质量从田间开始。干净采收、减少残膜和异性纤维混入，会影响轧花与后续纺织效率。]]

## 反向思考：终端用途如何影响田间
当产品需要更稳定的纤维品质时，品种选择、成熟度、脱叶催熟、采收天气、籽棉回潮和清洁度都会变得重要。了解用途，不只是认识几件棉制品，也是在理解为什么田间质量管理值得认真记录。

## 课后探索
找三件身边的纺织品，查看成分标签并记录棉含量；再画一张“籽棉—皮棉/棉籽—产品”的去向图。遇到不理解的加工名词，可以直接让 AI 用田间生产者能理解的方式解释。`,
      quiz: [
        {
          question: '轧花环节最核心的任务是什么？',
          options: ['给织物染色', '把纤维与棉籽分离并尽量保持品质', '把棉籽直接制成食品', '完成服装裁剪'],
          correctIndex: 1,
          explanation: '轧花承接籽棉并分离纤维和棉籽，同时控制清理过程对纤维品质的影响。'
        },
        {
          question: '哪项是田间环节能直接帮助纤维加工品质的措施？',
          options: ['增加异性纤维', '减少残膜、土块和杂质混入', '把潮湿籽棉长期堆放', '只关注产量不记录采收条件'],
          correctIndex: 1,
          explanation: '清洁采收和减少异性纤维、残膜等污染，可以降低后续清理难度和品质风险。'
        },
        {
          question: '关于棉籽用途，哪种说法正确？',
          options: ['所有棉籽都可直接食用', '未经处理即可随意饲喂', '可进入种用、油脂或饲用加工，但必须符合相应安全规范', '棉籽没有利用价值'],
          correctIndex: 2,
          explanation: '棉籽有多种利用方向，但食品、饲料和种用均有相应质量与安全要求。'
        },
        {
          question: '为什么不能只凭颜色判断一件牛仔服的纤维成分？',
          options: ['所有蓝色织物都是纯棉', '面料可能混用其他纤维，应查看成分标签', '颜色决定纤维长度', '棉纤维不能染色'],
          correctIndex: 1,
          explanation: '牛仔外观来自组织、染色和整理，面料成分可能是纯棉或混纺，标签才是判断依据。'
        },
        {
          question: '课程所说的循环利用首先需要满足什么？',
          options: ['所有剩余物混合处理', '不考虑污染风险', '可追溯并符合具体用途的质量与安全标准', '只要成本低即可'],
          correctIndex: 2,
          explanation: '副产物能否利用取决于来源、污染风险和用途标准。分类和可追溯是安全利用的基础。'
        }
      ]
    }
  ]

  for (const course of interactiveCourses) {
    const [[existing]] = await db.query(
      'SELECT id FROM knowledge_contents WHERE title=? LIMIT 1',
      [course.title]
    )
    if (existing) continue
    await db.query(
      `INSERT INTO knowledge_contents
       (type,title,subtitle,category_key,category_name,cover_url,video_url,images_json,content,tags_json,quiz_json,
        duration_seconds,difficulty,source_name,status,is_featured,sort_order,published_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [
        course.type, course.title, course.subtitle, course.categoryKey, course.categoryName,
        course.coverUrl, '', JSON.stringify(course.images), course.content, JSON.stringify(course.tags),
        JSON.stringify(course.quiz), course.duration, course.difficulty,
        '棉花智能体知识中心原创整理', 'published', 1, course.sortOrder
      ]
    )
    console.log(`[migrate] interactive knowledge course created: ${course.title}`)
  }

  console.log('[migrate] knowledge hall tables ready')
  process.exit(0)
}

run().catch(error => {
  console.error('[migrate] knowledge hall failed:', error.message)
  process.exit(1)
})
