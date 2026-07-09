# 棉花智能体 · 接口文档

> 本文档记录所有后端 API 接口，包含认证、商品和管理后台三个模块。
> 最后更新：2026-07-09

---

## 基本信息

| 项目 | 说明 |
|------|------|
| 开发环境 Base URL | `http://192.168.0.25:3000`（局域网真机）或 `http://localhost:3000`（模拟器） |
| 认证方式 | `Authorization: Bearer <token>`（JWT，有效期 7 天） |
| 请求格式 | `Content-Type: application/json` |
| 响应格式 | 统一 JSON，字段：`code / msg / data` |

---

## 通用响应格式

```json
{
  "code": 200,
  "msg":  "成功",
  "data": { ... }
}
```

## 错误码

| code | 含义 |
|------|------|
| 200  | 成功 |
| 400  | 参数错误（缺字段、格式错误） |
| 401  | 未登录或 Token 失效/过期 |
| 403  | 权限不足（角色不匹配或非管理员） |
| 404  | 资源不存在 |
| 500  | 服务器内部错误 |

---

## 一、认证模块 `/api/auth`

### 1.1 注册

**POST** `/api/auth/register`

> 小程序注册，当前仅支持农户（`role: "farmer"`）；商户由管理员在后台操作。

**请求体（农户）：**
```json
{
  "phone":     "13800000001",
  "password":  "abc123",
  "role":      "farmer",
  "real_name": "古丽巴哈尔",
  "location":  "喀什·疏附县",
  "land_size": 486,
  "crop_type": "棉花"
}
```

**成功响应 200：**
```json
{
  "code": 200,
  "msg":  "注册成功",
  "data": {
    "token":     "eyJhbGciOiJIUzI1NiIs...",
    "role":      "farmer",
    "real_name": "古丽巴哈尔"
  }
}
```

**失败示例：**
```json
{ "code": 400, "msg": "该手机号已注册" }
```

---

### 1.2 登录

**POST** `/api/auth/login`

**请求体：**
```json
{ "phone": "13800000001", "password": "abc123" }
```

**成功响应 200（农户）：**
```json
{
  "code": 200,
  "msg":  "登录成功",
  "data": {
    "token":     "eyJhbGciOiJIUzI1NiIs...",
    "role":      "farmer",
    "real_name": "古丽巴哈尔",
    "location":  "喀什·疏附县",
    "land_size": 486,
    "crop_type": "棉花"
  }
}
```

**成功响应 200（商户）：**
```json
{
  "code": 200,
  "msg":  "登录成功",
  "data": {
    "token":        "eyJhbGciOiJIUzI1NiIs...",
    "role":         "merchant",
    "real_name":    "阿里木",
    "company_name": "疏附县农资有限公司"
  }
}
```

---

### 1.3 验证 Token

**GET** `/api/auth/verify`

**请求头：** `Authorization: Bearer <token>`

**成功响应 200：**
```json
{
  "code": 200,
  "msg":  "ok",
  "data": {
    "id":          1,
    "phone":       "138****0001",
    "role":        "farmer",
    "real_name":   "古丽巴哈尔",
    "is_verified": 0,
    "location":    "喀什·疏附县",
    "land_size":   486
  }
}
```

**Token 过期 401：**
```json
{ "code": 401, "msg": "登录已过期，请重新登录", "data": null }
```

---

### 1.4 登出

**POST** `/api/auth/logout`

**请求头：** `Authorization: Bearer <token>`

> 服务端无状态，前端收到响应后清除本地 token 即可。

**成功响应 200：**
```json
{ "code": 200, "msg": "已退出登录" }
```

---

## 二、商品模块 `/api/products`

### 2.1 获取所有在售商品（公开）

**GET** `/api/products`

> 农户端农资商城调用，无需登录。返回所有 `status=on` 的商品，含商家名称。

**成功响应 200：**
```json
{
  "code": 200,
  "data": [
    {
      "id":           1,
      "merchant_id":  1,
      "name":         "新疆优质棉花种子",
      "category":     "种子化肥",
      "price":        "128.00",
      "unit":         "袋（5kg）",
      "stock":        500,
      "status":       "on",
      "icon":         "🌱",
      "company_name": "疏附县鑫农农资有限公司"
    }
  ]
}
```

---

### 2.2 获取本店商品（商户）

**GET** `/api/products/mine`

**请求头：** `Authorization: Bearer <token>`（需 `role=merchant`）

**查询参数（可选）：** `?status=on` 或 `?status=off`

**成功响应 200：**
```json
{
  "code": 200,
  "data": [ { "id": 1, "name": "...", "status": "on", ... } ]
}
```

---

### 2.3 上架商品（商户）

**POST** `/api/products`

**请求头：** `Authorization: Bearer <token>`（需 `role=merchant`）

