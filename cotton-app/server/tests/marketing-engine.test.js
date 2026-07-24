const assert = require('assert')
const engine = require('../utils/marketing-engine')

function campaign(overrides = {}) {
  return engine.normalizeCampaign({
    id: 1,
    merchant_id: 8,
    kind: 'promotion',
    type: 'limited_discount',
    scope_type: 'all',
    discount_rate: 90,
    stackable: 0,
    products: [],
    ...overrides
  })
}

function line(overrides = {}) {
  return {
    productId: 11,
    merchantId: 8,
    category: '化肥',
    originalPriceFen: 10000,
    qty: 1,
    ...overrides
  }
}

function run() {
  assert.strictEqual(engine.toFen(19.999), 2000)
  assert.strictEqual(engine.fromFen(1234), 12.34)

  const flash = campaign({
    id: 2,
    type: 'flash_sale',
    scope_type: 'products',
    special_price: 60,
    products: [{ product_id: 11, promo_price: 55 }]
  })
  const limited = campaign({ id: 3, discount_rate: 80 })
  const bestProduct = engine.calculateAutomaticPromotions([line()], [flash, limited])
  assert.strictEqual(bestProduct.totalDiscountFen, 4500, 'best product promotion should win')
  assert.strictEqual(bestProduct.lines[0].promotion.id, 2)
  const soldOutFlash = campaign({
    id: 13,
    type: 'flash_sale',
    scope_type: 'products',
    special_price: 60,
    products: [{ product_id: 11, promo_price: 55, available_stock: 0 }]
  })
  assert.strictEqual(engine.calculateAutomaticPromotions([line()], [soldOutFlash]).totalDiscountFen, 0)

  const buyGift = campaign({ id: 4, type: 'buy_x_get_y', buy_quantity: 2, gift_quantity: 1 })
  const giftResult = engine.calculateAutomaticPromotions([line({ qty: 7, originalPriceFen: 1200 })], [buyGift])
  assert.strictEqual(giftResult.totalDiscountFen, 2400, 'buy 2 get 1 should grant two free units for seven items')

  const tier = campaign({
    id: 5,
    type: 'tiered_reduction',
    rules_json: { tiers: [{ threshold: 100, discount: 10 }, { threshold: 300, discount: 50 }] }
  })
  const tierResult = engine.calculateAutomaticPromotions([line({ qty: 3 })], [campaign({ id: 12, discount_rate: 90 }), tier])
  assert.strictEqual(tierResult.totalDiscountFen, 5000, 'non-stackable tier should replace smaller product discount')

  const stackedLimited = campaign({ id: 6, discount_rate: 50, stackable: 1 })
  const stackedTier = campaign({
    id: 7,
    type: 'tiered_reduction',
    stackable: 1,
    rules_json: { tiers: [{ threshold: 100, discount: 80 }] }
  })
  const cappedStack = engine.calculateAutomaticPromotions([line()], [stackedLimited, stackedTier])
  assert.strictEqual(cappedStack.totalDiscountFen, 10000, 'stacked promotions must not exceed the remaining item amount')
  assert.strictEqual(cappedStack.lines[0].promotionDiscountFen, 10000)
  assert.strictEqual(cappedStack.lines[0].productPromotionDiscountFen, 5000)
  assert.strictEqual(cappedStack.lines[0].orderPromotionDiscountFen, 5000)
  assert.strictEqual(cappedStack.lines[0].promotion.id, 6)
  assert.strictEqual(cappedStack.lines[0].orderPromotion.id, 7)

  const fullReduction = campaign({
    id: 8,
    kind: 'coupon',
    type: 'full_reduction',
    threshold_amount: 80,
    discount_amount: 20,
    stackable: 1
  })
  const couponStack = engine.applyCoupon(bestProduct, fullReduction)
  assert.strictEqual(couponStack.couponApplied, false, 'threshold should use the post-promotion amount when stacking')

  const percentage = campaign({
    id: 9,
    kind: 'coupon',
    type: 'percentage',
    discount_rate: 70,
    max_discount: 15,
    stackable: 0
  })
  const couponReplace = engine.applyCoupon(
    engine.calculateAutomaticPromotions([line()], [campaign({ id: 10, discount_rate: 95 })]),
    percentage
  )
  assert.strictEqual(couponReplace.couponApplied, true)
  assert.strictEqual(couponReplace.totalDiscountFen, 0, 'non-stackable coupon should replace automatic promotion')
  assert.strictEqual(couponReplace.couponDiscountFen, 1500, 'percentage coupon should respect its cap')

  const newCustomer = campaign({
    id: 11,
    kind: 'coupon',
    type: 'new_customer',
    threshold_amount: 1,
    discount_amount: 10
  })
  assert.strictEqual(engine.calculateCoupon(newCustomer, [line()], { isNewCustomer: false }).discountFen, 0)
  assert.strictEqual(engine.calculateCoupon(newCustomer, [line()], { isNewCustomer: true }).discountFen, 1000)

  const allocations = engine.allocateDiscount(
    [line({ originalPriceFen: 100 }), line({ productId: 12, originalPriceFen: 200 })],
    100,
    item => item.originalPriceFen
  )
  assert.deepStrictEqual(allocations, [33, 67])
  assert.strictEqual(allocations.reduce((sum, amount) => sum + amount, 0), 100)

  console.log('marketing engine tests passed')
}

run()
