const assert = require('assert')
const express = require('express')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'plot-route-test-secret'

const dbPath = require.resolve('../db/database')
const queryLog = []
const mockPlot = {
  id: 7,
  user_id: 42,
  name: '测试棉田',
  variety: '新陆早57号',
  area: '14.35',
  perimeter: '394.51',
  coordinates: JSON.stringify([
    { latitude: 39.47, longitude: 75.99 },
    { latitude: 39.47, longitude: 75.991 },
    { latitude: 39.471, longitude: 75.991 },
    { latitude: 39.471, longitude: 75.99 }
  ]),
  irrigation: '滴灌',
  soil_type: '壤土',
  planting_status: '已播种',
  health_score: 92,
  status: 'normal'
}

const mockDb = {
  async query(sql, params = []) {
    queryLog.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
    if (/INSERT INTO plots/i.test(sql)) return [{ insertId: 7 }, []]
    if (/COUNT\(\*\) AS total FROM farm_records/i.test(sql)) return [[{ total: 1 }], []]
    if (/FROM farm_records/i.test(sql)) {
      return [[{ id: 1, type: '灌溉', title: '滴灌作业', work_date: '2026-06-30', work_time: '09:00' }], []]
    }
    if (/SELECT \* FROM plots WHERE id=/i.test(sql)) return [[mockPlot], []]
    if (/SELECT \* FROM plots WHERE/i.test(sql)) return [[mockPlot], []]
    if (/UPDATE plots SET/i.test(sql)) return [{ affectedRows: 1 }, []]
    if (/DELETE FROM plots/i.test(sql)) return [{ affectedRows: params.includes(999) ? 0 : 1 }, []]
    throw new Error(`Unexpected SQL in test: ${sql}`)
  }
}

require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
const plotsRouter = require('../routes/plots')

async function request(baseUrl, token, method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  return { status: response.status, json: await response.json() }
}

async function run() {
  const app = express()
  app.use(express.json())
  app.use('/api/plots', plotsRouter)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const port = server.address().port
  const baseUrl = `http://127.0.0.1:${port}`
  const token = jwt.sign({ id: 42, role: 'farmer' }, process.env.JWT_SECRET)

  try {
    const unauthorized = await request(baseUrl, '', 'GET', '/api/plots')
    assert.strictEqual(unauthorized.status, 401)

    const invalidCreate = await request(baseUrl, token, 'POST', '/api/plots', {
      name: '无效地块', variety: '测试品种', coordinates: [{ latitude: 39, longitude: 75 }]
    })
    assert.strictEqual(invalidCreate.status, 400)

    const coordinates = JSON.parse(mockPlot.coordinates)
    const created = await request(baseUrl, token, 'POST', '/api/plots', {
      name: '测试棉田',
      variety: '新陆早57号',
      area: 999999,
      perimeter: 999999,
      coordinates,
      irrigation: '滴灌',
      soil_type: '壤土',
      planting_status: '已播种'
    })
    assert.strictEqual(created.status, 200)
    assert(created.json.data.area > 10 && created.json.data.area < 20)
    assert(created.json.data.perimeter > 300 && created.json.data.perimeter < 500)

    const insertQuery = queryLog.find(item => /INSERT INTO plots/i.test(item.sql))
    assert(insertQuery, 'create should issue INSERT')
    assert.notStrictEqual(insertQuery.params[3], 999999, 'server must recalculate area')
    assert.notStrictEqual(insertQuery.params[4], 999999, 'server must recalculate perimeter')

    const listed = await request(baseUrl, token, 'GET', '/api/plots?status=normal&min_area=10')
    assert.strictEqual(listed.status, 200)
    assert.strictEqual(listed.json.data.length, 1)

    const detail = await request(baseUrl, token, 'GET', '/api/plots/7')
    assert.strictEqual(detail.status, 200)
    assert.strictEqual(detail.json.data.overview.record_count, 1)
    assert.strictEqual(detail.json.data.overview.recent_records.length, 1)

    const invalidUpdate = await request(baseUrl, token, 'PUT', '/api/plots/7', {
      name: '测试棉田', variety: '新陆早57号', irrigation: '未知方式'
    })
    assert.strictEqual(invalidUpdate.status, 400)

    const updated = await request(baseUrl, token, 'PUT', '/api/plots/7', {
      name: '测试棉田', variety: '新陆早57号', irrigation: '滴灌',
      soil_type: '壤土', planting_status: '计划播种'
    })
    assert.strictEqual(updated.status, 200)

    const batchDeleted = await request(baseUrl, token, 'POST', '/api/plots/batch-delete', { ids: [7, 7] })
    assert.strictEqual(batchDeleted.status, 200)
    assert.strictEqual(batchDeleted.json.data.deleted, 1)

    const deleted = await request(baseUrl, token, 'DELETE', '/api/plots/7')
    assert.strictEqual(deleted.status, 200)

    console.log('plots API tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