**请求体：**
```json
{
  "name":     "高效棉花脱叶剂",
  "category": "农药",
  "price":    89.9,
  "unit":     "瓶（500ml）",
  "stock":    200,
  "icon":     "🧴"
}
```

**成功响应 200：**
```json
{ "code": 200, "msg": "商品已上架", "data": { "id": 7 } }
```

---

### 2.4 编辑商品（商户）

**PUT** `/api/products/:id`

**请求头：** `Authorization: Bearer <token>`（需 `role=merchant`，且为本店商品）

**请求体（同上架，字段可选）：**
```json
{ "price": 79.9, "stock": 150 }
```

**成功响应 200：**
```json
{ "code": 200, "msg": "商品已更新" }
```

---

### 2.5 切换上架/下架状态（商户）

**PATCH** `/api/products/:id/status`

**请求头：** `Authorization: Bearer <token>`（需 `role=merchant`）

**请求体：**
```json
{ "status": "off" }
```
> `status` 取值：`"on"` 上架 | `"off"` 下架

**成功响应 200：**
```json
{ "code": 200, "msg": "已下架" }
```

---

### 2.6 删除商品（商户）

**DELETE** `/api/products/:id`

**请求头：** `Authorization: Bearer <token>`（需 `role=merchant`，且为本店商品）

**成功响应 200：**
```json
{ "code": 200, "msg": "已删除" }
```

---

## 三、管理后台模块 `/api/admin`

> 所有接口（除登录外）需在请求头携带管理员 Token。
> 管理员 Token 通过 `/api/admin/login` 获取，与普通用户 Token 独立校验（需 `is_admin=1`）。

### 3.1 管理员登录

**POST** `/api/admin/login`

**请求体：**
```json
{ "phone": "10000000000", "password": "Admin@Cotton2026" }
```

**成功响应 200：**
```json
{
  "code": 200,
  "msg":  "登录成功",
  "data": {
    "token":     "eyJhbGciOiJIUzI1NiIs...",
    "real_name": "系统管理员"
  }
}
```

**失败 403：**
```json
{ "code": 403, "msg": "该账号无管理员权限" }
```

---

### 3.2 数据统计概览

**GET** `/api/admin/stats`

**请求头：** `Authorization: Bearer <admin_token>`

**成功响应 200：**
```json
{
  "code": 200,
  "data": {
    "totalUsers":     10,
    "totalFarmers":   7,
    "totalMerchants": 3,
    "totalProducts":  24,
    "onSaleProducts": 18
  }
}
```

---

### 3.3 农户列表

**GET** `/api/admin/farmers`

**请求头：** `Authorization: Bearer <admin_token>`

**成功响应 200：**
```json
{
  "code": 200,
  "data": [
    {
      "id":          1,
      "phone":       "13800000001",
      "real_name":   "古丽巴哈尔",
      "is_verified": 0,
      "is_active":   1,
      "created_at":  "2026-05-25T10:00:00.000Z",
      "location":    "喀什·疏附县",
      "land_size":   "486.00",
      "crop_type":   "棉花"
    }
  ]
}
```

---

### 3.4 商户列表

**GET** `/api/admin/merchants`

**请求头：** `Authorization: Bearer <admin_token>`

**成功响应 200：**
```json
{
  "code": 200,
  "data": [
    {
      "id":               2,
      "phone":            "13800000002",
      "real_name":        "阿里木",
      "is_active":        1,
      "created_at":       "2026-05-25T10:00:00.000Z",
      "company_name":     "疏附县农资有限公司",
      "business_license": "91650100TEST0001",
      "product_category": "化肥、农药",
      "product_count":    12
    }
  ]
}
```

---

### 3.5 全量商品列表

**GET** `/api/admin/products`

**请求头：** `Authorization: Bearer <admin_token>`

**成功响应 200：**
```json
{
  "code": 200,
  "data": [
    {
      "id":           1,
      "merchant_id":  1,
      "name":         "新疆优质棉花种子",
      "category":     "种子化肥",
      "price":        "128.00",
      "unit":         "袋（5kg）",
      "stock":        500,
      "status":       "on",
      "icon":         "🌱",
      "company_name": "疏附县鑫农农资有限公司"
    }
  ]
}
```

---

### 3.6 启用 / 禁用账号

**PATCH** `/api/admin/users/:id/status`

**请求头：** `Authorization: Bearer <admin_token>`

**请求体：**
```json
{ "is_active": false }
```
> `is_active: true` → 启用；`is_active: false` → 禁用

**成功响应 200：**
```json
{ "code": 200, "msg": "已禁用账号" }
```

---

### 3.7 编辑农户信息

**PUT** `/api/admin/farmers/:id`

**请求头：** `Authorization: Bearer <admin_token>`

