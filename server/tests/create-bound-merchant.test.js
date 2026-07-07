const assert = require('assert')

const { upsertBoundMerchant, upsertSelfOperatedMerchant } = require('../utils/merchant-account')

function makeDb() {
  const calls = []
  let userRows = []
  let merchantRows = []
  const db = {
    calls,
    setUserRows(rows) { userRows = rows },
    setMerchantRows(rows) { merchantRows = rows },
    async query(sql, params = []) {
      const compact = sql.replace(/\s+/g, ' ').trim()
      calls.push({ sql: compact, params })
      if (/SELECT id, role FROM users WHERE phone=\?/i.test(sql)) return [userRows]
      if (/INSERT INTO users/i.test(compact)) return [{ insertId: 101 }]
      if (/SELECT id FROM merchants WHERE user_id=\?/i.test(sql)) return [merchantRows]
      if (/INSERT INTO merchants/i.test(compact)) return [{ insertId: 202 }]
      if (/UPDATE users SET/i.test(compact)) return [{ affectedRows: 1 }]
      if (/UPDATE merchants SET/i.test(compact)) return [{ affectedRows: 1 }]
      throw new Error(`Unexpected SQL: ${compact}`)
    }
  }
  return db
}

async function run() {
  const bcrypt = { async hash(value) { return `hashed:${value}` } }

  const db = makeDb()
  const created = await upsertBoundMerchant({
    db,
    bcrypt,
    input: {
      phone: '13900000009',
      password: 'test123',
      subMchid: '1700000001',
      realName: 'Payment Test Merchant',
      companyName: 'Cotton Test Store',
      businessLicense: 'TESTLICENSE001',
      productCategory: 'fertilizer',
      commissionRate: 5
    }
  })
  assert.deepStrictEqual(created, {
    userId: 101,
    merchantId: 202,
    createdUser: true,
    createdMerchant: true,
    subMchid: '1700000001'
  })
  assert(db.calls.some(call => /INSERT INTO users/i.test(call.sql)), 'should create user')
  assert(db.calls.some(call => /INSERT INTO merchants/i.test(call.sql)), 'should create merchant')
  assert(db.calls.some(call => call.params.includes('1700000001')), 'should bind sub_mchid')

  const existingDb = makeDb()
  existingDb.setUserRows([{ id: 7, role: 'merchant' }])
  existingDb.setMerchantRows([{ id: 8 }])
  const updated = await upsertBoundMerchant({
    db: existingDb,
    bcrypt,
    input: {
      phone: '13900000009',
      password: 'newpass123',
      subMchid: '1700000002',
      companyName: 'Updated Cotton Test Store'
    }
  })
  assert.strictEqual(updated.createdUser, false)
  assert.strictEqual(updated.createdMerchant, false)
  assert.strictEqual(updated.userId, 7)
  assert.strictEqual(updated.merchantId, 8)
  assert(existingDb.calls.some(call => /UPDATE users SET/i.test(call.sql)), 'should update existing user')
  assert(existingDb.calls.some(call => /UPDATE merchants SET/i.test(call.sql)), 'should update existing merchant')

  await assert.rejects(() => upsertBoundMerchant({
    db,
    bcrypt,
    input: { phone: '13900000009', password: 'test123', subMchid: 'abc' }
  }), /sub_mchid/)

  const farmerDb = makeDb()
  farmerDb.setUserRows([{ id: 9, role: 'farmer' }])
  await assert.rejects(() => upsertBoundMerchant({
    db: farmerDb,
    bcrypt,
    input: { phone: '13900000009', password: 'test123', subMchid: '1700000001' }
  }), /already exists as farmer/)

  const selfDb = makeDb()
  const self = await upsertSelfOperatedMerchant({
    db: selfDb,
    bcrypt,
    input: {
      phone: '13900000010',
      password: 'test123',
      realName: 'Cotton Self Operated',
      companyName: 'Cotton Platform Store'
    }
  })
  assert.deepStrictEqual(self, {
    userId: 101,
    merchantId: 202,
    createdUser: true,
    createdMerchant: true,
    selfOperated: true
  })
  assert(selfDb.calls.some(call => /INSERT INTO merchants/i.test(call.sql)), 'should create self-operated merchant')
  assert(selfDb.calls.some(call => call.params.includes('SELF_OPERATED')), 'should mark self-operated merchant')

  console.log('create bound merchant tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
