const fs = require('fs')
const crypto = require('crypto')

const REQUEST_TIMEOUT_MS = Number(process.env.QWEATHER_TIMEOUT_MS || 8000)
const JWT_TTL_SECONDS = 900

let cachedJwt = null

function toNumber(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeHost(value) {
  const host = String(value || '').trim()
  if (!host) throw new Error('和风天气 API Host 未配置：请填写 QWEATHER_API_HOST')
  return host
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
}

function base64url(value) {
  return Buffer.from(value).toString('base64url')
}

function readPrivateKey(options = {}) {
  const inline = options.privateKey || process.env.QWEATHER_JWT_PRIVATE_KEY
  if (inline) return String(inline).replace(/\\n/g, '\n')

  const privateKeyPath = options.privateKeyPath || process.env.QWEATHER_JWT_PRIVATE_KEY_PATH
  if (privateKeyPath) {
    try {
      return fs.readFileSync(privateKeyPath, 'utf8')
    } catch (error) {
      throw new Error(`和风天气JWT私钥读取失败：${error.message}`)
    }
  }

  return ''
}

function createQweatherJwt(options = {}) {
  const kid = options.kid || process.env.QWEATHER_JWT_KID
  const sub = options.sub || process.env.QWEATHER_JWT_SUB
  const privateKey = readPrivateKey(options)
  if (!kid || !sub || !privateKey) {
    throw new Error('和风天气JWT认证未配置完整')
  }

  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'EdDSA', kid }))
  const payload = base64url(JSON.stringify({
    sub,
    iat: now - 30,
    exp: now - 30 + JWT_TTL_SECONDS
  }))
  const data = `${header}.${payload}`
  try {
    const signature = crypto.sign(null, Buffer.from(data), privateKey).toString('base64url')
    return `${data}.${signature}`
  } catch (error) {
    throw new Error(`和风天气JWT签名失败：${error.message}`)
  }
}

function getQweatherJwt() {
  if (cachedJwt && cachedJwt.expiresAt > Date.now() + 60 * 1000) return cachedJwt.token
  const token = createQweatherJwt()
  cachedJwt = {
    token,
    expiresAt: Date.now() + (JWT_TTL_SECONDS - 60) * 1000
  }
  return token
}

function authHeaders() {
  const hasJwtConfig = process.env.QWEATHER_JWT_KID &&
    process.env.QWEATHER_JWT_SUB &&
    (process.env.QWEATHER_JWT_PRIVATE_KEY || process.env.QWEATHER_JWT_PRIVATE_KEY_PATH)
  if (hasJwtConfig) {
    return { Authorization: `Bearer ${getQweatherJwt()}` }
  }

  if (process.env.QWEATHER_API_KEY) {
    return { 'X-QW-Api-Key': process.env.QWEATHER_API_KEY }
  }

  throw new Error('和风天气认证未配置：请配置 QWEATHER_API_KEY 或 QWEATHER_JWT_*')
}

function formatCoordinate(value) {
  const number = toNumber(value)
  if (number === null) throw new Error('地块中心点经纬度无效，无法请求和风天气')
  return String(Number(number.toFixed(2)))
}

function formatLocation(center) {
  const lat = toNumber(center && center.latitude)
  const lng = toNumber(center && center.longitude)
  if (lat === null || lng === null) {
    throw new Error('地块中心点经纬度无效，无法请求和风天气')
  }
  return `${formatCoordinate(lng)},${formatCoordinate(lat)}`
}

