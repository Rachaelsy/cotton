# cotton-community

`cotton-community` 是面向新疆棉花产业的社会服务、商业展示与知识社区网站。
第一版使用模拟数据，已经具备完整公共网站结构，同时保留原有互动学堂能力。

## 第一版功能

### 社会服务网站

- 首页：农资、培训、资讯与人工服务总览。
- 农资产品：种子、肥料、植保产品、农膜和滴灌材料列表与详情。
- 棉花培训：播种、苗期、水肥、病虫害、花铃期和采收六类图文文章。
- 新闻资讯：农业政策、行业资讯和公司动态列表与详情。
- 基础页面：关于我们、联系我们。
- 联系表单：第一版将需求保存在浏览器 `localStorage`，不会发送到服务器。

网站不提供购物车与在线支付。第一版商品、电话、地址、资讯和公司描述均为模拟内容，
正式上线前需要替换为真实且经过审核的信息。

### 互动学堂

- 课程、图文资料和课后小测试。
- 登录、注册、学习进度和收藏。
- 评论、回复、论坛提问与回答。
- 课程上下文 AI 问答。
- 管理员内容运营、评论管理和论坛管理。

## 页面路由

| 页面 | 地址 |
|---|---|
| 社会服务首页 | `/knowledge/` |
| 农资产品 | `/knowledge/products` |
| 商品详情 | `/knowledge/products/:id` |
| 棉花培训 | `/knowledge/training` |
| 培训详情 | `/knowledge/training/:id` |
| 新闻资讯 | `/knowledge/news` |
| 资讯详情 | `/knowledge/news/:id` |
| 关于我们 | `/knowledge/about` |
| 联系我们 | `/knowledge/contact` |
| 互动学堂 | `/knowledge/academy` |
| 学堂管理 | `/knowledge/admin.html` |

## 项目结构

```text
cotton-community/
├─ routes/
│  ├─ site.js                 # 公共网站页面路由
│  ├─ knowledge.js            # 课程、评论和论坛 API
│  ├─ auth.js                 # 共享账号认证
│  └─ ai.js                   # 学堂 AI 问答
├─ public/
│  ├─ site/
│  │  ├─ index.html           # 公共网站共享页面外壳
│  │  ├─ data.js              # 第一版模拟产品、培训和资讯数据
│  │  ├─ app.js               # 页面渲染、筛选、详情与联系表单
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

模拟内容集中在 `public/site/data.js`，后续接入后台或数据库时，可以保持页面组件不变，
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
http://localhost:3100/knowledge/
```

公共商品、培训、资讯和基础页面不需要登录。互动学堂登录后才能保存进度、评论和发帖。

## Docker

生产环境统一从仓库根目录启动：

```powershell
cd ..
docker compose up -d --build
```

根目录 Nginx 已将 `/knowledge/`、社区 API、静态素材和学堂上传文件路由到本服务。
正式视频建议存入腾讯云 COS、阿里云 OSS 等对象存储，不要长期占用应用服务器磁盘。

## 测试

```powershell
npm test
```

测试覆盖项目边界、互动学堂、公共页面路由、模拟数据完整性、商品与文章详情、
无购物车/支付约束以及电脑端、手机端响应式样式。
