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
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='商户扩展信息';

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
