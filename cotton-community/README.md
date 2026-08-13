# cotton-community

`cotton-community` 承载“喀什优棉公共服务平台”的内容管理服务，以及面向新疆棉花产业的农业商业服务网站。
公开入口拆分为公益、商业两个平台，账号、MySQL 数据、内容关联和运营后台保持打通。
种植培训、政策、病虫害和行业资讯依据农业农村部、新疆政府部门、全国农技中心等
公开资料整理，并在详情页保留原始来源。公益课程、专家咨询、评论、论坛和学习记录
使用共享数据库。

## 第一版功能

### 公益平台

#### 公共服务平台管理员与 Markdown 政策发布

喀什优棉公共服务平台提供独立、可扩展的小程序管理员账号，不需要把账号提升为核心平台管理员。后台“政策资讯”统一管理政策中心与行业资讯，支持 Markdown 编辑和分类发布；“优棉金融”维护种植贷、棉花保险、期货基础和金融政策解读四篇 Markdown 文章；“首页推送”集中管理政策、行业、金融和首页专稿，最多同时推送 5 篇；“专家讲堂”管理精选问答、在线专家与精选视频，并支持头像、封面和视频上传；“农机服务”和“农资服务”用于维护小程序中展示的具体产品目录；“加工服务”用于维护加工厂、地图坐标、产能、联系人、图片与发布状态。首次部署或更新后，容器启动会自动创建或升级管理员、文章、专家和生产服务数据表。

政策资讯文章支持公开读取评论、登录农户发表评论；评论按文章和用户保存到 `policy_comments`，限制为 2–300 字，并对短时间重复提交进行拦截。小程序收藏保存在当前设备，转发使用微信原生分享能力。

优棉金融通过 `/api/market/cotton-futures` 提供棉花主力连续行情。接口带 30 秒服务端缓存、请求超时、最近一次成功数据回退和不可用状态；不会在行情源失败时返回估算价格。默认 `FINANCE_QUOTE_PROVIDER=sina` 使用公开行情并明确提示可能延迟；取得正式授权行情后可设为 `custom`，通过 `FINANCE_QUOTE_URL` 接入 HTTPS JSON 服务，并用 `FINANCE_QUOTE_SOURCE` 标注来源。行情仅作信息参考，不构成交易报价或投资建议。

在服务器创建或重置政策管理员（密码由脚本随机生成，只显示一次）：

```bash
cd /root/cotton
docker compose exec community node db/create_community_admin.js 你的11位手机号 公共服务平台管理员
```

管理员从统一入口 `/admin/login.html?role=admin` 登录，后端根据账号类型自动进入公益小程序管理后台 `/knowledge/policy-admin.html`。公益管理员不能进入核心订单、商户等后台；当前可编辑 Markdown 政策、实时预览、保存草稿和正式发布。公开接口 `GET /api/policies` 和 `GET /api/policies/:id` 只返回已发布文章。

官方政策资讯可执行 `npm run policies:seed` 导入。脚本仅整理政府部门、国家统计局等权威公开页面的阅读要点并保留原文链接，按 `original_url` 去重，重复执行不会覆盖管理员在后台做过的编辑。Docker 部署可执行 `docker compose exec community npm run policies:seed`。

统一首页推送队列支持政策、行业、金融和仅在首页展示的专稿。只有 `published` 文章可以推送，后端最多保留 5 篇；管理端可直接切换推送状态，小程序首页通过 `GET /api/policies?homepage=1` 读取。文章转为草稿时会自动退出首页队列。

公益小程序后台沿用核心管理员后台的视觉布局，但左侧导航按公共服务产品权限独立生成，目前提供“政策资讯”“优棉金融”“首页推送”“专家讲堂”“农机服务”“农资服务”“加工服务”“农户管理”和“账号安全”，不会暴露核心平台的商户、订单等菜单。

#### 专家讲堂内容运营

