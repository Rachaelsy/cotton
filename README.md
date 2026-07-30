# Cotton Platform

本仓库统一管理两个可以独立开发、共同部署的项目：

- `cotton-app/`：微信小程序、业务后台、农资与农机交易、支付和核心 API。
- `cotton-community/`：棉知公益平台、农业商业平台和统一内容运营台。公益平台
  包含种植培训、图文课程、政策资讯、专家咨询、病虫害知识和公益活动；商业平台
  展示农资供应、农机作业、数字履约和产业资讯等核心业务。

二者共用 MySQL 数据库与账号体系，但各自维护依赖和代码边界。整个 `cotton/`
目录只有根目录这一份 Git 历史，子目录内不应再出现 `.git`。

## 本地开发

先确保 `cotton-app/server/.env` 与 `cotton-community/.env` 使用同一套数据库连接和
`JWT_SECRET`。

### Compose 一键启动

在仓库根目录执行：

```powershell
docker compose up -d --build
docker compose ps
```

Compose 默认以正式模式运行，不会创建或允许项目内置测试账号登录。只有使用独立本地测试
数据库时，才可在根目录 `.env` 临时设置：

```dotenv
APP_NODE_ENV=development
SEED_DEMO_DATA=true
```

恢复正式数据或部署云服务器前必须改回 `APP_NODE_ENV=production` 和
`SEED_DEMO_DATA=false`。正式模式即使遇到旧数据库残留的公开测试口令，也会拒绝对应
农户、商户、农机手和专家登录；默认管理员只允许进入强制修改密码页面。

启动后可访问：

- 统一管理入口：`http://127.0.0.1/admin/login.html`
- 公益平台：`http://127.0.0.1/public/`
- 商业平台：`http://127.0.0.1/business/`
- 小程序后端直连：`http://127.0.0.1:3000`
- 社区网页直连：`http://127.0.0.1:3100`

从 `http://127.0.0.1:3000/admin/login.html` 直接打开管理后台也受支持；其中的公益、
商业和内容运营入口会自动跳转到 `3100` 的对应网页。停止全部本地容器：

```powershell
docker compose down
```

### 分别启动

不使用 Docker 时，在两个终端分别启动：

```powershell
# 终端 1：核心平台
cd cotton-app\server
npm install
npm start

# 终端 2：公益与商业网站
cd cotton-community
npm install
npm run migrate
npm start
```

- 核心平台：`http://localhost:3000`
- 棉知双平台入口：`http://localhost:3100/knowledge/`
- 公益平台：`http://localhost:3100/public/`
- 商业平台：`http://localhost:3100/business/`
- 社区服务健康检查：`http://localhost:3100/api/community-health`

## 统一测试

```powershell
npm test
```

该命令会先检查目录、Compose、Nginx 和跨项目接口路径，再运行两个子项目的测试。

## 账号互通与学习积分

- 两个网站共用农户账号和 `JWT_SECRET`。小程序打开公益平台时，核心后端签发 5 分钟有效、仅可使用一次的登录票据；公益平台兑换成功后立即销毁票据，URL 中不会长期保留登录凭证。
- 公益课程按难度奖励积分：入门 20、进阶 30、高阶 40；同一账号、同一课程只奖励一次，每日课程奖励上限 100 分。
- `100` 积分抵扣 `1` 元，单笔至少使用 `100` 积分，最多使用 `2000` 积分，且不超过订单金额的 `10%`、订单对应的平台服务费和账号可用余额。
- 积分优惠由平台承担，可与商户优惠券同时使用，不减少商户应结算金额。待付款订单会锁定积分；取消或超时会释放，支付后正式核销，全额退款后返还。
- 游客仍可免登录购买农资，但不能获得或使用积分。登录农户可在小程序“我的 -> 学习积分”查看余额和明细，管理员可在核心后台查询并按原因调整积分。

## Docker 部署

生产环境只使用仓库根目录的 `docker-compose.yml`。它会启动 MySQL、核心平台、
公益与商业网站和统一 Nginx，并在同一域名下提供：

- `/`、`/admin/`、业务 API：`cotton-app`
- `/public/`、`/business/`、`/knowledge/`、公益课程 API 和课程上传文件：`cotton-community`

正式域名下的公开入口为 `https://你的域名/public/` 和
`https://你的域名/business/`。`/knowledge/` 保留为双平台总入口和内容运营后台路径。

首次部署：

```bash
cd /root/cotton
cp .env.example .env
# 填写根目录 .env，并配置 cotton-app/server/.env
npm run secrets:ensure
docker compose config --quiet
docker compose up -d --build

# 首次部署创建管理员；命令会生成并只显示一次初始强密码
docker compose exec app npm run admin:bootstrap -- --phone=你的11位手机号 --name=管理员姓名

# 上线前必须通过默认测试口令审计
npm run security:audit-defaults
```