**请求体（字段均可选）：**
```json
{
  "real_name":   "古丽巴哈尔",
  "location":    "喀什·疏附县",
  "land_size":   500,
  "crop_type":   "棉花",
  "is_verified": true
}
```

**成功响应 200：**
```json
{ "code": 200, "msg": "农户信息已更新" }
```

---

### 3.8 编辑商户信息

**PUT** `/api/admin/merchants/:id`

**请求头：** `Authorization: Bearer <admin_token>`

**请求体：**
```json
{
  "real_name":        "阿里木",
  "company_name":     "疏附县农资有限公司",
  "business_license": "91650100XXXXXXXXXX",
  "product_category": "化肥、农药",
  "is_verified":      true
}
```

**成功响应 200：**
```json
{ "code": 200, "msg": "商户信息已更新" }
```

---

### 3.9 编辑商品信息

**PUT** `/api/admin/products/:id`

**请求头：** `Authorization: Bearer <admin_token>`

**请求体：**
```json
{
  "name":     "高效棉花脱叶剂",
  "category": "农药",
  "icon":     "🧴",
  "price":    79.9,
  "unit":     "瓶（500ml）",
  "stock":    200,
  "status":   "on"
}
```

**成功响应 200：**
```json
{ "code": 200, "msg": "商品信息已更新" }
```

---

### 3.10 待审批商户列表

**GET** `/api/admin/applications`

**请求头：** `Authorization: Bearer <admin_token>`

**成功响应 200：**
```json
{
  "code": 200,
  "data": [
    {
      "id":               5,
      "phone":            "13700000001",
      "real_name":        "买买提",
      "company_name":     "莎车县绿源农资店",
      "business_license": "",
      "product_category": "化肥",
      "apply_status":     "pending",
      "created_at":       "2026-05-25T12:00:00.000Z"
    }
  ]
}
```

---

### 3.11 批准入驻申请

**POST** `/api/admin/applications/:id/approve`

**请求头：** `Authorization: Bearer <admin_token>`

**成功响应 200：**
```json
{ "code": 200, "msg": "已批准入驻申请" }
```

---

### 3.12 拒绝入驻申请

**POST** `/api/admin/applications/:id/reject`

**请求头：** `Authorization: Bearer <admin_token>`

**请求体：**
```json
{ "reason": "营业执照信息不完整，请补充后重新申请" }
```

**成功响应 200：**
```json
{ "code": 200, "msg": "已拒绝入驻申请" }
```

---

### 3.13 商户提交入驻申请（公开）

**POST** `/api/admin/apply`

> 商户自助申请入驻，无需登录。申请后 `apply_status=pending`，需等待管理员审批。
> 入口页面：`http://localhost:3000/admin/merchant-apply.html`

**请求体：**
```json
{
  "phone":            "13700000001",
  "password":         "abc123",
  "real_name":        "买买提",
  "company_name":     "莎车县绿源农资店",
  "business_license": "91650100XXXXXXXXXX",
  "product_category": "化肥、种子"
}
```

**成功响应 200：**
```json
{ "code": 200, "msg": "申请已提交，请等待管理员审核（1-3个工作日）" }
```

**失败 400（手机号已注册）：**
```json
{ "code": 400, "msg": "该手机号已注册" }
```

---

## 四、地块气象模块 `/api/weather`

> 地块气象不再使用本地模拟数据，也不再把区域气象站作为地块天气主数据。
> 后端默认使用和风天气 QWeather 格点天气接口，根据地块边界中心点经纬度请求实时天气、7 日预报和逐小时预报。和风格点接口未返回的地温、紫外线、能见度会显示为不可用，不再本地估算；如果真实接口失败，接口直接返回失败。`WEATHER_PROVIDER=open-meteo-cma` 仅作为旧数据源备用。
> 生产环境需要配置 `QWEATHER_API_HOST`，并在 `QWEATHER_API_KEY` 或 `QWEATHER_JWT_*` 中选择一种认证方式。
> 该接口需要农户登录态，且地块必须存在边界坐标。

### 4.1 获取指定地块天气

**GET** `/api/weather/plot/:id`

**请求头：** `Authorization: Bearer <token>`

**成功响应 200：**
```json
{
  "code": 200,
  "msg": "天气获取成功",
  "data": {
    "plot": {
      "id": 1,
      "name": "3号地",
      "area": 56.8
    },
    "center": {
      "latitude": 39.3801,
      "longitude": 75.8602
    },
    "weather": {
      "provider": "qweather",
      "source": "abc1234xyz.qweatherapi.com",
      "model": "QWeather Grid Weather",
      "current": { ... },
      "hourly": { ... },
      "forecast": {
        "daily": [ ... ]
      }
    }
  }
}
```

**失败 400：**
```json
{ "code": 400, "msg": "地块暂无边界数据", "data": null }
```

---

## 五、AI 问答模块 `/api/ai`

