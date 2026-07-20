# 棉花智能体 · WeChat Mini Program

面向新疆棉农、农资商户和农业服务人员的智能农业管理平台，采用农户微信小程序 + 多角色网页后台 + Node.js 后端架构。

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

当前产品边界：微信小程序仅供农户使用；商户、农机手、专家和管理员统一从网页端进入各自后台。农户登录后直接进入首页，实名认证为可选服务，不影响普通功能。首页暂未开放的棉花交易、农业贷款和农业保险入口继续保留，点击时统一提示“尚在开发中”。

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
# 修改 .env 中的 DB_HOST / DB_USER / DB_PASS / JWT_SECRET / WX_APPID / WX_SECRET / QWEATHER_*

# 建表（首次）
node db/migrate_products.js           # 创建 products 表并插入测试商品
node db/migrate_admin.js              # 添加 is_admin 字段 + 创建管理员账号
node db/migrate_merchant_approval.js  # 添加 apply_status/reject_reason 字段
node db/migrate_product_image.js      # 添加 image_url 字段
node db/migrate_orders.js             # 创建 orders 和 order_items 表
node db/migrate_logistics.js          # 订单物流公司、真实轨迹和订阅状态
node db/migrate_product_detail.js     # 添加 detail 字段（商品详细介绍）
node db/migrate_merchant_wechat.js    # 添加 wechat_id 字段（商家客服微信号）
node db/migrate_aftersale.js          # 创建 aftersale_requests 表
node db/migrate_aftersale_images.js   # 添加 images 字段（售后凭证图片）
node db/migrate_fund_status.js        # 添加资金状态字段 + 创建 withdrawals 表
node db/migrate_messages.js           # 创建 messages + announcements 表
node db/migrate_commission.js         # 添加 merchants.commission_rate 字段
node db/migrate_pay_expires.js        # 添加 orders.pay_expires_at 字段
node db/migrate_reviews.js            # 创建 reviews 表（买家评价）
node db/migrate_review_anonymous.js   # reviews 表添加 is_anonymous 字段
node db/migrate_plots.js              # 创建 plots 表（农户地块）
node db/migrate_farm_records.js       # 创建 farm_records 表（农事记录）
node db/migrate_machines.js           # 农机租赁建表（operators/machines/machine_orders/machine_reviews）+ operator 角色
node db/migrate_order_delete.js       # 订单按角色软删除字段（farmer/merchant/operator_deleted）
node db/migrate_delivery_range.js     # 可配送范围（machines.service_radius、merchants 定位+delivery_radius）
node db/migrate_wechat_service_provider.js # 微信支付服务商字段（sub_mchid、进件状态、素材表）
node db/migrate_profit_sharing.js     # 微信支付分账记录表
node db/migrate_wechat_refunds.js     # 微信支付真实退款记录表
node db/migrate_commission_requests.js # 农机支付字段 + 商户/农机手佣金调整审核表
node db/migrate_experts.js            # 专家账号表
node db/migrate_expert_questions.js   # 专家提问表
node db/migrate_farmer_improvements.js # 农机分阶段支付/定位、气象观测与农户功能增强
node db/migrate_feedbacks.js          # 意见反馈、在线客服消息、引用/撤回/单方删除状态
node db/seed.js                       # 插入测试用户账号
node db/seed_machines.js              # 农机演示数据（机主 13800000003 + 4 台机具）

# 启动服务
node index.js
```

### 回归测试

```bash
cd server
npm test
npm audit --omit=dev
```

测试覆盖农户权限边界、可选实名认证、天气缓存与重试、AI 和上传安全、支付超时保护、意见反馈、在线客服实时消息及主要支付/订单流程。

### Docker 部署更新

云服务器使用 Docker Compose 部署时，拉取新代码后的完整更新命令见：[docs/docker-update-commands.md](docs/docker-update-commands.md)。

### 环境变量说明

仓库只提交 `server/.env.example` 作为模板，不提交真实 `server/.env`。其他人拉取项目后，需要自己在 `server/` 目录创建 `.env`：

```bash
# Windows PowerShell / CMD
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

然后在 `server/.env` 中填写自己的本地或服务器配置：

```bash
DB_HOST=localhost
DB_PORT=3306
DB_NAME=cotton_db
DB_USER=root
DB_PASS=自己的数据库密码

JWT_SECRET=生产环境请换成随机长字符串
JWT_EXPIRES=7d

WX_APPID=自己的微信小程序 AppID
WX_SECRET=自己的微信小程序 AppSecret

# 地块气象：和风天气 QWeather
WEATHER_PROVIDER=qweather
QWEATHER_API_HOST=你的和风 API Host
QWEATHER_JWT_KID=和风 JWT 凭据ID
QWEATHER_JWT_SUB=和风项目ID
QWEATHER_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
QWEATHER_TIMEOUT_MS=8000
WEATHER_OBSERVATION_COLLECTOR_ENABLED=true
WEATHER_OBSERVATION_MAX_PLOTS=100

# 农户实名认证（至少 32 位随机字符串，生产环境启用后不得更换）
IDENTITY_DATA_KEY=请使用密码管理器生成的随机密钥
```

`WX_APPID` 和 `WX_SECRET` 用于后端调用微信登录接口，将 `wx.login()` 得到的临时 `code` 换成用户 `openid`。没有这两个配置，微信登录和后续 JSAPI 支付都不能完整工作。

地块气象默认使用和风天气 QWeather 格点天气接口。和风控制台里的 `API Host` 必须填到 `QWEATHER_API_HOST`；生产环境使用 `QWEATHER_JWT_*`，不要同时配置 `QWEATHER_API_KEY`。注意：`ed25519-public.pem` 是上传到和风控制台的公钥，服务器签名要用 `ed25519-private.pem`，不要把私钥提交到 GitHub。

### 和风天气 QWeather JWT 配置

后端天气接口 `/api/weather/plot/:id` 会根据地块边界计算中心点经纬度，然后请求和风格点天气接口：

