# 喀什优棉公益平台小程序

`cotton-public` 是面向棉农的公益农技学习与生产服务小程序。项目以 `demo/index.html` 为产品和视觉参考，复用 `cotton-app` 已验证的农业生产功能，并通过同一套 Node.js + Express + MySQL 后端读取用户、地块、气象、农事记录、专家内容和 AI 数据。

公益管理员统一从 `/admin/login.html?role=admin` 登录。后台左侧包含“政策中心”和“账号安全”；退出后返回统一登录页，旧的公益运营独立登录页已删除。

## 当前迁移范围

- 公益平台新首页：顶部当前位置天气与农事提示；常用工具集中展示地块管理、病虫害识别、地块气象、政策中心、专家讲堂、农事记录和棉知学堂。
- 棉花资讯：推荐、政策、农技、市场、气象分类列表。
- 政策中心：首页常用工具入口，支持政策搜索、行政层级与类别筛选、申报提醒、详情、材料清单和办理流程。
- 棉知学堂：初级、中级、高级阶梯课程，支持图文课、视频课、课程积分和阶段考试。
- 地块管理：列表、地图绘制、新增地块、地块详情。
- 病虫害识别：拍照/相册识别、识别结果和病虫害详情。
- 地块气象：按用户地块读取气象和农事建议。
- 专家讲堂：专家内容、视频/图文内容、常见问题和在线提问。
- 农事记录：记录列表、增删改和独立农事日历。
- AI 农技问答、手机号登录及微信一键登录基础页面。

底部导航为“首页 / AI助手 / 我的”。棉知学堂不占用底部导航，继续从首页常用工具进入。首页天气使用定位接口读取真实数据；用户拒绝定位或网络不可用时只展示降级提示。

公益小程序拥有独立、可扩展的管理后台，当前首个模块为政策中心。管理员从统一入口 `/admin/login.html?role=admin` 登录，系统按账号类型自动进入公益小程序后台；可以使用 Markdown 编辑、实时预览、保存草稿和发布。小程序通过 `/api/policies` 读取已发布文章。创建账号和部署步骤见 `cotton-community/README.md`。

农资商城、农机租赁、棉花交易、贷款、保险、商户后台和支付能力不属于公益平台首批范围。

## 目录说明

```text
cotton-public/
├─ app.js / app.json / app.wxss   小程序入口与全局样式
├─ project.config.json            微信开发者工具项目配置
├─ pages/
│  ├─ index/                      公益平台首页
│  ├─ news/                       棉花资讯
│  ├─ policy/                     政策中心列表与详情
│  ├─ academy/                    棉知学堂、课程、考试
│  ├─ fields/                     地块管理（迁移自 cotton-app）
│  ├─ pest/                       病虫害识别（迁移自 cotton-app）
│  ├─ weather/                    地块气象（迁移自 cotton-app）
│  ├─ expert/                     专家讲堂（迁移自 cotton-app）
│  ├─ records/                    农事记录与独立日历
│  ├─ ai/                         AI 农技问答
│  ├─ login/                      登录
│  └─ my/                         个人中心
├─ utils/                         API、身份认证、气象和页面工具
├─ components/                    公共组件
├─ images/                        Demo 迁入的课程及资讯素材
└─ demo/                          原 HTML 交互 Demo，保留作设计参考
```

## 与 cotton-app 共用后端

小程序不会在本目录启动第二套后端。API 地址由 `utils/auth.js` 管理，当前沿用 `cotton-app` 的环境配置：

- `prod`：正式 HTTPS 域名。
- `server`：云服务器 IP。
- `real`：局域网开发机地址，适合真机联调。
- `local`：`127.0.0.1`，适合微信开发者工具模拟器。

当前 `ENV` 设置为 `server`，小程序直接连接云服务器 `http://101.34.207.252`。微信开发者工具调试时需要按项目需要开启“不校验合法域名”；该 HTTP IP 不能作为正式发布配置，正式上传前必须改用已备案且配置 HTTPS 的合法域名。

开发前请在 `utils/auth.js` 中确认 `ENV` 与对应地址。真机不能把 `127.0.0.1` 当作电脑；应使用电脑局域网 IP，并确保手机与电脑处于同一网络、防火墙允许 Node 服务端口。

后端仍从 `F:\cotton\cotton-app\server` 启动。首次更新或新增数据库迁移后先执行迁移：

```powershell
cd F:\cotton\cotton-app\server
npm install
npm run migrate:runtime
npm start
```

前端不需要执行 `npm start`，直接用微信开发者工具导入 `F:\cotton\cotton-public`。

修改认证后端代码后，必须重启正在运行的 Node 服务才能加载新代码。PowerShell 如果禁止执行 `npm.ps1`，请使用：

```powershell
npm.cmd run migrate:runtime
npm.cmd start
```

