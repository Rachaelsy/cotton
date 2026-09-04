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

async function hasIndex(table, index) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?`,
    [table, index]
  )
  return Number(row.total || 0) > 0
}

async function run() {
  if (!await hasTable('users') || !await hasTable('farmers')) {
    throw new Error('共享数据库尚未初始化，请先运行 cotton-app 的数据库迁移')
  }

  if (!await hasColumn('users', 'email')) {
    await db.query("ALTER TABLE users ADD COLUMN email VARCHAR(254) DEFAULT NULL COMMENT '注册邮箱' AFTER phone")
  }
  if (!await hasIndex('users', 'uniq_users_email')) {
    await db.query('ALTER TABLE users ADD UNIQUE INDEX uniq_users_email (email)')
  }
  if (!await hasColumn('merchants', 'company_type')) {
    await db.query("ALTER TABLE merchants ADD COLUMN company_type VARCHAR(32) NOT NULL DEFAULT 'enterprise' COMMENT '商家主体类型'")
  }
  if (!await hasColumn('merchants', 'contact_email')) {
    await db.query("ALTER TABLE merchants ADD COLUMN contact_email VARCHAR(254) NOT NULL DEFAULT '' COMMENT '联系人邮箱'")
  }
  if (!await hasColumn('merchants', 'registered_address')) {
    await db.query("ALTER TABLE merchants ADD COLUMN registered_address VARCHAR(255) NOT NULL DEFAULT '' COMMENT '经营或注册地址'")
  }
  if (!await hasColumn('merchants', 'apply_status')) {
    await db.query("ALTER TABLE merchants ADD COLUMN apply_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved' COMMENT '入驻审批状态'")
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS community_admins (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      display_name VARCHAR(64) NOT NULL DEFAULT '公共服务平台管理员',
      permission_key VARCHAR(64) NOT NULL DEFAULT 'public_admin',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      auth_version INT UNSIGNED NOT NULL DEFAULT 0,
      last_login_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_community_admin_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公共服务平台独立管理员'
  `)
  await db.query("ALTER TABLE community_admins MODIFY display_name VARCHAR(64) NOT NULL DEFAULT '公共服务平台管理员'")
  await db.query("UPDATE community_admins SET display_name='公共服务平台管理员' WHERE display_name IN ('公益平台管理员','公益小程序管理员')")
  await db.query("UPDATE community_admins SET permission_key='public_admin' WHERE permission_key='policy_editor'")

  await db.query(`
    CREATE TABLE IF NOT EXISTS community_market_listings (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      listing_type ENUM('供应','求购','农机服务','运输服务','加工服务') NOT NULL,
      title VARCHAR(120) NOT NULL,
      content VARCHAR(1500) NOT NULL,
      contact_name VARCHAR(64) NOT NULL DEFAULT '',
      contact_phone VARCHAR(24) NOT NULL,
      region VARCHAR(120) NOT NULL DEFAULT '',
      status ENUM('pending','published','rejected','offline') NOT NULL DEFAULT 'pending',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      expires_at DATETIME DEFAULT NULL,
      reviewed_by INT UNSIGNED DEFAULT NULL,
      reviewed_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_market_public (status,is_featured,created_at),
      INDEX idx_market_user (user_id,status,created_at),
      CONSTRAINT fk_market_listing_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='网站本地商圈供需信息'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS community_plot_daily_work (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      plot_id INT UNSIGNED NOT NULL,
      work_date DATE NOT NULL,
      time_label VARCHAR(40) NOT NULL DEFAULT '',
      title VARCHAR(120) NOT NULL,
      content VARCHAR(500) NOT NULL DEFAULT '',
      priority ENUM('normal','important','urgent') NOT NULL DEFAULT 'normal',
      status ENUM('draft','published','offline') NOT NULL DEFAULT 'draft',
      sort_order INT NOT NULL DEFAULT 0,
      published_at DATETIME DEFAULT NULL,
      created_by INT UNSIGNED DEFAULT NULL,
      updated_by INT UNSIGNED DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_plot_work_public (work_date,status,plot_id,sort_order,id),
      INDEX idx_plot_work_admin (plot_id,work_date,updated_at),
      CONSTRAINT fk_plot_daily_work_plot FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='按农户地块发布的今日农事'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS community_voice_briefings (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      briefing_date DATE NOT NULL,
      content TEXT NOT NULL,
      source_type ENUM('manual','ai','ai_edited') NOT NULL DEFAULT 'manual',
      status ENUM('draft','published','offline') NOT NULL DEFAULT 'draft',
      context_snapshot LONGTEXT DEFAULT NULL,
      context_hash CHAR(64) NOT NULL DEFAULT '',
      generation_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      ai_provider VARCHAR(32) NOT NULL DEFAULT '',
      ai_model VARCHAR(100) NOT NULL DEFAULT '',
      generated_at DATETIME DEFAULT NULL,
      published_at DATETIME DEFAULT NULL,
      created_by INT UNSIGNED DEFAULT NULL,
      updated_by INT UNSIGNED DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_voice_briefing_user_date (user_id,briefing_date),
      INDEX idx_voice_briefing_public (briefing_date,status,user_id),
      CONSTRAINT fk_voice_briefing_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农户每日智能语音播报'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS policy_articles (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(180) NOT NULL,
      summary VARCHAR(500) NOT NULL DEFAULT '',
      body_markdown MEDIUMTEXT NOT NULL,
      policy_level VARCHAR(32) NOT NULL DEFAULT '地区',
      category VARCHAR(64) NOT NULL DEFAULT '政策动态',
      issuer VARCHAR(160) NOT NULL DEFAULT '',
      region VARCHAR(160) NOT NULL DEFAULT '喀什地区',
      document_no VARCHAR(120) NOT NULL DEFAULT '',
      deadline VARCHAR(120) NOT NULL DEFAULT '',
      original_url VARCHAR(500) NOT NULL DEFAULT '',
      source_published_at DATETIME DEFAULT NULL,
      status ENUM('draft','published') NOT NULL DEFAULT 'draft',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      published_at DATETIME DEFAULT NULL,
      created_by INT UNSIGNED DEFAULT NULL,
      updated_by INT UNSIGNED DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_policy_public (status,is_featured,sort_order,published_at),
      INDEX idx_policy_filter (policy_level,category,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公共服务平台政策文章'
  `)
  if (!await hasColumn('policy_articles', 'content_type')) {
    await db.query(`
      ALTER TABLE policy_articles
      ADD COLUMN content_type VARCHAR(32) NOT NULL DEFAULT 'policy' AFTER body_markdown,
      ADD INDEX idx_policy_content_type (content_type,status,published_at)
    `)
  }
  await db.query("UPDATE policy_articles SET content_type='policy' WHERE content_type IS NULL OR content_type=''")
  if (!await hasColumn('policy_articles', 'is_home_featured')) {
    await db.query(`
      ALTER TABLE policy_articles
      ADD COLUMN is_home_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER is_featured,
      ADD COLUMN home_featured_at DATETIME DEFAULT NULL AFTER is_home_featured,
      ADD INDEX idx_policy_home (status,is_home_featured,home_featured_at)
    `)
    const [legacyFeatured] = await db.query(
      `SELECT id FROM policy_articles
        WHERE status='published' AND is_featured=1
        ORDER BY sort_order ASC,published_at DESC,id DESC LIMIT 5`
    )
    if (legacyFeatured.length) {
      const ids = legacyFeatured.map(row => Number(row.id)).filter(Number.isInteger)
      const placeholders = ids.map(() => '?').join(',')
      await db.query(
        `UPDATE policy_articles SET is_home_featured=1,home_featured_at=COALESCE(published_at,updated_at,NOW())
          WHERE id IN (${placeholders})`,
        ids
      )
    }
  }
  if (!await hasColumn('policy_articles', 'cover_url')) {
    await db.query(`
      ALTER TABLE policy_articles
      ADD COLUMN cover_url VARCHAR(500) NOT NULL DEFAULT '' AFTER original_url
    `)
  }
  if (!await hasColumn('policy_articles', 'source_published_at')) {
    if (await hasColumn('policy_articles', 'source_published_on')) {
      await db.query(`
        ALTER TABLE policy_articles
        CHANGE COLUMN source_published_on source_published_at DATETIME DEFAULT NULL
      `)
    } else {
      await db.query(`
        ALTER TABLE policy_articles
        ADD COLUMN source_published_at DATETIME DEFAULT NULL AFTER original_url
      `)
    }
  }
  await db.query(
    `UPDATE policy_articles SET source_published_at='2026-05-25 18:44:27'
      WHERE original_url='https://www.xinhuanet.com/20260525/1b268d4488ae49a191b4f10406d1e5cd/c.html'
        AND source_published_at IS NULL`
  )

  const financeArticles = [
    {
      category: 'loan',
      title: '申请棉花种植贷款前，先算清这四笔账',
      body: `# 申请棉花种植贷款前，先算清这四笔账

种植贷通常用于种子、农资、机耕机采、水肥等真实农业生产支出。贷款不是补贴，申请前应先判断资金缺口和还款能力。

## 一、完整种植成本

把种子、地膜、肥料、植保、滴灌、农机、人工和采收等费用列全，不要只计算眼前的一两项支出。

## 二、自有资金与贷款缺口

先确定可以投入且不会影响家庭基本生活的自有资金，再计算真正需要融资的部分，避免盲目追求高额度。

## 三、回款时间与融资成本

核对预计售棉时间、贷款期限、利率及合同约定费用。回款时间晚于还款日时，应提前准备周转方案。

## 四、风险缓冲

按减产、价格波动或回款延迟的情形重新测算，确认在不利情况下仍有基本偿还能力。

## 申请材料建议

- 身份证明与实名手机号
- 土地承包、流转或合法经营证明
- 种植面积、成本预算和农事记录
- 机构要求的其他真实材料

> 只通过银行或正规涉农金融机构官方渠道咨询。平台不放贷、不担保、不收取代办费用。`
    },
    {
      category: 'insurance',
      title: '棉花保险投保与理赔：关键步骤',
      body: `# 棉花保险投保与理赔：关键步骤

棉花保险用于分担合同约定范围内的农业生产风险。保险金额不等于最终赔款，具体保障以当地当年度通知、保险单和保险条款为准。

## 投保前

核对承保区域、截止时间、承保机构、保费承担方式和保险责任，准备身份及土地经营资料，并准确确认地块和种植面积。

## 签单时

逐项检查姓名、证件信息、地块位置、面积、保险期间、责任免除和免赔约定。发现信息错误，应及时通过官方渠道申请更正。

## 保障期间

保存保单、缴费凭证和服务电话。宣传材料只能帮助理解，最终权利义务以正式合同为准。

## 出险后

按约定及时报案，拍摄带时间、位置和地块特征的全景与近景照片，保留受损作物并配合现场查勘。

- 保存报案号和查勘记录
- 未获同意前不宜大面积翻耕或销毁现场
- 对处理结果有疑问时先向承保机构申请复核

> 不通过来源不明的二维码缴费，不向个人账户支付保费。`
    },
    {
      category: 'futures',
      title: '棉花期货入门：合约、行情与风险',
      body: `# 棉花期货入门：合约、行情与风险

棉花期货与现货价格存在联系，但它不是当地即时收购报价。阅读行情时，必须同时核对合约月份、时间、单位和数据来源。

## 认识具体合约

期货合约约定标准化的数量、质量、交易月份和交割规则。主力连续行情是便于观察趋势的连续数据，不是一个始终不变、可直接交易的单一合约。

## 理解保证金与每日结算

期货通常只需缴纳部分合约价值作为保证金，因此价格小幅变化也可能带来较大的盈亏。保证金不足时可能需要追加资金或被强制平仓。

## 比较价格要统一口径

- 核对具体合约月份和行情时间
- 核对报价单位、品质和交货条件
- 区分期货价格、现货报价和基差
- 重大经营决策应交叉核验权威来源

## 套期保值不等于确保盈利

套期保值用于管理价格风险，数量、月份或方向不匹配也会形成新风险，应由具备制度、人员和风控能力的经营主体审慎开展。

> 期货及衍生品风险较高，可能造成本金损失。本平台不提供开户、荐单、喊单、交易或收益预测。`
    },
    {
      category: 'finance-policy',
      title: '金融支农政策怎么看：贴息、担保与保费补贴',
      body: `# 金融支农政策怎么看：贴息、担保与保费补贴

金融支农政策会随地区和年度调整。政策支持不等于自动获批，办理前应核验最新正式文件、适用对象、期限和受理渠道。

## 贷款贴息

贴息通常对符合条件的贷款利息给予一定支持，可能采取先付后补、按期核算等方式。支持比例、期限和材料要求以正式政策为准。

## 农业信贷担保

担保可以帮助符合条件的农业经营主体改善增信条件，但不代表免审核、免担保费或免还款，贷款机构仍会独立评估经营和偿还能力。

## 农业保险保费补贴

保费补贴用于分担符合政策范围的农业保险保费，不代表所有风险均可赔付。实际保障仍取决于保险责任、保险期间和查勘定损结果。

## 核验清单

- 政策名称、文号、发布机关和发布日期
- 适用地区、支持对象和办理期限
- 资金上限、材料清单和受理部门
- 政府网站或政策指定机构的官方入口

> 转述、截图和短视频不能替代正式文件，提交材料前请向发布部门或经办机构再次核验。`
    }
  ]
  for (const article of financeArticles) {
    const [[existing]] = await db.query(
      "SELECT id FROM policy_articles WHERE content_type='finance' AND category=? LIMIT 1",
      [article.category]
    )
    if (existing) continue
    await db.query(
      `INSERT INTO policy_articles
       (title,summary,body_markdown,content_type,policy_level,category,issuer,region,status,is_featured,sort_order,published_at)
       VALUES (?,?,?,'finance','优棉金融',?,'喀什优棉公共服务平台','喀什地区','published',1,0,NOW())`,
      [article.title, article.body.replace(/[#>*_`~\-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180), article.body, article.category]
    )
    console.log(`[migrate] finance article created: ${article.category}`)
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS policy_comments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      article_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      parent_id BIGINT UNSIGNED DEFAULT NULL,
      content VARCHAR(300) NOT NULL,
      status ENUM('published','hidden') NOT NULL DEFAULT 'published',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_policy_comment_article (article_id,status,created_at),
      INDEX idx_policy_comment_parent (parent_id,created_at),
      INDEX idx_policy_comment_user (user_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='政策资讯文章评论'
  `)
  if (!await hasColumn('policy_comments', 'parent_id')) {
    await db.query(`
      ALTER TABLE policy_comments
      ADD COLUMN parent_id BIGINT UNSIGNED DEFAULT NULL AFTER user_id,
      ADD INDEX idx_policy_comment_parent (parent_id,created_at)
    `)
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS policy_comment_likes (
      comment_id BIGINT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (comment_id,user_id),
      INDEX idx_policy_comment_like_user (user_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='政策资讯评论点赞'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS community_service_products (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      service_type ENUM('machinery','supplies') NOT NULL,
      category VARCHAR(40) NOT NULL,
      name VARCHAR(160) NOT NULL,
      model_name VARCHAR(160) NOT NULL DEFAULT '',
      brand VARCHAR(120) NOT NULL DEFAULT '',
      manufacturer VARCHAR(180) NOT NULL DEFAULT '',
      cover_url VARCHAR(500) NOT NULL DEFAULT '',
      intro VARCHAR(1000) NOT NULL DEFAULT '',
      features_json TEXT,
      applicable VARCHAR(500) NOT NULL DEFAULT '',
      region VARCHAR(160) NOT NULL DEFAULT '喀什地区',
      status ENUM('draft','published','offline') NOT NULL DEFAULT 'draft',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      published_at DATETIME DEFAULT NULL,
      created_by INT UNSIGNED DEFAULT NULL,
      updated_by INT UNSIGNED DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_service_product_public (service_type,status,category,is_featured,sort_order,published_at),
      INDEX idx_service_product_admin (service_type,status,updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公共服务平台农机农资产品目录'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS community_cotton_varieties (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      trial_year SMALLINT UNSIGNED NOT NULL,
      trial_area VARCHAR(160) NOT NULL DEFAULT '喀什地区',
      name VARCHAR(160) NOT NULL,
      lint_percent DECIMAL(6,2) DEFAULT NULL,
      lint_rank SMALLINT UNSIGNED DEFAULT NULL,
      lint_weighted DECIMAL(7,3) DEFAULT NULL,
      fiber_length_mm DECIMAL(6,2) DEFAULT NULL,
      fiber_length_rank SMALLINT UNSIGNED DEFAULT NULL,
      fiber_length_weighted DECIMAL(7,3) DEFAULT NULL,
      fiber_strength_cn_tex DECIMAL(6,2) DEFAULT NULL,
      fiber_strength_rank SMALLINT UNSIGNED DEFAULT NULL,
      fiber_strength_weighted DECIMAL(7,3) DEFAULT NULL,
      micronaire_value DECIMAL(5,2) DEFAULT NULL,
      micronaire_rank SMALLINT UNSIGNED DEFAULT NULL,
      micronaire_weighted DECIMAL(7,3) DEFAULT NULL,
      uniformity_percent DECIMAL(6,2) DEFAULT NULL,
      uniformity_rank SMALLINT UNSIGNED DEFAULT NULL,
      uniformity_weighted DECIMAL(7,3) DEFAULT NULL,
      seed_cotton_yield_kg_mu DECIMAL(8,2) DEFAULT NULL,
      yield_rank SMALLINT UNSIGNED DEFAULT NULL,
      yield_weighted DECIMAL(7,3) DEFAULT NULL,
      weighted_total DECIMAL(8,3) DEFAULT NULL,
      overall_rank SMALLINT UNSIGNED DEFAULT NULL,
      cover_url VARCHAR(500) NOT NULL DEFAULT '',
      suitable_conditions VARCHAR(1000) NOT NULL DEFAULT '',
      strengths_json TEXT,
      recommended_counties_json TEXT,
      notes TEXT,
      source_name VARCHAR(300) NOT NULL DEFAULT '',
      status ENUM('draft','published','offline') NOT NULL DEFAULT 'draft',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      published_at DATETIME DEFAULT NULL,
      created_by INT UNSIGNED DEFAULT NULL,
      updated_by INT UNSIGNED DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_cotton_variety_trial (trial_year,name),
      INDEX idx_cotton_variety_public (status,trial_year,overall_rank,sort_order),
      INDEX idx_cotton_variety_admin (status,updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='喀什棉花品种试验指标与优选资料'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS community_pest_knowledge (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      category ENUM('pest','disease','physiological') NOT NULL,
      icon VARCHAR(16) NOT NULL DEFAULT '🌿',
      cover_url VARCHAR(500) NOT NULL DEFAULT '',
      summary TEXT NOT NULL,
      symptoms_json TEXT,
      treatment_advice TEXT NOT NULL,
      medication_warning TEXT,
      source_name VARCHAR(200) NOT NULL DEFAULT '',
      source_url VARCHAR(500) NOT NULL DEFAULT '',
      status ENUM('draft','published','offline') NOT NULL DEFAULT 'draft',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      published_at DATETIME DEFAULT NULL,
      created_by INT UNSIGNED DEFAULT NULL,
      updated_by INT UNSIGNED DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pest_knowledge_public (status,category,is_featured,sort_order,published_at),
      INDEX idx_pest_knowledge_admin (status,updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='病虫害知识库'
  `)

  const varietyTrial2025 = [
    ['中棉9001',46.2,3,0.45,28.9,15,3,31.6,11,2.2,5,8,0.8,82.1,16,3.2,394.1,19,2.85,12.5,20],
    ['中棉698',43.5,15,2.25,29.9,8,1.6,30.1,16,3.2,4.7,7,0.7,84.4,7,1.4,481.8,3,0.45,9.6,11],
    ['ZZ1786',43.1,16,2.4,30.3,4,0.8,31.1,13,2.6,4.5,5,0.5,85.1,5,1,429.6,12,1.8,9.1,9],
    ['新陆中86号',43.5,15,2.25,29.8,9,1.8,30.9,15,3,4.4,4,0.4,83.9,12,2.4,478.5,4,0.6,10.45,16],
    ['九棉35',43.1,16,2.4,30.1,6,1.2,31.6,11,2.2,4.5,5,0.5,85.4,2,0.4,435.8,11,1.65,8.35,7],
    ['中生棉17',45,7,1.05,29.6,11,2.2,32.5,8,1.6,4.7,7,0.7,84.9,6,1.2,389.2,20,3,9.75,13],
    ['塔河2号',43.9,12,1.8,30.4,3,0.6,33.4,6,1.2,4.7,7,0.7,85.2,4,0.8,482.7,2,0.3,5.4,3],
    ['新塔棉11号',45.4,5,0.75,29.8,9,1.8,31.2,12,2.4,4.6,6,0.6,84,11,2.2,461.1,6,0.9,8.65,8],
    ['新塔棉5号',44,11,1.65,29.4,12,2.4,33.6,5,1,4.6,6,0.6,83.7,13,2.6,425.5,13,1.95,10.2,15],
    ['源棉8号',40.7,18,2.7,30.2,5,1,35.6,1,0.2,4,1,0.1,84.2,9,1.8,454.5,9,1.35,7.15,4],
    ['K621',44.1,10,1.5,29.3,13,2.6,31.1,13,2.6,4.3,3,0.3,83,15,3,419.7,14,2.1,12.1,19],
    ['J8031',44.1,10,1.5,29.8,9,1.8,31.1,13,2.6,4.6,6,0.6,85.1,5,1,385.1,21,3.15,10.65,17],
    ['新陆中84号',43.6,14,2.1,29.7,10,2,34.4,2,0.4,4.2,2,0.2,83,15,3,416.8,15,2.25,9.95,14],
    ['鲁丰花861',43.8,13,1.95,29.7,10,2,33.9,4,0.8,4.7,7,0.7,85.1,5,1,455.1,8,1.2,7.65,5],
    ['新棉92号',44,11,1.65,30.2,5,1,32.4,9,1.8,4.5,5,0.5,84.1,10,2,400.4,18,2.7,9.65,12],
    ['新陆中88号',45.2,6,0.9,29.1,14,2.8,33.1,7,1.4,4.4,4,0.4,84.1,10,2,471.4,5,0.75,8.25,6],
    ['96G',45.7,4,0.6,29.9,8,1.6,33.1,7,1.4,4.2,2,0.2,81.9,17,3.4,401.5,17,2.55,9.75,13],
    ['前海211',47.8,1,0.15,30.6,2,0.4,33.4,6,1.2,4.5,5,0.5,85.3,3,0.6,404.1,16,2.4,5.25,2],
    ['HD258',41.3,17,2.55,31.4,1,0.2,34.1,3,0.6,4,1,0.1,86.5,1,0.2,496.2,1,0.15,3.8,1],
    ['禾春洲10号',46.9,2,0.3,30,7,1.4,31,14,2.8,4.2,2,0.2,83.2,14,2.8,338.5,22,3.3,10.8,18],
    ['盛棉2号',44.2,9,1.35,29.1,14,2.8,33.4,6,1.2,4.5,5,0.5,84,11,2.2,451.9,10,1.5,9.55,10],
    ['AW05',44.8,8,1.2,28.8,16,3.2,31.8,10,2,4.7,7,0.7,84.3,8,1.6,459.6,7,1.05,9.75,13]
  ]
  for (const variety of varietyTrial2025) {
    await db.query(
      `INSERT IGNORE INTO community_cotton_varieties
       (trial_year,trial_area,name,lint_percent,lint_rank,lint_weighted,fiber_length_mm,fiber_length_rank,fiber_length_weighted,
        fiber_strength_cn_tex,fiber_strength_rank,fiber_strength_weighted,micronaire_value,micronaire_rank,micronaire_weighted,
        uniformity_percent,uniformity_rank,uniformity_weighted,seed_cotton_yield_kg_mu,yield_rank,yield_weighted,
        weighted_total,overall_rank,source_name,status,is_featured,sort_order,published_at)
       VALUES (2025,'喀什地区',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'2025年喀什地区棉花品种对比试验各项指标统计表','published',?, ?,NOW())`,
      [...variety, variety[20] <= 5 ? 1 : 0, variety[20]]
    )
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS community_processing_factories (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      short_name VARCHAR(100) NOT NULL DEFAULT '',
      county VARCHAR(80) NOT NULL,
      address VARCHAR(300) NOT NULL,
      longitude DECIMAL(11,7) NOT NULL,
      latitude DECIMAL(10,7) NOT NULL,
      annual_capacity_tons DECIMAL(14,2) DEFAULT NULL,
      manager_name VARCHAR(80) NOT NULL DEFAULT '',
      contact_phone VARCHAR(40) NOT NULL DEFAULT '',
      intro TEXT NOT NULL,
      image_urls_json TEXT,
      services_json TEXT,
      public_code VARCHAR(40) DEFAULT NULL,
      rating VARCHAR(20) NOT NULL DEFAULT '',
      official_address VARCHAR(300) NOT NULL DEFAULT '',
      map_name VARCHAR(200) NOT NULL DEFAULT '',
      official_source VARCHAR(500) NOT NULL DEFAULT '',
      map_source VARCHAR(300) NOT NULL DEFAULT '',
      verified_at DATE DEFAULT NULL,
      status ENUM('draft','published','offline') NOT NULL DEFAULT 'draft',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      published_at DATETIME DEFAULT NULL,
      created_by INT UNSIGNED DEFAULT NULL,
      updated_by INT UNSIGNED DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_processing_factory_public_code (public_code),
      INDEX idx_processing_factory_public (status,is_featured,sort_order,id),
      INDEX idx_processing_factory_county (county,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公共服务平台加工厂地图与详情'
  `)
  // 兼容曾使用 NOT NULL 默认空字符串的开发库；空公示代码应存为 NULL，避免唯一索引冲突。
  await db.query('ALTER TABLE community_processing_factories MODIFY public_code VARCHAR(40) DEFAULT NULL')

  const processingSeed = [
    ['新疆棉花产业（集团）巴楚棉业有限责任公司色力布亚轧花厂','色力布亚轧花厂','巴楚县','新疆喀什地区巴楚县色力布亚镇',77.82704,39.30513,'该企业列入自治区棉花加工企业公开名单，地图 POI 可匹配到巴楚县色力布亚镇的轧花厂位置。平台仅汇集公开信息，不对实际接收、加工或仓储能力作出承诺。','["自治区公示棉花加工企业"]','653165263','A','新疆喀什地区巴楚县色力布亚镇','巴楚公司色力布亚轧花厂','自治区 2025 年度第一批棉花加工企业诚信经营评价结果公示名单','图吧地图公开 POI','2026-08-12',1],
    ['新疆棉花产业（集团）麦盖提棉业有限责任公司县城轧花厂','麦盖提县城轧花厂','麦盖提县','新疆喀什地区麦盖提县央塔克北路001号',77.65416,38.90886,'该企业列入 2025 年度自治区棉花加工企业公示及诚信经营评价名单，公开地图以“麦盖提棉业公司县城轧花厂”收录对应位置。','["自治区公示棉花加工企业","参与追溯（公示信息）"]','653165060','A','新疆喀什地区麦盖提县央塔克北路001号','麦盖提棉业公司县城轧花厂','自治区 2025 年度第一批棉花目标价格改革加工企业公示及诚信经营评价结果','图吧地图公开 POI','2026-08-12',2],
    ['新疆棉花产业集团岳普湖棉业有限公司县城轧花厂','岳普湖县城轧花厂','岳普湖县','新疆喀什地区岳普湖县库木萨热依南路21号院',76.76648,39.23027,'该企业列入 2025 年度自治区棉花加工企业公示及诚信经营评价名单。公开地图仍使用“岳普湖县棉麻公司县城轧花厂”的历史简称，地址区域与官方公示相符。','["自治区公示棉花加工企业","参与追溯（公示信息）"]','653165395','A','新疆喀什地区岳普湖县库木萨热依南路21号院','岳普湖县棉麻公司县城轧花厂','自治区 2025 年度第一批棉花目标价格改革加工企业公示及诚信经营评价结果','图吧地图公开 POI（历史简称）','2026-08-12',3]
  ]
  for (const factory of processingSeed) {
    await db.query(
      `INSERT IGNORE INTO community_processing_factories
       (name,short_name,county,address,longitude,latitude,intro,image_urls_json,services_json,public_code,rating,official_address,map_name,official_source,map_source,verified_at,status,is_featured,sort_order,published_at)
       VALUES (?,?,?,?,?,?,?,'[]',?,?,?,?,?,?,?,?,'published',1,?,NOW())`,
      factory
    )
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS experts (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      name VARCHAR(64) NOT NULL,
      title VARCHAR(64) DEFAULT '',
      org VARCHAR(128) DEFAULT 'Cotton 棉花平台',
      avatar VARCHAR(16) DEFAULT '专',
      specialties VARCHAR(512) DEFAULT '[]',
      bio TEXT,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_experts_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='共享专家账号'
  `)
  if (!await hasColumn('experts', 'avatar_url')) {
    await db.query("ALTER TABLE experts ADD COLUMN avatar_url VARCHAR(500) NOT NULL DEFAULT '' AFTER avatar")
  }
  if (!await hasColumn('experts', 'profile_only')) {
    await db.query('ALTER TABLE experts ADD COLUMN profile_only TINYINT(1) NOT NULL DEFAULT 0 AFTER bio')
  }
  if (!await hasColumn('experts', 'sort_order')) {
    await db.query('ALTER TABLE experts ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER profile_only')
  }

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
      expert_avatar VARCHAR(16) DEFAULT '专',
      expert_tags VARCHAR(512) DEFAULT '[]',
      intro TEXT,
      content MEDIUMTEXT,
      cover_url VARCHAR(500) DEFAULT '',
      video_url VARCHAR(500) DEFAULT '',
      duration VARCHAR(32) DEFAULT '',
      price_type ENUM('free','paid') NOT NULL DEFAULT 'free',
      price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      quiz_json MEDIUMTEXT,
      ai_prompt TEXT,
      students INT UNSIGNED NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      is_published TINYINT(1) NOT NULL DEFAULT 1,
      expert_id INT UNSIGNED DEFAULT NULL,
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_expert_content_type (type),
      INDEX idx_expert_content_expert (expert_id),
      INDEX idx_expert_content_public (is_published,is_featured,sort_order,id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专家讲堂运营内容'
  `)
  if (!await hasColumn('expert_contents', 'expert_id')) {
    await db.query('ALTER TABLE expert_contents ADD COLUMN expert_id INT UNSIGNED DEFAULT NULL AFTER is_published')
  }
  if (!await hasColumn('expert_contents', 'is_featured')) {
    await db.query('ALTER TABLE expert_contents ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER expert_id')
  }
  if (!await hasColumn('expert_contents', 'source_key')) {
    await db.query('ALTER TABLE expert_contents ADD COLUMN source_key VARCHAR(100) DEFAULT NULL AFTER is_featured')
  }
  await db.query('ALTER TABLE expert_contents MODIFY cover_url VARCHAR(500) DEFAULT NULL, MODIFY video_url VARCHAR(500) DEFAULT NULL')

  await db.query(`CREATE TABLE IF NOT EXISTS community_seed_runs (
    seed_key VARCHAR(100) PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公共服务初始化内容批次'`)
  const expertQaSeedBatch = 'expert-qa-production-faq-v1'
  const [[expertQaSeeded]] = await db.query('SELECT seed_key FROM community_seed_runs WHERE seed_key=? LIMIT 1', [expertQaSeedBatch])
  if (!expertQaSeeded) {
    const expertQaSeed = require('./expert_qa_seed')
    for (const item of expertQaSeed) {
      const [[existing]] = await db.query('SELECT id FROM expert_contents WHERE source_key=? LIMIT 1', [item.key])
      if (existing) continue
      await db.query(
        `INSERT INTO expert_contents
         (type,title,subtitle,category_key,category_name,teacher,teacher_title,org,expert_avatar,expert_tags,
          intro,content,duration,price_type,price,ai_prompt,students,sort_order,is_published,expert_id,is_featured,source_key)
         VALUES ('qa',?,?,?,?,?,'内容审核','喀什优棉公共服务平台','农技',?,?,?,?,
          'free',0,?,0,?,1,NULL,1,?)`,
        [item.title,item.subtitle,item.categoryKey,item.categoryName,'平台农技组',JSON.stringify(item.tags),item.intro,item.content,'约5分钟',item.aiPrompt,item.sortOrder,item.key]
      )
    }
    await db.query('INSERT INTO community_seed_runs (seed_key) VALUES (?)', [expertQaSeedBatch])
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS expert_questions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED DEFAULT NULL,
      farmer_name VARCHAR(64) DEFAULT '',
      farmer_phone VARCHAR(32) DEFAULT '',
      category VARCHAR(64) DEFAULT '',
      crop_stage VARCHAR(64) DEFAULT '',
      plot_id INT UNSIGNED DEFAULT NULL,
      plot_name VARCHAR(128) DEFAULT '',
      question TEXT NOT NULL,
      images TEXT DEFAULT NULL,
      status ENUM('pending','replied','closed') NOT NULL DEFAULT 'pending',
      reply TEXT,
      replied_by INT UNSIGNED DEFAULT NULL,
      replied_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_expert_questions_user_created (user_id,created_at),
      INDEX idx_expert_questions_status_created (status,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='共享专家咨询记录'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS community_service_requests (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      kind ENUM('business','activity','privacy') NOT NULL,
      reference_id VARCHAR(120) DEFAULT '',
      reference_name VARCHAR(160) DEFAULT '',
      contact_name VARCHAR(64) NOT NULL,
      contact_phone VARCHAR(32) NOT NULL,
      region VARCHAR(100) DEFAULT '',
      category VARCHAR(64) DEFAULT '',
      message TEXT,
      status ENUM('pending','contacted','closed') NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      source_path VARCHAR(255) DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_service_request_status (status,created_at),
      INDEX idx_service_request_kind (kind,created_at),
      INDEX idx_service_request_phone (contact_phone,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公益活动意向与商务服务需求'
  `)
  await db.query(`
    ALTER TABLE community_service_requests
    MODIFY COLUMN kind ENUM('business','activity','privacy') NOT NULL
  `)

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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公共服务平台课程内容'
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公益课程评论'
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公益课程观看和阅读进度'
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公益课程收藏'
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公共服务平台公开问答'
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公共服务平台问题回答'
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公共服务平台回答点赞'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS farmer_points_accounts (
      user_id       INT UNSIGNED PRIMARY KEY,
      balance       INT UNSIGNED NOT NULL DEFAULT 0,
      locked_points INT UNSIGNED NOT NULL DEFAULT 0,
      total_earned  INT UNSIGNED NOT NULL DEFAULT 0,
      total_used    INT UNSIGNED NOT NULL DEFAULT 0,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_points_account_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农户积分账户'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS farmer_points_transactions (
      id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id        INT UNSIGNED NOT NULL,
      type           VARCHAR(32) NOT NULL,
      points         INT NOT NULL,
      status         VARCHAR(16) NOT NULL DEFAULT 'completed',
      order_id       INT UNSIGNED DEFAULT NULL,
      content_id     INT UNSIGNED DEFAULT NULL,
      reference_key  VARCHAR(96) NOT NULL,
      balance_after  INT UNSIGNED NOT NULL DEFAULT 0,
      description    VARCHAR(255) NOT NULL DEFAULT '',
      operator_id    INT UNSIGNED DEFAULT NULL,
      settled_at     DATETIME DEFAULT NULL,
      cancelled_at   DATETIME DEFAULT NULL,
      created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_points_reference (reference_key),
      INDEX idx_points_user_created (user_id,created_at),
      INDEX idx_points_order (order_id,type,status),
      INDEX idx_points_content (content_id,user_id),
      CONSTRAINT fk_points_transaction_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农户积分收支账本'
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS community_sso_tickets (
      id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ticket_hash CHAR(64) NOT NULL,
      user_id     INT UNSIGNED NOT NULL,
      expires_at  DATETIME NOT NULL,
      used_at     DATETIME DEFAULT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_community_sso_ticket (ticket_hash),
      INDEX idx_community_sso_expiry (expires_at,used_at),
      CONSTRAINT fk_community_sso_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序到公共服务平台的一次性登录票据'
  `)

  await db.query(`
    INSERT IGNORE INTO farmer_points_accounts (user_id)
    SELECT u.id FROM users u JOIN farmers f ON f.user_id=u.id WHERE u.is_active=1
  `)

  await db.query('DROP TABLE IF EXISTS knowledge_web_login_tickets')
  await db.query('DELETE FROM community_sso_tickets WHERE expires_at<NOW() OR used_at IS NOT NULL')
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

  console.log('[migrate] public service and learning tables ready')
  process.exit(0)
}

run().catch(error => {
  console.error('[migrate] public learning migration failed:', error.message)
  process.exit(1)
})
