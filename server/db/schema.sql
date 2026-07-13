-- ============================================================
-- 棉花智能体小程序数据库建表语句
-- 数据库：MySQL 5.7+  字符集：utf8mb4
-- ============================================================

-- -------------------------------------------------------
-- 用户主表（农户 + 商户共用）
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
  phone       VARCHAR(11)  NOT NULL UNIQUE       COMMENT '手机号（登录账号）',
  password    VARCHAR(64)  NOT NULL              COMMENT 'bcrypt 加密后的密码',
  role        ENUM('farmer','merchant') NOT NULL COMMENT '身份：农户/商户',
  real_name   VARCHAR(32)  DEFAULT NULL          COMMENT '真实姓名',
  is_verified TINYINT(1)   NOT NULL DEFAULT 0   COMMENT '是否实名认证',
  is_active   TINYINT(1)   NOT NULL DEFAULT 1   COMMENT '账号是否启用',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_role  (role)
) ENGINE=InnoDB COMMENT='用户主表';

-- -------------------------------------------------------
-- 农户扩展信息
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS farmers (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL UNIQUE       COMMENT '关联 users.id',
  location     VARCHAR(128) DEFAULT NULL          COMMENT '所在地区（如：喀什·疏附县）',
  land_size    DECIMAL(10,2) DEFAULT 0.00         COMMENT '承包面积（亩）',
  crop_type    VARCHAR(64)  DEFAULT '棉花'        COMMENT '主种作物',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='农户扩展信息';

-- -------------------------------------------------------
-- 商户扩展信息
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchants (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED NOT NULL UNIQUE       COMMENT '关联 users.id',
  company_name     VARCHAR(128) DEFAULT NULL          COMMENT '企业/店铺名称',
  business_license VARCHAR(32)  DEFAULT NULL          COMMENT '营业执照号',
  product_category VARCHAR(64)  DEFAULT NULL          COMMENT '经营品类（如：化肥、农药）',
  sub_mchid        VARCHAR(32)  DEFAULT NULL          COMMENT '微信支付子商户号',
  wechat_applyment_id VARCHAR(64) DEFAULT NULL        COMMENT '微信支付进件申请单号',
  wechat_business_code VARCHAR(64) DEFAULT NULL       COMMENT '平台侧微信进件业务申请编号',
  wechat_applyment_state VARCHAR(32) DEFAULT NULL     COMMENT '微信进件状态',
  wechat_applyment_msg VARCHAR(512) DEFAULT NULL      COMMENT '微信进件状态说明/驳回原因',
  wechat_applyment_payload MEDIUMTEXT DEFAULT NULL    COMMENT '微信进件资料草稿 JSON',
  wechat_applyment_updated_at DATETIME DEFAULT NULL   COMMENT '微信进件状态更新时间',
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sub_mchid (sub_mchid),
  INDEX idx_wechat_business_code (wechat_business_code),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='商户扩展信息';

CREATE TABLE IF NOT EXISTS merchant_applyment_files (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant_id INT UNSIGNED NOT NULL,
  field_name  VARCHAR(64) NOT NULL DEFAULT '',
  local_path  VARCHAR(255) NOT NULL DEFAULT '',
  media_id    VARCHAR(128) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_merchant_field (merchant_id, field_name),
  INDEX idx_media_id (media_id)
) ENGINE=InnoDB COMMENT='微信支付商户进件图片素材';

-- -------------------------------------------------------
-- 登录日志（可选，用于安全审计）
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_logs (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  ip         VARCHAR(45)  DEFAULT NULL,
  user_agent VARCHAR(256) DEFAULT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB COMMENT='登录日志';

-- -------------------------------------------------------
-- 专家讲堂内容
-- -------------------------------------------------------
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
) ENGINE=InnoDB COMMENT='专家后台账号';

CREATE TABLE IF NOT EXISTS expert_contents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expert_id INT UNSIGNED DEFAULT NULL,
  type ENUM('video','article','qa') NOT NULL DEFAULT 'video',
  title VARCHAR(160) NOT NULL,
  subtitle VARCHAR(255) DEFAULT '',
  category_key VARCHAR(40) DEFAULT 'planting',
  category_name VARCHAR(64) DEFAULT '',
  teacher VARCHAR(64) DEFAULT '',
  teacher_title VARCHAR(64) DEFAULT '',
  org VARCHAR(128) DEFAULT '',
  expert_avatar VARCHAR(16) DEFAULT '',
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
  INDEX idx_expert_type (type),
  INDEX idx_expert_category (category_key),
  INDEX idx_expert_contents_expert (expert_id),
  INDEX idx_expert_publish_sort (is_published, sort_order, id)
) ENGINE=InnoDB COMMENT='专家讲堂内容';

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
  INDEX idx_expert_questions_user_created (user_id, created_at),
  INDEX idx_expert_questions_status_created (status, created_at)
) ENGINE=InnoDB COMMENT='专家讲堂农户提问';

CREATE TABLE IF NOT EXISTS wechat_refunds (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_type            VARCHAR(20) NOT NULL DEFAULT 'supply',
  order_id              INT UNSIGNED NOT NULL,
  aftersale_id          INT UNSIGNED DEFAULT NULL,
  out_trade_no          VARCHAR(64) NOT NULL DEFAULT '',
  out_refund_no         VARCHAR(64) NOT NULL,
  wechat_refund_id      VARCHAR(64) NOT NULL DEFAULT '',
  transaction_id        VARCHAR(64) NOT NULL DEFAULT '',
  sub_mchid             VARCHAR(32) NOT NULL DEFAULT '',
  amount_fen            INT UNSIGNED NOT NULL DEFAULT 0,
  total_fen             INT UNSIGNED NOT NULL DEFAULT 0,
  currency              VARCHAR(8) NOT NULL DEFAULT 'CNY',
  reason                VARCHAR(255) NOT NULL DEFAULT '',
  status                VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  channel               VARCHAR(32) NOT NULL DEFAULT '',
  user_received_account VARCHAR(128) NOT NULL DEFAULT '',
  success_time          DATETIME DEFAULT NULL,
  request_payload       MEDIUMTEXT,
  result_payload        MEDIUMTEXT,
  notify_payload        MEDIUMTEXT,
  profit_sharing_return_no      VARCHAR(64) NOT NULL DEFAULT '',
  profit_sharing_return_state   VARCHAR(32) NOT NULL DEFAULT '',
  profit_sharing_return_payload MEDIUMTEXT,
  error_code            VARCHAR(64) NOT NULL DEFAULT '',
  error_msg             VARCHAR(512) NOT NULL DEFAULT '',
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_out_refund_no (out_refund_no),
  INDEX idx_order (order_type, order_id),
  INDEX idx_aftersale (aftersale_id),
  INDEX idx_status (status),
  INDEX idx_sub_mchid (sub_mchid)
) ENGINE=InnoDB COMMENT='微信支付退款单';
