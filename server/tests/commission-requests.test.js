const assert = require('assert')

const queries = []
const dbPath = require.resolve('../db/database')
const mockDb = {
  async query(sql, params = []) {
    queries.push({ sql, params })
    if (sql.includes('SELECT id, company_name')) return [[{ id: 4, applicant_name: '测试商户', commission_rate: '5.00' }]]
    if (sql.includes('FROM commission_change_requests WHERE applicant_type')) {
      return [[{ id: 9, current_rate: '5.00', requested_rate: '8.00', status: 'pending', reason: '服务成本增加' }]]
    }
    if (sql.includes('SELECT commission_rate FROM merchants')) return [[{ commission_rate: '5.00' }]]
    if (sql.includes("status='pending' LIMIT 1")) return [[]]
    if (sql.includes('INSERT INTO commission_change_requests')) return [{ insertId: 10 }]
    return [[]]
  },
  async getConnection() {
    return {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      async query(sql, params = []) {
        queries.push({ sql, params })
        if (sql.includes('FOR UPDATE')) return [[{ id: 10, applicant_type: 'operator', applicant_id: 3, requested_rate: '7.50' }]]
        return [{ affectedRows: 1 }]
      }
    }
  }
}
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
const commissions = require('../utils/commission-requests')

async function run() {
  const summary = await commissions.getSummary('merchant', 4)
  assert.strictEqual(summary.current_rate, 5)
  assert.strictEqual(summary.latest_request.id, 9)

  const submitted = await commissions.submit('merchant', 4, 8, '经营服务范围扩大，需要调整平台佣金')
  assert.strictEqual(submitted.id, 10)
  assert.strictEqual(submitted.requested_rate, 8)

  await commissions.review(10, 'approved', '同意调整', 1)
  assert(queries.some(item => item.sql.includes('UPDATE operators SET commission_rate=?')))
  assert(queries.some(item => item.sql.includes('UPDATE commission_change_requests SET status=?')))

  assert.throws(() => commissions.normalizeRate(101), /0% 到 100%/)
  console.log('commission request tests passed')
}

run().catch(error => { console.error(error); process.exit(1) })
