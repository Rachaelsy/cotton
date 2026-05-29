# 变更日志

## [2.0.0] — 2026-05-29

### 新增

- **AI 问答接入真实大模型**（`server/routes/ai.js`）：
  - `POST /api/ai/chat`：后端代理，将用户消息和历史上下文转发给 AI 服务，返回回复；保留最近 10 条历史以维持对话连贯性
  - API 优先级：`GROQ_API_KEY`（完全免费，Llama 3.3 70B，推荐）→ `SILICONFLOW_API_KEY`（DeepSeek-V3）→ `DEEPSEEK_API_KEY`（DeepSeek 直连）
  - System Prompt 专为新疆棉花种植场景定制，覆盖病虫害防治、农事管理、市场行情等领域
  - API Key 存在服务器 `.env`，客户端不接触

- **拍照识别功能**：
  - 首页「去拍照 ›」Banner 调起相机（`wx.chooseMedia`），自动压缩（质量 50%）后存入 `app.globalData.pendingPhoto`，跳转至 AI 问答页
  - AI 问答页 `onShow()` 检测待分析图片，图片以气泡形式显示在聊天界面
  - `POST /api/ai/photo`：接收 multipart 图片，读取后转 base64，调用 Siliconflow Qwen2-VL-7B 视觉模型分析，分析完立即删除临时文件
  - 若仅有 Groq Key（不支持视觉），自动降级为文字引导提示，要求用户描述症状

### 改进

- **AI 问答页**：历史消息结构同步给后端，AI 能理解上下文连续对话；「清空对话」移入「···」菜单
- **错误处理**：兼容 OpenAI 格式 `{"error":{...}}` 和 Siliconflow 格式 `{"code":xxx,"message":"..."}` 两种错误响应；余额不足返回友好提示而非技术报错

### Bug 修复

- 修复地图绘制页三处交互失效（详见 v1.9.1）：`bindcallouttap` 事件未绑定导致"点我闭合"无响应；`position:fixed` 表单在 Skyline 下阻断触摸事件（改为页面级状态切换）；`catchtap=""` 拦截事件无处理函数

---

## [1.9.1] — 2026-05-29

### Bug 修复

- 修复地图绘制页「点我闭合」callout 点击无响应：新增 `bindcallouttap="onCalloutTap"`；`e.markerId` 改为 `e.detail?.markerId ?? e.markerId` 兼容两种 API
- 修复「完成绘制」后表单无法输入：原 `position:fixed` 弹层在 Skyline 渲染器下阻断子元素触摸事件；改为绘制模式/表单模式页面级互换（`wx:if="{{!showForm}}"` / `wx:if="{{showForm}}"`），彻底消除 fixed 定位
- 修复点击遮罩无法返回绘制：移除 `catchtap=""` 遮罩，导航栏「‹」在表单模式下执行 `setData({ showForm: false })` 返回

---

## [1.9.0] — 2026-05-28

### 新增

- **地块管理（全链路）**（`pages/fields/`）：
  - **地块列表页**（`index`）：显示所有地块，按状态分组（需要关注 / 正常种植），展示面积、品种、灌溉方式、健康评分，从 `GET /api/plots` 实时加载
  - **地图绘制页**（`draw`）：使用 WeChat 原生 `<map>` 组件，**默认卫星遥感图**（`enable-satellite`），在地图上打点采集真实经纬度，点击第一个顶点（`bindmarkertap`）闭合多边形；球面积公式计算实际亩数，Haversine 公式计算周长；完成绘制后底部弹出表单（地块名称、品种、播种日期、灌溉方式、土壤类型）；工具栏：定位、卫星/地图切换、撤销、清空
  - **地块详情页**（`detail`）：地图展示已绘制多边形（卫星图，右下角切换按钮）、健康评分状态卡、基础信息卡、编辑弹窗（PUT）、删除二次确认（DELETE）
  - **后端 API**（`server/routes/plots.js`）：完整 CRUD — `GET /api/plots`、`POST /api/plots`、`GET /api/plots/:id`、`PUT /api/plots/:id`、`DELETE /api/plots/:id`
  - **数据库**：`migrate_plots.js` — 新建 `plots` 表（id、user_id、name、variety、area、perimeter、coordinates JSON、sow_date、irrigation、soil_type、health_score、health_issue、status）
  - **首页**：点击「地块管理」模块正式跳转至地块列表（原为 toast 提示）

- **买家评价系统**：
  - **评价提交页**（`subpkg-supplies/supplies-review/`）：五星评分选择器 + 文字输入（选填）；提交成功显示完成态；每个订单只能评价一次
  - **订单详情页**：「去评价」按钮已完成订单时亮起；已评价后显示「已评价」灰色状态（从 `GET /api/orders/my` 的 `has_reviewed` 字段读取）
  - **商品详情页**：底部展示真实买家评价（最近 5 条）：平均评分、脱敏姓名（`古**尔`）、星级、内容、商家回复；暂无评价时显示引导文字
  - **商户后台**：「评价管理」Tab 从 `GET /api/merchant/reviews` 拉取真实数据；展示订单商品名称、评分、内容；「回复」按钮调用 `PATCH /api/merchant/reviews/:id/reply` 实时更新
  - **后端 API**：`POST /api/orders/:id/review`（需已完成订单、不可重复）；`GET /api/products/reviews?merchant_id=X`（公开）；`GET /api/merchant/reviews`；`PATCH /api/merchant/reviews/:id/reply`
  - **数据库**：`migrate_reviews.js` — 新建 `reviews` 表，`order_id` 唯一约束

