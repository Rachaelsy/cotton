const assert = require('assert')
const express = require('express')
const jwt = require('jsonwebtoken')
const { generateKeyPairSync } = require('crypto')

process.env.JWT_SECRET = 'qweather-route-test-secret'
process.env.WEATHER_PROVIDER = 'qweather'
process.env.QWEATHER_API_HOST = 'abc1234xyz.qweatherapi.com'
process.env.QWEATHER_API_KEY = 'test-qweather-api-key'
delete process.env.QWEATHER_JWT_KID
delete process.env.QWEATHER_JWT_SUB
delete process.env.QWEATHER_JWT_PRIVATE_KEY
delete process.env.QWEATHER_JWT_PRIVATE_KEY_PATH

const dbPath = require.resolve('../db/database')
const nativeFetch = global.fetch
const fetchedRequests = []
const mockCoordinates = JSON.stringify([
  { latitude: 39.47, longitude: 75.99 },
  { latitude: 39.47, longitude: 75.991 },
  { latitude: 39.471, longitude: 75.991 }
])

const mockDb = {
  async query(sql, params = []) {
    if (/FROM plots WHERE id=\? AND user_id=\?/i.test(sql)) {
      return [[{
        id: params[0],
        name: 'qweather-test-field',
        area: '14.35',
        coordinates: mockCoordinates,
        sow_date: '2026-04-20',
        irrigation: 'drip',
        soil_type: 'loam',
        planting_status: 'planted',
        note: ''
      }], []]
    }
    throw new Error(`Unexpected SQL in test: ${sql}`)
  }
}

function qweatherJson(url) {
  const currentUrl = new URL(String(url))
  if (!currentUrl.hostname.includes('qweatherapi.com')) {
    return null
  }

  if (currentUrl.pathname === '/v7/grid-weather/now') {
    return {
      code: '200',
      updateTime: '2026-07-07T10:10+08:00',
      now: {
        obsTime: '2026-07-07T02:00+00:00',
        temp: '27',
        icon: '302',
        text: '雷阵雨',
        wind360: '45',
        windDir: '东北风',
        windScale: '2',
        windSpeed: '9',
        humidity: '80',
        precip: '0.1',
        pressure: '862',
        cloud: '90',
        dew: '20'
      },
      refer: { sources: ['QWeather'], license: ['QWeather Developers License'] }
    }
  }

  if (currentUrl.pathname === '/v7/grid-weather/24h') {
    return {
      code: '200',
      updateTime: '2026-07-07T10:10+08:00',
      hourly: [
        { fxTime: '2026-07-07T03:00+00:00', temp: '27', icon: '302', text: '雷阵雨', wind360: '45', windSpeed: '9', humidity: '80', precip: '0.1', pressure: '862' },
        { fxTime: '2026-07-07T04:00+00:00', temp: '28', icon: '305', text: '小雨', wind360: '60', windSpeed: '10', humidity: '76', precip: '0.3', pressure: '861' },
        { fxTime: '2026-07-07T05:00+00:00', temp: '29', icon: '101', text: '多云', wind360: '80', windSpeed: '11', humidity: '70', precip: '0.0', pressure: '860' }
      ],
      refer: { sources: ['QWeather'], license: ['QWeather Developers License'] }
    }
  }

  if (currentUrl.pathname === '/v7/grid-weather/7d') {
    return {
      code: '200',
      updateTime: '2026-07-07T10:10+08:00',
      daily: [
        { fxDate: '2026-07-07', tempMax: '31', tempMin: '22', iconDay: '302', textDay: '雷阵雨', wind360Day: '45', windSpeedDay: '11', humidity: '78', precip: '1.2', pressure: '862' },
        { fxDate: '2026-07-08', tempMax: '33', tempMin: '23', iconDay: '101', textDay: '多云', wind360Day: '80', windSpeedDay: '13', humidity: '62', precip: '0.0', pressure: '860' }
      ],
      refer: { sources: ['QWeather'], license: ['QWeather Developers License'] }
    }
  }

  return null
}

global.fetch = async (url, options = {}) => {
  fetchedRequests.push({ url: String(url), headers: options.headers || {} })
  const payload = qweatherJson(url)
  if (payload) {
    return { ok: true, status: 200, json: async () => payload }
  }
  return { ok: false, status: 404, json: async () => ({ code: '404', message: 'unexpected url' }) }
}

require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
const weatherRouter = require('../routes/weather')
const { createQweatherJwt } = require('../utils/qweather')

async function request(baseUrl, token, route) {
  const response = await nativeFetch(`${baseUrl}${route}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  return { status: response.status, json: await response.json() }
}

async function runRouteTest() {
  const app = express()
  app.use(express.json())
  app.use('/api/weather', weatherRouter)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const farmerToken = jwt.sign({ id: 42, role: 'farmer' }, process.env.JWT_SECRET)

  try {
    const success = await request(baseUrl, farmerToken, '/api/weather/plot/7')
    assert.strictEqual(success.status, 200)
    assert.strictEqual(success.json.data.weather.provider, 'qweather')
    assert.strictEqual(success.json.data.weather.source, 'abc1234xyz.qweatherapi.com')
    assert.strictEqual(success.json.data.weather.hourly.time.length, 3)
    assert.strictEqual(success.json.data.weather.daily.time.length, 2)

    const qweatherRequests = fetchedRequests.filter(item => item.url.includes('qweatherapi.com'))
    assert.strictEqual(qweatherRequests.length, 3)
    assert(qweatherRequests.some(item => new URL(item.url).pathname === '/v7/grid-weather/now'))
    assert(qweatherRequests.some(item => new URL(item.url).pathname === '/v7/grid-weather/24h'))
    assert(qweatherRequests.some(item => new URL(item.url).pathname === '/v7/grid-weather/7d'))
    assert(qweatherRequests.every(item => new URL(item.url).searchParams.get('location') === '75.99,39.47'))
    assert(qweatherRequests.every(item => item.headers['X-QW-Api-Key'] === 'test-qweather-api-key'))
    assert(fetchedRequests.every(item => !item.url.includes('api.open-meteo.com')), 'qweather provider should not request Open-Meteo')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

function runJwtTest() {
  const { privateKey } = generateKeyPairSync('ed25519')
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const token = createQweatherJwt({
    kid: 'kid-123',
    sub: 'project-456',
    privateKey: privatePem,
    now: 1783425600
  })
  const [headerPart, payloadPart, signaturePart] = token.split('.')
  const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'))
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
  assert.strictEqual(header.alg, 'EdDSA')
  assert.strictEqual(header.kid, 'kid-123')
  assert.strictEqual(payload.sub, 'project-456')
  assert.strictEqual(payload.iat, 1783425570)
  assert.strictEqual(payload.exp, 1783426470)
  assert(signaturePart.length > 20)
}

async function run() {
  runJwtTest()
  await runRouteTest()
  console.log('qweather tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