“专家讲堂”分为精选问答、在线专家、精选视频。问答维护问题与答案，专家维护公开简介和在线状态，视频支持将封面与视频文件上传到 `community_uploads` 持久化卷。管理接口使用 `/api/expert-studio/admin/*`，公开展示继续读取共享 `/api/expert`，因此后台发布后可直接进入 `cotton-public` 小程序。部署该功能需要重新构建 `app`、`community` 和 `nginx`，以同步核心公开接口、数据库迁移、后台和代理规则。

#### 农机与农资产品上架

管理员可以分别进入“农机服务”和“农资服务”，新增具体产品并维护名称、分类、机型/品种、品牌、生产厂家、图片地址、简介、特点、适用条件和展示顺序。产品状态分为草稿、已上架、已下架，只有已上架数据会通过公开接口进入 `cotton-public` 小程序。

| 接口 | 用途 |
|---|---|
| `GET /api/service-products?type=machinery` | 读取已上架农机产品 |
| `GET /api/service-products?type=supplies` | 读取已上架农资产品 |
| `GET /api/service-products/admin/list?type=...` | 后台读取含草稿、下架状态的管理列表 |
| `POST /api/service-products/admin` | 新增产品 |
| `PUT /api/service-products/admin/:id` | 编辑产品 |
| `PATCH /api/service-products/admin/:id/status` | 上架或下架产品 |
| `DELETE /api/service-products/admin/:id` | 删除产品 |

生产部署拉取新代码后需重新构建公益服务，容器入口会先执行 `node db/migrate.js`，自动创建 `community_service_products` 表：

```bash
cd /root/cotton
docker compose up -d --build community nginx
docker compose logs --tail=100 community
```

#### 加工厂数据与后台维护

加工厂资料保存在 `community_processing_factories` 表，包含名称、简称、县市、地址、经纬度、年加工产能、负责人、联系电话、简介、图片 URL 列表、服务范围、公示代码、诚信等级、来源、核验日期及发布状态。公示代码允许为空；填写后保持唯一。公益管理员可在后台“加工服务”中新增、编辑、发布、下线和删除记录。

| 接口 | 用途 |
|---|---|
| `GET /api/processing-factories` | 小程序读取已发布加工厂列表 |
| `GET /api/processing-factories/:id` | 小程序读取单个已发布加工厂详情 |
| `GET /api/processing-factories/admin/list` | 后台读取全部状态记录 |
| `POST /api/processing-factories/admin` | 新增加工厂 |
| `PUT /api/processing-factories/admin/:id` | 修改加工厂 |
| `PATCH /api/processing-factories/admin/:id/status` | 发布或下线 |
| `DELETE /api/processing-factories/admin/:id` | 删除加工厂 |

更新后需重新构建 `community` 和 `nginx`，启动迁移会创建数据表并以不覆盖后台修改的方式写入首批已核验记录。

- 棉花种植培训：播种、苗期、水肥、病虫害、花铃期和采收六类图文文章。
- 图文课程：图文资料、图片、课后小测试、评论和 AI 助学。
- 政策资讯：独立展示政策阅读、来源核验和适用范围提示。
- 专家咨询：读取共享 `experts` 专家资料，登录后向 `expert_questions` 提交问题并查看回复。
- 病虫害知识：常见虫害、病害和非生物胁迫的识别与田间调查方法。
- 公益活动：田间开放日、线上公开课、公益工作坊和志愿服务活动。
- 个人信息说明：公开说明账号、学习与服务数据用途；登录用户可提交查阅、更正、删除或撤回申请。
- 登录、注册、学习进度和收藏。
- 评论、回复、论坛提问与回答。
- 课程上下文 AI 问答。
- 管理员内容运营、评论管理、论坛管理和服务需求处理。

### 商业平台

- 农资产品：种子、肥料、植保产品、农膜和滴灌材料列表与详情。
- 农机服务：耕整地、播种铺膜、植保飞防、田间管理、机采棉和田间转运列表与详情。
- 核心业务展示：用农资供应、农机作业和数字履约三条业务线说明平台服务链。
- 新闻资讯：棉花行业、质量监管和加工动态列表与详情，并提供公益政策入口。
- 基础页面：商业首页、关于我们、商务联系。
- 商品详情可关联公益培训，培训文章也可以推荐相关商业资料。
- 商务联系和公益活动意向会写入共享 MySQL，并进入网站运营后台处理。

