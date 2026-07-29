const assert = require('assert')
const points = require('../utils/points')

function accountDb(balance, eligible = true) {
  return {
    async query(sql) {
      if (sql.includes('INSERT IGNORE INTO farmer_points_accounts')) return [{ affectedRows: 0 }]
      if (sql.includes('FROM farmer_points_accounts WHERE user_id=')) {
        return [eligible ? [{
          user_id: 7,
          balance,
          locked_points: 0,
          total_earned: balance,
          total_used: 0
        }] : []]
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }
}

function ledgerDb(status = 'locked', balance = 800) {
  const statements = []
  return {
    statements,
    async query(sql, params) {
      const compact = sql.replace(/\s+/g, ' ').trim()
      statements.push({ sql: compact, params })
      if (compact.includes('FROM farmer_points_transactions') && compact.includes('reference_key=?')) {
        if (compact.startsWith('SELECT id,user_id,points,status')) {
          return [[{ id: 31, user_id: 7, points: -200, status }]]
        }
        return [[]]
      }
      if (compact.includes('SELECT balance FROM farmer_points_accounts')) return [[{ balance }]]
      if (compact.startsWith('UPDATE farmer_points_accounts')) return [{ affectedRows: 1 }]
      if (compact.startsWith('UPDATE farmer_points_transactions')) return [{ affectedRows: 1 }]
      if (compact.startsWith('INSERT IGNORE INTO farmer_points_transactions')) return [{ affectedRows: 1 }]
      if (compact.startsWith('INSERT INTO farmer_points_transactions')) return [{ insertId: 32 }]
      throw new Error(`Unexpected SQL: ${compact}`)
    }
  }
}

function reconcileDb() {
  const database = ledgerDb('locked')
  const originalQuery = database.query.bind(database)
  database.query = async (sql, params) => {
    if (sql.includes("t.type='order_redeem'") && sql.includes("t.status='locked'")) {
      database.statements.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
      return [[{ order_id: 94, status: 'pending_ship' }]]
    }
    return originalQuery(sql, params)
  }
  return database
}

async function run() {
  const pricing = {
    payableFen: 10000,
    originalSubtotalFen: 10000,
    commissionBaseFen: 10000,
    merchant: { commission_rate: 5 }
  }

  const maximum = await points.quoteRedemption(accountDb(2500), {
    userId: 7,
    pricing,
    usePoints: true
  })
  assert.strictEqual(maximum.maxPointsUsable, 500)
  assert.strictEqual(maximum.pointsUsed, 500)
  assert.strictEqual(maximum.payableFen, 9500)

  const requested = await points.quoteRedemption(accountDb(2500), {
    userId: 7,
    pricing,
    usePoints: true,
    requestedPoints: 250
  })
  assert.strictEqual(requested.pointsUsed, 250)
  assert.strictEqual(requested.payableFen, 9750)

  const disabled = await points.quoteRedemption(accountDb(2500), {
    userId: 7,
    pricing,
    usePoints: false
  })
  assert.strictEqual(disabled.maxPointsUsable, 500)
  assert.strictEqual(disabled.pointsUsed, 0)

  const belowMinimum = await points.quoteRedemption(accountDb(1000), {
    userId: 7,
    pricing: { ...pricing, merchant: { commission_rate: 0.5 } },
    usePoints: true
  })
  assert.strictEqual(belowMinimum.maxPointsUsable, 0)
  assert.strictEqual(belowMinimum.pointsUsed, 0)

  const guest = await points.quoteRedemption(accountDb(2500), {
    userId: null,
    pricing,
    usePoints: true
  })
  assert.strictEqual(guest.pointsUsed, 0)
  assert.match(guest.pointsReason, /登录/)

  const merchantOnly = await points.quoteRedemption(accountDb(2500, false), {
    userId: 7,
    pricing,
    usePoints: true
  })
  assert.strictEqual(merchantOnly.pointsUsed, 0)
  assert.match(merchantOnly.pointsReason, /农户身份/)

  const publicQuote = points.publicQuote(requested)
  assert.strictEqual(publicQuote.points_discount, 2.5)
  assert.strictEqual(publicQuote.payable_total, 97.5)
  assert.strictEqual(publicQuote.points_applied, true)

  const settleDb = ledgerDb('locked')
  assert.strictEqual(await points.settleOrderPoints(91, settleDb), true)
  assert(settleDb.statements.some(item => item.sql.includes('total_used=total_used+?')))
  assert(settleDb.statements.some(item => item.sql.includes("status='completed'")))

  const cancelDb = ledgerDb('locked')
  assert.strictEqual(await points.releaseOrderPoints(92, cancelDb), true)
  assert(cancelDb.statements.some(item => item.sql.includes('balance=balance+?')))
  assert(cancelDb.statements.some(item => item.sql.includes("'order_return'")))

  const refundDb = ledgerDb('completed')
  assert.strictEqual(await points.returnOrderPointsAfterRefund(93, refundDb), true)
  assert(refundDb.statements.some(item => item.sql.includes('total_used=GREATEST(total_used-?,0)')))
  assert(refundDb.statements.some(item => (item.params || []).includes('order:93:refund_return')))

  const recovered = await points.reconcileLockedOrderPoints(20, reconcileDb())
  assert.deepStrictEqual(recovered, { checked: 1, settled: 1, returned: 0 })

  console.log('points utility tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