- `/v7/grid-weather/now`：格点实时天气
- `/v7/grid-weather/24h`：格点逐小时预报
- `/v7/grid-weather/7d`：格点 7 日预报
- `/weatheralert/v1/current/{纬度}/{经度}`：当前位置官方灾害预警

配置步骤：

1. 登录和风天气控制台，进入当前项目。
2. 在控制台「设置」中复制自己的 `API Host`，填到 `QWEATHER_API_HOST`。不要使用旧公共域名。
3. 在项目凭据里新增 `JSON Web Token` 凭据。
4. 生成 Ed25519 密钥对：

```bash
openssl genpkey -algorithm ED25519 -out ed25519-private.pem
openssl pkey -pubout -in ed25519-private.pem > ed25519-public.pem
```

5. 将 `ed25519-public.pem` 的完整内容上传到和风控制台。保存后，控制台会显示凭据 ID。
6. 将凭据 ID 填到 `QWEATHER_JWT_KID`，将项目 ID 填到 `QWEATHER_JWT_SUB`。
7. 将 `ed25519-private.pem` 的内容写入 `QWEATHER_JWT_PRIVATE_KEY`，整段放一行，换行用 `\n`。

Windows PowerShell 可以用下面命令把私钥转成可粘贴的一行：

```powershell
(Get-Content "C:\path\to\ed25519-private.pem" -Raw).Trim() -replace "\r?\n", "\n"
```

最终配置示例：

```env
WEATHER_PROVIDER=qweather
QWEATHER_API_HOST=abc1234xyz.def.qweatherapi.com
QWEATHER_JWT_KID=你的凭据ID
QWEATHER_JWT_SUB=你的项目ID
QWEATHER_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n这里是私钥内容\n-----END PRIVATE KEY-----"
QWEATHER_TIMEOUT_MS=8000
WEATHER_OBSERVATION_COLLECTOR_ENABLED=true
WEATHER_OBSERVATION_MAX_PLOTS=100
```

地块页的近 30 天降水与积温来自后端每小时保存的真实实况，不会用预报或本地模型补造。首次部署时历史库为空，统计会从启用采集器后逐步累积，并同时返回实际覆盖小时数/天数。官方预警接口不可用时页面会明确显示“预警数据暂不可用”，不会伪造“无预警”。

如果是本地直接运行后端，填写 `server/.env`；如果是 Docker Compose 部署，还要填写根目录 `.env`，因为 `docker-compose.yml` 会从根目录 `.env` 注入容器环境变量。

配置后可在 `server/` 目录运行下面命令验证，不会打印私钥或完整 token：

```bash
node -e "require('dotenv').config(); const { createQweatherJwt } = require('./utils/qweather'); console.log(createQweatherJwt().split('.').length === 3 ? 'JWT OK' : 'JWT FAIL')"
```

真实接口连通性可以用：

```bash
node -e "require('dotenv').config(); const { fetchQweatherWeather } = require('./utils/qweather'); fetchQweatherWeather({latitude:39.47, longitude:75.99}).then(w=>console.log(w.provider, w.current.weather_text, w.hourly.time.length, w.daily.time.length)).catch(e=>{console.error(e.message); process.exit(1)})"
```

常见错误：

- `和风天气 API Host 未配置`：没有填写 `QWEATHER_API_HOST`，或 Docker 容器没有注入该变量。
- `和风天气JWT认证未配置完整`：`QWEATHER_JWT_KID`、`QWEATHER_JWT_SUB`、`QWEATHER_JWT_PRIVATE_KEY` 缺任意一项。
- `和风天气JWT签名失败`：误填了 `ed25519-public.pem`，或私钥换行格式不对。后端必须使用 private key。
- `403 Security Restriction`：和风凭据设置了 API/IP/域名等安全限制，当前机器或云服务器出口 IP 没有被允许。
- `401 Unauthorized`：凭据 ID、项目 ID、私钥和上传的公钥不是同一组，或服务器时间偏差较大。

微信支付服务商相关字段（如 `WECHAT_PAY_SP_MCH_ID`、`WECHAT_PAY_API_V3_KEY`、`WECHAT_PAY_PUBLIC_KEY_ID`、API 私钥路径等）等公司通过微信支付服务商审核后再填写。Docker Compose 会通过 `env_file: ./server/.env` 注入微信支付配置，所以这些字段要填在 `server/.env`。新服务商优先使用微信支付公钥模式：在服务商平台 `账户中心 -> 账户设置 -> API安全 -> 管理公钥` 下载公钥，填写 `WECHAT_PAY_PUBLIC_KEY_ID` 和 `WECHAT_PAY_PUBLIC_KEY_PATH`。旧平台证书字段仅作兼容保留。暂时不填时，普通后端功能可以运行；发起真实微信支付时会返回未配置提示，不会走模拟支付。

特约商户/农机手微信支付进件资料模板见 [docs/wechat-pay-applyment.md](docs/wechat-pay-applyment.md)。商户和农机手都可通过 `/api/wechat-applyment/*` 保存草稿、提交微信审核、同步状态；审核完成返回 `sub_mchid` 后才能发起真实收款。

服务商自营测试店铺也必须绑定一个自营特约商户号 `sub_mchid`，不能直接用服务商商户号作为普通商户收款。可在 `server/.env` 填写 `SELF_MERCHANT_SUB_MCHID`，再运行 `node db/create_self_merchant.js` 绑定到平台自营店铺。

农资订单和农机租赁订单均已接入微信支付服务商分账：农机支持定金、作业完成后尾款及一次性全款三种支付阶段，每笔真实交易分别记录和分账；农资订单确认收货、农机订单完成作业并过冻结期后，定时任务调用微信分账接口把平台佣金分到服务商商户号。测试基础支付但暂未开通分账权限时，可在 `server/.env` 设置 `WECHAT_PAY_PROFIT_SHARING_ENABLED=false`，等微信支付分账产品和特约商户授权都开通后再改回 `true`。

商户和农机手不能直接修改正在生效的佣金比例。两类后台均需填写目标比例和调整理由并提交申请，管理员在“佣金审核”中通过后新比例才生效；审核前创建的订单仍按支付时记录的比例分账。

