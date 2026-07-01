require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS plots (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id      INT UNSIGNED NOT NULL                   COMMENT '农户 user_id',
      name         VARCHAR(64)  NOT NULL                   COMMENT '地块名称',
      variety      VARCHAR(64)  NOT NULL DEFAULT ''        COMMENT '种植品种',
      area         DECIMAL(10,2) NOT NULL DEFAULT 0        COMMENT '面积（亩）',
      perimeter    DECIMAL(10,2) NOT NULL DEFAULT 0        COMMENT '周长（米）',
      coordinates  TEXT         DEFAULT NULL               COMMENT 'JSON [{latitude,longitude},...]',
      sow_date     DATE         DEFAULT NULL               COMMENT '播种日期',
      irrigation   VARCHAR(16)  NOT NULL DEFAULT '滴灌'   COMMENT '灌溉方式',
      soil_type    VARCHAR(32)  NOT NULL DEFAULT ''        COMMENT '土壤类型',
      planting_status VARCHAR(16) NOT NULL DEFAULT '已播种' COMMENT '已播种 / 计划播种 / 未播种',
      health_score TINYINT UNSIGNED NOT NULL DEFAULT 100   COMMENT '健康评分 0-100',
      health_issue VARCHAR(64)  NOT NULL DEFAULT ''        COMMENT '当前问题（如：蚜虫、缺水）',
      status       VARCHAR(16)  NOT NULL DEFAULT 'normal'  COMMENT 'normal / attention',
      note         TEXT         DEFAULT NULL               COMMENT '备注',
      created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农户地块信息'
  `)
  const [plantingColumns] = await db.query("SHOW COLUMNS FROM plots LIKE 'planting_status'")
  if (!plantingColumns.length) {
    await db.query(`
      ALTER TABLE plots
      ADD COLUMN planting_status VARCHAR(16) NOT NULL DEFAULT '已播种'
      COMMENT '已播种 / 计划播种 / 未播种'
      AFTER soil_type
    `)
  }
  console.log('✅ plots 表已创建')
  process.exit(0)
}

migrate().catch(err => { console.error('❌', err.message); process.exit(1) })