商业网站不提供购物车与在线支付；交易和农机预约由 `cotton-app` 小程序及核心 API 承接。
尚未接入真实商品库和实时农机调度数据前，网页只展示经营品类、选型参数、作业能力与核验
边界，不伪造具体品牌、库存、在岗设备、报价、电话或办公地址。真实供货或接单时仍需补充
品牌批次、农机手资质、设备档期、服务半径与最终计价信息，并经过对应经营主体确认。

### 数据打通

- `cotton-app` 与两个社区平台使用同一套 MySQL 和 `JWT_SECRET`。
- 公益平台的课程、评论、论坛、收藏、学习记录、专家与咨询记录继续使用数据库表。
- 公益与商业页面共享内容标识与关联推荐。
- 管理员从核心后台分别进入公益平台、商业平台和统一内容运营台。

## 页面路由

| 页面 | 地址 |
|---|---|
| 社区根路径（跳转公益平台） | `/`、`/knowledge/` |
| 公益平台首页 | `/public/` |
| 棉花种植培训 | `/public/training` |
| 培训详情 | `/public/training/:id` |
| 图文课程 | `/public/courses` |
| 课程详情 | `/public/courses/:id` |
| 棉友问答 | `/public/forum` |
| 问题详情 | `/public/forum/:id` |
| 登录 / 注册 | `/public/login` |
| 个人信息使用说明 | `/public/privacy` |
| 政策资讯 | `/public/policies` |
| 政策详情 | `/public/policies/:id` |
| 专家咨询 | `/public/experts` |
| 病虫害知识 | `/public/pests` |
| 病虫害详情 | `/public/pests/:id` |
| 公益活动 | `/public/activities` |
| 活动详情 | `/public/activities/:id` |
| 商业平台首页 | `/business/` |
| 农资产品 | `/business/products` |
| 商品详情 | `/business/products/:id` |
| 农机服务 | `/business/machinery` |
| 农机服务详情 | `/business/machinery/:id` |
| 新闻资讯 | `/business/news` |
| 资讯详情 | `/business/news/:id` |
| 关于我们 | `/business/about` |
| 商务联系 | `/business/contact` |
| 网站运营管理 | `/knowledge/admin.html` |

旧的 `/knowledge/public/*`、`/knowledge/business/*`、`/knowledge/products`、
`/knowledge/training`、`/knowledge/news` 和 `/knowledge/academy` 地址继续兼容；
旧 `/public/academy`、课程详情和论坛地址会永久跳转到公益平台对应页面，
站内链接统一使用 `/public/*` 与 `/business/*`。不再提供额外的双平台总页面。

## 项目结构

```text
cotton-community/
├─ routes/
│  ├─ site.js                 # 公共网站页面路由
│  ├─ knowledge.js            # 课程、评论和论坛 API
│  ├─ public-service.js       # 共享专家与公益咨询 API
│  ├─ auth.js                 # 共享账号认证
│  └─ ai.js                   # 公益课程 AI 问答
├─ public/
│  ├─ site/
│  │  ├─ index.html           # 双平台共享页面外壳
│  │  ├─ data.js              # 经营品类、培训、政策、病虫害、活动与资讯内容
│  │  ├─ app.js               # 双平台路由、页面渲染与内容关联
│  │  ├─ learning.js          # 公益课程、问答、登录与学习互动
│  │  └─ styles.css           # 电脑端和手机端响应式样式
│  ├─ knowledge/              # 公益与商业网站运营后台
│  ├─ assets/                 # 棉田、课程与产品展示素材
│  └─ uploads/                # 公益课程本地上传目录
├─ db/
│  ├─ database.js
│  └─ migrate.js
├─ server.js
└─ tests/
```

首版公开内容集中在 `public/site/data.js`。培训、病虫害、政策和产业资讯包含 `source`
与 `sourceUrl`，页面会显示原始资料入口。公益活动只展示常态服务方向和需求征集，
不使用未确认的具体日期、地点；商务需求、活动意向和个人信息处理申请写入
`community_service_requests`，管理员可在运营后台标记待处理、已联系和已完成。

