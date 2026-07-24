const crypto = require('crypto')
const db = require('../db/database')

const ACTION_LABELS = Object.freeze({
  100001: '已揽收',
  100002: '揽收失败',
  100003: '等待揽收',
  200001: '运输中',
  300001: '派送中',
  300002: '派送中',
  300003: '已签收',
  300004: '签收失败',
  400001: '已取消',
  400002: '物流异常'
})

let tokenCache = { value: '', expiresAt: 0 }

function getConfig(env = process.env) {
  return {
    appid: String(env.WX_APPID || '').trim(),
    secret: String(env.WX_SECRET || '').trim(),
    timeoutMs: Math.max(3000, Number(env.WECHAT_LOGISTICS_TIMEOUT_MS) || 10000),
    senderName: String(env.WECHAT_LOGISTICS_SENDER_NAME || '').trim(),
    senderMobile: String(env.WECHAT_LOGISTICS_SENDER_MOBILE || '').trim(),
    senderCompany: String(env.WECHAT_LOGISTICS_SENDER_COMPANY || '').trim(),
    senderAddress: String(env.WECHAT_LOGISTICS_SENDER_ADDRESS || '').trim(),
    defaultWeight: Math.max(0.1, Number(env.WECHAT_LOGISTICS_DEFAULT_WEIGHT_KG) || 1),
    defaultSize: Math.max(1, Number(env.WECHAT_LOGISTICS_DEFAULT_SIZE_CM) || 20)
  }
}

function isConfigured(env = process.env) {
  const cfg = getConfig(env)
  return Boolean(cfg.appid && cfg.secret)
}

async function fetchJson(url, options = {}, timeoutMs = getConfig().timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.headers || {}) }
    })
    const text = await response.text()
    let payload
    try { payload = JSON.parse(text) } catch { throw new Error(`微信物流接口返回非 JSON 数据（HTTP ${response.status}）`) }
    if (!response.ok) throw new Error(payload.errmsg || `微信物流接口 HTTP ${response.status}`)
    return payload
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('微信物流接口响应超时')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function getAccessToken(env = process.env, force = false) {
  const cfg = getConfig(env)
  if (!cfg.appid || !cfg.secret) throw new Error('微信小程序 AppID 或 AppSecret 未配置')
  if (!force && tokenCache.value && Date.now() < tokenCache.expiresAt) return tokenCache.value
  const query = new URLSearchParams({
    grant_type: 'client_credential', appid: cfg.appid, secret: cfg.secret
  })
  const payload = await fetchJson(`https://api.weixin.qq.com/cgi-bin/token?${query}`, {}, cfg.timeoutMs)
  if (payload.errcode || !payload.access_token) throw new Error(`获取微信 access_token 失败：${payload.errmsg || payload.errcode}`)
  tokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 7200) - 300) * 1000
  }
  return tokenCache.value
}

async function wechatRequest(path, { method = 'POST', body, env = process.env } = {}) {
  const call = async force => {
    const token = await getAccessToken(env, force)
    const url = `https://api.weixin.qq.com${path}?access_token=${encodeURIComponent(token)}`
    const options = { method }
    if (body !== undefined) {
      options.headers = { 'Content-Type': 'application/json; charset=utf-8' }
      options.body = JSON.stringify(body)
    }
    return fetchJson(url, options, getConfig(env).timeoutMs)
  }
  let payload = await call(false)
  if ([40001, 40014, 42001].includes(Number(payload.errcode))) payload = await call(true)
  if (payload.errcode) throw new Error(`微信物流接口失败（${payload.errcode}）：${payload.errmsg || '未知错误'}`)
  if (payload.delivery_resultcode && Number(payload.delivery_resultcode) !== 0) {
    throw new Error(`快递公司下单失败（${payload.delivery_resultcode}）：${payload.delivery_resultmsg || '未知错误'}`)
  }
  return payload
}

function normalizeServices(source = []) {
  return (Array.isArray(source) ? source : []).map(item => ({
    service_type: Number(item.service_type ?? item.type ?? 0),
    service_name: String(item.service_name || item.name || '标准快递')
  }))
}

