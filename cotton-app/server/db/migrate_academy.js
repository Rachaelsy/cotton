require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function ensureColumn(column, definition) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) total FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='academy_courses' AND COLUMN_NAME=?`,
    [column]
  )
  if (!Number(row.total)) await db.query(`ALTER TABLE academy_courses ADD COLUMN ${column} ${definition}`)
}

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS academy_series (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      series_key VARCHAR(80) NOT NULL UNIQUE,
      level ENUM('basic','intermediate','advanced') NOT NULL DEFAULT 'basic',
      title VARCHAR(160) NOT NULL,
      summary VARCHAR(1000) DEFAULT '',
      teacher VARCHAR(100) DEFAULT '平台农技组',
      cover_url VARCHAR(500) DEFAULT '',
      status ENUM('draft','published','offline') NOT NULL DEFAULT 'published',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_academy_series_level (level,status,sort_order,id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优棉学堂系列课程'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS academy_courses (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      course_key VARCHAR(80) NOT NULL UNIQUE,
      level ENUM('basic','intermediate','advanced') NOT NULL DEFAULT 'basic',
      type ENUM('video','article') NOT NULL DEFAULT 'video',
      title VARCHAR(160) NOT NULL,
      summary VARCHAR(1000) DEFAULT '',
      teacher VARCHAR(100) DEFAULT '平台农技组',
      teacher_title VARCHAR(120) DEFAULT '棉花栽培课程',
      cover_url VARCHAR(500) DEFAULT '',
      cover_object_key VARCHAR(500) DEFAULT '',
      video_url VARCHAR(500) DEFAULT '',
      video_object_key VARCHAR(500) DEFAULT '',
      vod_file_id VARCHAR(64) NOT NULL DEFAULT '',
      vod_status ENUM('none','ready','processing','failed') NOT NULL DEFAULT 'none',
      duration_seconds INT UNSIGNED NOT NULL DEFAULT 60,
      objectives_json VARCHAR(2000) DEFAULT '[]',
      status ENUM('draft','published','offline') NOT NULL DEFAULT 'draft',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      view_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_by INT UNSIGNED DEFAULT NULL,
      published_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_academy_status_level (status,level,sort_order,id),
      INDEX idx_academy_featured (is_featured,status,sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优棉学堂课程'
  `)

  await ensureColumn('vod_file_id', "VARCHAR(64) NOT NULL DEFAULT '' AFTER video_object_key")
  await ensureColumn('vod_status', "ENUM('none','ready','processing','failed') NOT NULL DEFAULT 'none' AFTER vod_file_id")
  await ensureColumn('series_key', "VARCHAR(80) NOT NULL DEFAULT '' AFTER course_key")
  await ensureColumn('lesson_no', "INT UNSIGNED NOT NULL DEFAULT 1 AFTER series_key")

  const seriesRows = [
    ['cotton-foundation','basic','棉花种植入门','从认识棉花生育期开始，系统学习品种选择、播前准备、精量播种和苗期管理。','/assets/knowledge-hero-v2.webp',10,1],
    ['field-observation','basic','田间巡查与基础记录','掌握规范巡田路线、苗情墒情调查和基础生产记录方法。','/assets/course-scouting-v2.webp',20,0],
    ['water-fertilizer','intermediate','水肥与群体调控','围绕膜下滴灌、水肥一体化和株型观察建立中期管理思路。','/assets/course-water-v2.webp',110,1],
    ['flower-protection','intermediate','花铃期与植保管理','学习病虫害调查、花铃期综合管理及投入品作业记录。','/assets/course-seedling-v2.webp',120,0],
    ['yield-quality','advanced','产量与品质诊断','从产量构成和纤维品质指标出发开展田间诊断。','/assets/course-scouting-v2.webp',210,1],
    ['harvest-digital','advanced','采收与数字化复盘','衔接脱叶机采、气象风险、地块数据分析和年度复盘。','/assets/course-water-v2.webp',220,0]
  ]
  await db.query(
    `INSERT INTO academy_series (series_key,level,title,summary,cover_url,sort_order,is_featured,status)
     VALUES ? ON DUPLICATE KEY UPDATE level=VALUES(level),title=VALUES(title),summary=VALUES(summary),cover_url=VALUES(cover_url),sort_order=VALUES(sort_order),is_featured=VALUES(is_featured)`,
    [seriesRows.map(row => [...row, 'published'])]
  )

  await db.query(`
    CREATE TABLE IF NOT EXISTS academy_comments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      course_id VARCHAR(80) NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      parent_id BIGINT UNSIGNED DEFAULT NULL,
      content VARCHAR(500) NOT NULL,
      status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_academy_comment_course (course_id,status,created_at),
      INDEX idx_academy_comment_parent (parent_id,created_at),
      INDEX idx_academy_comment_user (user_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优棉学堂课程评论'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS academy_comment_likes (
      comment_id BIGINT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (comment_id,user_id),
      INDEX idx_academy_comment_like_user (user_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优棉学堂评论点赞'
  `)

  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM academy_courses')
  if (!Number(total)) {
    const rows = [
      ['cotton-growth-cycle','basic','video','认识棉花全生育期','从播种出苗到吐絮采收，认识不同生育阶段的田间表现与管理目标。','棉花栽培课程','/assets/knowledge-hero-v2.webp',68,10,1],
      ['seed-selection-preparation','basic','video','品种选择与播前准备','围绕生育期、纤维品质、抗逆性和机采适应性，讲解品种信息核对与播前准备。','种植基础课程','/assets/course-scouting-v2.webp',58,20,0],
      ['precision-sowing','basic','video','精量播种与播后检查','讲解播种机检查、株行距设置、播深控制、铺膜铺管及播后质量核查。','农机农艺课程','/assets/course-water-v2.webp',62,30,0],
      ['seedling-management','basic','video','苗期管理关键点','以全苗、齐苗、匀苗、壮苗为目标，介绍苗情调查和早期风险识别。','苗期管理课程','/assets/course-seedling-v2.webp',63,40,0],
      ['field-scouting-basics','basic','video','第一次规范田间巡查','使用固定路线和定点观察方法记录苗情、墒情、虫情及田间异常。','田间调查课程','/assets/course-scouting-v2.webp',55,50,0],
      ['basic-field-checklist','basic','article','棉田基础管理检查表','梳理播前、播种、出苗和苗期需要持续记录的关键事项。','配套学习资料','/assets/course-water-v2.webp',480,60,0],
      ['irrigation-principles','intermediate','video','膜下滴灌与灌水判断','结合生育阶段、土壤墒情和天气变化，讲解滴灌前的判断方法。','水分管理课程','/assets/course-water-v2.webp',60,110,1],
      ['fertigation-management','intermediate','video','水肥一体化基础管理','从土壤基础、作物长势和肥料标签出发，建立可记录的水肥管理思路。','养分管理课程','/assets/course-water-v2.webp',66,120,0],
      ['plant-architecture','intermediate','video','株型观察与化控判断','介绍株高、节间、果枝和群体封行程度的调查方法。','群体管理课程','/assets/course-seedling-v2.webp',59,130,0],
      ['pest-monitoring','intermediate','video','棉田病虫害调查方法','学习常见病虫害的田间调查方法，先调查再判断是否需要处理。','植保调查课程','/assets/course-scouting-v2.webp',65,140,0],
      ['flower-boll-management','intermediate','video','花铃期综合管理','围绕蕾铃保持、群体协调、水肥衔接和病虫害巡查梳理管理逻辑。','关键生育期课程','/assets/course-seedling-v2.webp',69,150,0],
      ['midlevel-record-template','intermediate','article','水肥与植保记录规范','学习记录作业时间、地块、投入品、用量、天气和效果。','配套学习资料','/assets/course-scouting-v2.webp',600,160,0],
      ['yield-diagnosis','advanced','video','棉田产量构成与诊断','从亩株数、单株结铃、铃重和衣分等指标认识产量构成。','生产诊断课程','/assets/course-seedling-v2.webp',68,210,1],
      ['fiber-quality','advanced','video','纤维品质形成与管理','认识纤维长度、强度、马克隆值和整齐度，理解田间管理对品质的影响。','品质管理课程','/assets/course-scouting-v2.webp',64,220,0],
      ['defoliation-harvest','advanced','video','脱叶催熟与机采衔接','结合吐絮程度、天气条件和机采要求，介绍脱叶前调查与采收衔接。','采收管理课程','/assets/course-water-v2.webp',61,230,0],
      ['digital-field-data','advanced','video','用地块数据复盘生产','把天气、灌溉、施肥、植保和产量记录放到同一时间轴上。','数字农业课程','/assets/course-scouting-v2.webp',57,240,0],
      ['weather-risk-decision','advanced','video','气象风险与作业决策','把高温、大风、降水和强对流预报转化为田间作业安排。','风险管理课程','/assets/course-water-v2.webp',67,250,0],
      ['annual-review-template','advanced','article','棉花生产年度复盘模板','从品种、播期、投入、关键作业、灾害、产量和品质完成年度复盘。','配套学习资料','/assets/knowledge-hero-v2.webp',720,260,0]
    ]
    await db.query(
      `INSERT INTO academy_courses
       (course_key,level,type,title,summary,teacher_title,cover_url,duration_seconds,sort_order,is_featured,status,published_at)
       VALUES ?`,
      [rows.map(row => [...row, 'published', new Date()])]
    )
  }

  const assignments = {
    'cotton-growth-cycle':['cotton-foundation',1], 'seed-selection-preparation':['cotton-foundation',2],
    'precision-sowing':['cotton-foundation',3], 'seedling-management':['cotton-foundation',4],
    'field-scouting-basics':['field-observation',1], 'basic-field-checklist':['field-observation',2],
    'irrigation-principles':['water-fertilizer',1], 'fertigation-management':['water-fertilizer',2],
    'plant-architecture':['water-fertilizer',3], 'pest-monitoring':['flower-protection',1],
    'flower-boll-management':['flower-protection',2], 'midlevel-record-template':['flower-protection',3],
    'yield-diagnosis':['yield-quality',1], 'fiber-quality':['yield-quality',2],
    'defoliation-harvest':['harvest-digital',1], 'digital-field-data':['harvest-digital',2],
    'weather-risk-decision':['harvest-digital',3], 'annual-review-template':['harvest-digital',4]
  }
  for (const [courseKey, [seriesKey, lessonNo]] of Object.entries(assignments)) {
    await db.query('UPDATE academy_courses SET series_key=?,lesson_no=? WHERE course_key=? AND (series_key="" OR series_key IS NULL)', [seriesKey, lessonNo, courseKey])
  }
  console.log('[migrate] academy courses and comments ready')
}

run().then(() => process.exit(0)).catch(error => {
  console.error('[migrate-academy]', error)
  process.exit(1)
})