async function requestQweatherJson(pathname, center, extraParams = {}) {
  const host = normalizeHost(process.env.QWEATHER_API_HOST)
  const params = new URLSearchParams({
    location: formatLocation(center),
    lang: 'zh',
    unit: 'm',
    ...extraParams
  })
  const url = `https://${host}${pathname}?${params.toString()}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'cotton-miniapp-qweather/1.0',
        Accept: 'application/json',
        ...authHeaders()
      }
    })
    if (!response.ok) {
      throw new Error(`和风天气接口请求失败(${response.status})`)
    }

    const payload = await response.json()
    if (!payload || payload.code !== '200') {
      throw new Error(`和风天气接口返回异常(${payload && payload.code ? payload.code : 'empty'})`)
    }
    return payload
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('和风天气接口响应超时')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function requestQweatherAlert(center) {
  const host = normalizeHost(process.env.QWEATHER_API_HOST)
  const lat = formatCoordinate(center && center.latitude)
  const lng = formatCoordinate(center && center.longitude)
  const url = `https://${host}/weatheralert/v1/current/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}?lang=zh`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'cotton-miniapp-qweather/1.0', Accept: 'application/json', ...authHeaders() }
    })
    if (!response.ok) throw new Error(`和风天气预警接口请求失败(${response.status})`)
    const payload = await response.json()
    if (!payload || (!Array.isArray(payload.alerts) && !payload.metadata)) {
      throw new Error('和风天气预警接口返回异常(empty)')
    }
    return payload
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('和风天气预警接口响应超时')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function qweatherIconToWmo(icon, text = '') {
  const code = Number(icon)
  const label = String(text || '')
  if ([100, 150].includes(code) || /晴/.test(label)) return 0
  if ([101, 102, 103, 151, 152, 153].includes(code) || /多云|少云|晴间多云/.test(label)) return 2
  if ([104, 154].includes(code) || /阴/.test(label)) return 3
  if ([300, 301, 302, 303, 304].includes(code) || /雷|强阵雨/.test(label)) return 95
  if ([305, 309].includes(code) || /小雨|毛毛雨/.test(label)) return 61
  if ([306, 314, 399].includes(code) || /中雨/.test(label)) return 63
  if ([307, 308, 310, 311, 312, 315, 316, 317, 318].includes(code) || /大雨|暴雨|雨/.test(label)) return 65
  if ([400, 401, 407, 408, 499].includes(code) || /小雪|阵雪/.test(label)) return 71
  if ([402, 403, 409, 410].includes(code) || /中雪|大雪|暴雪|雪/.test(label)) return 75
  if ([404, 405, 406].includes(code) || /雨夹雪|冻雨/.test(label)) return 67
  if (code >= 500 && code < 600) return 45
  if (code >= 700 && code < 800) return 45
  return 3
}

function mapList(list, mapper) {
  return Array.isArray(list) ? list.map(mapper) : []
}

function normalizeAlertPayload(payload) {
  const alerts = Array.isArray(payload && payload.alerts) ? payload.alerts : []
  const metadata = payload && payload.metadata ? payload.metadata : {}
  return {
    available: true,
    zeroResult: Boolean(metadata.zeroResult) || alerts.length === 0,
    alerts: alerts.map(item => ({
      id: item.id || '',
      title: item.headline || item.title || (item.eventType && item.eventType.name) || item.typeName || '天气预警',
      type: (item.eventType && item.eventType.name) || item.typeName || item.type || '',
      severity: item.severity || '',
      severityColor: (item.color && item.color.code) || item.severityColor || '',
      sender: item.senderName || item.sender || '',
      pubTime: item.issuedTime || item.pubTime || '',
      startTime: item.onsetTime || item.effectiveTime || item.startTime || '',
      endTime: item.expireTime || item.endTime || '',
      text: item.text || item.description || '',
      instruction: item.instruction || '',
      status: (item.messageType && item.messageType.code) || item.status || ''
    })),
    attributions: Array.isArray(metadata.attributions)
      ? metadata.attributions
      : (Array.isArray(payload && payload.attributions) ? payload.attributions : [])
  }
}

