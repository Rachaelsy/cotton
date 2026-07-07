const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const { fetchCmaWeather } = require('../utils/cma-weather')
const { fetchQweatherWeather } = require('../utils/qweather')
const { normalizeCoordinates, calculateCenter } = require('../utils/plot-geometry')

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

async function fetchPlotWeather(center, plot) {
  const provider = weatherProvider()
  if (provider === 'open-meteo-cma' || provider === 'cma') {
    return fetchCmaWeather(center, plot)
  }
  if (provider === 'qweather' || provider === 'heweather') {
    return fetchQweatherWeather(center, plot)
  }
  throw new Error(`未知天气数据源：${provider}`)
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
    const weather = await fetchPlotWeather(center, plot)
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