## 本地运行

准备 `.env`：

```powershell
cd C:\Users\23302\Desktop\cotton\cotton-community
Copy-Item .env.example .env
```

`DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASS` 和 `JWT_SECRET`
应与 `cotton-app/server/.env` 保持一致。然后执行：

```powershell
npm install
npm run migrate
node server.js
```

访问：

```text
http://localhost:3100/public/
http://localhost:3100/business/
```

公益培训、图文课程、政策、病虫害、活动、商业商品、资讯和基础页面不需要登录。
公益平台的登录入口与图文课程独立；登录后才能保存进度、收藏、评论和发帖，
专家咨询登录后才能提交问题和查看自己的回复。

### 小程序账号与学习积分

- 小程序进入公益平台时会先向 `cotton-app` 申请 5 分钟有效的一次性票据，再由本项目兑换为共享农户会话；票据只保存哈希且成功使用后立即作废。
- 图文课程达到服务端记录时长的 90% 才视为完成。首次完成入门、进阶、高阶课程分别奖励 20、30、40 积分，同一课程不会重复奖励，每日课程奖励最多 100 积分。
- 课程页、账号页和小程序积分中心展示同一个积分账户。积分消费由 `cotton-app` 的农资订单负责，本项目只产生可审计的课程奖励流水。
- 两个服务必须连接同一 MySQL，并配置相同的 `JWT_SECRET`。生产环境的小程序业务域名必须包含承载 `/public/` 的 HTTPS 域名。

## Docker

生产环境统一从仓库根目录启动：

```powershell
cd ..
docker compose up -d --build
```

根目录 Nginx 已将 `/public/`、`/business/`、`/knowledge/`、社区 API、静态素材和
课程上传文件路由到本服务。两个子站顶部均提供“管理后台”入口，核心后台登录页和
仪表盘也提供公益、商业和内容运营入口。
正式视频建议存入腾讯云 COS、阿里云 OSS 等对象存储，不要长期占用应用服务器磁盘。

## 测试

```powershell
npm test
```

测试覆盖项目边界、公益课程与问答、公益/商业路由隔离、旧地址兼容、跨平台内容关联、
公开内容来源完整性、占位联系方式检查、无购物车/支付约束以及电脑端、手机端响应式样式。

### 公共服务平台管理员

- 公益管理员统一从 `/admin/login.html?role=admin` 登录，系统按账号权限进入公益管理后台。
- 左侧目前提供“政策资讯”“优棉金融”“首页推送”“专家讲堂”“农机服务”“农资服务”“加工服务”“农户管理”和“账号安全”；政策资讯可选择政策中心/行业资讯及其分类，金融文章和首页推荐均由后台维护，生产服务菜单管理具体上架内容，账号安全可校验当前密码并设置高强度新密码。
- 密码修改后，旧令牌立即失效，管理员必须使用新密码重新登录。
- 退出登录统一清理本地管理令牌并返回 `/admin/login.html?role=admin`。
- 原独立页面 `/knowledge/admin-login.html` 已删除；为兼容旧收藏地址，服务端会将该地址重定向到统一登录页。
- 密码修改由已在生产环境使用的 `/api/policies/admin/change-password` 后台通道处理，减少独立代理路径造成的连接问题；原认证接口继续保留兼容。
- 创建公益管理员时可临时设置 `COMMUNITY_ADMIN_PASSWORD` 环境变量；脚本会校验强度并只保存 bcrypt 哈希，不在日志中回显指定密码。未设置时仍生成一次性随机密码。
- 公益管理员左侧同时提供“农户管理”，可查看、新增、编辑、启用和禁用共享数据库中的农户；核心后端采用独立的农户权限中间件，不向该账号开放商户、订单等其他平台接口。

### 本地热开发

从仓库根目录运行 `scripts/dev-local.ps1`。开发 Compose 会把 `cotton-community` 源码挂载到
容器并以 Node `--watch` 启动，保存后自动重启；本地配置读取根目录中被 Git 忽略的
`.env.development`。浏览器统一访问 `http://127.0.0.1/knowledge/`，无需操作云服务器。
