const assert = require('assert')
const points = require('../utils/points')

function awardDb({ balance = 60, dailyEarned = 20, existing = false, eligible = true } = {}) {
  const statements = []
  return {
    statements,
    async query(sql, params) {
      statements.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
      if (sql.includes('reference_key=?')) return [[existing ? { id: 1, points: 20 } : undefined].filter(Boolean)]
      if (sql.includes('INSERT IGNORE INTO farmer_points_accounts')) return [{ affectedRows: 1 }]
      if (sql.includes('SUM(points)')) return [[{ earned: dailyEarned }]]
      if (sql.includes('SELECT balance FROM farmer_points_accounts')) return [eligible ? [{ balance }] : []]
      if (sql.includes('UPDATE farmer_points_accounts')) return [{ affectedRows: 1 }]
      if (sql.includes('INSERT INTO farmer_points_transactions')) return [{ insertId: 1 }]
      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }
}

async function run() {
  const executor = awardDb()
  const reward = await points.awardCourseCompletion(executor, 7, {
    id: 12,
    title: '苗期诊断',
    difficulty: 'advanced'
  })
  assert.deepStrictEqual(reward, {
    awarded: true,
    points: 40,
    balance: 100,
    reason: ''
  })
  const insert = executor.statements.find(item => item.sql.includes('INSERT INTO farmer_points_transactions'))
  assert.strictEqual(insert.params[3], 'course:7:12:complete')
  const accountLockIndex = executor.statements.findIndex(item => item.sql.includes('FOR UPDATE'))
  const dailyTotalIndex = executor.statements.findIndex(item => item.sql.includes('SUM(points)'))
  assert(accountLockIndex >= 0 && accountLockIndex < dailyTotalIndex, 'account must be locked before checking the daily cap')

  const capped = await points.awardCourseCompletion(awardDb({ dailyEarned: 90 }), 7, {
    id: 13,
    title: '水肥管理',
    difficulty: 'intermediate'
  })
  assert.strictEqual(capped.points, 10)

  const duplicate = await points.awardCourseCompletion(awardDb({ existing: true }), 7, {
    id: 12,
    title: '苗期诊断',
    difficulty: 'advanced'
  })
  assert.strictEqual(duplicate.awarded, false)
  assert.match(duplicate.reason, /已经发放/)

  const ineligible = await points.awardCourseCompletion(awardDb({ eligible: false }), 8, {
    id: 14,
    title: '商户学习课程',
    difficulty: 'intro'
  })
  assert.strictEqual(ineligible.awarded, false)
  assert.match(ineligible.reason, /农户身份/)

  console.log('community points tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