`npm run secrets:ensure` 会检查 `cotton-app/server/.env` 中的 `JWT_SECRET`。
仅当密钥缺失、过短或仍是示例占位值时才生成新的随机密钥，不会在终端输出密钥明文。
密钥变更会使已有登录状态失效，但不会影响账号、订单或学习记录。生产服务启动时也会
拒绝使用不安全的占位密钥，避免带着可预测令牌配置上线。

生产启动不再自动写入测试农户、商户、农机手、专家或商品。`SEED_DEMO_DATA` 只允许在
非生产环境显式开启；生产环境开启会直接停止启动。数据库迁移任一步失败时服务也会停止，
避免带着不完整表结构继续提供交易接口。管理员可在核心后台“账户安全”中修改密码，修改后
核心后台与内容运营台的全部旧管理员登录状态都会失效。

若旧数据库曾使用项目内置测试账号，`npm run security:audit-defaults` 会列出仍处于启用状态
且仍使用默认口令的账号。管理员可用以下命令安全重置，未传 `--password` 时会生成一次性密码：

```bash
docker compose exec app npm run admin:bootstrap -- --phone=管理员手机号 --reset
```

其他测试农户、商户、农机手和专家应在后台停用或删除。`deploy/update.sh` 默认会在健康检查后
执行该审计并在发现风险时返回失败；过渡部署只能临时设置
`ALLOW_DEFAULT_ACCOUNT_AUDIT_FAILURE=1`，完成整改后必须移除。

本地已有 MySQL 占用 `3306` 时，在根目录 `.env` 设置 `DB_HOST_PORT=3307`；
该值只改变 Docker MySQL 暴露到宿主机的端口，容器间仍使用 `db:3306`。
真机联调需要把 `APP_HOST_BIND` 和 `COMMUNITY_HOST_BIND` 设置为 `0.0.0.0`，
并确认 `cotton-app/utils/auth.js` 的 `LOCAL_IP` 是电脑当前局域网 IPv4。正式服务器
建议保留默认的 `127.0.0.1`，只通过 Nginx 对外提供服务。

容器启动时会自动执行积分与跨端登录迁移。非 Docker 环境首次升级需执行：

```bash
cd cotton-app/server
node db/migrate_points.js
cd ../../cotton-community
npm run migrate
```

生产环境还需在微信公众平台把正式域名加入小程序业务域名，否则小程序内的
`web-view` 无法打开 `/public/`。公益平台与核心后端必须使用同一套 MySQL 和
`JWT_SECRET`，并始终通过 HTTPS 对外提供服务。
网页和 API 同域部署时 `CORS_ALLOWED_ORIGINS` 保持为空；只有确实存在独立可信前端域名时
才填写其完整 HTTPS 来源，多个来源使用英文逗号分隔。生产环境不会向其他来源开放浏览器跨域访问。

微信支付私钥与平台公钥默认放在仓库根目录：

```text
/root/cotton/apiclient_key.pem
/root/cotton/pub_key.pem
```

也可以通过根目录 `.env` 的 `WECHAT_PAY_PRIVATE_KEY_HOST_PATH` 和
`WECHAT_PAY_PUBLIC_KEY_HOST_PATH` 指向仓库外的绝对路径。

从旧的单目录结构升级时，拉取代码后运行：

```bash
cd /root/cotton
git pull --ff-only origin main
sh deploy/update.sh
```

脚本会迁移旧位置遗留的环境文件、保留原有数据库与上传卷、重建服务并执行健康检查。
更新脚本也会执行上述密钥检查。核心服务和社区服务的健康检查都会验证 MySQL，
所有 Docker 服务的本地 JSON 日志限制为最多 3 个、每个 10MB，避免长期运行占满磁盘。
不要运行 `docker compose down -v`，它会删除持久化数据卷。

HTTPS 建议由云负载均衡、CDN 或宿主机 Nginx 终止，再转发到本项目的 80 端口。
完整云端操作见 `cotton-app/docs/docker-update-commands.md`。

### 数据备份

正式产生用户、订单或课程数据后，建议每天执行：

```bash
cd /root/cotton
sh deploy/backup.sh
```

脚本会备份共享 MySQL、业务上传、实名认证文件、商户/农机手入驻材料、课程上传和运行配置，逐项校验压缩包，
并默认保留最近 14 天的目录。可通过 `BACKUP_ROOT=/var/backups/cotton` 和
`BACKUP_RETENTION_DAYS=30` 调整位置与保留天数。备份中包含手机号、身份资料和支付配置，
目录权限默认为仅服务器管理员可读；还应定期复制到受控的异地对象存储，不能只留在同一台云服务器。

## Git

所有 Git 操作都在仓库根目录执行：

```powershell
cd C:\Users\23302\Desktop\cotton
git status
git add -A
git commit -m "refactor: organize app and community"
git push
```
