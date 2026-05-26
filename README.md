# 棉管家 · WeChat Mini Program

面向新疆棉农和农资商户的智能农业管理平台，微信小程序 Skyline 渲染器 + Node.js 后端。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端渲染器 | Skyline（非 WebView）+ glass-easel |
| 导航栏 | 全局 `navigationStyle: custom` |
| 后端框架 | Node.js + Express |
| 数据库 | MySQL 8.0（mysql2 连接池）|
| 认证 | JWT（jsonwebtoken）+ bcryptjs |
| 开发调试 | 真机：局域网 IP；模拟器：localhost |

---

## 快速启动

### 前提条件
- Node.js 18+
- MySQL 8.0（已安装并运行）
- 微信开发者工具（Skyline 版本）

### 后端启动

```bash
cd F:\cotton\server
npm install
# 复制并编辑环境变量
copy .env.example .env
# 修改 .env 中的 DB_HOST / DB_USER / DB_PASS

# 建表（首次）
node db/migrate_products.js          # 创建 products 表并插入测试商品
node db/migrate_admin.js             # 添加 is_admin 字段 + 创建管理员账号
node db/migrate_merchant_approval.js # 添加 apply_status/reject_reason 字段
node db/migrate_product_image.js     # 添加 image_url 字段
node db/migrate_orders.js            # 创建 orders 和 order_items 表
node db/migrate_product_detail.js    # 添加 detail 字段（商品详细介绍）
node db/seed.js                      # 插入测试用户账号

# 启动服务
node index.js
```

### 前端配置

编辑 `utils/auth.js` 第 7-8 行：

```js
const IS_DEV_REAL_DEVICE = true      // true=真机, false=模拟器
const LOCAL_IP = '192.168.0.25'      // 改成你电脑的局域网 IP（ipconfig 查询）
```

Windows 防火墙放行端口（真机调试必须）：
```
netsh advfirewall firewall add rule name="Cotton 3000" dir=in action=allow protocol=TCP localport=3000
```

---

## 测试账号

| 角色 | 手机号 | 密码 | 备注 |
|------|--------|------|------|
| 农户 | `13800000001` | `test123` | 古丽巴哈尔，喀什疏附县（小程序登录） |
| 商户 | `13800000002` | `test123` | 疏附县农资有限公司（后台管理） |
| 商户 | `13900000001` | `merchant123` | 疏附县鑫农农资有限公司（后台管理） |
| 管理员 | `10000000000` | `Admin@Cotton2026` | 系统管理员（网页后台登录） |

> **小程序仅供农户使用**；商户登录和管理功能已迁移至网页版管理后台。

## 管理后台

启动后端服务后，访问：

```
http://localhost:3000/admin/
```

使用管理员账号登录，功能包含：

| 面板 | 功能 |
|------|------|
| 数据概览 | 用户/农户/商户/待审批/商品统计，最近注册用户 |
| 商户审批 | 待审批申请列表，一键批准或拒绝（含填写原因），侧边栏角标提醒 |
| 农户管理 | 列表查看、新增、编辑（姓名/地区/面积/作物/实名）、启用/禁用账号 |
| 商户管理 | 列表查看、新增（自动批准）、编辑（店铺名/联系人/品类/实名）、查看审批状态、启用/禁用账号 |
| 商品管理 | 全量商品列表、新增（选择所属商户）、编辑（名称/价格/库存/状态等）、删除 |
| 订单管理 | 全量订单列表，按状态筛选，在线修改订单状态 |

**商户入驻申请（公开页面）：**
```
http://localhost:3000/admin/merchant-apply.html
```
商户通过此页面提交入驻申请，管理员在"商户审批"面板审核。

**商户管理后台（统一登录入口）：**
```
http://localhost:3000/admin/login.html
```
管理员和商户共用此登录页，系统根据角色自动跳转不同后台。商户功能包含：店铺统计、商品管理（CRUD + 图片上传）、订单管理（发货/退款/删除）。

---

## 登录路由逻辑