function normalizeQweatherPayload(center, nowPayload, hourlyPayload, dailyPayload, alertPayload) {
  const now = nowPayload.now || {}
  const hourlyItems = Array.isArray(hourlyPayload.hourly) ? hourlyPayload.hourly : []
  const dailyItems = Array.isArray(dailyPayload.daily) ? dailyPayload.daily : []
  const currentTime = now.obsTime || nowPayload.updateTime || new Date().toISOString()

  return {
    provider: 'qweather',
    source: normalizeHost(process.env.QWEATHER_API_HOST),
    model: 'QWeather Grid Weather',
    center,
    current: {
      time: currentTime,
      temperature_2m: toNumber(now.temp),
      relative_humidity_2m: toNumber(now.humidity),
      precipitation: toNumber(now.precip, 0),
      weather_code: qweatherIconToWmo(now.icon, now.text),
      weather_text: now.text || '',
      wind_speed_10m: toNumber(now.windSpeed, 0),
      wind_direction_10m: toNumber(now.wind360, 0),
      surface_pressure: toNumber(now.pressure, 0),
      visibility: null,
      soil_temperature_0cm: null,
      apparent_temperature: null
    },
    hourly: {
      time: mapList(hourlyItems, item => item.fxTime),
      temperature_2m: mapList(hourlyItems, item => toNumber(item.temp)),
      relative_humidity_2m: mapList(hourlyItems, item => toNumber(item.humidity)),
      precipitation: mapList(hourlyItems, item => toNumber(item.precip, 0)),
      weather_code: mapList(hourlyItems, item => qweatherIconToWmo(item.icon, item.text)),
      weather_text: mapList(hourlyItems, item => item.text || ''),
      wind_speed_10m: mapList(hourlyItems, item => toNumber(item.windSpeed, 0)),
      wind_direction_10m: mapList(hourlyItems, item => toNumber(item.wind360, 0)),
      surface_pressure: mapList(hourlyItems, item => toNumber(item.pressure, 0))
    },
    daily: {
      time: mapList(dailyItems, item => item.fxDate),
      weather_code: mapList(dailyItems, item => qweatherIconToWmo(item.iconDay, item.textDay)),
      weather_text: mapList(dailyItems, item => item.textDay || ''),
      temperature_2m_max: mapList(dailyItems, item => toNumber(item.tempMax)),
      temperature_2m_min: mapList(dailyItems, item => toNumber(item.tempMin)),
      precipitation_sum: mapList(dailyItems, item => toNumber(item.precip, 0)),
      wind_speed_10m_max: mapList(dailyItems, item => toNumber(item.windSpeedDay, 0)),
      wind_direction_10m_dominant: mapList(dailyItems, item => toNumber(item.wind360Day, 0))
    },
    refer: {
      now: nowPayload.refer || null,
      hourly: hourlyPayload.refer || null,
      daily: dailyPayload.refer || null
    },
    warning: alertPayload,
    fetchedAt: new Date().toISOString()
  }
}

async function fetchQweatherWeather(center, plot = {}) {
  const warningPromise = requestQweatherAlert(center)
    .then(normalizeAlertPayload)
    .catch(error => ({ available: false, zeroResult: false, alerts: [], attributions: [], error: error.message }))
  const [nowPayload, hourlyPayload, dailyPayload, warning] = await Promise.all([
    requestQweatherJson('/v7/grid-weather/now', center),
    requestQweatherJson('/v7/grid-weather/24h', center),
    requestQweatherJson('/v7/grid-weather/7d', center),
    warningPromise
  ])

  const weather = normalizeQweatherPayload(center, nowPayload, hourlyPayload, dailyPayload, warning)
  if (!Array.isArray(weather.hourly.time) || !weather.hourly.time.length) {
    throw new Error('和风天气逐小时预报数据缺失')
  }
  if (!Array.isArray(weather.daily.time) || !weather.daily.time.length) {
    throw new Error('和风天气7日预报数据缺失')
  }
  return weather
}

module.exports = {
  createQweatherJwt,
  fetchQweatherWeather,
  formatLocation,
  qweatherIconToWmo
}
