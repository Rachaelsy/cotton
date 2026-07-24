# Cotton Platform

本仓库统一管理两个可以独立开发、共同部署的项目：

- `cotton-app/`：微信小程序、业务后台、农资与农机交易、支付和核心 API。
- `cotton-community/`：棉知学堂、课程、评论、论坛、AI 问答和知识运营台。

二者共用 MySQL 数据库与账号体系，但各自维护依赖和代码边界。整个 `cotton/`
目录只有根目录这一份 Git 历史，子目录内不应再出现 `.git`。

## 本地开发

先确保 `cotton-app/server/.env` 与 `cotton-community/.env` 使用同一套数据库连接和
`JWT_SECRET`，然后分别启动：

```powershell
# 终端 1：核心平台
cd cotton-app\server
npm install
npm start

# 终端 2：棉知学堂
cd cotton-community
npm install
npm run migrate
npm start
```

- 核心平台：`http://localhost:3000`
- 棉知学堂：`http://localhost:3100/knowledge/`
- 学堂健康检查：`http://localhost:3100/api/community-health`

## 统一测试

```powershell
npm test
```

该命令会先检查目录、Compose、Nginx 和跨项目接口路径，再运行两个子项目的测试。

## Docker 部署

生产环境只使用仓库根目录的 `docker-compose.yml`。它会启动 MySQL、核心平台、
棉知学堂和统一 Nginx，并在同一域名下提供：

- `/`、`/admin/`、业务 API：`cotton-app`
- `/knowledge/`、学堂 API 和学堂上传文件：`cotton-community`

首次部署：

```bash
cd /root/cotton
cp .env.example .env
# 填写根目录 .env，并配置 cotton-app/server/.env
docker compose config --quiet
docker compose up -d --build
```

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
不要运行 `docker compose down -v`，它会删除持久化数据卷。

HTTPS 建议由云负载均衡、CDN 或宿主机 Nginx 终止，再转发到本项目的 80 端口。
完整云端操作见 `cotton-app/docs/docker-update-commands.md`。

## Git

所有 Git 操作都在仓库根目录执行：

```powershell
cd C:\Users\23302\Desktop\cotton
git status
git add -A
git commit -m "refactor: organize app and community"
git push
```