```
小程序（农户专用）：
打开小程序
  └─ 有 Token → verify() → 有效 → /pages/index/index（农户首页）
  └─ 无 Token → /pages/login/index（农户登录/注册）

网页管理后台（管理员 + 商户统一登录）：
http://localhost:3000/admin/login.html
  └─ 管理员账号登录 → /admin/dashboard.html
  └─ 商户账号登录  → /merchant/dashboard.html
  └─ /merchant/login.html 自动重定向至此入口
```

---

## 项目结构

```
cotton/
├── app.js                    # 全局：购物车、auth 恢复、globalData
├── app.json                  # 路由注册、tabBar、Skyline 全局设置
├── app.wxss                  # CSS 变量 + .tbar-placeholder 全局类
├── utils/
│   ├── auth.js               # Token 管理、request 封装、login/register/verify
│   └── data.js               # 本地兜底商品数据（API 不可用时使用）
│
├── components/
│   ├── tab-bar/              # 农户底部导航（3 Tab：首页/AI/我的）
│   └── merchant-tab-bar/     # 商户底部导航（5 Tab：首页/商品/订单/资金/我的）
│
├── custom-tab-bar/           # 框架要求的空壳（display:none），实际导航由上方组件实现
│
├── pages/
│   ├── login/                # 登录注册（身份选择 → 表单）
│   │
│   ├── ── 农户页面 ──────────────────────────────────
│   ├── index/                # 农户首页（11 模块网格 + 天气 + 快拍入口）
│   ├── ai/                   # AI 问答（聊天气泡界面）
│   ├── my/                   # 我的（用户卡片、实名、退出，含进行中订单徽章）
│   ├── fields/               # 地块管理（列表 + 绘制 draw）
│   ├── pest/                 # 病虫害识别（拍照 + 识别结果 detail）
│   ├── weather/              # 地块气象
│   ├── remote/               # 遥感监测（NDVI/旱情）
│   ├── trade/                # 棉花交易行情
│   ├── records/              # 农事记录（时间轴/日历）
│   ├── machine/              # 农机租赁（列表 + 详情）
│   ├── loans/                # 农业贷款
│   ├── insurance/            # 农业保险
│   ├── expert/               # 专家讲堂（课程 + 详情）
│   ├── supplies/             # 农资商城（对接商户商品 API，显示商家名）
│   ├── supplies-detail/      # 商品详情
│   ├── supplies-cart/        # 购物车
│   ├── supplies-checkout/    # 结算（提交后写入 MySQL 订单）
│   ├── supplies-pay-success/ # 支付成功页（订单号展示 + 查看订单入口）
│   ├── supplies-order/       # 订单详情（4 步进度条 + 操作栏）
│   ├── my-orders/            # 我的订单列表（Tab：全部/待发货/配送中/已完成）
│   ├── supplies-store/       # 店铺页（单个商户全部商品）
│   └── favorites/            # 我的收藏（卡片网格，取消收藏，加购）
│   │
│   └── ── 商户页面 ──────────────────────────────────
│       └── merchant/
│           ├── index         # 数据看板（订单/收款/商品/营收统计）
│           ├── products      # 商品管理（上架/编辑/下架/删除，对接 API）
│           ├── orders        # 订单管理（全部/待发货/已完成/退款）
│           ├── finance       # 资金结算（收支明细/提现）
│           └── profile       # 个人中心（店铺信息/改密/退出）
│
└── server/
    ├── index.js              # Express 入口，PORT 3000
    ├── .env                  # 数据库密码等（不提交 git）
    ├── .env.example          # 配置模板
    ├── API.md                # 接口文档
    ├── routes/
    │   ├── auth.js           # /api/auth/*（注册/登录/验证/登出）
    │   ├── products.js       # /api/products/*（商品 CRUD）
    │   ├── orders.js         # /api/orders/*（农户下单、查看个人订单）
    │   ├── merchant.js       # /api/merchant/*（商户登录、商品、订单、统计）
    │   └── admin.js          # /api/admin/*（管理后台 API，需 is_admin）
    ├── middleware/
    │   └── auth.js           # JWT 鉴权中间件 + roleGuard()
    ├── public/
    │   ├── admin/            # 网页管理后台静态文件
    │   │   ├── index.html           # 重定向到 login.html
    │   │   ├── login.html           # 管理员登录页（含商户入口链接）
    │   │   ├── dashboard.html       # SPA 仪表盘（概览/审批/农户/商户/商品/订单）
    │   │   └── merchant-apply.html  # 商户入驻申请（公开页面）
    │   └── merchant/         # 网页商户后台静态文件
    │       ├── login.html           # 商户登录页
    │       └── dashboard.html       # 商户 SPA（统计/商品/订单管理）
    └── db/
        ├── database.js       # mysql2 连接池
        ├── schema.sql        # 建表：users / farmers / merchants / login_logs
        ├── migrate_products.js # 建 products 表 + 种子数据（运行一次）
        ├── migrate_admin.js            # 添加 is_admin 字段 + 创建管理员账号
        ├── migrate_merchant_approval.js # 添加 apply_status/reject_reason 字段
        ├── migrate_orders.js           # 建 orders + order_items 表（运行一次）
        ├── migrate_product_detail.js   # 添加 detail 字段（幂等，可重复运行）
        └── seed.js                     # 测试用户账号（可重复运行，幂等）
```