### 5.1 文字问答 / 指令识别

**POST** `/api/ai/chat`

**请求体：**
```json
{
  "message": "我要卖棉花",
  "displayMessage": "我要卖棉花",
  "language": "zh",
  "history": [
    { "role": "user", "content": "今天能打药吗" },
    { "role": "assistant", "content": "需要先看风力和降水。" }
  ]
}
```

**成功响应 200：**
```json
{
  "code": 200,
  "data": {
    "reply": "我这就打开「棉花交易」。如果没有自动进入，点下面的入口也能进。",
    "intent": { "key": "trade", "jump": { "...": "..." } },
    "jump": {
      "key": "trade",
      "icon": "💰",
      "title": "棉花交易",
      "desc": "查看收购价并发布卖棉需求",
      "url": "/pages/trade/index",
      "method": "navigateTo",
      "autoOpen": true
    },
    "provider": "local-intent"
  }
}
```

> 如果已配置 `DEEPSEEK_API_KEY`、`GROQ_API_KEY` 或 `SILICONFLOW_API_KEY`，普通农技问题会代理到真实 AI 服务；文字问答优先使用 DeepSeek，图片视觉分析仍需要 Siliconflow。如果未配置 Key，确定性的功能指令仍会返回本地 `jump` 卡片，普通问答会提示未配置 AI Key，不会伪装成真实 AI。

### 5.2 图片分析

**POST** `/api/ai/photo`

`multipart/form-data`，字段名：`photo`。图片视觉分析需要 `SILICONFLOW_API_KEY`。

---

## 六、前端接入示例

### 小程序（`utils/auth.js` 封装）

```js
const auth = require('../../utils/auth')

// 农户登录
const res = await auth.login('13800000001', 'test123')
if (res.code === 200) {
  getApp().globalData.user = res.data
  wx.reLaunch({ url: '/pages/index/index' })
}

// 需要鉴权的接口（自动带 Token）
const products = await auth.request('GET', '/api/products/mine')

// 需要登录保护的页面
onShow() {
  if (!auth.requireLogin()) return
}

// 退出登录
auth.logout()
```

### 网页管理后台（原生 fetch）

```js
// 管理员登录
const res = await fetch('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '10000000000', password: 'Admin@Cotton2026' })
})
const { data } = await res.json()
localStorage.setItem('admin_token', data.token)

// 调用管理接口
const r = await fetch('/api/admin/merchants', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') }
})
```

---

## 七、测试账号

| 角色 | 手机号 | 密码 | 用途 |
|------|--------|------|------|
| 农户 | `13800000001` | `test123` | 小程序登录测试 |
| 商户 | `13800000002` | `test123` | 商户 API 测试 |
| 商户 | `13900000001` | `merchant123` | 商户 API 测试 |
| 管理员 | `10000000000` | `Admin@Cotton2026` | 网页后台登录 |

---

## 近期更新（2026-07-09）

### 地理位置天气

**GET** /api/weather/location?lat=<纬度>&lng=<经度>

- 用途：按当前位置经纬度获取真实天气，用于首页天气卡片。
- 鉴权：无需登录。
- 成功返回：location + center + weather。
- 失败说明：上游天气服务不可用时，接口可能返回 503。

**成功示例**
```json
{
  "code": 200,
  "msg": "天气获取成功",
  "data": {
    "center": { "latitude": 39.47, "longitude": 75.99 },
    "location": {
      "name": "喀什地区",
      "inService": true,
      "distance_km": 2.1
    },
    "weather": { }
  }
}
```

### 病虫害图片识别

**POST** /api/ai/photo

- 用途：上传病虫害图片并返回结构化识别结果。
- 请求格式：multipart/form-data
- 文件字段：photo
- 鉴权：当前前端按已登录场景接入，服务端会保存识别图片并返回结构化诊断。
- 说明：文字问答 /api/ai/chat 继续走文本模型；图片识别单独走视觉模型。

**成功返回字段重点**
- image：识别后保存的图片地址
- diagnosis_name：诊断名称
- category / category_code：病害分类
- severity / severity_code：严重程度
- confidence / confidence_code：置信度
- summary：一句话结论
- symptoms / evidence / actions / products / warning：结构化识别结果

**成功示例**
```json
{
  "code": 200,
  "msg": "识别成功",
  "data": {
    "image": "/uploads/pest/pest-xxx.jpg",
    "diagnosis_name": "棉铃虫为害",
    "category": "虫害",
    "category_code": "pest",
    "severity": "中度",
    "confidence": "中",
    "summary": "图片中可见虫体和棉铃受害痕迹。",
    "symptoms": ["棉铃表面受损"],
    "evidence": ["可见虫体"],
    "actions": ["优先复查周边棉株"],
    "products": [],
    "warning": ""
  }
}
```
