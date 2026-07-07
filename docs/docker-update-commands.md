# Docker 部署更新命令

每次在云服务器拉取新代码后，建议执行下面这一组命令。它会拉取 `main` 最新代码、重建后端 `app` 镜像、按需重建容器，并保留 MySQL 数据卷。

```bash
cd /root/cotton

git fetch origin main
git pull --ff-only origin main

docker compose up -d --build --remove-orphans

docker compose ps
docker compose logs --tail=200 app

curl http://127.0.0.1/api/ping
curl -I http://127.0.0.1/
```

## 微信支付证书文件

如果 `server/.env` 中使用的是下面这种相对路径：

```env
WECHAT_PAY_PRIVATE_KEY_PATH=apiclient_key.pem
WECHAT_PAY_PUBLIC_KEY_PATH=pub_key.pem
```

需要在服务器项目根目录放置这两个文件：

```bash
cd /root/cotton
ls -l apiclient_key.pem pub_key.pem
```

`docker-compose.yml` 会把它们只读挂载到容器内：

```text
/root/cotton/apiclient_key.pem -> /app/apiclient_key.pem
/root/cotton/pub_key.pem       -> /app/pub_key.pem
```

如果你想把证书放到仓库外，例如 `/root/cotton-secrets/`，就在根目录 `.env` 里加：

```env
WECHAT_PAY_PRIVATE_KEY_HOST_PATH=/root/cotton-secrets/apiclient_key.pem
WECHAT_PAY_PUBLIC_KEY_HOST_PATH=/root/cotton-secrets/pub_key.pem
```

同时 `server/.env` 仍然可以保持容器内路径：

```env
WECHAT_PAY_PRIVATE_KEY_PATH=apiclient_key.pem
WECHAT_PAY_PUBLIC_KEY_PATH=pub_key.pem
```

重建后可用下面命令做不泄露密钥的自检：

```bash
docker compose exec app node -e "const wx=require('./utils/wechat-pay'); const cfg=wx.getServiceProviderConfig(); const notify=wx.getNotifyConfig(); console.log(JSON.stringify({serviceProviderConfigured:!!cfg, notifyVerifyConfigured:!!notify, notifyUrlHttps:!!(cfg&&/^https:\/\//.test(cfg.notifyUrl)), publicKeyMode:!!(notify&&notify.wechatpayPublicKey)}))"
```

## 创建服务商自营测试店铺

如果特约商户暂时没有审批下来，但服务商自己的商户号已经可以 JSAPI 收款，可以先创建一个平台自营店铺测试微信支付。自营订单会走微信支付普通 JSAPI 下单接口，不需要 `sub_mchid`。

```bash
cd /root/cotton
git pull --ff-only origin main
docker compose up -d --build --remove-orphans

docker compose exec app sh -lc '
SELF_MERCHANT_PHONE=13900000010 \
SELF_MERCHANT_PASSWORD=test123 \
SELF_MERCHANT_COMPANY_NAME="Cotton平台自营店" \
node db/create_self_merchant.js
'
```

然后用 `13900000010 / test123` 登录商户后台，上架一个测试商品；农户在小程序里下单时，如果订单商品属于这个自营店铺，会直接收款到服务商商户号。

如果只想看实时启动日志：

```bash
cd /root/cotton
docker compose logs -f app
```

如果遇到容器名冲突，例如提示 `container name "/cotton-app" is already in use`，再执行下面这组修复命令。不要加 `-v`，这样不会删除数据库数据卷。

```bash
cd /root/cotton

docker compose down --remove-orphans
docker compose up -d --build --remove-orphans

docker compose ps
docker compose logs --tail=200 app
curl http://127.0.0.1/api/ping
```

如果只是修改了服务器上的 `.env`，也需要让容器重新读取环境变量：

```bash
cd /root/cotton
docker compose up -d --force-recreate app
docker compose logs --tail=100 app
```

注意事项：

- 不要执行 `docker compose down -v`，它会删除 volume，可能导致数据库数据丢失。
- 一般不需要手动删除 `cotton-db`，数据库容器由 Compose 管理，数据保存在 `mysql_data` volume。
- 代码更新后如果涉及 Node 依赖、静态页面、后端接口或 Dockerfile，直接使用第一组命令即可。
