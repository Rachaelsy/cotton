const assert = require('assert')
const express = require('express')
const fs = require('fs')
const path = require('path')

process.env.JWT_SECRET = 'orders-route-test-secret'

const dbPath = require.resolve('../db/database')
const calls = []

const mockConnection = {
  async beginTransaction() {
    calls.push({ type: 'begin' })
  },
  async query(sql, params = []) {
    const compact = sql.replace(/\s+/g, ' ').trim()
    calls.push({ type: 'conn-sql', sql: compact, params })
    if (/SELECT p\.id,p\.merchant_id.*FROM products p JOIN merchants m/i.test(compact)) {
      return [[{
        id: 1,
        merchant_id: 7,
        name: '测试商品',
        category: '化肥',
        price: '10.01',
        unit: '袋',
        stock: 100,
        status: 'on',
        icon: '📦',
        image_url: null,
        company_name: '测试商户',
        commission_rate: 5,
        sub_mchid: '',
        wechat_applyment_state: '',
        merchant_latitude: 39.38,
        merchant_longitude: 75.86,
        delivery_radius: 50
      }], []]
    }
    if (/FROM marketing_campaigns c/i.test(compact)) {
      return [[], []]
    }
    if (/UPDATE products SET stock=stock-\?/i.test(compact)) {
      return [{ affectedRows: 1 }, []]
    }
    if (/INSERT INTO orders/i.test(compact)) {
      return [{ insertId: 77 }, []]
    }
    if (/INSERT INTO order_items/i.test(compact)) {
      return [{ insertId: 88 }, []]
    }
    throw new Error(`Unexpected connection SQL in test: ${sql}`)
  },
  async commit() {
    calls.push({ type: 'commit' })
  },
  async rollback() {
    calls.push({ type: 'rollback' })
  },
  release() {
    calls.push({ type: 'release' })
  }
}

const mockDb = {
  async query(sql, params = []) {
    const compact = sql.replace(/\s+/g, ' ').trim()
    calls.push({ type: 'db-sql', sql: compact, params })
    if (/SELECT COUNT\(\*\) AS cnt FROM orders WHERE order_no LIKE \?/i.test(compact)) {
      return [[{ cnt: 0 }], []]
    }
    throw new Error(`Unexpected DB SQL in test: ${sql}`)
  },
  async getConnection() {
    calls.push({ type: 'getConnection' })
    return mockConnection
  }
}

require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
const ordersRouter = require('../routes/orders')

async function request(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { status: response.status, json: await response.json() }
}

function assertCheckoutUiShowsFreeShipping() {
  const root = path.join(__dirname, '..', '..')
  const checkoutJs = fs.readFileSync(path.join(root, 'subpkg-supplies/supplies-checkout/index.js'), 'utf8')
  const checkoutWxml = fs.readFileSync(path.join(root, 'subpkg-supplies/supplies-checkout/index.wxml'), 'utf8')
  const detailWxml = fs.readFileSync(path.join(root, 'subpkg-supplies/supplies-detail/index.wxml'), 'utf8')
  const orderWxml = fs.readFileSync(path.join(root, 'subpkg-supplies/supplies-order/index.wxml'), 'utf8')
  const merchantDashboard = fs.readFileSync(path.join(root, 'server/public/merchant/dashboard.html'), 'utf8')

  assert.match(checkoutJs, /DELIVERY_FEE\s*=\s*0/, 'checkout should use a zero freight constant')
  assert(!/deliveryFee\s*=\s*10/.test(checkoutJs), 'checkout should not create orders with 10 yuan freight')
  assert(!/¥10/.test(checkoutWxml), 'checkout should not display 10 yuan freight')
  assert(!/快递\s*¥10/.test(detailWxml), 'product detail should not advertise 10 yuan freight')
  assert(!/运费[\s\S]{0,80}¥10/.test(orderWxml), 'order detail should not display 10 yuan freight')
  assert(!merchantDashboard.includes("['free_shipping','运费券']"), 'merchant should not create a useless shipping coupon while all orders ship free')
}

async function run() {
  assertCheckoutUiShowsFreeShipping()

  const app = express()
  app.use(express.json())
  app.use('/api/orders', ordersRouter)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  try {
    const result = await request(baseUrl, {
      items: [{ id: 1, name: '测试商品', price: 10.01, qty: 1, merchant_id: 7 }],
      subtotal: 10.01,
      deliveryFee: 10,
      total: 20.01,
      payMethod: 'wechat',
      receiverName: '测试农户',
      receiverPhone: '13800000001',
      address: '喀什测试地址'
    })

    assert.strictEqual(result.status, 200)
    const insertOrder = calls.find(call => call.type === 'conn-sql' && /INSERT INTO orders/i.test(call.sql))
    assert(insertOrder, 'route should insert the order')
    assert.strictEqual(insertOrder.params[13], 10.01, 'subtotal should keep server-priced product amount')
    assert.strictEqual(insertOrder.params[14], 0, 'delivery_fee should be zero')
    assert.strictEqual(insertOrder.params[15], 10.01, 'total should be subtotal plus zero freight')
    assert(!calls.some(call => call.type === 'rollback'), 'successful order should not rollback')

    const outOfRange = await request(baseUrl, {
      items: [{ id: 1, qty: 1 }],
      payMethod: 'wechat',
      receiverName: '测试农户',
      receiverPhone: '13800000001',
      address: '上海市浦东新区测试地址',
      receiverLatitude: 31.22114,
      receiverLongitude: 121.54409
    })
    assert.strictEqual(outOfRange.status, 409, 'selected shipping location outside the merchant radius should be rejected')
    assert.match(outOfRange.json.msg, /超出商户配送范围/)

    console.log('supply shipping fee tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
