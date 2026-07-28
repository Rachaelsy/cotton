# cotton-community

`cotton-community` 是面向新疆棉花产业的公益知识服务与农业商业服务网站。
公开入口拆分为公益、商业两个平台，账号、MySQL 数据、内容关联和运营后台保持打通。
种植培训、政策、病虫害和行业资讯依据农业农村部、新疆政府部门、全国农技中心等
公开资料整理，并在详情页保留原始来源。互动课程、专家咨询、评论、论坛和学习记录
使用共享数据库。

## 第一版功能

### 公益平台

- 棉花种植培训：播种、苗期、水肥、病虫害、花铃期和采收六类图文文章。
- 图文课程：图文资料、图片、课后小测试、评论和 AI 助学。
- 政策资讯：独立展示政策阅读、来源核验和适用范围提示。
- 专家咨询：读取共享 `experts` 专家资料，登录后向 `expert_questions` 提交问题并查看回复。
- 病虫害知识：常见虫害、病害和非生物胁迫的识别与田间调查方法。
- 公益活动：田间开放日、线上公开课、公益工作坊和志愿服务活动。
- 登录、注册、学习进度和收藏。
- 评论、回复、论坛提问与回答。
- 课程上下文 AI 问答。
- 管理员内容运营、评论管理和论坛管理。

### 商业平台

- 农资产品：种子、肥料、植保产品、农膜和滴灌材料列表与详情。
- 新闻资讯：棉花行业、质量监管和加工动态列表与详情，政策资讯统一归入公益平台。
- 基础页面：商业首页、关于我们、商务联系。
- 商品详情可关联公益培训，培训文章也可以推荐相关商业资料。
- 商务联系表单第一版保存在浏览器 `localStorage`，不会发送到服务器。

商业平台不提供购物车与在线支付。尚未接入真实商品库前，产品区只展示经营品类、选型参数
和核验边界，不伪造具体品牌、库存、包装、电话或办公地址。真实供货时仍需补充品牌、批次、
标签、登记或标准信息，并经过经营主体审核。

### 数据打通

- `cotton-app` 与两个社区平台使用同一套 MySQL 和 `JWT_SECRET`。
- 公益平台的课程、评论、论坛、收藏、学习记录、专家与咨询记录继续使用数据库表。
- 公益与商业页面共享内容标识与关联推荐。
- 管理员从核心后台分别进入公益平台、商业平台和统一内容运营台。

## 页面路由

| 页面 | 地址 |
|---|---|
| 双平台总入口 | `/knowledge/` |
| 公益平台首页 | `/public/` |
| 棉花种植培训 | `/public/training` |
| 培训详情 | `/public/training/:id` |
| 图文课程 / 互动学堂 | `/public/academy` |
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
| 新闻资讯 | `/business/news` |
| 资讯详情 | `/business/news/:id` |
| 关于我们 | `/business/about` |
| 商务联系 | `/business/contact` |
| 学堂管理 | `/knowledge/admin.html` |

旧的 `/knowledge/public/*`、`/knowledge/business/*`、`/knowledge/products`、
`/knowledge/training`、`/knowledge/news` 和 `/knowledge/academy` 地址继续兼容，
站内链接统一使用 `/public/*` 与 `/business/*`。

## 项目结构

```text
cotton-community/
├─ routes/
│  ├─ site.js                 # 公共网站页面路由
│  ├─ knowledge.js            # 课程、评论和论坛 API
│  ├─ public-service.js       # 共享专家与公益咨询 API
│  ├─ auth.js                 # 共享账号认证
│  └─ ai.js                   # 学堂 AI 问答
├─ public/
│  ├─ site/
│  │  ├─ index.html           # 双平台共享页面外壳
│  │  ├─ data.js              # 经营品类、培训、政策、病虫害、活动与资讯内容
│  │  ├─ app.js               # 双平台路由、页面渲染与内容关联
│  │  └─ styles.css           # 电脑端和手机端响应式样式
│  ├─ knowledge/              # 原互动学堂页面
│  ├─ assets/                 # 棉田、课程与产品展示素材
│  └─ uploads/                # 学堂本地上传目录
├─ db/
│  ├─ database.js
│  └─ migrate.js
├─ server.js
└─ tests/
```

首版公开内容集中在 `public/site/data.js`。培训、病虫害、政策和产业资讯包含 `source`
与 `sourceUrl`，页面会显示原始资料入口。公益活动只展示常态服务方向和需求征集，
不使用未确认的具体日期、地点；商务需求和活动意向目前仅保存在浏览器 `localStorage`，
页面会明确提示尚未提交至服务器。后续接入后台或数据库时，可以保持页面组件不变，
将数据来源替换为 API。

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

公益培训、政策、病虫害、活动、商业商品、资讯和基础页面不需要登录。互动学堂登录后
才能保存进度、评论和发帖，专家咨询登录后才能提交问题和查看自己的回复。

## Docker

生产环境统一从仓库根目录启动：

```powershell
cd ..
docker compose up -d --build
```

根目录 Nginx 已将 `/public/`、`/business/`、`/knowledge/`、社区 API、静态素材和
学堂上传文件路由到本服务。两个子站顶部均提供“管理后台”入口，核心后台登录页和
仪表盘也提供公益、商业和内容运营入口。
正式视频建议存入腾讯云 COS、阿里云 OSS 等对象存储，不要长期占用应用服务器磁盘。

## 测试

```powershell
npm test
```

测试覆盖项目边界、互动学堂、公益/商业路由隔离、旧地址兼容、跨平台内容关联、
公开内容来源完整性、占位联系方式检查、无购物车/支付约束以及电脑端、手机端响应式样式。
