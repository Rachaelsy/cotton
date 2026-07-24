const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const { fetchCmaWeather } = require('../utils/cma-weather')
const { fetchQweatherLocationWeather, fetchQweatherWeather } = require('../utils/qweather')
const { normalizeCoordinates, calculateCenter } = require('../utils/plot-geometry')
const { locateService } = require('../utils/regions')
const weatherObservations = require('../utils/weather-observations')

const router = express.Router()

const ok = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function isWeatherUpstreamError(error) {
  const message = String(error && error.message ? error.message : '')
  return /和风天气|QWeather|真实小时预报接口|中国气象局接口|open-meteo|CMA|响应超时|请求失败|返回异常/.test(message)
}

function weatherProvider() {
  return String(process.env.WEATHER_PROVIDER || 'qweather').trim().toLowerCase()
}

async function fetchPointWeather(center, plot) {
  const provider = weatherProvider()
  if (provider === 'open-meteo-cma' || provider === 'cma') {
    return fetchCmaWeather(center, plot)
  }
  if (provider === 'qweather' || provider === 'heweather') {
    return fetchQweatherWeather(center, plot)
  }
  throw new Error(`未知天气数据源：${provider}`)
}

async function fetchLocationWeather(center, locationName) {
  const provider = weatherProvider()
  if (provider === 'qweather' || provider === 'heweather') {
    return fetchQweatherLocationWeather(center)
  }
  return fetchPointWeather(center, {
    id: null,
    name: locationName,
    area: 0,
    coordinates: JSON.stringify([center])
  })
}

function farmerAuth(req, res, next) {
  const authorization = req.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) return fail(res, '请先登录', 401)
  try {
    req.user = jwt.verify(authorization.slice(7), process.env.JWT_SECRET)
    if (req.user.role !== 'farmer') return fail(res, '仅农户可查看地块气象', 403)
    next()
  } catch (error) {
    return fail(res, '登录已过期', 401)
  }
}

function parsePositiveId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function parseCoordinates(value) {
  if (Array.isArray(value)) return normalizeCoordinates(value)
  try {
    return normalizeCoordinates(value ? JSON.parse(value) : [])
  } catch (error) {
    return []
  }
}

function parseLatLng(query) {
  const lat = Number(query.lat != null ? query.lat : query.latitude)
  const lng = Number(query.lng != null ? query.lng : query.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: '经纬度不能为空' }
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: '经纬度范围无效' }
  }
  return { center: { latitude: lat, longitude: lng } }
}

// GET /api/weather/location?lat=39.47&lng=75.99 — 获取当前位置真实天气
router.get('/location', async (req, res) => {
  const parsed = parseLatLng(req.query)
  if (parsed.error) return fail(res, parsed.error)

  const center = parsed.center
  const location = locateService(center.latitude, center.longitude)
  const locationName = location && location.name ? location.name : '当前位置'

  try {
    const weather = await fetchLocationWeather(center, locationName)
    return ok(res, {
      center,
      location: {
        name: locationName,
        inService: !!(location && location.inService),
        distance_km: Number.isFinite(Number(location && location.distance))
          ? Number(Number(location.distance).toFixed(1))
          : null
      },
      weather
    }, '天气获取成功')
  } catch (error) {
    const statusCode = isWeatherUpstreamError(error) ? 503 : 500
    if (statusCode === 503) {
      console.warn('[weather-location] upstream unavailable:', error.message)
    } else {
      console.error('[weather-location]', error)
    }
    return fail(res, error.message || '天气获取失败', statusCode)
  }
})
// GET /api/weather/plot/:id — 获取指定地块的真实天气
router.get('/plot/:id', farmerAuth, async (req, res) => {
  const plotId = parsePositiveId(req.params.id)
  if (!plotId) return fail(res, '地块编号无效')

  try {
    const [rows] = await db.query(
      'SELECT id, name, area, coordinates, sow_date, irrigation, soil_type, planting_status, note FROM plots WHERE id=? AND user_id=?',
      [plotId, req.user.id]
    )
    if (!rows.length) return fail(res, '地块不存在', 404)

    const plot = rows[0]
    const coordinates = parseCoordinates(plot.coordinates)
    if (!coordinates.length) return fail(res, '地块暂无边界数据', 400)

    const center = calculateCenter(coordinates)
    const weather = await fetchPointWeather(center, plot)
    await weatherObservations.saveObservation(plot.id, center, weather)
    const statistics = await weatherObservations.getThirtyDayStats(plot.id)
    return ok(res, {
      plot: {
        id: plot.id,
        name: plot.name,
        area: plot.area,
        coordinates: plot.coordinates,
        sow_date: plot.sow_date,
        irrigation: plot.irrigation,
        soil_type: plot.soil_type,
        planting_status: plot.planting_status,
        note: plot.note
      },
      center,
      weather,
      statistics
    }, '天气获取成功')
  } catch (error) {
    const statusCode = isWeatherUpstreamError(error) ? 503 : 500
    if (statusCode === 503) {
      console.warn('[weather-plot] upstream unavailable:', error.message)
    } else {
      console.error('[weather-plot]', error)
    }
    return fail(res, error.message || '天气获取失败', statusCode)
  }
})

module.exports = router