async function listDeliveryAccounts(env = process.env) {
  const [accountsPayload, deliveryPayload] = await Promise.all([
    wechatRequest('/cgi-bin/express/business/account/getall', { method: 'GET', env }),
    wechatRequest('/cgi-bin/express/business/delivery/getall', { method: 'GET', env })
  ])
  const accounts = accountsPayload.list || accountsPayload.data || []
  const deliveries = deliveryPayload.data || deliveryPayload.list || deliveryPayload.delivery_list || []
  const deliveryMap = new Map(deliveries.map(item => [String(item.delivery_id), item]))
  return accounts
    .filter(item => Number(item.status_code || 0) === 0)
    .map(item => {
      const delivery = deliveryMap.get(String(item.delivery_id)) || {}
      const services = normalizeServices(item.service_type?.length ? item.service_type : delivery.service_type)
      return {
        code: String(item.delivery_id),
        delivery_id: String(item.delivery_id),
        biz_id: String(item.biz_id),
        name: String(delivery.delivery_name || item.alias || item.delivery_id),
        alias: String(item.alias || ''),
        quota_num: Number(item.quota_num || 0),
        services: services.length ? services : [{ service_type: 0, service_name: '标准快递' }]
      }
    })
}

function splitAddress(value) {
  const address = String(value || '').trim()
  const province = address.match(/^(.*?(?:省|自治区|北京市|上海市|天津市|重庆市))/)?.[1] || ''
  const remaining = province ? address.slice(province.length) : address
  const city = remaining.match(/^(.*?(?:市|地区|自治州))/)?.[1] || ''
  const afterCity = city ? remaining.slice(city.length) : remaining
  const area = afterCity.match(/^(.*?(?:县|区|市))/)?.[1] || ''
  return { country: '中国', province, city, area, address }
}

function logisticsOrderId(order) {
  return `COTTON_${order.order_no || order.id}_${order.merchant_id || ''}`.slice(0, 128)
}

function buildWaybillPayload(order, account, service, env = process.env) {
  const cfg = getConfig(env)
  const senderAddress = order.sender_address || cfg.senderAddress
  const senderMobile = order.sender_mobile || cfg.senderMobile
  const senderName = order.sender_name || cfg.senderName
  if (!order.openid) throw new Error('农户账号尚未绑定微信 OpenID，无法发送微信物流通知')
  if (!senderName || !senderMobile || !senderAddress) {
    throw new Error('发件人姓名、手机号或地址不完整，请先完善店铺地址或微信物流默认发件信息')
  }
  const items = Array.isArray(order.items) ? order.items : []
  const goodsCount = items.reduce((sum, item) => sum + Number(item.qty || 0), 0) || 1
  const goodsName = items.map(item => item.name).filter(Boolean).join('、').slice(0, 128) || '农资商品'
  return {
    add_source: 0,
    order_id: logisticsOrderId(order),
    openid: order.openid,
    delivery_id: account.delivery_id,
    biz_id: account.biz_id,
    custom_remark: String(order.note || '').slice(0, 1024),
    sender: {
      name: String(senderName).slice(0, 64),
      mobile: String(senderMobile).slice(0, 32),
      company: String(order.sender_company || cfg.senderCompany || '').slice(0, 64),
      ...splitAddress(senderAddress)
    },
    receiver: {
      name: String(order.receiver_name || '').slice(0, 64),
      mobile: String(order.receiver_phone || '').slice(0, 32),
      ...splitAddress(order.address)
    },
    cargo: {
      count: 1,
      weight: cfg.defaultWeight,
      space_x: cfg.defaultSize,
      space_y: cfg.defaultSize,
      space_z: cfg.defaultSize,
      detail_list: items.slice(0, 20).map(item => ({
        name: String(item.name || '农资商品').slice(0, 128), count: Number(item.qty || 1)
      }))
    },
    shop: {
      wxa_path: `/subpkg-supplies/supplies-order/index?id=${order.id}`,
      goods_name: goodsName,
      goods_count: goodsCount
    },
    insured: { use_insured: 0, insured_value: 0 },
    service: {
      service_type: Number(service.service_type),
      service_name: String(service.service_name)
    },
    expect_time: 0
  }
}

async function createWaybill(order, account, service, env = process.env) {
  const request = buildWaybillPayload(order, account, service, env)
  const result = await wechatRequest('/cgi-bin/express/business/order/add', { body: request, env })
  if (!result.waybill_id) throw new Error('微信物流助手未返回运单号')
  return { request, result }
}