### 改进

- **注册页**：移除「主种作物」输入框，简化注册流程
- **个人资料页**：移除「主种作物」选择器
- **管理员后台**：农户列表移除「作物」列及弹窗中的主种作物输入项，所有后端接口同步删除 `crop_type` 参数

### Bug 修复

- 修复商户财务结算「综合评分」、列头「佣金(3%)」文字写死不随实际佣金率更新（前端动态从 API 响应读取 `commission_rate`，后端 finance 接口新增 `commission_rate` 字段）

---

## [1.7.0] — 2026-05-28

### 新增

- **个人资料编辑页**（`pages/profile/`）：点击"我的"页面姓名右侧箭头进入，可编辑所在地区、承包面积、主种作物（选择器），保存后同步写库并更新本地缓存
- **后端 API**：`PUT /api/auth/profile` 更新农户个人信息（location、land_size、crop_type）
- **待付款页**（`subpkg-supplies/supplies-pay/`）：独立结算等待页面；从 `app.globalData.currentOrders` 读取订单，展示倒计时（从真实 `pay_expires_at` 计算），含「取消订单」和「去支付」操作
- **管理员后台 — 商户佣金费率管理**：商户列表新增"佣金率"列（黄色角标），点击可弹窗为每个商户单独设置平台佣金比例（0%~100%，精确到小数点后两位）
- **数据库迁移**：
  - `migrate_commission.js`：`merchants` 表新增 `commission_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00`
  - `migrate_pay_expires.js`：`orders` 表新增 `pay_expires_at TIMESTAMP NULL`

### 改进

- **订单流程重设计**（`server/routes/orders.js`）：
  - 提交订单 → 立即锁库存（`UPDATE products SET stock=stock-? WHERE stock>=?`）→ 状态 `pending_payment` + 30 分钟支付截止时间
  - 付款（`PATCH /api/orders/:id/pay`）→ `pending_ship`，同时异步通知商户
  - 超时或主动取消（`PATCH /api/orders/:id/cancel`）→ `cancelled` 并释放库存
- **定时任务**（`server/scheduler.js`）：新增 `autoExpireOrders()`，每 5 分钟扫描 `pay_expires_at <= NOW()` 的待付款订单，批量关单并还库存
- **商户订单列表**：屏蔽 `pending_payment` 和 `cancelled` 状态，商户仅看到已付款后的订单
- **我的订单页**（`subpkg-supplies/my-orders/`）：
  - 新增"待付款"Tab，卡片底部展示倒计时操作行（取消 / 去支付）
  - 完善状态映射，新增 `pending_payment`（待付款）、`cancelled`（已取消）
- **农资供应页**（`subpkg-supplies/supplies/index.js`）：本地兜底数据立即渲染，API 响应后更新；分类筛选状态在 API 返回时保持正确

### Bug 修复

- 修复财务结算佣金始终显示 3%（根因：可提现余额 / 冻结余额 SQL 及结算明细 JS 均硬编码 `0.03`/`0.97`，未读取 `merchants.commission_rate`）；三处计算现均动态使用数据库存储的实际佣金率，前端标题和列头也同步显示真实百分比
- 修复 AI 问答页文字被右侧截断、快捷提问横排变竖列问题（Skyline 约束：`scroll-view` 不可直接设 `display:flex`；改用内层 wrapper view 承担 flex 布局）
- 修复农资供应商品不显示（根因：`utils/auth.js` 局域网 IP 地址变更后未同步更新）

---

## [1.6.0] — 2026-05-27

### 新增

- **多商家拆单**：购物车含多个商家商品时，结算自动按 `merchant_id` 拆分，分别调用 `POST /api/orders` 为每家商户创建独立订单；`app.globalData.currentOrders` 存储所有订单数组
- **支付成功页重设计**：改为逐商家卡片展示（店铺名、商品缩略、小计、可复制订单号），底部汇总合计金额与下单时间；"查看全部订单"跳转至 `my-orders`
- **农资功能分包**（`subpkg-supplies/`）：将 9 个农资相关页面从主包迁出，建立独立分包，主包体积从 ~1.21 MB 降至 ~230 KB

  | 迁移页面 | 原路径 |
  |---|---|
  | 农资商城 | `pages/supplies/` |
  | 商品详情 | `pages/supplies-detail/` |
  | 店铺页 | `pages/supplies-store/` |
  | 购物车 | `pages/supplies-cart/` |
  | 确认订单 | `pages/supplies-checkout/` |
  | 支付成功 | `pages/supplies-pay-success/` |
  | 订单详情 | `pages/supplies-order/` |
  | 售后申请 | `pages/supplies-aftersale/` |
  | 我的订单 | `pages/my-orders/` |

- **`.wxignore`**：新增忽略文件，排除 `server/`（983 KB）和 `*.md` 不进入小程序包
- **`project.config.json`**：同步设置 `packOptions.ignore`，双重保障排除后端目录

### 改进

- **确认订单页**：商品列表图片区域优先展示真实 `image_url`，无图时退回 emoji 图标，与购物车展示一致
- **首页功能模块**：仅"农资供应"可跳转，其余功能点击统一提示"正在开发中，敬请期待"
- **商家后台 — 订单管理**：移除"删除订单"按钮及 `deleteOrder` 函数，订单记录不可在商户侧删除

---

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
