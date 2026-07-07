const assert = require('assert')
const express = require('express')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'weather-route-test-secret'
process.env.WEATHER_PROVIDER = 'open-meteo-cma'

const dbPath = require.resolve('../db/database')
const queryLog = []
const nativeFetch = global.fetch
const mockCoordinates = JSON.stringify([
  { latitude: 39.47, longitude: 75.99 },
  { latitude: 39.47, longitude: 75.991 },
  { latitude: 39.471, longitude: 75.991 }
])
const mockUnavailableCmaCoordinates = JSON.stringify([
  { latitude: 28.167, longitude: 104.511 },
  { latitude: 28.168, longitude: 104.511 },
  { latitude: 28.168, longitude: 104.512 }
])
const mockTimeoutCoordinates = JSON.stringify([
  { latitude: 39.48, longitude: 75.99 },
  { latitude: 39.48, longitude: 75.991 },
  { latitude: 39.481, longitude: 75.991 }
])

const mockDb = {
  async query(sql, params = []) {
    queryLog.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
    if (/FROM plots WHERE id=\? AND user_id=\?/i.test(sql)) {
      if (params[0] === 8) {
        return [[{
          id: 8,
          name: '无边界地块',
          area: '0.00',
          coordinates: null,
          sow_date: null,
          irrigation: '滴灌',
          soil_type: '壤土',
          planting_status: '已播种',
          note: ''
        }], []]
      }
      if (params[0] === 9) {
        return [[{
          id: 9,
          name: '筠连县',
          area: '42.14',
          coordinates: mockUnavailableCmaCoordinates,
          sow_date: '2026-04-20',
          irrigation: '滴灌',
          soil_type: '壤土',
          planting_status: '已播种',
          note: ''
        }], []]
      }
      if (params[0] === 10) {
        return [[{
          id: 10,
          name: '上游超时地块',
          area: '18.20',
          coordinates: mockTimeoutCoordinates,
          sow_date: '2026-04-20',
          irrigation: '滴灌',
          soil_type: '壤土',
          planting_status: '已播种',
          note: ''
        }], []]
      }
      return [[{
        id: 7,
        name: '测试棉田',
        area: '14.35',
        coordinates: mockCoordinates,
        sow_date: '2026-04-20',
        irrigation: '滴灌',
        soil_type: '壤土',
        planting_status: '已播种',
        note: ''
      }], []]
    }
    throw new Error(`Unexpected SQL in test: ${sql}`)
  }
}

const fetchedRequests = []
global.fetch = async (url, options = {}) => {
  fetchedRequests.push({ url: String(url), headers: options.headers || {} })
  const currentUrl = String(url)
  if (currentUrl.includes('/api/now/56498') || currentUrl.includes('/api/weather/view?stationid=56498')) {
    return {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON')
      }
    }
  }

  if (currentUrl.includes('/api/now/')) {
    return {
      ok: true,
      json: async () => ({
        msg: 'success',
        code: 0,
        data: {
          location: { id: 'Y9199', name: '喀什', path: '中国, 新疆, 喀什' },
          now: {
            precipitation: 0,
            temperature: 32.8,
            pressure: 862,
            humidity: 19,
            windDirection: '东南风',
            windDirectionDegree: 95,
            windSpeed: 3.2,
            windScale: '微风',
            feelst: 32.2
          },
          alarm: []
        }
      })
    }
  }

  if (currentUrl.includes('/api/weather/view')) {
    return {
      ok: true,
      json: async () => ({
        msg: 'success',
        code: 0,
        data: {
          location: {
            id: 'Y9199',
            name: '喀什',
            path: '中国, 新疆, 喀什',
            longitude: 75.97,
            latitude: 39.46,
            timezone: 8
          },
          now: {
            precipitation: 0,
            temperature: 32.8,
            pressure: 862,
            humidity: 19,
            windDirection: '东南风',
            windDirectionDegree: 95,
            windSpeed: 3.2,
            windScale: '微风',
            feelst: 32.2
          },
          daily: [
            {
              date: '2026/07/02',
              high: 38,
              dayText: '多云',
              dayCode: 1,
              dayWindDirection: '东南风',
              dayWindScale: '微风',
              low: 23,
              nightText: '多云',
              nightCode: 1,
              nightWindDirection: '北风',
              nightWindScale: '微风'
            },
            {
              date: '2026/07/03',
              high: 37,
              dayText: '晴',
              dayCode: 0,
              dayWindDirection: '东风',
              dayWindScale: '微风',
              low: 24,
              nightText: '晴',
              nightCode: 0,
              nightWindDirection: '西风',
              nightWindScale: '微风'
            }
          ],
          alarm: []
        }
      })
    }
  }

  if (currentUrl.includes('api.open-meteo.com/v1/cma')) {
    if (currentUrl.includes('latitude=39.480333333333334')) {
      throw new Error('真实小时预报接口响应超时')
    }
    return {
      ok: true,
      json: async () => ({
        latitude: 39.47,
        longitude: 75.99,
        timezone: 'Asia/Shanghai',
        hourly: {
          time: ['2026-07-06T10:00', '2026-07-06T11:00', '2026-07-06T12:00'],
          temperature_2m: [27, 28, 29],
          relative_humidity_2m: [40, 39, 38],
          precipitation: [0, 0, 0.2],
          weather_code: [1, 1, 3],
          wind_speed_10m: [7.2, 8.1, 9.3],
          wind_direction_10m: [0, 45, 90],
          visibility: [18000, 17000, 16000],
          surface_pressure: [860, 861, 862],
          soil_temperature_0_to_10cm: [29, 30, 31]
        },
        daily: {
          time: ['2026-07-06'],
          weather_code: [1],
          temperature_2m_max: [32],
          temperature_2m_min: [22],
          uv_index_max: [7.4]
        }
      })
    }
  }

  return {
    ok: false,
    status: 404,
    json: async () => ({ msg: 'unexpected url' })
  }
}