认证专项测试：

```powershell
cd F:\cotton\cotton-app\server
npm.cmd run test:public-auth
```

当前本地真机联调地址为 `http://192.168.0.22:3000`。可以先在同一 Wi-Fi 下用手机访问或通过小程序请求 `/api/ping`；响应中的 `database: true` 表示共享 MySQL 已连接。电脑网络切换后 IP 可能改变，需要同步更新 `utils/auth.js` 的 `LOCAL_IP`。

## 首次打开

1. 打开微信开发者工具，选择“导入项目”。
2. 目录选择 `F:\cotton\cotton-public`。
3. `project.config.json` 必须填写实际用于调试的微信小程序 AppID；微信一键登录要求它与后端对应的 AppID 配置一致。
4. 本地调试可在“详情 → 本地设置”暂时勾选“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。正式发布时必须配置合法 HTTPS request/uploadFile 域名。
5. 确认 `cotton-app` 后端与 MySQL 已启动，再测试登录、地块、气象、农事记录和专家接口。

## 新 AppID 与共用账号的注意事项

不同微信小程序的 OpenID 不相同。共享后端现在支持主小程序和公益小程序两套微信配置：

```env
WX_APPID=原小程序AppID
WX_SECRET=原小程序AppSecret
PUBLIC_WX_APPID=公益小程序AppID
PUBLIC_WX_SECRET=公益小程序AppSecret
```

如果暂时没有配置 `PUBLIC_WX_APPID` 和 `PUBLIC_WX_SECRET`，公益前端会回退使用原小程序配置，便于使用同一个 AppID 联调。换成独立 AppID 后必须填写公益配置并重启后端。

公益小程序发送 `X-Miniapp-Client: cotton-public`，后端据此选择微信配置。手机号账号仍保存在共享 `users` 表；不同小程序的 OpenID 保存在 `mini_program_identities` 表，该表通过无符号用户 ID 外键连接现有用户数据。同一微信开放平台主体下如能取得 UnionID，后端优先将身份关联到已有用户；否则通过授权手机号关联共享账号。

### 注册登录接口

| 功能 | 接口 | 说明 |
| --- | --- | --- |
| 手机号注册 | `POST /api/auth/register` | 创建共享农户账号和农户资料并返回 JWT |
| 密码登录 | `POST /api/auth/login` | 按手机号和密码登录共享账号 |
| 微信一键登录 | `POST /api/auth/wx-login` | `wx.login` + 微信手机号授权，自动注册或关联农户 |
| 登录态校验 | `GET /api/auth/verify` | 小程序启动时验证 JWT 并刷新用户资料 |
| 退出登录 | `POST /api/auth/logout` | 客户端清理 JWT；服务端保留无状态接口 |

## 数据边界

- 共用：农户基础账号、地块、农事记录、气象、专家内容、AI 服务。
- 公益平台独有：资讯栏目、课程体系、学习进度、考试、学习积分和证书。
- 不进入公益平台：商品、营销、交易订单、农机支付、微信分账和商户结算。

目前课程与资讯使用前端演示数据，用于确定信息架构和交互。下一阶段应在共享后端增加公益内容 API 和独立数据表，避免把正式运营内容长期写在小程序代码中。

政策中心当前同样使用明确标识的演示数据。正式上线政策内容前，必须建立政策运营后台和审核流程，并保存政策层级、类别、文号、发布单位、发布时间、生效状态、适用地区、申报截止时间及政府原文链接。

## 后续开发顺序

1. 在 `cotton-app/server/.env` 填写公益小程序 AppID 和 AppSecret。
2. 运行共享后端数据库迁移并完成微信一键登录真机验收。
3. 建立资讯、课程、章节、进度、考试、积分和证书数据表及运营 API。
4. 将当前课程和资讯演示数据切换为真实接口。
5. 完成真机定位、图片上传、AI 识别和全流程回归测试。

## 修改记录要求

所有后续代码修改必须同时更新根目录 `CHANGELOG.md` 和本 README。修改记录至少包括日期、改动模块、数据库迁移、配置变化和验证结果。

## 安全要求

- AppSecret、JWT_SECRET、AI Key、天气 Key 只能保存在后端 `.env`，不得写进小程序。
- 小程序只保存服务端签发的 Token。
- 正式环境必须使用 HTTPS，并在微信公众平台配置合法域名。
- 两个前端共用后端不等于共用所有权限；后端仍需对用户和资源归属进行校验。
- 当前 `F:\cotton` 的运行配置已与服务器备份的同名变量同步，本地启动后端可能直接连接线上数据库和服务；执行注册、删除、支付、迁移或测试数据脚本前必须先确认影响范围。
- 同步前的本地配置备份位于 `F:\cotton-history\local-env-before-server-sync-20260807`，真实 `.env` 不得提交到 GitHub。
