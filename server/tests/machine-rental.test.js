const assert = require('assert')
const express = require('express')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')

process.env.JWT_SECRET = 'machine-rental-test-secret'

let createMode = 'ready'
let operatorOrder = null
let insertedSql = ''
let insertedParams = []
let refundCalls = 0

const connection = {
  async beginTransaction() {},
  async commit() {},
  async rollback() {},
  release() {},
  async query(sql, params = []) {
    const compact = sql.replace(/\s+/g, ' ').trim()
    if (/FROM machines m JOIN operators o.*FOR UPDATE/i.test(compact)) {
      return [[{
        id: 5, operator_id: 3, name: '采棉机', icon: 'M', price: '100.00',
        service_lat: '31.2200', service_lng: '121.5400', service_radius: '50',
        sub_mchid: '1700000003', apply_status: 'approved', unit: createMode === 'byDay' ? '天' : '亩'
      }], []]
    }
    if (/SELECT id FROM machine_orders WHERE machine_id=/i.test(compact)) {
      return [[createMode === 'conflict' ? { id: 99 } : undefined], []]
    }
    if (/SELECT real_name,phone FROM users/i.test(compact)) {
      return [[{ real_name: '测试农户', phone: '13800138000' }], []]
    }
    if (/INSERT INTO machine_orders/i.test(compact)) {
      insertedSql = compact
      insertedParams = params
      return [{ insertId: 88 }]
    }
    throw new Error(`Unexpected transaction SQL: ${compact}`)
  }
}

const mockDb = {
  async getConnection() { return connection },
  async query(sql) {
    const compact = sql.replace(/\s+/g, ' ').trim()
    if (/支付超时自动取消/i.test(compact)) return [{ affectedRows: 0 }]
    if (/SELECT \* FROM machine_orders WHERE id=.*operator_id/i.test(compact)) return [[operatorOrder], []]
    if (/UPDATE machine_orders SET status='accepted'/i.test(compact)) return [{ affectedRows: 1 }]
    if (/UPDATE machines SET order_count/i.test(compact)) return [{ affectedRows: 1 }]
    if (/UPDATE machine_orders SET status='cancelled'/i.test(compact)) return [{ affectedRows: 1 }]
    if (/FROM machine_reviews mr JOIN machine_orders/i.test(compact)) {
      return [[{ id: 7, order_id: 88, order_no: 'MJ88', machine_name: '采棉机', rating: '5.00', content: '很好', reply: '' }], []]
    }
    if (/UPDATE machine_reviews SET reply=/i.test(compact)) return [{ affectedRows: 1 }]
    throw new Error(`Unexpected database SQL: ${compact}`)
  }
}

const mockRefunds = {
  async createMachineRefund() {
    refundCalls += 1
    return { status: 'SUCCESS' }
  },
  async syncPendingMachineRefunds() { return { total: 0, synced: 0 } }
}

const dbPath = require.resolve('../db/database')
const refundsPath = require.resolve('../utils/refunds')
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
require.cache[refundsPath] = { id: refundsPath, filename: refundsPath, loaded: true, exports: mockRefunds }

const machineOrdersRouter = require('../routes/machine-orders')
const operatorRouter = require('../routes/operator')

function dateAfter(days) {
  const date = new Date(Date.now() + days * 86400000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date)
}

async function jsonRequest(baseUrl, path, token, method = 'POST', body = {}) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }
  if (method !== 'GET') options.body = JSON.stringify(body)
  const response = await fetch(`${baseUrl}${path}`, options)
  return { status: response.status, json: await response.json() }
}

