const assert = require('assert')
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'multi-role-auth-test-secret'

const dbPath = require.resolve('../db/database')

async function run() {
  const password = 'merchant123'
  const merchant = {
    id: 3,
    phone: '13800000002',
    password: await bcrypt.hash(password, 4),
    role: 'merchant',
    real_name: '测试商户兼农户',
    is_verified: 0,
    is_active: 1,
    avatar_url: null
  }
  let farmerProfile = null
  let farmerInsertCount = 0
  const legacyFarmerSchema = true

  const mockDb = {
    async query(sql, params = []) {
      const compact = String(sql).replace(/\s+/g, ' ').trim()
      if (/FROM users WHERE phone=\?/i.test(compact)) return [[{ ...merchant }], []]
      if (/FROM farmers WHERE user_id=\?/i.test(compact)) {
        if (legacyFarmerSchema && /crop_type/i.test(compact)) {
          const error = new Error('Unknown column crop_type')
          error.code = 'ER_BAD_FIELD_ERROR'
          throw error
        }
        return [farmerProfile ? [{ ...farmerProfile }] : [], []]
      }
      if (/INSERT INTO farmers/i.test(compact)) {
        if (legacyFarmerSchema && /crop_type/i.test(compact)) {
          const error = new Error('Unknown column crop_type')
          error.code = 'ER_BAD_FIELD_ERROR'
          throw error
        }
        farmerInsertCount += 1
        farmerProfile = {
          location: params[1] || '',
          land_size: Number(params[2] || 0),
          crop_type: params[3] || '棉花'
        }
        return [{ insertId: 9, affectedRows: 1 }]
      }
      if (/FROM users WHERE id=\? AND is_active=1/i.test(compact)) return [[{ ...merchant }], []]
      if (/INSERT INTO login_logs/i.test(compact)) return [{ insertId: 1, affectedRows: 1 }]
      throw new Error(`Unexpected SQL in multi-role auth test: ${compact}`)
    }
  }

  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
  const authRouter = require('../routes/auth')
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  async function request(path, body, token = '') {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    return { status: response.status, json: await response.json() }
  }

  try {
    const wrongPassword = await request('/api/auth/register', {
      phone: merchant.phone,
      password: 'wrong-password',
      role: 'farmer',
      real_name: merchant.real_name,
      location: '喀什地区',
      land_size: 120
    })
    assert.strictEqual(wrongPassword.status, 409)
    assert.match(wrongPassword.json.msg, /原账号密码/)
    assert.strictEqual(farmerInsertCount, 0)

    const registration = await request('/api/auth/register', {
      phone: merchant.phone,
      password,
      role: 'farmer',
      real_name: merchant.real_name,
      location: '喀什地区',
      land_size: 120
    })
    assert.strictEqual(registration.status, 200)
    assert.strictEqual(registration.json.data.role, 'farmer')
    assert.strictEqual(jwt.verify(registration.json.data.token, process.env.JWT_SECRET).role, 'farmer')
    assert.strictEqual(merchant.role, 'merchant', 'the primary web account role must remain merchant')
    assert.strictEqual(farmerInsertCount, 1)

    const login = await request('/api/auth/login', { phone: merchant.phone, password, role: 'farmer' })
    assert.strictEqual(login.status, 200)
    assert.strictEqual(login.json.data.role, 'farmer')
    assert.strictEqual(login.json.data.location, '喀什地区')
    assert.strictEqual(login.json.data.crop_type, '棉花', 'legacy cloud schemas should receive the default crop type')

    const verify = await request('/api/auth/verify', null, login.json.data.token)
    assert.strictEqual(verify.status, 200)
    assert.strictEqual(verify.json.data.role, 'farmer')
    assert.strictEqual(verify.json.data.location, '喀什地区')
    assert.strictEqual(verify.json.data.password, undefined, 'verification responses must never expose password hashes')

    const duplicate = await request('/api/auth/register', {
      phone: merchant.phone,
      password,
      role: 'farmer',
      real_name: merchant.real_name,
      location: '喀什地区'
    })
    assert.strictEqual(duplicate.status, 409)
    assert.match(duplicate.json.msg, /已注册农户身份/)

    console.log('merchant and farmer multi-role auth tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