---

## 后端 API 概览

Base URL（开发）：`http://192.168.0.25:3000`

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 公开 | 注册（农户/商户） |
| POST | `/api/auth/login` | 公开 | 手机号+密码登录 |
| GET  | `/api/auth/verify` | Token | 验证 Token，返回用户信息 |
| POST | `/api/auth/logout` | Token | 登出（前端清 Token） |
| GET  | `/api/products` | 公开 | 获取所有在售商品（含商家名） |
| GET  | `/api/products/mine` | 商户 | 获取本店商品列表 |
| POST | `/api/products` | 商户 | 上架新商品 |
| PUT  | `/api/products/:id` | 商户 | 编辑商品信息 |
| PATCH| `/api/products/:id/status` | 商户 | 切换上架/下架 |
| DELETE | `/api/products/:id` | 商户 | 删除商品 |
| POST | `/api/admin/login` | 公开 | 管理员登录 |
| GET  | `/api/admin/stats` | 管理员 | 统计数据概览 |
| GET  | `/api/admin/farmers` | 管理员 | 农户列表 |
| GET  | `/api/admin/merchants` | 管理员 | 商户列表（含商品数） |
| GET  | `/api/admin/products` | 管理员 | 全量商品列表 |
| PATCH | `/api/admin/users/:id/status` | 管理员 | 启用/禁用账号 |
| PUT  | `/api/admin/farmers/:id` | 管理员 | 编辑农户信息 |
| PUT  | `/api/admin/merchants/:id` | 管理员 | 编辑商户信息 |
| PUT  | `/api/admin/products/:id` | 管理员 | 编辑商品信息 |
| GET  | `/api/admin/applications` | 管理员 | 待审批商户列表 |
| POST | `/api/admin/applications/:id/approve` | 管理员 | 批准入驻 |
| POST | `/api/admin/applications/:id/reject` | 管理员 | 拒绝入驻 |
| POST | `/api/admin/apply` | 公开 | 商户提交入驻申请 |
| GET  | `/api/admin/orders` | 管理员 | 全量订单列表（可按状态筛选） |
| PATCH | `/api/admin/orders/:id/status` | 管理员 | 修改订单状态 |
| POST | `/api/merchant/login` | 公开 | 商户登录 |
| GET  | `/api/merchant/stats` | 商户 | 店铺统计（今日订单/本月销售额等）|
| GET  | `/api/merchant/orders` | 商户 | 本店订单列表 |
| PATCH | `/api/merchant/orders/:id/ship` | 商户 | 发货（填写物流单号） |
| PATCH | `/api/merchant/orders/:id/refund` | 商户 | 退款/售后处理 |
| DELETE | `/api/merchant/orders/:id` | 商户 | 删除订单 |
| POST | `/api/orders` | 农户 | 下单（写入 MySQL，返回订单号） |
| GET  | `/api/orders/my` | 农户 | 查看个人订单列表 |

---

## 数据库表结构

