const COUPON_TYPES = new Set([
  'cash', 'full_reduction', 'percentage', 'quantity_reduction', 'free_shipping', 'new_customer'
])

const PROMOTION_TYPES = new Set([
  'flash_sale', 'limited_discount', 'special_price', 'tiered_reduction',
  'multi_buy_discount', 'buy_x_get_y'
])

function toFen(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0
}

function fromFen(value) {
  return Number((Math.max(0, Number(value) || 0) / 100).toFixed(2))
}

function parseRules(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try { return JSON.parse(value) || {} } catch { return {} }
}

function normalizeCampaign(row = {}) {
  return {
    ...row,
    id: Number(row.id),
    merchant_id: Number(row.merchant_id),
    thresholdAmountFen: toFen(row.threshold_amount),
    thresholdQuantity: Math.max(0, Number(row.threshold_quantity) || 0),
    discountAmountFen: toFen(row.discount_amount),
    discountRate: Math.max(0, Math.min(100, Number(row.discount_rate) || 0)),
    maxDiscountFen: toFen(row.max_discount),
    specialPriceFen: toFen(row.special_price),
    buyQuantity: Math.max(0, Number(row.buy_quantity) || 0),
    giftQuantity: Math.max(0, Number(row.gift_quantity) || 0),
    totalQuota: row.total_quota == null ? null : Math.max(0, Number(row.total_quota) || 0),
    perUserLimit: Math.max(1, Number(row.per_user_limit) || 1),
    stackable: Number(row.stackable) === 1,
    rules: parseRules(row.rules_json),
    products: Array.isArray(row.products) ? row.products : []
  }
}

function isCampaignActive(campaign, now = new Date()) {
  const status = String(campaign.status || '')
  if (!['approved', 'running'].includes(status)) return false
  const startsAt = new Date(campaign.starts_at)
  const endsAt = new Date(campaign.ends_at)
  return Number.isFinite(startsAt.getTime()) && Number.isFinite(endsAt.getTime()) && startsAt <= now && endsAt > now
}

function campaignMatchesLine(campaign, line) {
  if (Number(campaign.merchant_id) !== Number(line.merchantId)) return false
  if (campaign.scope_type === 'all') return true
  if (campaign.scope_type === 'category') return String(campaign.category || '') === String(line.category || '')
  if (campaign.scope_type !== 'products') return false
  return campaign.products.some(item => Number(item.product_id) === Number(line.productId) && item.role !== 'gift')
}

function campaignProduct(campaign, productId) {
  return campaign.products.find(item => Number(item.product_id) === Number(productId) && item.role !== 'gift') || null
}

function percentageDiscount(totalFen, rate, maxDiscountFen = 0) {
  const discount = Math.max(0, Math.round(totalFen * (100 - rate) / 100))
  return maxDiscountFen > 0 ? Math.min(discount, maxDiscountFen) : discount
}

function productPromotionDiscount(campaign, line) {
  const originalTotalFen = line.originalPriceFen * line.qty
  if (!originalTotalFen) return 0
  const product = campaignProduct(campaign, line.productId)

  if (campaign.type === 'flash_sale' || campaign.type === 'special_price') {
    if (campaign.type === 'flash_sale' && product && product.available_stock != null && Number(product.available_stock) < line.qty) return 0
    const promoPriceFen = product && product.promo_price != null
      ? toFen(product.promo_price)
      : campaign.specialPriceFen
    if (!promoPriceFen || promoPriceFen >= line.originalPriceFen) return 0
    return (line.originalPriceFen - promoPriceFen) * line.qty
  }

  if (campaign.type === 'limited_discount') {
    if (!(campaign.discountRate > 0 && campaign.discountRate < 100)) return 0
    return percentageDiscount(originalTotalFen, campaign.discountRate, campaign.maxDiscountFen)
  }

  if (campaign.type === 'multi_buy_discount') {
    if (line.qty < campaign.thresholdQuantity || !(campaign.discountRate > 0 && campaign.discountRate < 100)) return 0
    return percentageDiscount(originalTotalFen, campaign.discountRate, campaign.maxDiscountFen)
  }

  if (campaign.type === 'buy_x_get_y') {
    const groupSize = campaign.buyQuantity + campaign.giftQuantity
    if (!campaign.buyQuantity || !campaign.giftQuantity || line.qty < groupSize) return 0
    const freeQuantity = Math.floor(line.qty / groupSize) * campaign.giftQuantity
    return Math.min(originalTotalFen, freeQuantity * line.originalPriceFen)
  }

  return 0
}

