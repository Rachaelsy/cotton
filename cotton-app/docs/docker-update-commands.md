# 云服务器 Docker 更新

目录拆分后，生产环境统一从仓库根目录部署。不要分别进入 `cotton-app` 或
`cotton-community` 执行 Compose。

## 常规更新

```bash
cd /root/cotton
sh deploy/update.sh
```

脚本依次执行安全的 Git 快进更新、配置检查、镜像构建、容器更新和两个服务的健康检查。
MySQL、业务上传文件、实名资料和学堂上传文件均使用固定名称的数据卷，不会因目录改变丢失。

查看状态和日志：

```bash
docker compose ps
docker compose logs --tail=200 app community nginx
docker compose logs -f app
```

手工检查：

```bash
curl http://127.0.0.1/api/ping
curl http://127.0.0.1/api/community-health
curl -I http://127.0.0.1/knowledge/
```

## 首次目录迁移

旧结构的 `server/.env` 属于忽略文件，Git 不会自动把它移动到新目录。
`deploy/update.sh` 会在新文件不存在时将其复制到：

```text
/root/cotton/cotton-app/server/.env
```

第一次升级时脚本尚未出现在旧代码中，因此先执行一次：

```bash
cd /root/cotton
git pull --ff-only origin main
sh deploy/update.sh
```

根目录 `.env` 继续供 Compose 读取，至少应配置：

```env
DB_PASS=当前 MySQL root 密码
DB_NAME=cotton
```

两个 Node 服务在统一部署时都会读取 `cotton-app/server/.env`，因此天然共享
`JWT_SECRET`、微信登录配置和 AI 配置，避免账号令牌不一致。

更新脚本会在启动容器前运行 `npm run secrets:ensure` 对应的密钥初始化逻辑，
自动补齐旧服务器缺少的 `JWT_SECRET` 和 `IDENTITY_DATA_KEY`，但不会覆盖有效旧值。
`IDENTITY_DATA_KEY` 启用后必须纳入受控备份，不能随意更换，否则历史实名资料和
商户/农机手入驻草稿将无法解密。

## app 容器不健康

先查看真正的启动错误，不要只依据 Compose 的 `unhealthy` 汇总：

```bash
cd /root/cotton
docker compose logs --tail=200 app
```

若日志提示缺少或拒绝 `IDENTITY_DATA_KEY` / `JWT_SECRET`，执行：

```bash
git pull --ff-only origin main
node scripts/ensure-runtime-secrets.js
docker compose up -d --build --remove-orphans
docker compose ps
curl --fail http://127.0.0.1/api/ping
```

检查两个变量是否存在时只显示键名，禁止把密钥明文粘贴到聊天或工单：

```bash
grep -E '^(JWT_SECRET|IDENTITY_DATA_KEY)=' cotton-app/server/.env | sed 's/=.*/=<configured>/'
```

如果 `app` 仍不健康，重新执行 `docker compose logs --tail=200 app`。入口脚本会在
任一数据库迁移失败时停止服务，日志中的第一条 `Error` 才是下一步需要处理的原因。

## 微信支付证书

默认宿主机位置保持不变：

```text
/root/cotton/apiclient_key.pem
/root/cotton/pub_key.pem
```

容器内仍映射为：

```text
/app/apiclient_key.pem
/app/pub_key.pem
```

若证书存放在仓库外，在根目录 `.env` 中配置：

```env
WECHAT_PAY_PRIVATE_KEY_HOST_PATH=/root/cotton-secrets/apiclient_key.pem
WECHAT_PAY_PUBLIC_KEY_HOST_PATH=/root/cotton-secrets/pub_key.pem
```

支付配置自检：

```bash
docker compose exec app node -e "const wx=require('./utils/wechat-pay'); const cfg=wx.getServiceProviderConfig(); const notify=wx.getNotifyConfig(); console.log(JSON.stringify({serviceProviderConfigured:!!cfg,notifyVerifyConfigured:!!notify,notifyUrlHttps:!!(cfg&&/^https:\/\//.test(cfg.notifyUrl)),publicKeyMode:!!(notify&&notify.wechatpayPublicKey)}))"
```

## HTTPS 与域名

根 Compose 的 Nginx 监听 80 端口。HTTPS 应由云负载均衡、CDN 或宿主机 Nginx
终止，再转发到 `127.0.0.1:80`。同域部署时，将根目录 `.env` 中的
`COMMUNITY_BASE_URL` 和 `PLATFORM_BASE_URL` 留空，站内跳转会使用相对地址。

如果使用独立学堂域名，再分别填写完整的 HTTPS 地址，并在外层反向代理中将该域名
转发到社区服务或按根目录 `deploy/nginx.conf` 的路径规则转发。

## 注意事项

- 不要执行 `docker compose down -v`，否则会删除数据库和上传文件卷。
- 不要再使用子目录中的 Compose 做生产更新。
- 修改 `.env` 后使用 `docker compose up -d --force-recreate app community`。
- 更新代码、依赖或 Dockerfile 后使用 `sh deploy/update.sh`。
