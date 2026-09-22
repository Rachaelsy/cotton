# 优棉学堂恢复 VOD 播放

后台采用手动填写 HTTPS 播放链接的方式。视频仍在腾讯云 VOD 控制台上传；不需要在平台配置腾讯云上传密钥。

## 更新

重新构建 app 和 community 服务，并重新编译 cotton-public 小程序。app 的运行迁移包含 db/migrate_academy.js；该迁移新增或扩展 video_url 字段，保留已有课程、测验、学习进度和积分。历史视频号列仅作为旧数据保留，运行代码不再读取或写入。没有 HTTPS 视频地址的已发布视频会转为草稿，已下架或草稿课程不会自动上架。

部署前备份数据库。在仓库根目录执行：

```sh
docker compose up -d --build app community
```

若使用开发 Compose，请附带现有的 docker-compose.dev.yml 配置。

## 配置视频

1. 在腾讯云控制台上传并处理视频，复制 HTTPS MP4 或 M3U8 播放地址。
2. 后台进入优棉学堂，编辑系列中的视频课程，填写“VOD 视频播放地址”，保存并上架。
3. 历史课程若没有 VOD 地址，需要手动补填后再上架。
4. 在真机验证自动播放、暂停、拖动、全屏、失败重试，以及中高级课程登录限制。

本版接入直接播放链接，不包含 DRM 解密或后端动态签名。启用时效防盗链的地址过期后需要更新，不能将临时签名链接作为永久地址。

## 自动记录学习进度

- 已移除“完成本节”按钮；登录用户有效观看的、不重复的视频片段覆盖达到 95% 后，服务端自动完成并发积分：初级 5 分、中级 8 分、高级 10 分。每人每课只发一次，重播或更换视频不会重复发放。
- 每约 10 秒以及暂停、结束、离开页面时同步。播放位置用于断点续播，覆盖率用于判断完成，两者分开计算。拖到片尾不算完成；暂停、后台停留和重复片段不增加覆盖率。支持最高 2 倍速的正常播放。
- 网络中断后的片段按账号缓存在本机，下次进入课程或学习中心尝试补传。必须先联网取得观看会话；会话有效期 24 小时，超过时限、视频更新或课程下架的记录不再接受。关闭程序前未保存的最后几秒可能需要重看。
- 游客可看初级课，进度只保存在本机，不发放完成积分，也不会自动归入后来登录的账号。
- 后台保存时通过视频元数据自动读取时长，无需手填。建议使用 MP4 地址；如果浏览器无法解析 M3U8，则改用 VOD 的 MP4 播放地址。读取失败会保留输入并阻止保存。历史课程重新保存即可更新时长。播放器检测到实际时长和配置相差超过 2 秒或 2% 时，会提示核对，并暂停计入进度，防止提前完成。
- 视频地址路径或时长变化会启动新的进度版本；只更换签名查询参数不重置。保留以前手动完成的历史记录，历史观看秒数不会凭空补齐。
- 系列完成要求当前上架视频均完成、当前上架测验均通过；“我的学习”可推荐下一项测验，不再推荐下架内容。

这套机制用于学习辅助和普通积分，不等同于考勤或防作弊认证。客户端事件和服务端时间校验不能证明用户真正专心观看，不能直接作为高价值奖励的唯一依据。

开发环境已有服务运行时，新增数据库字段需要执行一次迁移（只刷新 Node 进程不会运行迁移）：

```sh
docker exec cotton-app node db/migrate_academy.js
```

本地回归测试：

```sh
node cotton-app/server/tests/academy-management.test.js
node cotton-app/server/tests/academy-workflow.test.js
node cotton-community/tests/academy-admin-actions.test.js
node cotton-app/server/tests/academy-watch.test.js
node cotton-app/server/tests/learning-center.test.js
docker exec -e RUN_ACADEMY_WATCH_DB_TEST=1 cotton-app node tests/academy-watch-db.test.js
```