function bestProductPromotion(line, campaigns) {
  let best = null
  for (const campaign of campaigns) {
    if (!PROMOTION_TYPES.has(campaign.type) || campaign.type === 'tiered_reduction') continue
    if (!campaignMatchesLine(campaign, line)) continue
    const discountFen = productPromotionDiscount(campaign, line)
    if (!discountFen) continue
    if (!best || discountFen > best.discountFen || (discountFen === best.discountFen && campaign.id < best.campaign.id)) {
      best = { campaign, discountFen }
    }
  }
  return best
}

function eligibleLines(campaign, lines) {
  return lines.filter(line => campaignMatchesLine(campaign, line))
}

function bestTier(rules, amountFen) {
  const tiers = Array.isArray(rules && rules.tiers) ? rules.tiers : []
  return tiers
    .map(item => ({ thresholdFen: toFen(item.threshold), discountFen: toFen(item.discount) }))
    .filter(item => item.thresholdFen <= amountFen && item.discountFen > 0)
    .sort((a, b) => b.discountFen - a.discountFen || b.thresholdFen - a.thresholdFen)[0] || null
}

function orderPromotionDiscount(campaign, lines) {
  if (campaign.type !== 'tiered_reduction') return 0
  const eligible = eligibleLines(campaign, lines)
  const amountFen = eligible.reduce((sum, line) => sum + line.originalPriceFen * line.qty, 0)
  if (!amountFen) return 0
  const tier = bestTier(campaign.rules, amountFen)
  if (tier) return Math.min(amountFen, tier.discountFen)
  if (amountFen < campaign.thresholdAmountFen) return 0
  return Math.min(amountFen, campaign.discountAmountFen)
}

function allocateDiscount(lines, totalDiscountFen, amountSelector) {
  const eligible = lines
    .map((line, index) => ({ line, index, amountFen: Math.max(0, amountSelector(line)) }))
    .filter(item => item.amountFen > 0)
  const totalEligibleFen = eligible.reduce((sum, item) => sum + item.amountFen, 0)
  const targetFen = Math.min(Math.max(0, totalDiscountFen), totalEligibleFen)
  const allocations = new Array(lines.length).fill(0)
  if (!targetFen || !totalEligibleFen) return allocations

  let allocatedFen = 0
  const fractions = eligible.map(item => {
    const exact = targetFen * item.amountFen / totalEligibleFen
    const base = Math.floor(exact)
    allocations[item.index] = base
    allocatedFen += base
    return { index: item.index, fraction: exact - base }
  }).sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  for (let i = 0; allocatedFen < targetFen && fractions.length; i += 1) {
    allocations[fractions[i % fractions.length].index] += 1
    allocatedFen += 1
  }
  return allocations
}

function calculateAutomaticPromotions(lines, campaigns) {
  const productResults = lines.map(line => bestProductPromotion(line, campaigns))
  const productDiscountFen = productResults.reduce((sum, item) => sum + (item ? item.discountFen : 0), 0)

  let bestOrder = null
  for (const campaign of campaigns) {
    const discountFen = orderPromotionDiscount(campaign, lines)
    if (!discountFen) continue
    if (!bestOrder || discountFen > bestOrder.discountFen) bestOrder = { campaign, discountFen }
  }

  const canStackOrder = bestOrder && bestOrder.campaign.stackable && productResults.every(item => !item || item.campaign.stackable)
  if (bestOrder && !canStackOrder && bestOrder.discountFen > productDiscountFen) {
    const allocations = allocateDiscount(
      lines,
      bestOrder.discountFen,
      line => campaignMatchesLine(bestOrder.campaign, line) ? line.originalPriceFen * line.qty : 0
    )
    return {
      totalDiscountFen: bestOrder.discountFen,
      lines: lines.map((line, index) => ({
        ...line,
        promotionDiscountFen: allocations[index],
        productPromotionDiscountFen: 0,
        orderPromotionDiscountFen: allocations[index],
        promotion: null,
        orderPromotion: allocations[index] ? bestOrder.campaign : null
      }))
    }
  }

  let resultLines = lines.map((line, index) => ({
    ...line,
    promotionDiscountFen: productResults[index] ? productResults[index].discountFen : 0,
    productPromotionDiscountFen: productResults[index] ? productResults[index].discountFen : 0,
    orderPromotionDiscountFen: 0,
    promotion: productResults[index] ? productResults[index].campaign : null,
    orderPromotion: null
  }))
  let totalDiscountFen = productDiscountFen

  if (bestOrder && canStackOrder) {
    const allocations = allocateDiscount(
      resultLines,
      bestOrder.discountFen,
      line => campaignMatchesLine(bestOrder.campaign, line)
        ? Math.max(0, line.originalPriceFen * line.qty - line.promotionDiscountFen)
        : 0
    )
    resultLines = resultLines.map((line, index) => ({
      ...line,
      promotionDiscountFen: line.promotionDiscountFen + allocations[index],
      orderPromotionDiscountFen: allocations[index],
      orderPromotion: allocations[index] ? bestOrder.campaign : null
    }))
    totalDiscountFen += allocations.reduce((sum, amount) => sum + amount, 0)
  }

  return { totalDiscountFen, lines: resultLines }
}