async function run() {
  const dashboardHtml = fs.readFileSync(path.join(__dirname, '../public/operator/dashboard.html'), 'utf8')
  const dashboardScript = dashboardHtml.match(/<script>([\s\S]*?)<\/script>/i)
  assert(dashboardScript, 'operator dashboard script should exist')
  assert.doesNotThrow(() => new Function(dashboardScript[1]))
  const trackWxml = fs.readFileSync(path.join(__dirname, '../../pages/machine/track.wxml'), 'utf8')
  assert.match(trackWxml, /onPayInitial/)
  assert.match(trackWxml, /paid_amount_text/)
  const paymentsSource = fs.readFileSync(path.join(__dirname, '../routes/payments.js'), 'utf8')
  assert.match(paymentsSource, /machine-late-payment-refund/)
  assert.match(paymentsSource, /skipProfitSharing/)

  const app = express()
  app.use(express.json())
  app.use('/api/machine-orders', machineOrdersRouter)
  app.use('/api/operator', operatorRouter)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const farmerToken = jwt.sign({ id: 42, role: 'farmer' }, process.env.JWT_SECRET)
  const merchantToken = jwt.sign({ id: 7, role: 'merchant' }, process.env.JWT_SECRET)
  const operatorToken = jwt.sign({ id: 9, role: 'operator', operator_id: 3 }, process.env.JWT_SECRET)
  const booking = {
    machine_id: 5, work_address: '上海市浦东新区测试地块', work_date: dateAfter(1),
    work_area: 10, farmer_lat: 31.221, farmer_lng: 121.541,
    contact_phone: '13800138000'
  }

  try {
    const forbidden = await jsonRequest(baseUrl, '/api/machine-orders', merchantToken, 'POST', booking)
    assert.strictEqual(forbidden.status, 403)

    const past = await jsonRequest(baseUrl, '/api/machine-orders', farmerToken, 'POST', {
      ...booking, work_date: dateAfter(-1)
    })
    assert.strictEqual(past.status, 400)
    assert.match(past.json.msg, /不能早于今天/)

    createMode = 'conflict'
    const conflict = await jsonRequest(baseUrl, '/api/machine-orders', farmerToken, 'POST', booking)
    assert.strictEqual(conflict.status, 409)
    assert.match(conflict.json.msg, /已有预约/)

    createMode = 'ready'
    const created = await jsonRequest(baseUrl, '/api/machine-orders', farmerToken, 'POST', booking)
    assert.strictEqual(created.status, 200)
    assert.strictEqual(created.json.data.id, 88)
    assert.match(insertedSql, /pay_expires_at/)
    assert.match(insertedSql, /DATE_ADD\(NOW\(\), INTERVAL 30 MINUTE\)/)

    createMode = 'byDay'
    const byDay = await jsonRequest(baseUrl, '/api/machine-orders', farmerToken, 'POST', {
      ...booking, work_date: dateAfter(3), work_area: 3
    })
    assert.strictEqual(byDay.status, 200)
    assert.strictEqual(insertedParams[13], '天')
    assert.strictEqual(insertedParams[10], dateAfter(5))

    operatorOrder = { id: 88, machine_id: 5, operator_id: 3, status: 'pending', pay_status: 'unpaid', refund_status: '' }
    const unpaidAccept = await jsonRequest(baseUrl, '/api/operator/orders/88/accept', operatorToken, 'PATCH')
    assert.strictEqual(unpaidAccept.status, 409)
    assert.match(unpaidAccept.json.msg, /尚未支付/)

    operatorOrder = { ...operatorOrder, pay_status: 'partial' }
    const paidAccept = await jsonRequest(baseUrl, '/api/operator/orders/88/accept', operatorToken, 'PATCH')
    assert.strictEqual(paidAccept.status, 200)

    operatorOrder = { id: 89, machine_id: 5, operator_id: 3, status: 'pending', pay_status: 'unpaid' }
    refundCalls = 0
    const unpaidReject = await jsonRequest(baseUrl, '/api/operator/orders/89/reject', operatorToken, 'PATCH', { reason: '档期冲突' })
    assert.strictEqual(unpaidReject.status, 200)
    assert.strictEqual(refundCalls, 0)

    const reviews = await jsonRequest(baseUrl, '/api/operator/reviews', operatorToken, 'GET')
    assert.strictEqual(reviews.status, 200)
    assert.strictEqual(reviews.json.data.length, 1)
    const reply = await jsonRequest(baseUrl, '/api/operator/reviews/7/reply', operatorToken, 'PATCH', { reply: '感谢认可' })
    assert.strictEqual(reply.status, 200)

    console.log('machine rental route tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
