const { nearestRegion } = require('../../utils/regions')

const CMA_API_BASE = 'https://weather.cma.cn/api'
const REQUEST_TIMEOUT_MS = 8000

const CMA_STATIONS = [
  { id: 'Y9199', name: '喀什', lat: 39.46, lng: 75.97, aliases: ['喀什市', '疏附', '疏勒'] },
  { id: '51708', name: '阿克陶', lat: 39.14, lng: 75.94 },
  { id: '51705', name: '乌恰', lat: 39.72, lng: 75.25 },
  { id: '51707', name: '伽师', lat: 39.5, lng: 76.78 },
  { id: '51717', name: '岳普湖', lat: 39.2, lng: 76.81 },
  { id: '51802', name: '英吉沙', lat: 38.94, lng: 76.17 },
  { id: '51810', name: '麦盖提', lat: 38.91, lng: 77.64 },
  { id: '51811', name: '莎车', lat: 38.43, lng: 77.24 },
  { id: '51815', name: '泽普', lat: 38.2, lng: 77.26 },
  { id: '51814', name: '叶城', lat: 37.88, lng: 77.42 },
  { id: '51716', name: '巴楚', lat: 39.8, lng: 78.57 },
  { id: '51804', name: '塔什库尔干', lat: 37.78, lng: 75.23, aliases: ['塔什库尔干县'] },
  { id: '56498', name: '筠连', lat: 28.16, lng: 104.51, aliases: ['筠连县'] },
  { id: '57713', name: '遵义', lat: 27.7, lng: 106.93, aliases: ['遵义市'] },
  { id: '51463', name: '乌鲁木齐', lat: 43.78, lng: 87.62, aliases: ['乌鲁木齐市'] },
  { id: '51828', name: '和田', lat: 37.13, lng: 79.93, aliases: ['和田市'] },
  { id: '51628', name: '库尔勒', lat: 41.75, lng: 86.13, aliases: ['库尔勒市'] },
  { id: '51644', name: '若羌', lat: 39.03, lng: 88.17 },
  { id: '51431', name: '伊宁', lat: 43.95, lng: 81.33, aliases: ['伊宁市'] }
]

function toNumber(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function haversine(lat1, lng1, lat2, lng2) {
  const radius = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function cleanName(value) {
  return String(value || '')
    .replace(/[^\u4e00-\u9fa5]/g, '')
    .replace(/(地块|棉田|农场|基地|示范田|全部|测试|号地|号田)/g, '')
    .replace(/[县市区镇乡村]$/g, '')
}

function stationMatchesName(station, rawName) {
  const name = cleanName(rawName)
  if (!name) return false
  return [station.name, ...(station.aliases || [])].some(alias => {
    const current = cleanName(alias)
    return current && (name.includes(current) || current.includes(name))
  })
}

function nearestCmaStation(lat, lng) {
  const latitude = toNumber(lat)
  const longitude = toNumber(lng)
  if (latitude === null || longitude === null) return null

  return CMA_STATIONS.reduce((best, station) => {
    const distance = haversine(latitude, longitude, station.lat, station.lng)
    if (!best || distance < best.distance) {
      return { ...station, distance, matchType: 'nearest' }
    }
    return best
  }, null)
}

function stationFromName(name, center) {
  const station = CMA_STATIONS.find(item => stationMatchesName(item, name))
  if (!station) return null
  const distance = center
    ? haversine(center.latitude, center.longitude, station.lat, station.lng)
    : null
  return { ...station, distance, matchType: 'name' }
}

function cmaHeaders(stationId) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    Referer: stationId ? `https://weather.cma.cn/web/weather/${stationId}.html` : 'https://weather.cma.cn/',
    Accept: 'application/json,text/plain,*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
  }
}

async function requestCmaJson(url, stationId) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: cmaHeaders(stationId)
    })

    if (!response.ok) {
      throw new Error(`中国气象局接口请求失败(${response.status})`)
    }

    const payload = await response.json()
    if (payload && payload.code !== 0 && payload.code !== '0') {
      throw new Error(payload.msg || '中国气象局接口返回异常')
    }
    return payload
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('中国气象局接口响应超时')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function parseAutocompleteItem(item) {
  if (typeof item !== 'string') return null
  const [id, name, , country] = item.split('|')
  if (!id || !name || country !== '中国') return null
  return { id, name, lat: null, lng: null, aliases: [], distance: null, matchType: 'autocomplete' }
}

async function searchCmaStation(keyword) {
  const query = cleanName(keyword)
  if (query.length < 2) return null

  const url = `${CMA_API_BASE}/autocomplete?q=${encodeURIComponent(query)}&limit=10`
  const payload = await requestCmaJson(url, null)
  const list = Array.isArray(payload && payload.data) ? payload.data : []
  return parseAutocompleteItem(list[0])
}

async function resolveCmaStation(center, plot = {}) {
  const lat = toNumber(center && center.latitude)
  const lng = toNumber(center && center.longitude)
  if (lat === null || lng === null) {
    throw new Error('地块中心点无效，无法匹配气象站')
  }

  const namedStation = stationFromName(plot.name, { latitude: lat, longitude: lng })
  if (namedStation) return namedStation

  const nearest = nearestCmaStation(lat, lng)
  if (nearest && nearest.distance <= 120) return nearest

  const searchedByPlot = await searchCmaStation(plot.name).catch(() => null)
  if (searchedByPlot) return searchedByPlot

  const nearbyRegion = nearestRegion(lat, lng)
  const searchedByRegion = await searchCmaStation(nearbyRegion && nearbyRegion.name).catch(() => null)
  if (searchedByRegion) return searchedByRegion

  return nearest
}

function mergeStation(station, currentData, forecastData) {
  const location = (forecastData && forecastData.location) || (currentData && currentData.location) || {}
  return {
    id: location.id || station.id,
    name: location.name || station.name,
    path: location.path || '',
    latitude: toNumber(location.latitude, station.lat),
    longitude: toNumber(location.longitude, station.lng),
    distance: station.distance,
    matchType: station.matchType
  }
}

async function fetchCmaWeather(center, plot = {}) {
  const station = await resolveCmaStation(center, plot)
  if (!station) throw new Error('未匹配到可用的中国气象局气象站')

  const nowUrl = `${CMA_API_BASE}/now/${encodeURIComponent(station.id)}`
  const forecastUrl = `${CMA_API_BASE}/weather/view?stationid=${encodeURIComponent(station.id)}`
  const [currentPayload, forecastPayload] = await Promise.all([
    requestCmaJson(nowUrl, station.id),
    requestCmaJson(forecastUrl, station.id)
  ])

  const current = currentPayload && currentPayload.data ? currentPayload.data : {}
  const forecast = forecastPayload && forecastPayload.data ? forecastPayload.data : {}

  return {
    provider: 'cma',
    source: 'weather.cma.cn',
    station: mergeStation(station, current, forecast),
    current,
    forecast,
    fetchedAt: new Date().toISOString()
  }
}

module.exports = {
  CMA_STATIONS,
  nearestCmaStation,
  resolveCmaStation,
  fetchCmaWeather
}
