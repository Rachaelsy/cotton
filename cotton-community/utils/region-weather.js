const KASHGAR_REGIONS = [
  { name: '疏附县', lat: 39.3800, lng: 75.8600 },
  { name: '疏勒县', lat: 39.4080, lng: 76.0540 },
  { name: '英吉沙县', lat: 38.9300, lng: 76.1750 },
  { name: '岳普湖县', lat: 39.2360, lng: 76.7720 },
  { name: '伽师县', lat: 39.4900, lng: 76.7240 },
  { name: '麦盖提县', lat: 38.9070, lng: 77.6420 },
  { name: '莎车县', lat: 38.4160, lng: 77.2400, aliases: ['莎车'] },
  { name: '泽普县', lat: 38.1900, lng: 77.2600 },
  { name: '叶城县', lat: 37.8830, lng: 77.4160 },
  { name: '巴楚县', lat: 39.7850, lng: 78.5490 },
  { name: '塔什库尔干县', lat: 37.7780, lng: 75.2300, aliases: ['塔什库尔干'] },
  { name: '喀什市', lat: 39.4677, lng: 75.9938, aliases: ['喀什地区'] }
]

const DEFAULT_REGION = KASHGAR_REGIONS.find(item => item.name === '莎车县')
const CACHE_TTL_MS = 2 * 60 * 60 * 1000
const cache = new Map()

function normalized(value) {
  return String(value || '').trim().replace(/\s+/g, '')
}

function resolveWeatherRegion(location) {
  const raw = normalized(location)
  if (!raw) return { ...DEFAULT_REGION, registeredLocation: '', usedDefault: true, fallbackReason: 'empty' }
  const match = KASHGAR_REGIONS.find(item => [item.name, item.name.replace(/[县市]$/, ''), ...(item.aliases || [])]
    .some(alias => raw.includes(alias.replace(/\s+/g, ''))))
  if (match) return { ...match, registeredLocation: String(location).trim(), usedDefault: false, fallbackReason: '' }
  return { ...DEFAULT_REGION, registeredLocation: String(location).trim(), usedDefault: true, fallbackReason: 'unrecognized' }
}

function platformBaseUrl() {
  return String(process.env.PLATFORM_INTERNAL_BASE_URL || 'http://app:3000').replace(/\/$/, '')
}

function compactWeather(region, payload) {
  const weather = payload?.data?.weather
  const current = weather?.current
  if (!current) return null
  const alerts = Array.isArray(weather.warning?.alerts) ? weather.warning.alerts : []
  return {
    region: String(payload?.data?.location?.name || region.name || '当前位置'),
    observedAt: current.time || weather.fetchedAt || null,
    temperature: current.temperature_2m == null ? null : Number(current.temperature_2m),
    apparentTemperature: current.apparent_temperature == null ? null : Number(current.apparent_temperature),
    weatherText: String(current.weather_text || ''),
    humidity: current.relative_humidity_2m == null ? null : Number(current.relative_humidity_2m),
    precipitation: Number(current.precipitation || 0),
    windSpeed: current.wind_speed_10m == null ? null : Number(current.wind_speed_10m),
    warnings: alerts.slice(0, 2).map(item => String(item.title || '')).filter(Boolean),
    provider: String(weather.provider || '')
  }
}

function validCoordinate(value, min, max) {
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max ? number : null
}

async function fetchCurrentLocationWeather(latitude, longitude) {
  const lat = validCoordinate(latitude, -90, 90)
  const lng = validCoordinate(longitude, -180, 180)
  if (lat == null || lng == null) throw new Error('当前位置坐标无效')
  const key = `current:${lat.toFixed(3)},${lng.toFixed(3)}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.weather
  const url = `${platformBaseUrl()}/api/weather/location?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || Number(payload.code) !== 200) throw new Error(payload?.msg || `当前位置天气接口返回 ${response.status}`)
  const weather = compactWeather({ name: '当前位置' }, payload)
  if (!weather) throw new Error('当前位置天气接口未返回当前天气')
  cache.set(key, { createdAt: Date.now(), weather })
  return weather
}

async function fetchRegionWeather(region) {
  const cached = cache.get(region.name)
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.weather
  const url = `${platformBaseUrl()}/api/weather/location?lat=${encodeURIComponent(region.lat)}&lng=${encodeURIComponent(region.lng)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || Number(payload.code) !== 200) throw new Error(payload?.msg || `地区天气接口返回 ${response.status}`)
  const weather = compactWeather(region, payload)
  if (!weather) throw new Error('地区天气接口未返回当前天气')
  cache.set(region.name, { createdAt: Date.now(), weather })
  return weather
}

module.exports = { KASHGAR_REGIONS, DEFAULT_REGION, resolveWeatherRegion, fetchRegionWeather, fetchCurrentLocationWeather, compactWeather }