分账开通后还需要在 `server/.env` 填 `WECHAT_PAY_PROFIT_SHARING_RECEIVER_NAME`，值必须是微信支付商户平台里的接收方商户全称；`WECHAT_PAY_PROFIT_SHARING_RECEIVER_MCH_ID` 留空时默认用服务商商户号收平台佣金；`WECHAT_PAY_PROFIT_SHARING_FREEZE_DAYS` 正式环境建议 `7`，联调可临时设为 `0`。填好后进入 `server` 目录运行 `node db/ensure_profit_sharing_receivers.js`，提前登记分账接收方并验证特约商户最大分账比例。

真实退款已接入微信支付服务商退款接口。农资售后和已支付的农机预约取消都会创建 `wechat_refunds` 退款单；若对应款项已经分账，后端会先按订单/支付阶段退回平台分账，再调用微信退款。退款成功以微信退款回调 `/api/pay/wechat/refund-notify` 为准。早期模拟支付订单没有微信交易号，会明确拒绝真实退款，不会伪造退款成功。

### 农户实名认证

农户实名认证是可选服务，不影响登录和普通农户功能。农户可从“我的”页面主动提交姓名、身份证号及身份证正反面，由管理员后台“实名审核”人工核验。身份证号码使用 AES-256-GCM 加密，证件图片保存在 Docker 私有卷 `identity_uploads`，不会通过 `/uploads` 公开访问。

启用实名认证功能时，生产环境必须在 `server/.env` 配置 `IDENTITY_DATA_KEY`。可用 `openssl rand -base64 48` 生成，启用后不要更换，否则历史身份证号无法解密；密钥和 `identity_uploads` 卷都应纳入受控备份。

### 意见反馈与在线客服

农户可从“我的”进入意见反馈，提交文字、联系方式和最多 4 张问题图片，也可直接进入平台在线客服。首页通知红点和“我的”未读角标只使用数据库中的真实未读数量，没有消息时不显示红点。

在线客服支持文字、图片、复制、2 分钟内撤回、双方单独删除、已读状态和引用回复。管理员可在后台查看农户会话、发送文字或图片，并从管理员端清空整个会话；该操作只隐藏管理员端历史，不会删除农户端记录，农户再次发送消息后会创建新的管理员会话。实时刷新使用 WebSocket，并保留 5 秒 HTTP 轮询作为断线兜底。

农机手网页后台可在有进行中作业时开启实时位置共享；农户跟踪页每 15 秒读取一次最近位置。生产环境浏览器定位要求 HTTPS 和用户授权，位置超过 10 分钟未更新时只显示“位置暂未更新”，不会拿基地坐标冒充实时位置。

农户端核心操作流程已补齐中文/维吾尔语即时切换，覆盖农机预约与支付、农事记录、水肥管理、农资商城订单及可选实名认证。页面固定文案随语言立即刷新；商户录入的商品名称、专家发布的课程内容等业务数据仍按发布者填写的原文展示。

### 真实快递物流配置

农资订单物流已切换为微信物流助手接入骨架，当前暂停在“读取小程序已绑定快递账号”阶段。继续联调前需先在微信小程序后台确认公司已绑定的快递公司和月结账号；系统不会生成模拟物流轨迹。

