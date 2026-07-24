const assert = require('assert')
const marketing = require('../utils/marketing')

function validCampaign(overrides = {}) {
  return {
    kind: 'coupon',
    type: 'cash',
    name: '测试优惠券',
    discount_amount: 10,
    total_quota: 100,
    per_user_limit: 1,
    starts_at: new Date(Date.now() + 60000).toISOString(),
    ends_at: new Date(Date.now() + 86400000).toISOString(),
    ...overrides
  }
}

function executorFor(records) {
  const calls = []
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: String(sql), params })
      if (String(sql).includes('SELECT * FROM order_promotions')) return [records]
      return [{ affectedRows: 1 }]
    }
  }
}

async function run() {
  assert.strictEqual(
    marketing.parseCampaignDate('2026-07-21T17:00').toISOString(),
    '2026-07-21T09:00:00.000Z',
    'merchant wall-clock values must be interpreted as China Standard Time'
  )
  assert.strictEqual(
    marketing.mysqlDate(new Date('2026-07-21T09:00:00.000Z')),
    '2026-07-21 17:00:00',
    'absolute timestamps must be stored as China Standard Time'
  )

  assert.throws(
    () => marketing.validateCampaignPayload(validCampaign({ discount_amount: 'invalid' })),
    /数值格式无效/
  )
  assert.throws(
    () => marketing.validateCampaignPayload(validCampaign({ total_quota: 1.5 })),
    /大于 0 的整数/
  )
  assert.throws(
    () => marketing.validateCampaignPayload(validCampaign({ per_user_limit: 2.5 })),
    /大于 0 的整数/
  )
  assert.throws(
    () => marketing.validateCampaignPayload(validCampaign({ type: 'free_shipping' })),
    /全场包邮/
  )
  assert.strictEqual(
    marketing.validateCampaignPayload(validCampaign({ per_user_limit: 3 })).perUserLimit,
    1,
    'coupons must always be limited to one claim per farmer'
  )
  assert.strictEqual(
    marketing.validateCampaignPayload(validCampaign({ kind: 'promotion', type: 'flash_sale', scope_type: 'products', product_ids: [1], special_price: 1, total_quota: 10, per_user_limit: 3 })).perUserLimit,
    3,
    'promotion purchase limits should remain configurable'
  )
  assert.strictEqual(marketing.isBetterCouponPricing(
    { couponApplied: true, payableFen: 8000, couponDiscountFen: 2000 },
    { couponApplied: true, payableFen: 9000, couponDiscountFen: 1000 }
  ), true, 'lowest final payable amount should win')
  assert.strictEqual(marketing.isBetterCouponPricing(
    { couponApplied: true, payableFen: 9000, couponDiscountFen: 1000 },
    { couponApplied: true, payableFen: 8000, couponDiscountFen: 2000 }
  ), false)

  const lifecycle = executorFor([])
  await marketing.syncCampaignStatuses(lifecycle)
  const lifecycleUpdate = lifecycle.calls.find(call => call.sql.includes('SET status=CASE'))
  assert.ok(lifecycleUpdate, 'campaign listing should be able to persist lifecycle status changes')
  assert.strictEqual(lifecycleUpdate.params.length, 2)

  const records = [
    { campaign_id: 1, kind: 'coupon', user_coupon_id: 9, type: 'cash' },
    { campaign_id: 2, kind: 'promotion', type: 'limited_discount' },
    { campaign_id: 2, kind: 'promotion', type: 'limited_discount' },
    { campaign_id: 3, kind: 'promotion', type: 'tiered_reduction' }
  ]
  const paid = executorFor(records)
  await marketing.markOrderPaid(88, paid)
  const increments = paid.calls.filter(call => call.sql.includes('used_count=used_count+1'))
  assert.deepStrictEqual(increments.map(call => Number(call.params[0])).sort(), [1, 2, 3])

  const refunded = executorFor(records)
  await marketing.returnCouponAfterRefund(88, refunded)
  const decrements = refunded.calls.filter(call => call.sql.includes('used_count=GREATEST'))
  assert.deepStrictEqual(decrements.map(call => Number(call.params[0])).sort(), [1, 2, 3])

  console.log('marketing lifecycle tests passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
