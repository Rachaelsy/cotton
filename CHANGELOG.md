# 变更日志

## [1.5.0] — 2026-05-27

### 新增

#### 售后系统（全链路）
- **售后申请页**（`pages/supplies-aftersale/`）：农户完成收货后可发起售后，包含：
  - 必选：售后类型单选（退货退款 / 仅退款 / 换货）
  - 必选：售后原因宫格选择（7 种），选「其他」时展开文本框
  - 可选：问题描述（200 字文本域）
  - 可选：上传凭证图片（最多 6 张，先上传到服务器再提交 URL）
  - 提交按钮置灰直到必填项填完
- **图片上传接口**（`server/routes/upload.js`）：`POST /api/upload`，使用 multer 存至 `server/public/uploads/`，返回可直接访问的 URL；`/uploads/` 已作为静态资源路径挂载
- **数据库**：新增 `aftersale_requests` 表（`server/db/migrate_aftersale.js`）及 `images TEXT` 字段（`server/db/migrate_aftersale_images.js`）
- **农户 API**：`POST /api/orders/:id/aftersale` 提交售后申请（含查重、存图片 URL）
- **商户 API**：`GET /api/merchant/aftersale` 获取本店售后列表，`PATCH /api/merchant/aftersale/:id/handle` 审批（同意/拒绝+备注）
- **商户后台 — 售后管理面板**：侧边栏新增「售后管理」入口（含待处理角标），列表支持状态分 Tab（全部/待处理/已同意/已拒绝），每行点「查看详情」弹出详情弹窗，显示买家信息、申请原因、问题描述、凭证图片（可点击查看原图），待处理时弹窗内可直接同意/拒绝

#### 商家客服微信功能
- **商户后台 — 店铺设置**：新增「客服微信号」输入框，商户可填写并保存自己的微信号
- **数据库**：`merchants` 表新增 `wechat_id VARCHAR(64)` 字段（`server/db/migrate_merchant_wechat.js`）
- **商品详情页**：底部新增「联系商家」按钮，点击弹出客服微信号并提供一键复制；未设置微信号时显示提示语

#### 确认收货
- **农户 API**：`PATCH /api/orders/:id/confirm` 确认收货，状态更新为 `completed`
- **订单详情页**：「已发货」状态下显示「确认收货」按钮，确认后弹出「收货成功，交易已完成」弹窗，页面实时刷新状态

### 改进

- **订单详情页**：收货后隐藏所有操作按钮，改为展示「去评价」「联系商家」「申请售后」三入口
- **订单状态**：`_loadOrder()` 改为每次从 `GET /api/orders/my` 实时拉取，解决商家发货后小程序仍显示「待发货」的缓存问题
- **商户后台 — 订单管理**：移除「售后/退款」标签页（售后流程已迁移至独立的售后管理面板）

### Bug 修复

- 修复确认收货后显示「接口不存在」的问题（根因：服务器未重启导致新路由未加载）

---

## [1.4.0] — 2026-05-26

### 新增

- **我的收藏页**（`pages/favorites/`）：卡片网格展示收藏商品，红心按钮取消收藏，`+` 加入购物车，空状态引导浏览
- **收藏持久化**（`app.js`）：`globalData.favorites`，`addToFavorites / removeFromFavorites / isFavorited`，写入 `wx.setStorageSync('favorites')`
- **商品详细介绍字段**：`products` 表新增 `detail TEXT` 列（`server/db/migrate_product_detail.js`）；管理员后台和商户后台商品弹窗均新增「详细介绍」文本框
- **店铺页**（`pages/supplies-store/`）：展示单个商户全部商品，优先从 `app.globalData.products` 按店铺名筛选，保证与商品列表显示一致

### 改进

#### 小程序
- **购物车**：商品图片栏优先显示 `image_url` 实物图，无图时降级为 Emoji 图标
- **农资详情页**：图片区移入 `scroll-view` 内，图片随页面一同滚动；底部操作栏改为 `flex-shrink:0`，不再使用 `position:fixed`
- **农资详情页**：「简介」（`product.description`）显示在图片下方，「详细介绍」（`product.detail`）显示在商品介绍栏；删除「店内推荐」区块
- **确认订单页**：收货信息默认展示已保存内容，点「编辑」才展开输入框，点「确定」验证并持久化到 `wx.setStorageSync('shipping_address')`；首次无记录时直接进入编辑模式
- **确认订单页**：支付方式仅保留微信支付，去除支付宝和银行卡选项
- **我的页面**：「我的收藏」点击跳转收藏页，数量角标显示真实收藏数
- **农资供应页**：去除「限时秒杀」模块及倒计时逻辑
- **商品详情 — 收藏按钮**：点击后真正写入/删除 `app.globalData.favorites`，状态跨页面持久化

#### 后端
- **管理员后台 & 商户后台**：商品 POST / PUT 接口同步支持 `detail` 字段的读取与写入
- **统一登录入口**：`/admin/login.html` 同时支持管理员和商户登录，根据角色跳转不同后台；`/merchant/login.html` 重定向至统一入口