function formatDateTime(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 19)
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function normalizePath(payload = {}) {
  const source = payload.path_item_list || []
  const events = source.map(item => ({
    time: item.action_time ? formatDateTime(new Date(Number(item.action_time) * 1000)) : '',
    timestamp: Number(item.action_time || 0),
    context: String(item.action_msg || ''),
    status: ACTION_LABELS[Number(item.action_type)] || '物流更新',
    statusCode: String(item.action_type || ''),
    location: '', areaName: ''
  })).filter(item => item.context).sort((a, b) => b.timestamp - a.timestamp)
  const latest = events[0] || null
  return {
    company: String(payload.delivery_id || ''),
    number: String(payload.waybill_id || ''),
    state: latest?.statusCode || '',
    stateLabel: latest?.status || '等待物流更新',
    latest,
    events
  }
}

async function saveTrackResult(orderId, payload, { queried = false } = {}) {
  const normalized = normalizePath(payload)
  for (const event of normalized.events) {
    const eventHash = crypto.createHash('md5').update(`${orderId}|${event.time}|${event.context}`, 'utf8').digest('hex')
    await db.query(
      `INSERT IGNORE INTO order_logistics_events
       (order_id,event_hash,event_time,status,status_code,location,area_name,context)
       VALUES (?,?,?,?,?,?,?,?)`,
      [orderId, eventHash, event.time || null, event.status, event.statusCode, '', '', event.context]
    )
  }
  await db.query(
    `UPDATE orders SET logistics_state=?, logistics_status=?, logistics_latest=?,
       logistics_updated_at=NOW(), logistics_queried_at=IF(?, NOW(), logistics_queried_at),
       logistics_error='', logistics_raw=? WHERE id=?`,
    [normalized.state, normalized.stateLabel, normalized.latest?.context || '', queried ? 1 : 0,
      JSON.stringify(payload), orderId]
  )
  return normalized
}

async function markLogisticsError(orderId, message, { queried = false } = {}) {
  await db.query(
    `UPDATE orders SET logistics_error=?, logistics_queried_at=IF(?, NOW(), logistics_queried_at) WHERE id=?`,
    [String(message || '微信物流服务异常').slice(0, 512), queried ? 1 : 0, orderId]
  )
}

async function refreshOrder(order) {
  try {
    const payload = await wechatRequest('/cgi-bin/express/business/path/get', {
      body: {
        order_id: order.wechat_logistics_order_id,
        openid: order.openid,
        delivery_id: order.logistics_company,
        waybill_id: order.logistics_no
      }
    })
    await saveTrackResult(order.id, payload, { queried: true })
    return { refreshed: true }
  } catch (error) {
    await markLogisticsError(order.id, error.message, { queried: true })
    return { refreshed: false, error: error.message }
  }
}

async function loadOrderLogistics(orderId) {
  const [[order]] = await db.query(
    `SELECT id, logistics_no, logistics_company, logistics_company_name, logistics_state,
            logistics_status, logistics_latest, logistics_arrival_time,
            logistics_updated_at, logistics_queried_at, logistics_error
     FROM orders WHERE id=?`, [orderId]
  )
  if (!order) return null
  const [events] = await db.query(
    `SELECT event_hash, event_time AS time, status, status_code, location, area_name, context
     FROM order_logistics_events WHERE order_id=? ORDER BY event_time DESC, id DESC LIMIT 100`, [orderId]
  )
  return {
    enabled: isConfigured(),
    provider: 'wechat_logistics',
    company_code: order.logistics_company,
    company_name: order.logistics_company_name || order.logistics_company || '',
    number: order.logistics_no || '',
    state: order.logistics_state || '',
    state_label: order.logistics_status || '等待物流更新',
    latest: order.logistics_latest || '',
    arrival_time: order.logistics_arrival_time || '',
    subscribed: true,
    updated_at: order.logistics_updated_at,
    queried_at: order.logistics_queried_at,
    error: order.logistics_error || '',
    events: events.map(event => ({ ...event, time: formatDateTime(event.time) }))
  }
}

module.exports = {
  ACTION_LABELS,
  getConfig,
  isConfigured,
  getAccessToken,
  wechatRequest,
  listDeliveryAccounts,
  splitAddress,
  logisticsOrderId,
  buildWaybillPayload,
  createWaybill,
  normalizePath,
  saveTrackResult,
  markLogisticsError,
  refreshOrder,
  loadOrderLogistics
}
