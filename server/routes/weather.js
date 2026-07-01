const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const { normalizeCoordinates, calculateCenter } = require('../../utils/plot-geometry')

const router = express.Router()

const ok = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function farmerAuth(req, res, next) {
  const authorization = req.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) return fail(res, '请先登录', 401)
  try {
    req.user = jwt.verify(authorization.slice(7), process.env.JWT_SECRET)
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

async function fetchWeather(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    timezone: 'auto',
    forecast_days: '5',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,precipitation_probability,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,precipitation_sum'
  })

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`天气服务请求失败(${response.status})`)
  }
  return response.json()
}

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
    const weather = await fetchWeather(center.latitude, center.longitude)
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
      weather
    }, '天气获取成功')
  } catch (error) {
    console.error('[weather-plot]', error)
    return fail(res, error.message || '天气获取失败', 500)
  }
})

module.exports = router