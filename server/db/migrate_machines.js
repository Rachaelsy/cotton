// server/db/migrate_machines.js — 农机租赁模块建表
// 角色 operator（农机手）+ 机具 + 预约订单 + 评价
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  // 1. users.role 增加 operator（农机手）
  await db.query(
    "ALTER TABLE users MODIFY COLUMN role ENUM('farmer','merchant','operator') NOT NULL"
  )
  console.log('✅ users.role 已支持 operator')

  // 2. operators —— 农机手 / 合作社
  await db.query(`
    CREATE TABLE IF NOT EXISTS operators (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id       INT UNSIGNED NOT NULL                  COMMENT '机手 user_id',
      org_name      VARCHAR(64)  NOT NULL                  COMMENT '合作社/机队名称',
      contact       VARCHAR(32)  NOT NULL DEFAULT ''       COMMENT '联系人',
      phone         VARCHAR(20)  NOT NULL DEFAULT ''       COMMENT '联系电话',
      id_card       VARCHAR(32)  NOT NULL DEFAULT ''       COMMENT '身份证/资质号',
      service_area  VARCHAR(64)  NOT NULL DEFAULT ''       COMMENT '服务区域',
      latitude      DECIMAL(10,7) DEFAULT NULL             COMMENT '基地纬度',
      longitude     DECIMAL(10,7) DEFAULT NULL             COMMENT '基地经度',
      location_name VARCHAR(128) NOT NULL DEFAULT ''       COMMENT '基地地址文字',
      apply_status  VARCHAR(16)  NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected',
      reject_reason VARCHAR(128) NOT NULL DEFAULT '',
      rating_avg    DECIMAL(3,2) NOT NULL DEFAULT 5.00     COMMENT '综合评分',
      response_time VARCHAR(16)  NOT NULL DEFAULT '30分钟'  COMMENT '平均响应时长',
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农机手/合作社'
  `)
  console.log('✅ operators 表已创建')

  // 3. machines —— 机具
  await db.query(`
    CREATE TABLE IF NOT EXISTS machines (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      operator_id   INT UNSIGNED NOT NULL                  COMMENT '所属机手 operators.id',
      name          VARCHAR(64)  NOT NULL                  COMMENT '机具名称',
      category      VARCHAR(16)  NOT NULL DEFAULT '其他'   COMMENT '打药机/采棉机/播种机/旋耕机/其他',
      icon          VARCHAR(8)   NOT NULL DEFAULT '🚜',
      price         DECIMAL(10,2) NOT NULL DEFAULT 0       COMMENT '单价',
      price_orig    DECIMAL(10,2) DEFAULT NULL             COMMENT '原价（划线）',
      unit          VARCHAR(8)   NOT NULL DEFAULT '亩'     COMMENT '计价单位：亩/天',
      latitude      DECIMAL(10,7) DEFAULT NULL             COMMENT '机具所在纬度',
      longitude     DECIMAL(10,7) DEFAULT NULL             COMMENT '机具所在经度',
      location_name VARCHAR(128) NOT NULL DEFAULT ''       COMMENT '所在地文字',
      spec_badges   TEXT         DEFAULT NULL              COMMENT 'JSON 规格标签 ["喷幅9m",...]',
      params        TEXT         DEFAULT NULL              COMMENT 'JSON 参数 [{val,lbl},...]',
      description   TEXT         DEFAULT NULL,
      status        VARCHAR(8)   NOT NULL DEFAULT 'on'     COMMENT 'on上架/off下架/busy紧俏',
      rating_avg    DECIMAL(3,2) NOT NULL DEFAULT 5.00,
      order_count   INT UNSIGNED NOT NULL DEFAULT 0        COMMENT '累计接单数',
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_operator (operator_id),
      INDEX idx_category (category),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='机具'
  `)
  console.log('✅ machines 表已创建')

  // 4. machine_orders —— 预约订单
  await db.query(`
    CREATE TABLE IF NOT EXISTS machine_orders (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_no      VARCHAR(32)  NOT NULL UNIQUE,
      machine_id    INT UNSIGNED NOT NULL,
      operator_id   INT UNSIGNED NOT NULL,
      farmer_id     INT UNSIGNED NOT NULL,
      machine_name  VARCHAR(64)  NOT NULL DEFAULT '',
      machine_icon  VARCHAR(8)   NOT NULL DEFAULT '🚜',
      plot_id       INT UNSIGNED DEFAULT NULL,
      plot_name     VARCHAR(64)  NOT NULL DEFAULT '',
      work_address  VARCHAR(255) NOT NULL DEFAULT ''       COMMENT '作业地址（农户填写/地图选点）',
      work_date     DATE         NOT NULL                  COMMENT '作业日期',
      work_area     DECIMAL(10,2) NOT NULL DEFAULT 0       COMMENT '作业面积（亩）',
      unit_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_price   DECIMAL(12,2) NOT NULL DEFAULT 0,
      deposit       DECIMAL(12,2) NOT NULL DEFAULT 0       COMMENT '定金（20%）',
      pay_mode      VARCHAR(8)   NOT NULL DEFAULT 'deposit' COMMENT 'deposit定金/full全款',
      pay_status    VARCHAR(8)   NOT NULL DEFAULT 'unpaid' COMMENT 'unpaid/paid',
      status        VARCHAR(12)  NOT NULL DEFAULT 'pending' COMMENT '订单状态机',
      farmer_lat    DECIMAL(10,7) DEFAULT NULL,
      farmer_lng    DECIMAL(10,7) DEFAULT NULL,
      farmer_name   VARCHAR(32)  NOT NULL DEFAULT '',
      contact_phone VARCHAR(20)  NOT NULL DEFAULT '',
      note          VARCHAR(255) NOT NULL DEFAULT '',
      reject_reason VARCHAR(128) NOT NULL DEFAULT '',
      accepted_at   DATETIME     DEFAULT NULL,
      completed_at  DATETIME     DEFAULT NULL,
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_farmer (farmer_id),
      INDEX idx_operator (operator_id),
      INDEX idx_machine (machine_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农机预约订单'
  `)
  console.log('✅ machine_orders 表已创建')

  // 5. machine_reviews —— 分项评价
  await db.query(`
    CREATE TABLE IF NOT EXISTS machine_reviews (
      id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id       INT UNSIGNED NOT NULL UNIQUE,
      machine_id     INT UNSIGNED NOT NULL,
      operator_id    INT UNSIGNED NOT NULL,
      farmer_id      INT UNSIGNED NOT NULL,
      farmer_name    VARCHAR(32)  NOT NULL DEFAULT '',
      score_timely   TINYINT      NOT NULL DEFAULT 5       COMMENT '及时性',
      score_quality  TINYINT      NOT NULL DEFAULT 5       COMMENT '作业质量',
      score_attitude TINYINT      NOT NULL DEFAULT 5       COMMENT '服务态度',
      score_price    TINYINT      NOT NULL DEFAULT 5       COMMENT '价格合理性',
      rating         DECIMAL(3,2) NOT NULL DEFAULT 5.00    COMMENT '综合',
      content        TEXT         DEFAULT NULL,
      reply          VARCHAR(255) NOT NULL DEFAULT '',
      created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_machine (machine_id),
      INDEX idx_operator (operator_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农机服务评价'
  `)
  console.log('✅ machine_reviews 表已创建')

  // 兼容已存在的表：补充 work_address 字段
  await addColumn('machine_orders', 'work_address', "VARCHAR(255) NOT NULL DEFAULT '' AFTER plot_name")

  console.log('🎉 农机租赁模块建表完成')
  process.exit(0)
}

async function addColumn(table, col, def) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
    console.log(`✅ ${table}.${col} 已添加`)
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log(`ℹ️  ${table}.${col} 已存在，跳过`)
    else throw e
  }
}

migrate().catch(err => { console.error('❌', err.message); process.exit(1) })