require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
const weatherRouter = require('../routes/weather')

async function request(baseUrl, token, route) {
  const response = await nativeFetch(`${baseUrl}${route}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  return { status: response.status, json: await response.json() }
}

async function run() {
  const app = express()
  app.use(express.json())
  app.use('/api/weather', weatherRouter)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const farmerToken = jwt.sign({ id: 42, role: 'farmer' }, process.env.JWT_SECRET)
  const merchantToken = jwt.sign({ id: 42, role: 'merchant' }, process.env.JWT_SECRET)

  try {
    const unauthorized = await request(baseUrl, '', '/api/weather/plot/7')
    assert.strictEqual(unauthorized.status, 401)

    const forbidden = await request(baseUrl, merchantToken, '/api/weather/plot/7')
    assert.strictEqual(forbidden.status, 403)

    const invalid = await request(baseUrl, farmerToken, '/api/weather/plot/x')
    assert.strictEqual(invalid.status, 400)

    const noBoundary = await request(baseUrl, farmerToken, '/api/weather/plot/8')
    assert.strictEqual(noBoundary.status, 400)

    const success = await request(baseUrl, farmerToken, '/api/weather/plot/7')
    assert.strictEqual(success.status, 200)
    assert.strictEqual(success.json.data.plot.id, 7)
    assert.strictEqual(success.json.data.weather.provider, 'open-meteo-cma')
    assert.strictEqual(success.json.data.weather.source, 'api.open-meteo.com/v1/cma')
    assert.strictEqual(success.json.data.weather.hourly.time.length, 3)
    assert.strictEqual(success.json.data.weather.daily.time.length, 1)
    assert(fetchedRequests.some(item => item.url.includes('api.open-meteo.com/v1/cma')), 'weather request should fetch CMA GRAPES hourly data')
    assert(
      fetchedRequests.some(item => item.url.includes('latitude=39.470333333333336') && item.url.includes('longitude=75.99066666666666')),
      'weather request should use the plot center latitude and longitude'
    )
    assert(
      fetchedRequests.some(item => item.url.includes('forecast_hours=48') && item.url.includes('soil_temperature_0_to_10cm')),
      'weather request should ask for real hourly and soil forecast variables'
    )
    assert(
      fetchedRequests.every(item => !item.url.includes('weather.cma.cn/api/now/') && !item.url.includes('weather.cma.cn/api/weather/view')),
      'weather request should not use station-level weather as plot weather'
    )

    const cmaStationUnavailable = await request(baseUrl, farmerToken, '/api/weather/plot/9')
    assert.strictEqual(cmaStationUnavailable.status, 200)
    assert.strictEqual(cmaStationUnavailable.json.data.weather.provider, 'open-meteo-cma')
    assert.strictEqual(cmaStationUnavailable.json.data.weather.source, 'api.open-meteo.com/v1/cma')
    assert.strictEqual(cmaStationUnavailable.json.data.weather.hourly.time.length, 3)
    assert(
      fetchedRequests.every(item => !item.url.includes('weather.cma.cn/api/now/56498')),
      'weather request should not try regional station data for plot-level weather'
    )

    const upstreamTimeout = await request(baseUrl, farmerToken, '/api/weather/plot/10')
    assert.strictEqual(upstreamTimeout.status, 503)
    assert.strictEqual(upstreamTimeout.json.code, 503)
    assert.match(upstreamTimeout.json.msg, /真实小时预报接口响应超时/)

    console.log('weather API tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