### Bug 修复

- 修复「进入店铺」显示错误商户商品的问题（根因：`merchant_id` 内嵌 URL 字符串时 wx.request 参数处理差异）；改为从全局已加载商品按店铺名筛选，确保与列表一致

---

## [1.3.0] — 2026-05-26

### 新增

#### 订单系统（全链路）
- **数据库**：新增 `orders` 表和 `order_items` 表（`server/db/migrate_orders.js`）
- **农户 API**：`POST /api/orders` 下单，`GET /api/orders/my` 查看个人订单
- **商户 API**：`GET /api/merchant/orders` 查看订单，`PATCH .../ship` 发货，`PATCH .../refund` 退款，`DELETE .../orders/:id` 删除订单
- **管理员 API**：`GET /api/admin/orders` 查看全量订单，`PATCH .../status` 修改状态
- **小程序**：新增 `pages/my-orders/` 我的订单列表页（分 Tab：全部/待发货/配送中/已完成）
- **小程序**：`my/index.js` 新增进行中订单数量徽章（实时从 API 拉取）
- **小程序**：`supplies-checkout/index.js` 结算时同步将订单写入 MySQL

#### 支付成功页（`pages/supplies-pay-success/`）
- 绿色渐变 Hero + 白色卡片：展示商品缩略图、订单号（可复制）、实付金额、支付方式
- 按钮：「查看订单」→ 订单详情页，「返回首页」→ 首页

#### 订单详情页（`pages/supplies-order/`，全量重写）
- 橙棕渐变顶部，含状态图标、文字说明
- 4 步进度条：已下单 → 待发货 → 已发货 → 已完成（完成步骤绿色打勾，当前步骤橙色）
- 收货信息、订单商品、订单信息（含复制订单号）三张卡片
- 底部操作栏：联系卖家、退款/售后、查看物流（未发货时灰显）

### 改进

- **商户登录页**：「手机号」改为「账号」，移除数字输入格式限制
- **农资供应页**：购物车按钮移至搜索栏右侧，避免与微信系统胶囊按钮重叠
- **商户后台 — 订单管理**：Mock 数据替换为真实 API，支持发货/退款/删除操作
- **商户后台 — 店铺统计**：今日订单数、本月销售额等改为从数据库实时计算
- **管理员后台**：新增「订单管理」面板，支持状态筛选和状态变更
- **管理员后台**：新增「商户入口」链接按钮，跳转至商户登录页
- **商户入驻申请页**：「返回登录」链接指向商户登录页（原为管理员登录页）
- **静态 HTML**：服务端为 `/admin` 和 `/merchant` 目录添加 `Cache-Control: no-store`，确保浏览器始终获取最新版本
- **订单管理 JS**：订单状态映射改用 `function getOrderStatus()` 声明，消除全局变量 TDZ 问题

### Bug 修复

- 修复商户后台「加载中...」冻结问题（根因：`const`/`let` 声明位于 init IIFE 之后导致 TDZ，将关键全局变量改为 `var` 并移至 IIFE 前）
- 修复订单 `merchant_id` 写入错误（checkout 传递 `merchant_id` 数字字段而非 `store` 店名字符串）

---

## [1.2.0] — 2026-05-25

### 新增

- **商户后台**：商品管理 CRUD（上架/编辑/下架/删除），支持图片上传
- **商户后台**：商户独立登录（`/merchant/login.html`）+ 仪表盘
- **管理员后台**：新增商品管理面板（全量列表、新增、编辑、删除）
- **管理员后台**：商户审批面板（批准/拒绝，含原因填写）

### 改进

- 商户登录页「手机号」输入框移除 `+86` 前缀和数字键盘限制

---

## [1.1.0] — 2026-05-24

### 新增

- **农资商城全链路**：商品列表、商品详情、购物车、结算页
- **商户管理后台**：网页版 SPA（数据概览/商品管理/订单管理/财务/评价/消息/设置）
- **管理员后台**：农户管理（列表、新增、编辑、启用/禁用）、商户管理
- 微信一键登录（`getPhoneNumber`）+ 手机号手动登录双通道
- JWT 认证体系：农户 Token 存 wx.storage，商户/管理员 Token 存 localStorage

### 改进

- Tab Bar 方案：废弃 `position:fixed`，改用 flex 列底部内嵌组件，解决 Skyline 触摸区域错位问题
- 顶部 Header 留出微信胶囊按钮空间（`padding-right: 200rpx`）

---

## [1.0.0] — 2026-05-23

### 首次提交

- 项目初始化（Skyline 渲染器 + glass-easel）
- 基础页面：首页、AI 问答、我的、地块管理、病虫害、天气、农机租赁、贷款、保险、专家讲堂
- Node.js + Express + MySQL 后端框架
- JWT 认证（注册/登录/验证/登出）
- 数据库：users / farmers / merchants / products / login_logs