function couponEligibility(campaign, lines, options = {}) {
  if (!campaign || !COUPON_TYPES.has(campaign.type)) return { ok: false, reason: '优惠券类型无效' }
  if (campaign.type === 'new_customer' && !options.isNewCustomer) return { ok: false, reason: '仅限新用户首单使用' }
  const eligible = eligibleLines(campaign, lines)
  if (!eligible.length) return { ok: false, reason: '订单中没有适用商品' }
  const eligibleAmountFen = eligible.reduce(
    (sum, line) => sum + Math.max(0, line.originalPriceFen * line.qty - (options.ignorePromotion ? 0 : line.promotionDiscountFen || 0)),
    0
  )
  const eligibleQuantity = eligible.reduce((sum, line) => sum + line.qty, 0)
  if (eligibleAmountFen < campaign.thresholdAmountFen) {
    return { ok: false, reason: `适用商品满${fromFen(campaign.thresholdAmountFen)}元可用` }
  }
  if (eligibleQuantity < campaign.thresholdQuantity) {
    return { ok: false, reason: `适用商品满${campaign.thresholdQuantity}件可用` }
  }
  return { ok: true, eligible, eligibleAmountFen, eligibleQuantity }
}

function calculateCoupon(campaign, lines, options = {}) {
  const eligibility = couponEligibility(campaign, lines, options)
  if (!eligibility.ok) return { discountFen: 0, reason: eligibility.reason, allocations: new Array(lines.length).fill(0) }
  let discountFen = 0
  if (['cash', 'full_reduction', 'quantity_reduction', 'new_customer'].includes(campaign.type)) {
    discountFen = campaign.discountAmountFen
  } else if (campaign.type === 'percentage') {
    discountFen = percentageDiscount(eligibility.eligibleAmountFen, campaign.discountRate, campaign.maxDiscountFen)
  } else if (campaign.type === 'free_shipping') {
    discountFen = Math.min(options.shippingFen || 0, campaign.maxDiscountFen || options.shippingFen || 0)
    return { discountFen, reason: discountFen ? '' : '当前订单没有可抵扣运费', allocations: new Array(lines.length).fill(0) }
  }
  discountFen = Math.min(discountFen, eligibility.eligibleAmountFen)
  const allocations = allocateDiscount(
    lines,
    discountFen,
    line => campaignMatchesLine(campaign, line)
      ? Math.max(0, line.originalPriceFen * line.qty - (options.ignorePromotion ? 0 : line.promotionDiscountFen || 0))
      : 0
  )
  return { discountFen, reason: discountFen ? '' : '优惠金额为0', allocations }
}

function applyCoupon(promotions, coupon, options = {}) {
  if (!coupon) return { ...promotions, couponDiscountFen: 0, couponApplied: false, couponReason: '' }
  const stacked = coupon.stackable && promotions.lines.every(line =>
    (!line.promotion || line.promotion.stackable) &&
    (!line.orderPromotion || line.orderPromotion.stackable)
  )
  const couponResult = calculateCoupon(coupon, promotions.lines, { ...options, ignorePromotion: !stacked })
  if (!couponResult.discountFen) {
    return { ...promotions, couponDiscountFen: 0, couponApplied: false, couponReason: couponResult.reason }
  }
  if (!stacked && promotions.totalDiscountFen >= couponResult.discountFen) {
    return { ...promotions, couponDiscountFen: 0, couponApplied: false, couponReason: '当前活动优惠更大，已为你保留更优价格' }
  }

  const baseLines = stacked
    ? promotions.lines
    : promotions.lines.map(line => ({
      ...line,
      promotionDiscountFen: 0,
      productPromotionDiscountFen: 0,
      orderPromotionDiscountFen: 0,
      promotion: null,
      orderPromotion: null
    }))
  const lines = baseLines.map((line, index) => ({ ...line, couponDiscountFen: couponResult.allocations[index] || 0 }))
  return {
    totalDiscountFen: stacked ? promotions.totalDiscountFen : 0,
    lines,
    couponDiscountFen: couponResult.discountFen,
    couponApplied: true,
    couponReason: ''
  }
}

module.exports = {
  COUPON_TYPES,
  PROMOTION_TYPES,
  toFen,
  fromFen,
  parseRules,
  normalizeCampaign,
  isCampaignActive,
  campaignMatchesLine,
  calculateAutomaticPromotions,
  calculateCoupon,
  applyCoupon,
  allocateDiscount
}
