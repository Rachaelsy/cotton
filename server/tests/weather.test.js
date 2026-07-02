const assert = require('assert')
const express = require('express')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'weather-route-test-secret'

const dbPath = require.resolve('../db/database')
const queryLog = []
const nativeFetch = global.fetch
const mockCoordinates = JSON.stringify([
  { latitude: 39.47, longitude: 75.99 },
  { latitude: 39.47, longitude: 75.991 },
  { latitude: 39.471, longitude: 75.991 }
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
    assert.strictEqual(success.json.data.weather.provider, 'cma')
    assert.strictEqual(success.json.data.weather.station.id, 'Y9199')
    assert.strictEqual(success.json.data.weather.forecast.daily.length, 2)
    assert(fetchedRequests.some(item => item.url.includes('weather.cma.cn/api/now/Y9199')), 'weather request should fetch CMA realtime data')
    assert(fetchedRequests.some(item => item.url.includes('weather.cma.cn/api/weather/view?stationid=Y9199')), 'weather request should fetch CMA forecast data')
    assert(fetchedRequests.every(item => !item.url.includes('api.open-meteo.com')), 'weather request should not use Open-Meteo')
    assert(
      fetchedRequests.some(item => String(item.headers.Referer || '').includes('/web/weather/Y9199.html')),
      'weather request should include CMA station referer'
    )

    console.log('weather API tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
