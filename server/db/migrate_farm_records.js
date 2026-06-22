// server/db/migrate_farm_records.js — 创建农事记录表
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS farm_records (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id     INT UNSIGNED NOT NULL                    COMMENT '农户 user_id',
      plot_id     INT UNSIGNED DEFAULT NULL                COMMENT '关联地块 id（NULL=全部地块）',
      plot_name   VARCHAR(64)  NOT NULL DEFAULT '全部地块' COMMENT '地块名称快照',
      type        VARCHAR(16)  NOT NULL                    COMMENT '农事类型：灌溉/施肥/打药/无人机/播种/采收/巡田/其他',
      title       VARCHAR(64)  NOT NULL DEFAULT ''         COMMENT '记录标题',
      work_date   DATE         NOT NULL                    COMMENT '作业日期',
      work_time   VARCHAR(8)   NOT NULL DEFAULT ''         COMMENT '作业时间 HH:mm',
      amount      VARCHAR(64)  NOT NULL DEFAULT ''         COMMENT '用量描述',
      cost        DECIMAL(10,2) NOT NULL DEFAULT 0         COMMENT '成本（元）',
      worker      VARCHAR(32)  NOT NULL DEFAULT '本人'     COMMENT '执行人',
      note        TEXT         DEFAULT NULL                COMMENT '备注',
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_user_date (user_id, work_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农事记录'
  `)
  console.log('✅ farm_records 表已创建')
  process.exit(0)
}

migrate().catch(err => { console.error('❌', err.message); process.exit(1) })