```
users          → id, phone, password(bcrypt), role, real_name, is_verified, is_active, is_admin
farmers        → user_id(FK), location, land_size, crop_type
merchants      → user_id(FK), company_name, business_license, product_category, apply_status, reject_reason
products       → id, merchant_id(FK), name, category, price, unit, stock, status, icon, image_url, description, detail
orders         → id, order_no(UNIQUE), user_id(FK), farmer_name, farmer_phone,
                  receiver_name, receiver_phone, address, subtotal, delivery_fee,
                  total, pay_method, status, logistics_no, note, created_at, updated_at
order_items    → id, order_id(FK CASCADE), merchant_id, product_id, name, icon, spec, price, qty, subtotal
login_logs     → user_id, ip, created_at
```

订单状态流转：`pending_ship`（待发货）→ `shipped`（已发货）→ `completed`（已完成）/ `refund`（售后中）

---

## Tab Bar 实现说明

> **重要**：Skyline 下 `position:fixed` 在自定义组件内触摸响应区域与视觉位置会错位，导致点击无效。

**当前方案（正确）**：
- `custom-tab-bar/` 保留空壳（框架要求），CSS 设 `display:none`
- 在 `components/tab-bar/` 和 `components/merchant-tab-bar/` 中实现真实导航 UI
- 每个 Tab 页在 WXML 的 flex 列底部直接内嵌组件（无需 `position:fixed`）：

```wxml
<view class="page">            <!-- display:flex; flex-direction:column; height:100vh -->
  <scroll-view style="flex:1;height:0;" scroll-y>
    <!-- 页面内容 -->
  </scroll-view>
  <tab-bar selected="{{0}}"></tab-bar>   <!-- 自然排列在底部，无 fixed -->
</view>
```

**商户页面**用 `wx.reLaunch` 切换（非 Tab 页），农户 Tab 页用 `wx.switchTab`。

---

## 顶部 Header 规范

微信胶囊按钮（右上角 `...`）占据约 `right: 0, width: 174rpx, height: 64rpx`，从 `statusBarHeight` 开始。

**所有页面 header 必须在第一行右侧留空**：

```wxml
<view class="header" style="padding-top: {{statusBarHeight}}px">
  <text class="header-tag" style="padding-right:200rpx">页面标签</text>
  <!-- 标题/内容放第二行，不受胶囊影响 -->
  <text class="header-title">页面标题</text>
</view>
```

---

## Skyline 开发约束

1. **禁止 CSS Grid** → 用 `display:flex; flex-wrap:wrap`
2. **禁止 HTML 标签** → 只用 `view / text / image / scroll-view`
3. **禁止 `calc()` 混合单位** → 两列网格用 `width:337rpx`
4. 根页面：`.page { display:flex; flex-direction:column; height:100vh; overflow:hidden }`
5. 滚动区：`<scroll-view style="flex:1;height:0;" scroll-y>`
6. 每个**页面** JSON：`"navigationStyle":"custom","renderer":"skyline","componentFramework":"glass-easel"`
7. 每个**组件** JSON：`"component":true,"renderer":"skyline","componentFramework":"glass-easel"`

---

## 颜色规范

| 用途 | 色值 |
|------|------|
| 品牌金 | `#C8902E` |
| 品牌金渐变 | `linear-gradient(135deg, #C8902E, #D4A043)` |
| 背景 | `#F5EEE6`（农户）/ `#F5F6FA`（商户）|
| 主文字 | `#1A1A1A` |
| 次文字 | `#555555` |
| 辅助文字 | `#888888` |
| 成功绿 | `#16A34A` |
| 警告橙 | `#D97706` |
| 危险红 | `#DC2626` |

---

## 全局数据流

```js
app.globalData = {
  user:            null,   // 当前登录用户（login 后写入，含 role/real_name/company_name 等）
  cart:            [],     // 购物车（本地 Storage 持久化）
  cartCount:       0,      // 购物车数量
  favorites:       [],     // 收藏列表（wx.setStorageSync('favorites') 持久化）
  products:        [],     // 已加载商品缓存（供店铺页筛选复用）
  selectedProduct: null,   // 农资详情页传参
  currentOrder:    null,   // 当前订单（结算 → 支付成功 → 订单详情页传参）
  statusBarHeight: 20      // 状态栏高度（px）
}
```

---

## 参考资源

- 网页版 demo：`F:\cotton demo\demo.html`（6797 行，47 个页面的完整设计参考）
- 后端接口文档：`server/API.md`
- 变更日志：`CHANGELOG.md`
