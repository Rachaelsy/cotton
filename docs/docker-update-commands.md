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