1. 在[快递100 API 开放平台](https://api.kuaidi100.com/)注册企业账号，开通“实时快递查询”和“快递信息推送”。
2. 在快递100控制台取得 `customer`（授权码）和 `key`。
3. 在 `server/.env` 填写：

```env
PUBLIC_BASE_URL=https://cyaia.cn
WECHAT_LOGISTICS_SENDER_NAME=默认发件人姓名
WECHAT_LOGISTICS_SENDER_MOBILE=默认发件手机号
WECHAT_LOGISTICS_SENDER_COMPANY=公司全称
WECHAT_LOGISTICS_SENDER_ADDRESS=省市区加详细地址
WECHAT_LOGISTICS_TIMEOUT_MS=10000
```

4. 快递100订阅回调默认只支持 HTTP；项目使用 HTTPS 回调时，需要联系快递100技术人员为账号开通 HTTPS 回调兼容。
5. 本地首次运行执行 `node db/migrate_logistics.js`；Docker 部署会在容器启动时自动执行该迁移。
6. 云服务器重建容器后检查：

```bash
docker compose exec app sh -lc 'printenv WX_APPID WECHAT_LOGISTICS_SENDER_NAME'
curl https://cyaia.cn/api/logistics/carriers
```

物流联调目前暂停；先在微信公众平台确认小程序已绑定的快递公司、月结账号和可用服务类型，再继续测试电子面单与轨迹查询。

上线前还要在小程序《用户隐私保护指引》和平台隐私政策中披露：为查询快递轨迹，会向快递100提供快递公司、运单号、收件手机号及收货地区。不要在前端保存 `customer`、`key` 或回调盐值，这些凭据只能放在服务端环境变量中。

> 不要把真实 `server/.env` 提交到 GitHub。真实密钥只应保存在本地开发机、服务器环境变量或安全的密钥管理服务中。

### AI 功能配置（可选）

在 `server/.env` 中填写至少一个 AI API Key：

```bash
# 推荐：Groq（完全免费，注册地址：https://console.groq.com）
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 可选：Siliconflow（图片视觉分析需要此 Key）
SILICONFLOW_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 可选：DeepSeek 直连（需充值）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

API 优先级：**DeepSeek（文字）> Groq（文字）> Siliconflow（文字+视觉）**。图片视觉分析仍需要 `SILICONFLOW_API_KEY`。

### 前端配置

编辑 `utils/auth.js` 第 9 行切换环境：

```js
const ENV = 'sim'     // sim=模拟器(localhost) | real=真机(局域网IP) | server=云服务器
const LOCAL_IP = '192.168.x.x'   // real 模式时填电脑局域网 IP（ipconfig 查询）
```

| ENV | 适用场景 |
|-----|---------|
| `sim` | 电脑模拟器，连本地服务器 |
| `real` | 真机调试，连本地服务器（手机和电脑同一 WiFi）|
| `server` | 测试完毕上线，连云服务器 |

Windows 防火墙放行端口（真机调试必须）：
```
netsh advfirewall firewall add rule name="Cotton 3000" dir=in action=allow protocol=TCP localport=3000
```

---

## 测试账号

| 角色 | 手机号 | 密码 | 备注 |
|------|--------|------|------|
| 农户 | `13800000001` | `test123` | 古丽巴哈尔，喀什疏附县（小程序登录） |
| 商户 | `13800000002` | `test123` | 疏附县农资有限公司（网页后台） |
| 商户 | `13900000001` | `merchant123` | 疏附县鑫农农资有限公司（网页后台，本地密码为 merchant123）|
| 机主 | `13800000003` | `test123` | 艾力农机合作社（网页后台，已审批）|
| 管理员 | `10000000000` | `Admin@Cotton2026` | 系统管理员（网页后台登录） |

> **小程序仅供农户使用**；商户、机主的登录和管理功能在网页后台。

## 三类角色入口

| 角色 | 登录入口 | 注册 / 入驻 | 工作台 |
|------|----------|-------------|--------|
| 农户 | 微信小程序 | 小程序内注册 | 小程序首页 |
| 商户 | `/` 或 `/admin/login.html?role=merchant` | `/portal/register.html?role=merchant` | `/merchant/dashboard.html` |
| 农机手 | `/` 或 `/admin/login.html?role=operator` | `/portal/register.html?role=operator` | `/operator/dashboard.html` |
| 管理员 | `/` 或 `/admin/login.html?role=admin` | — | `/admin/dashboard.html` |
| 专家 | `/` 或 `/admin/login.html?role=expert` | 管理员后台创建专家账号 | `/expert/dashboard.html` |

访问根路径（例如 `https://cyaia.cn/` 或本地 `http://localhost:3000/`）会进入统一身份选择登录页，页面提供管理员、商户、农机手、专家四个身份入口。网页后台登录目前只保留手机号 + 密码登录，不再提供手机号验证码登录。

新农机手 / 商户在统一入驻页 `/portal/register.html` 一次性提交平台资料和微信支付进件材料 → 管理员在后台「机主审批」/「商户审批」审核 → 通过后系统自动把本地证照上传微信换取 `media_id`，加密身份证、银行卡等敏感字段并提交微信支付进件。微信审核完成并返回 `sub_mchid` 后才具备真实收款条件；自动提交失败时后台会保存明确原因，可重新提交。

申请人不需要理解或填写小程序 AppID、微信结算规则 ID。小程序 AppID 读取 `WX_APPID`；微信支付进件结算规则按主体类型自动选择：个体工商户默认 `719`、企业默认 `716`、其他组织默认 `727`。商户经营种子、化肥、农药等农资，农机手出租自有农机，当前统一归入微信支付通用经营类目「零售批发/生活娱乐/其他」；正式上线前仍应按实际营业执照经营范围、农药/种子等资质要求和微信支付审核意见核对。

> 部署提醒：统一登录页、专家后台等网页静态文件在 Docker 镜像内。服务器 `git pull` 后如果看不到新入口，通常是容器还在跑旧镜像，需要执行 `docker compose up -d --build --remove-orphans` 重建并启动容器。

## 管理后台

启动后端服务后，访问：

```
http://localhost:3000/
```

选择管理员身份并使用管理员账号登录，功能包含：

| 面板 | 功能 |
|------|------|
| 数据概览 | 用户/农户/商户/待审批/商品统计，最近注册用户 |
| 商户审批 | 待审批申请列表，一键批准或拒绝（含填写原因），侧边栏角标提醒 |
| 机主审批 | 农机手入驻申请列表，查看资质/服务区域，一键批准或拒绝 |
| 农户管理 | 列表查看、新增、编辑（姓名/地区/面积/实名）、启用/禁用账号 |
| 商户管理 | 列表查看、新增（自动批准）、编辑（店铺名/联系人/品类/实名）、查看审批状态、启用/禁用账号、**单独设置佣金费率** |
| 商品管理 | 全量商品列表、新增（选择所属商户）、编辑（名称/价格/库存/状态等）、删除 |
| 订单管理 | 全量订单列表，按状态筛选，在线修改订单状态 |
| 售后管理 | 全平台售后申请列表，按状态筛选，查看申请详情（描述+凭证图片） |
| 财务管理 | 商户财务汇总（销售额/佣金/已解冻/冻结）；提现统一在微信支付商户平台处理 |
| 专家账号 | 管理专家账号，专家与管理员分离，专家可独立登录专家后台 |
| 专家讲堂 | 管理课程、图文内容、付费/免费标记，并查看农户专家提问 |
| 在线客服 | 农户会话、真实未读、文字/图片、引用、撤回、单条删除和管理员端会话清空 |
| 客服反馈 | 查看农户问题和图片，回复并维护待回复/已回复/已完成状态 |

**商户 / 农机手入驻申请（公开页面）：**
```
http://localhost:3000/portal/register.html?role=merchant
http://localhost:3000/portal/register.html?role=operator
```
商户和农机手通过此页面提交入驻申请，管理员分别在"商户审批"和"机主审批"面板审核。

**网页后台（统一登录入口）：**
```
http://localhost:3000/
http://localhost:3000/admin/login.html
```
管理员、商户和农机手共用此登录页，系统根据所选身份自动调用对应登录接口并跳转不同后台。商户功能包含：

| 面板 | 功能 |
|------|------|
| 店铺中心 | 今日销售/订单/待发货/结算统计 |
| 商品管理 | CRUD + 图片上传 + 简介/详情字段 |
| 订单管理 | 全部/待发货/已发货/已完成/售后，发货填单号，支持导出 CSV |
| 售后管理 | 售后申请列表（分 Tab），查看详情（描述+凭证图片），一键同意/拒绝 |
| 财务结算 | 结算明细、分账状态、冻结/已解冻金额；提现在微信支付商户平台操作 |
| 店铺设置 | 基础信息 + 客服微信号 + 修改密码 |

---

## 登录路由逻辑

```
小程序（农户专用）：
打开小程序
  └─ 有 Token → verify() → 有效 → /pages/index/index（农户首页）
  └─ 无 Token → /pages/login/index（农户登录/注册）

网页管理后台（管理员 + 商户 + 农机手统一登录）：
http://localhost:3000/
  └─ 自动跳转 /admin/login.html
  └─ 管理员账号登录 → /admin/dashboard.html
  └─ 商户账号登录  → /merchant/dashboard.html
  └─ 农机手账号登录 → /operator/dashboard.html
  └─ /portal/login.html、/merchant/login.html、/operator/login.html 自动重定向至此入口
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
│   └── tab-bar/              # 农户底部导航（3 Tab：首页/AI/我的）
│
├── custom-tab-bar/           # 框架要求的空壳（display:none），实际导航由上方组件实现
│
├── .wxignore                 # 打包排除规则（server/、*.md 不进小程序包）
├── pages/                    # 主包页面（TabBar 及必要入口）
│   ├── login/                # 登录注册（身份选择 → 表单）
│   │
│   ├── ── 农户主包页面 ───────────────────────────────
│   ├── index/                # 农户首页（地块天气、AI 核心入口、农事功能网格）
│   ├── ai/                   # AI 问答（DeepSeek 优先，支持中文语音问答、指令自动跳转、拍照识别）
│   ├── my/                   # 我的（用户卡片、实名、退出，含进行中订单徽章）
│   ├── feedback/             # 意见反馈（问题描述、图片、管理员回复、在线客服入口）
│   ├── support-chat/         # 农户与平台客服实时聊天
│   ├── favorites/            # 我的收藏（卡片网格，取消收藏，加购）
│   ├── fields/               # 地块管理（列表 + 绘制 draw + 详情 detail）
│   ├── pest/                 # 病虫害识别（拍照 + 识别结果 detail）
│   ├── weather/              # 地块气象
│   ├── water/                # 水管理（按地块查看灌溉与墒情建议）
│   ├── fert/                 # 肥管理（按地块查看施肥与营养建议）
│   ├── trade/                # 棉花交易行情
│   ├── records/              # 农事记录（列表/日历双视图，对接后端 API，按地块聚合）
│   ├── machine/              # 农机租赁（列表 + 详情）
│   ├── loans/                # 农业贷款
│   ├── insurance/            # 农业保险
│   └── expert/               # 专家讲堂（课程 + 详情）
│
├── subpkg-supplies/          # 分包：农资供应（不计入主包体积）
│   ├── supplies/             # 农资商城首页（对接商户商品 API）
│   ├── supplies-detail/      # 商品详情（加购、联系商家、收藏）
│   ├── supplies-store/       # 店铺页（单商户全部商品）
│   ├── supplies-cart/        # 购物车（按商家分组）
│   ├── supplies-checkout/    # 确认订单（含商品图片、收货信息）
│   ├── supplies-pay/         # 待付款（倒计时、取消/去支付）
   ├── supplies-pay-success/ # 支付成功（多商家拆单卡片展示）
│   ├── supplies-order/       # 订单详情（进度条 + 确认收货 + 售后）
│   ├── supplies-aftersale/   # 售后申请（类型/原因/描述/图片上传）
│   ├── supplies-review/      # 买家评价（五星选择 + 文字，已评价状态）
│   └── my-orders/            # 我的订单列表（Tab：全部/待付款/待发货/配送中/已完成/售后中）
│
└── server/
    ├── index.js              # Express 入口，PORT 3000
    ├── .env                  # 数据库密码等（不提交 git）
    ├── .env.example          # 配置模板
    ├── API.md                # 接口文档
    ├── routes/
    │   ├── auth.js           # /api/auth/*（注册/登录/验证/登出/个人资料）
    │   ├── products.js       # /api/products/*（商品 CRUD + 公开评价列表）
    │   ├── orders.js         # /api/orders/*（下单、查询、确认收货、售后、提交评价）
    │   ├── plots.js          # /api/plots/*（农户地块 CRUD）
    │   ├── farm-records.js   # /api/farm-records/*（农事记录 CRUD + 批量删除）
    │   ├── feedback.js       # /api/feedback/*（反馈工单、未读数和农户客服消息）
    │   ├── operator.js       # /api/operator/*（机主入驻/登录/机具管理/接单/订单）
    │   ├── machines.js       # /api/machines/*（农户浏览农机，含真实距离排序）
    │   ├── machine-orders.js # /api/machine-orders/*（农机预约下单/跟踪/评价/删除）
    │   ├── ai.js             # /api/ai/*（AI 问答代理 + 图片分析，支持 Groq/Siliconflow/DeepSeek）
    │   ├── merchant.js       # /api/merchant/*（商户登录、商品、订单、售后、评价回复）
    │   ├── upload.js         # /api/upload（multer 文件上传，存至 public/uploads/）
    │   └── admin.js          # /api/admin/*（管理后台 API，需 is_admin）
    ├── middleware/
    │   └── auth.js           # JWT 鉴权中间件 + roleGuard()
    ├── public/
    │   ├── admin/            # 网页管理后台静态文件
    │   │   ├── index.html           # 重定向到 login.html
    │   │   ├── login.html           # 管理员登录页（含商户入口链接）
    │   │   ├── dashboard.html       # SPA 仪表盘（概览/审批/农户/商户/商品/订单）
    │   │   └── merchant-apply.html  # 商户入驻申请（公开页面）
    │   ├── merchant/         # 网页商户后台静态文件
    │   │   ├── login.html           # 商户登录页（重定向到统一门户）
    │   │   └── dashboard.html       # 商户 SPA（统计/商品/订单/售后/财务/设置）
    │   ├── operator/         # 网页机主后台静态文件
    │   │   ├── login.html / apply.html  # 重定向到统一门户
    │   │   └── dashboard.html       # 机主 SPA（工作台/机具管理/接单中心/资料设置）
    │   └── portal/           # 机主+商户 统一门户
    │       ├── login.html           # 选身份登录（机主/商户）
    │       └── register.html        # 选身份注册入驻（机主/商户）
    ├── public/uploads/       # 图片上传目录（wx.uploadFile → POST /api/upload）
    ├── utils/support-messages.js # 客服消息、引用快照、撤回、已读和单方隐藏
    ├── utils/support-realtime.js # 客服 WebSocket 连接与事件推送
    └── db/
        ├── database.js       # mysql2 连接池
        ├── schema.sql        # 建表：users / farmers / merchants / login_logs
        ├── migrate_products.js           # 建 products 表 + 种子数据
        ├── migrate_admin.js              # 添加 is_admin 字段 + 创建管理员账号
        ├── migrate_merchant_approval.js  # 添加 apply_status/reject_reason 字段
        ├── migrate_orders.js             # 建 orders + order_items 表
        ├── migrate_product_detail.js     # 添加 products.detail 字段
        ├── migrate_merchant_wechat.js    # 添加 merchants.wechat_id 字段
        ├── migrate_aftersale.js          # 建 aftersale_requests 表
        ├── migrate_aftersale_images.js   # 添加 aftersale_requests.images 字段
        ├── migrate_plots.js              # 建 plots 表（农户地块）
        ├── migrate_farm_records.js       # 建 farm_records 表（农事记录）
        ├── migrate_machines.js           # 农机租赁建表 + operator 角色
        ├── migrate_order_delete.js       # 订单按角色软删除字段
        ├── migrate_delivery_range.js     # 可配送范围字段（机具/商户）
        ├── migrate_feedbacks.js          # 反馈工单与在线客服消息表
        ├── seed.js                       # 测试用户账号（幂等）
        └── seed_machines.js              # 农机演示数据（机主 + 机具）
```

---

## 后端 API 概览

Base URL（开发）：`http://<电脑当前局域网IP>:3000`（真机）/ `http://127.0.0.1:3000`（模拟器）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 公开 | 小程序农户注册；商户走网页入驻 |
| POST | `/api/auth/login` | 公开 | 手机号+密码登录 |
| GET  | `/api/auth/verify` | Token | 验证 Token，返回用户信息 |
| POST | `/api/auth/logout` | Token | 登出（前端清 Token） |
| GET/POST | `/api/feedback` | 农户 | 查询/提交意见反馈，支持问题图片 |
| GET | `/api/feedback/unread` | 农户 | 获取反馈回复与客服消息真实未读数 |
| GET/POST | `/api/feedback/chat/messages` | 农户 | 查询/发送客服文字、图片和引用回复 |
| PATCH/DELETE | `/api/feedback/chat/messages/:id/recall` `/api/feedback/chat/messages/:id` | 农户 | 撤回自己的消息 / 仅农户端删除消息 |
| GET  | `/api/products` | 公开 | 获取所有在售商品（含商家名） |
| GET  | `/api/products/mine` | 商户 | 获取本店商品列表 |
| POST | `/api/products` | 商户 | 上架新商品 |
| PUT  | `/api/products/:id` | 商户 | 编辑商品信息 |
| PATCH| `/api/products/:id/status` | 商户 | 切换上架/下架 |
| DELETE | `/api/products/:id` | 商户 | 删除商品 |
| POST | `/api/admin/login` | 公开 | 管理员登录 |
| GET  | `/api/admin/stats` | 管理员 | 统计数据概览 |
| GET/DELETE | `/api/admin/support-chats[/:userId]` | 管理员 | 查询客服会话 / 仅清空管理员端指定会话 |
| GET/POST | `/api/admin/support-chats/:userId/messages` | 管理员 | 查询或发送客服消息，支持图片和引用 |
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
| PATCH | `/api/merchant/orders/:id/ship` | 商户 | 发货（选择快递公司并填写物流单号，自动订阅轨迹） |
| GET | `/api/logistics/orders/:id` | 农户 | 查看本人订单的真实物流轨迹；`refresh=1` 请求刷新 |
| PATCH | `/api/merchant/orders/:id/refund` | 商户 | 发起真实微信退款 |
| GET  | `/api/merchant/finance` | 商户 | 财务明细（已解冻金额、冻结金额、分账状态、结算列表） |
| GET/POST | `/api/merchant/commission` `/api/merchant/commission-change-requests` | 商户 | 查看佣金比例 / 提交带理由的调整申请 |
| POST | `/api/merchant/withdraw` | 商户 | 已停用，提现请到微信支付商户平台处理 |
| GET  | `/api/merchant/messages` | 商户 | 消息中心列表 |
| PATCH | `/api/merchant/messages/read-all` | 商户 | 全部标为已读 |
| PATCH | `/api/merchant/messages/:id/read` | 商户 | 单条标为已读 |
| GET  | `/api/merchant/aftersale` | 商户 | 售后申请列表（可按 status 筛选） |
| PATCH | `/api/merchant/aftersale/:id/handle` | 商户 | 审批售后（approved/rejected + 备注）|
| GET/PUT | `/api/merchant/profile` | 商户 | 获取/更新店铺信息（含 wechat_id）|
| POST | `/api/orders` | 农户/访客 | 下单（登录用账号信息，访客填姓名+手机+地址）|
| GET  | `/api/orders/my` | 农户 | 查看个人订单列表（支持 status/status2 双状态过滤）|
| GET  | `/api/orders/:id/aftersale` | 农户 | 查看售后申请状态及商家回复 |
| POST | `/api/orders/:id/aftersale` | 农户 | 提交售后申请（含图片 URL，自动将订单状态改为 refund）|
| PATCH | `/api/orders/:id/pay` | 农户 | 付款确认（`pending_payment` → `pending_ship`，通知商户） |
| PATCH | `/api/orders/:id/cancel` | 农户 | 取消待付款订单（释放库存） |
| PATCH | `/api/orders/:id/confirm` | 农户 | 确认收货（状态改为 completed，资金冻结 7 天） |
| PUT   | `/api/auth/profile` | 农户 | 更新个人资料（地区/面积） |
| PATCH | `/api/admin/merchants/:id/commission` | 管理员 | 设置商户佣金费率（0~100%） |
| POST  | `/api/orders/:id/review` | 农户 | 提交评价（已完成订单，每单一次） |
| GET   | `/api/products/reviews?merchant_id=X` | 公开 | 获取商户评价列表（商品详情页展示） |
| GET   | `/api/merchant/orders/export` | 商户 | 导出订单 CSV（UTF-8 BOM，支持 token query 参数）|
| GET   | `/api/merchant/reviews` | 商户 | 获取本店全部评价（匿名评价屏蔽真实姓名）|
| PATCH | `/api/merchant/reviews/:id/reply` | 商户 | 回复买家评价 |
| GET   | `/api/admin/aftersales` | 管理员 | 全平台售后申请列表（可按 status 筛选） |
| GET   | `/api/admin/finance` | 管理员 | 各商户财务汇总（销售额、佣金、已解冻、冻结） |
| GET/PATCH | `/api/admin/commission-change-requests[/:id]` | 管理员 | 查询并审核商户/农机手佣金调整申请 |
| GET   | `/api/admin/withdrawals` | 管理员 | 已停用，提现统一在微信支付商户平台处理 |
| PATCH | `/api/admin/withdrawals/:id/handle` | 管理员 | 已停用，提现统一在微信支付商户平台处理 |
| GET   | `/api/plots` | 农户 | 获取本人全部地块 |
| POST  | `/api/plots` | 农户 | 新建地块（含坐标、面积、基础信息） |
| GET   | `/api/plots/:id` | 农户 | 获取单个地块详情 |
| PUT   | `/api/plots/:id` | 农户 | 编辑地块（名称/品种/评分/状态等） |
| DELETE | `/api/plots/:id` | 农户 | 删除地块 |
| GET   | `/api/farm-records` | 农户 | 获取农事记录（支持 type/plot_id 筛选） |
| POST  | `/api/farm-records` | 农户 | 新增农事记录（类型/地块/日期/用量/成本/执行人/备注） |
| PUT   | `/api/farm-records/:id` | 农户 | 编辑农事记录 |
| DELETE | `/api/farm-records/:id` | 农户 | 删除单条农事记录 |
| POST  | `/api/farm-records/batch-delete` | 农户 | 批量删除（body: `{ ids:[...] }`） |
| POST  | `/api/operator/apply` | 公开 | 机主入驻申请 |
| POST  | `/api/operator/login` | 公开 | 机主登录 |
| GET/PUT | `/api/operator/profile` | 机主 | 机主资料 / 基地定位 |
| GET/POST/PUT/DELETE | `/api/operator/machines[/:id]` | 机主 | 机具管理（含坐标校验）|
| GET   | `/api/operator/orders` | 机主 | 接单列表（可按状态筛选）|
| GET   | `/api/operator/finance` | 机主 | 农机订单实付、平台佣金、预计收入和微信分账状态 |
| GET/POST | `/api/operator/commission` `/api/operator/commission-change-requests` | 机主 | 查看佣金比例 / 提交带理由的调整申请 |
| PATCH | `/api/operator/orders/:id/accept` `.../reject` `.../status` | 机主 | 接单 / 拒单 / 推进作业状态 |
| DELETE | `/api/operator/orders/:id` | 机主 | 删除（隐藏）订单 |
| GET   | `/api/machines?lat=&lng=&category=&sort=` | 公开 | 农机列表（真实距离排序）|
| GET   | `/api/machines/:id` | 公开 | 农机详情（含评价）|
| POST  | `/api/machine-orders` | 农户 | 提交预约（含作业地址）|
| GET   | `/api/machine-orders/my` | 农户 | 我的农机预约（可按状态）|
| GET   | `/api/machine-orders/:id` | 农户 | 订单跟踪详情 |
| POST  | `/api/pay/wechat/prepay` | 农户 | 农资或农机订单真实微信服务商 JSAPI 预支付（农机传 `orderType=machine`） |
| PATCH | `/api/machine-orders/:id/cancel` | 农户 | 取消未支付农机订单 |
| POST  | `/api/machine-orders/:id/review` | 农户 | 分项评价（及时/质量/态度/价格）|
| DELETE | `/api/machine-orders/:id` | 农户 | 删除（隐藏）订单 |
| GET   | `/api/admin/operator-applications` | 管理员 | 待审批机主列表 |
| POST  | `/api/admin/operator-applications/:id/approve` `.../reject` | 管理员 | 批准 / 拒绝机主入驻 |
| POST  | `/api/ai/chat` | 公开 | AI 文字问答 + 本地指令识别（返回 `reply/intent/jump/provider`，`jump.autoOpen` 用于小程序自动打开功能，文字优先代理 DeepSeek） |
| POST  | `/api/ai/photo` | 公开 | 图片分析（multipart，调用 Siliconflow Qwen2-VL 视觉模型）|
| POST | `/api/upload` | Token | 上传图片文件，返回 `/uploads/xxx` URL |
| GET  | `/api/admin/announcements` | 管理员 | 公告列表 |
| POST | `/api/admin/announcements` | 管理员 | 发布公告（广播至所有商户消息中心） |
| DELETE | `/api/admin/announcements/:id` | 管理员 | 删除公告 |

---

## 数据库表结构

```
users                → id, phone, password(bcrypt), role(farmer/merchant/operator), real_name, is_verified, is_active, is_admin
farmers              → user_id(FK), location, land_size
merchants            → user_id(FK), company_name, business_license, product_category,
                        apply_status, reject_reason, wechat_id, commission_rate(DECIMAL 默认5.00),
                        latitude, longitude, location_name, delivery_radius(可配送范围km,默认50)
products             → id, merchant_id(FK), name, category, price, unit, stock, status,
                        icon, image_url, description, detail
orders               → id, order_no(UNIQUE), user_id(FK), farmer_name, farmer_phone,
                        receiver_name, receiver_phone, address, subtotal, delivery_fee,
                        total, pay_method, status, pay_expires_at(30分钟超时截止),
                        logistics_no, note, shipped_at, confirmed_at, auto_confirmed,
                        fund_status, created_at, updated_at
order_items          → id, order_id(FK CASCADE), merchant_id, product_id, name, icon, spec, price, qty, subtotal
aftersale_requests   → id, order_id, order_no, merchant_id, user_id, farmer_name,
                        aftersale_type, reason, other_reason, description, images(TEXT),
                        status(pending/approved/rejected), handle_note, created_at, updated_at
withdrawals          → id, merchant_id, amount, status, note, created_at, paid_at
messages             → id, merchant_id, type(order/aftersale/announcement),
                        title, content, related_id, is_read, created_at
announcements        → id, title, content, created_at
reviews              → id, order_id(UNIQUE), merchant_id, user_id, farmer_name,
                        is_anonymous(0/1), rating(1-5), content, reply, replied_at, created_at
plots                → id, user_id(FK), name, variety, area(亩), perimeter(米),
                        coordinates(JSON), sow_date, irrigation, soil_type,
                        health_score(0-100), health_issue, status(normal/attention)
farm_records         → id, user_id(FK), plot_id(关联地块,NULL=全部地块), plot_name(快照),
                        type(灌溉/施肥/打药/无人机/播种/采收/巡田/其他), title,
                        work_date, work_time, amount(用量), cost(成本元), worker(执行人), note
operators            → id, user_id(FK), org_name(合作社), contact, phone, id_card,
                        service_area, latitude, longitude, location_name(基地定位),
                        apply_status(pending/approved/rejected), rating_avg, response_time
machines             → id, operator_id(FK), name, category(打药机/采棉机/播种机/旋耕机/其他),
                        icon, price, price_orig, unit(亩/天), latitude, longitude, location_name,
                        service_radius(可配送/作业范围km,默认50),
                        spec_badges(JSON), params(JSON), status(on/off/busy), rating_avg, order_count
machine_orders       → id, order_no, machine_id, operator_id, farmer_id, machine_name/icon,
                        plot_id, plot_name, work_address(作业地址), work_date, work_area(亩),
                        unit_price, total_price, deposit(定金20%), pay_mode, pay_status,
                        status(pending→accepted→departed→arrived→working→completed / cancelled),
                        farmer_lat, farmer_lng, contact_phone, farmer_deleted, operator_deleted
machine_reviews      → id, order_id(UNIQUE), machine_id, operator_id, farmer_id, farmer_name,
                        score_timely/quality/attitude/price(分项), rating(综合), content, reply
login_logs           → user_id, ip, created_at
feedbacks            → user_id, content, contact, images_json, status, admin_reply, user_read_at
support_messages     → user_id, sender_type, sender_id, content, image_url, reply_to_id,
                        reply_to_json, recalled_at, hidden_for_farmer, hidden_for_admin, read_at

订单软删除：`orders` 加 `farmer_deleted/merchant_deleted`、`machine_orders` 加 `farmer_deleted/operator_deleted`——按角色隐藏，仅终态（已完成/已取消/售后完成）可删，不影响对方记录。

可配送范围：机主给机具设 `service_radius`、商户给店铺设定位 + `delivery_radius`；农户端用 GPS 实时算距离（`ST_Distance_Sphere`），超出范围在列表/详情显示「超出配送范围」。农户定位显示用 [utils/regions.js](utils/regions.js) 全国主要城市/县就近匹配（喀什细化到县，无需地图 API key）。
```

订单状态流转：`pending_payment`（待付款，含30分钟超时）→ `pending_ship`（待发货）→ `shipped`（已发货）→ `completed`（已完成）；已完成后可申请售后 → `refund`（售后中）→ 商家处理后 → `refunded`（售后完成）；超时/主动取消 → `cancelled`（库存自动释放）

资金状态流转：`pending` → 确认收货后 `frozen`（按 `WECHAT_PAY_PROFIT_SHARING_FREEZE_DAYS` 配置等待）→ 无售后后分账并进入 `available`（已解冻，提现在微信支付商户平台操作）→ 退款成功时 `refunded`

售后状态流转：`pending`（待处理）→ `approved`（已同意）/ `rejected`（已拒绝）

真实退款流转：商户同意售后或在订单入口发起退款 → 写入 `wechat_refunds` → 已分账订单先执行分账回退 → 调用微信服务商退款接口 → 微信退款回调或列表同步查询确认成功 → 订单状态更新为 `refunded`。

---

## Tab Bar 实现说明

> **重要**：Skyline 下 `position:fixed` 在自定义组件内触摸响应区域与视觉位置会错位，导致点击无效。

**当前方案（正确）**：
- `custom-tab-bar/` 保留空壳（框架要求），CSS 设 `display:none`
- 在 `components/tab-bar/` 中实现真实导航 UI
- 每个 Tab 页在 WXML 的 flex 列底部直接内嵌组件（无需 `position:fixed`）：

```wxml
<view class="page">            <!-- display:flex; flex-direction:column; height:100vh -->
  <scroll-view style="flex:1;height:0;" scroll-y>
    <!-- 页面内容 -->
  </scroll-view>
  <tab-bar selected="{{0}}"></tab-bar>   <!-- 自然排列在底部，无 fixed -->
</view>
```

农户 Tab 页用 `wx.switchTab`。

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
3b. **禁止 `inset:0` 简写** → 用显式 `top/left/right/bottom:0`（否则真机遮罩不铺满，弹窗错位到左上角）
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
  currentOrders:   [],     // 多商家拆单订单组（待付款页/支付成功页传参）
  currentPlot:     null,   // 当前地块（列表 → 详情页传参）
  pendingPhoto:    null,   // 首页拍照后传给 AI 页的图片（{ tempFilePath }）
  statusBarHeight: 20      // 状态栏高度（px）
}
```

---

## 参考资源

- 网页版 demo：`F:\cotton demo\demo.html`（6797 行，47 个页面的完整设计参考）
- 后端接口文档：`server/API.md`
- 变更日志：`CHANGELOG.md`
