const crypto = require('crypto')
const db = require('../db/database')
const engine = require('./marketing-engine')

const ACTIVE_STATUSES = ['approved', 'running']
const EDITABLE_STATUSES = ['draft', 'rejected']

function statusError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function placeholders(values) {
  return values.map(() => '?').join(',')
}

function mysqlDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function groupCampaignRows(rows) {
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.id)) map.set(row.id, engine.normalizeCampaign({ ...row, products: [] }))
    if (row.campaign_product_id) {
      map.get(row.id).products.push({
        id: Number(row.campaign_product_id),
        product_id: Number(row.campaign_product_product_id),
        role: row.campaign_product_role,
        promo_price: row.campaign_product_promo_price,
        quota: row.campaign_product_quota == null ? null : Number(row.campaign_product_quota),
        available_stock: row.campaign_product_available_stock == null ? null : Number(row.campaign_product_available_stock),
        sold_count: Number(row.campaign_product_sold_count || 0),
        product_name: row.campaign_product_name || ''
      })
    }
  }
  return Array.from(map.values())
}

async function queryCampaigns(executor, whereSql, params = [], suffix = '') {
  const [rows] = await executor.query(`
    SELECT c.*,m.company_name AS merchant_name,
           cp.id AS campaign_product_id,
           cp.product_id AS campaign_product_product_id,
           cp.role AS campaign_product_role,
           cp.promo_price AS campaign_product_promo_price,
           cp.quota AS campaign_product_quota,
           cp.available_stock AS campaign_product_available_stock,
           cp.sold_count AS campaign_product_sold_count,
           p.name AS campaign_product_name
      FROM marketing_campaigns c
      JOIN merchants m ON m.id=c.merchant_id
      LEFT JOIN marketing_campaign_products cp ON cp.campaign_id=c.id
      LEFT JOIN products p ON p.id=cp.product_id
     WHERE ${whereSql}
     ORDER BY c.created_at DESC, cp.id ASC ${suffix}
  `, params)
  return groupCampaignRows(rows)
}

async function loadActiveCampaigns(executor, merchantId, now = new Date()) {
  const value = mysqlDate(now)
  return queryCampaigns(
    executor,
    `c.merchant_id=? AND c.status IN ('approved','running') AND c.starts_at<=? AND c.ends_at>?`,
    [merchantId, value, value]
  )
}

function campaignLabel(campaign) {
  if (campaign.type === 'cash') return `立减${engine.fromFen(campaign.discountAmountFen)}元`
  if (campaign.type === 'full_reduction' || campaign.type === 'new_customer') {
    return `满${engine.fromFen(campaign.thresholdAmountFen)}减${engine.fromFen(campaign.discountAmountFen)}`
  }
  if (campaign.type === 'percentage' || campaign.type === 'limited_discount') return `${campaign.discountRate / 10}折`
  if (campaign.type === 'quantity_reduction') return `满${campaign.thresholdQuantity}件减${engine.fromFen(campaign.discountAmountFen)}元`
  if (campaign.type === 'free_shipping') return '运费券'
  if (campaign.type === 'flash_sale') return '限时秒杀'
  if (campaign.type === 'special_price') return '限时特价'
  if (campaign.type === 'multi_buy_discount') return `${campaign.thresholdQuantity}件起${campaign.discountRate / 10}折`
  if (campaign.type === 'buy_x_get_y') return `买${campaign.buyQuantity}赠${campaign.giftQuantity}`
  if (campaign.type === 'tiered_reduction') return '阶梯满减'
  return campaign.name
}

async function decorateProducts(products, executor = db) {
  if (!Array.isArray(products) || !products.length) return products || []
  const merchantIds = Array.from(new Set(products.map(item => Number(item.merchant_id)).filter(Boolean)))
  if (!merchantIds.length) return products
  const now = mysqlDate(new Date())
  const campaigns = await queryCampaigns(
    executor,
    `c.merchant_id IN (${placeholders(merchantIds)}) AND c.status IN ('approved','running') AND c.starts_at<=? AND c.ends_at>?`,
    [...merchantIds, now, now]
  )
  const byMerchant = new Map()
  for (const campaign of campaigns) {
    if (!byMerchant.has(campaign.merchant_id)) byMerchant.set(campaign.merchant_id, [])
    byMerchant.get(campaign.merchant_id).push(campaign)
  }

  return products.map(product => {
    const line = {
      productId: Number(product.id),
      merchantId: Number(product.merchant_id),
      category: product.category || '',
      originalPriceFen: engine.toFen(product.price),
      qty: 1
    }
    const merchantCampaigns = byMerchant.get(line.merchantId) || []
    const promotions = engine.calculateAutomaticPromotions(line.originalPriceFen ? [line] : [], merchantCampaigns)
    const promotionLine = promotions.lines[0]
    const promotion = promotionLine && (promotionLine.promotion || promotionLine.orderPromotion)
    const couponCount = merchantCampaigns.filter(campaign => campaign.kind === 'coupon' && engine.campaignMatchesLine(campaign, line)).length
    const displayPriceFen = line.originalPriceFen - (promotionLine ? promotionLine.promotionDiscountFen : 0)
    return {
      ...product,
      original_price: engine.fromFen(line.originalPriceFen),
      display_price: engine.fromFen(displayPriceFen),
      promotion_discount: engine.fromFen(line.originalPriceFen - displayPriceFen),
      has_promotion: !!promotion,
      promotion_id: promotion ? promotion.id : null,
      promotion_type: promotion ? promotion.type : '',
      promotion_name: promotion ? promotion.name : '',
      promotion_label: promotion ? campaignLabel(promotion) : '',
      promotion_ends_at: promotion ? promotion.ends_at : null,
      is_flash_sale: !!(promotion && promotion.type === 'flash_sale'),
      coupon_count: couponCount
    }
  })
}

function aggregateRequestedItems(items) {
  const map = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    const productId = Number.parseInt(item.id || item.product_id)
    const qty = Number.parseInt(item.qty)
    if (!productId || !qty || qty < 1 || qty > 999) throw statusError('商品或购买数量无效')
    map.set(productId, (map.get(productId) || 0) + qty)
  }
  return Array.from(map, ([productId, qty]) => ({ productId, qty }))
}

async function loadOrderProducts(executor, items, lock = false) {
  const requested = aggregateRequestedItems(items)
  if (!requested.length) throw statusError('订单商品不能为空')
  const ids = requested.map(item => item.productId)
  const [rows] = await executor.query(`
    SELECT p.id,p.merchant_id,p.name,p.category,p.price,p.unit,p.stock,p.status,p.icon,p.image_url,
           m.company_name,m.commission_rate,m.sub_mchid,m.wechat_applyment_state,
           m.latitude AS merchant_latitude,m.longitude AS merchant_longitude,m.delivery_radius
      FROM products p JOIN merchants m ON m.id=p.merchant_id
     WHERE p.id IN (${placeholders(ids)}) ${lock ? 'FOR UPDATE' : ''}
  `, ids)
  if (rows.length !== ids.length) throw statusError('部分商品不存在或已删除', 409)
  const byId = new Map(rows.map(row => [Number(row.id), row]))
  const merchantIds = new Set(rows.map(row => Number(row.merchant_id)))
  if (merchantIds.size !== 1) throw statusError('一个订单只能包含同一商户的商品', 409)
  return requested.map(item => {
    const product = byId.get(item.productId)
    if (product.status !== 'on') throw statusError(`商品「${product.name}」已下架`, 409)
    if (Number(product.stock) < item.qty) throw statusError(`商品「${product.name}」库存不足`, 409)
    return {
      productId: Number(product.id),
      merchantId: Number(product.merchant_id),
      name: product.name,
      category: product.category || '',
      unit: product.unit || '',
      icon: product.icon || '',
      imageUrl: product.image_url || null,
      originalPriceFen: engine.toFen(product.price),
      qty: item.qty,
      product
    }
  })
}

async function isNewCustomer(executor, userId, merchantId) {
  if (!userId) return false
  const [[row]] = await executor.query(`
    SELECT COUNT(DISTINCT o.id) AS total
      FROM orders o JOIN order_items i ON i.order_id=o.id
     WHERE o.user_id=? AND i.merchant_id=? AND o.status NOT IN ('cancelled','pending_payment')
  `, [userId, merchantId])
  return Number(row && row.total || 0) === 0
}

async function loadUserCoupon(executor, userCouponId, userId, lock = false) {
  if (!userCouponId || !userId) return null
  const [rows] = await executor.query(`
    SELECT uc.*,c.*,
           uc.id AS user_coupon_id,uc.status AS user_coupon_status,uc.expires_at AS user_coupon_expires_at,
           cp.id AS campaign_product_id,
           cp.product_id AS campaign_product_product_id,
           cp.role AS campaign_product_role,
           cp.promo_price AS campaign_product_promo_price,
           cp.quota AS campaign_product_quota,
           cp.available_stock AS campaign_product_available_stock,
           cp.sold_count AS campaign_product_sold_count,
           p.name AS campaign_product_name
      FROM user_coupons uc
      JOIN marketing_campaigns c ON c.id=uc.campaign_id
      LEFT JOIN marketing_campaign_products cp ON cp.campaign_id=c.id
      LEFT JOIN products p ON p.id=cp.product_id
     WHERE uc.id=? AND uc.user_id=? ${lock ? 'FOR UPDATE' : ''}
  `, [userCouponId, userId])
  if (!rows.length) throw statusError('优惠券不存在或不属于当前用户', 404)
  const coupon = groupCampaignRows(rows.map(row => ({ ...row, id: row.campaign_id })))[0]
  coupon.userCouponId = Number(rows[0].user_coupon_id)
  coupon.userCouponStatus = rows[0].user_coupon_status
  coupon.userCouponExpiresAt = rows[0].user_coupon_expires_at
  if (coupon.userCouponStatus !== 'available') throw statusError('优惠券当前不可使用', 409)
  if (!engine.isCampaignActive(coupon) || new Date(coupon.userCouponExpiresAt) <= new Date()) {
    throw statusError('优惠券已过期或活动已结束', 409)
  }
  return coupon
}

function capCouponToPositivePayable(pricing) {
  const originalFen = pricing.lines.reduce((sum, line) => sum + line.originalPriceFen * line.qty, 0)
  const maxCouponFen = Math.max(0, originalFen - pricing.totalDiscountFen - 1)
  if (pricing.couponDiscountFen <= maxCouponFen) return pricing
  const allocations = engine.allocateDiscount(pricing.lines, maxCouponFen, line => line.couponDiscountFen || 0)
  return {
    ...pricing,
    couponDiscountFen: maxCouponFen,
    lines: pricing.lines.map((line, index) => ({ ...line, couponDiscountFen: allocations[index] || 0 }))
  }
}

async function priceOrder(executor, { items, userId, userCouponId, lock = false }) {
  const lines = await loadOrderProducts(executor, items, lock)
  const merchantId = lines[0].merchantId
  const campaigns = await loadActiveCampaigns(executor, merchantId)
  const promotions = engine.calculateAutomaticPromotions(lines, campaigns.filter(item => item.kind === 'promotion'))
  const coupon = await loadUserCoupon(executor, userCouponId, userId, lock)
  const newCustomer = coupon && coupon.type === 'new_customer'
    ? await isNewCustomer(executor, userId, merchantId)
    : false
  let pricing = engine.applyCoupon(promotions, coupon, { isNewCustomer: newCustomer, shippingFen: 0 })
  pricing = capCouponToPositivePayable(pricing)

  const originalSubtotalFen = pricing.lines.reduce((sum, line) => sum + line.originalPriceFen * line.qty, 0)
  const promotionDiscountFen = pricing.lines.reduce((sum, line) => sum + (line.promotionDiscountFen || 0), 0)
  const couponDiscountFen = pricing.lines.reduce((sum, line) => sum + (line.couponDiscountFen || 0), 0)
  const payableFen = originalSubtotalFen - promotionDiscountFen - couponDiscountFen
  if (payableFen <= 0) throw statusError('优惠后订单金额必须大于0元', 409)

  return {
    merchantId,
    merchant: lines[0].product,
    lines: pricing.lines.map(line => ({
      ...line,
      lineOriginalFen: line.originalPriceFen * line.qty,
      linePayableFen: line.originalPriceFen * line.qty - (line.promotionDiscountFen || 0) - (line.couponDiscountFen || 0)
    })),
    coupon: pricing.couponApplied ? coupon : null,
    couponRequested: coupon,
    couponApplied: pricing.couponApplied,
    couponReason: pricing.couponReason || '',
    originalSubtotalFen,
    promotionDiscountFen,
    couponDiscountFen,
    merchantDiscountFen: promotionDiscountFen + couponDiscountFen,
    payableFen,
    commissionBaseFen: originalSubtotalFen
  }
}

function isBetterCouponPricing(candidate, current) {
  if (!candidate || !candidate.couponApplied) return false
  if (!current) return true
  if (candidate.payableFen !== current.payableFen) return candidate.payableFen < current.payableFen
  return candidate.couponDiscountFen > current.couponDiscountFen
}

async function priceOrderWithBestCoupon(executor, { items, userId }) {
  const basePricing = await priceOrder(executor, { items, userId, userCouponId: null, lock: false })
  if (!userId) return { pricing: basePricing, selectedUserCouponId: null, evaluatedCoupons: 0 }

  const [rows] = await executor.query(`
    SELECT uc.id AS user_coupon_id
      FROM user_coupons uc
      JOIN marketing_campaigns c ON c.id=uc.campaign_id
     WHERE uc.user_id=? AND uc.status='available' AND uc.expires_at>NOW()
       AND c.merchant_id=? AND c.kind='coupon' AND c.status IN ('approved','running')
       AND c.starts_at<=NOW() AND c.ends_at>NOW()
     ORDER BY uc.expires_at ASC,uc.id ASC
     LIMIT 50
  `, [userId, basePricing.merchantId])

  let bestPricing = basePricing
  let selectedUserCouponId = null
  for (const row of rows) {
    try {
      const candidate = await priceOrder(executor, {
        items,
        userId,
        userCouponId: Number(row.user_coupon_id),
        lock: false
      })
      if (isBetterCouponPricing(candidate, bestPricing)) {
        bestPricing = candidate
        selectedUserCouponId = Number(row.user_coupon_id)
      }
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) throw error
    }
  }
  return { pricing: bestPricing, selectedUserCouponId, evaluatedCoupons: rows.length }
}

function publicQuote(pricing) {
  return {
    merchant_id: pricing.merchantId,
    original_subtotal: engine.fromFen(pricing.originalSubtotalFen),
    promotion_discount: engine.fromFen(pricing.promotionDiscountFen),
    coupon_discount: engine.fromFen(pricing.couponDiscountFen),
    merchant_discount: engine.fromFen(pricing.merchantDiscountFen),
    payable_total: engine.fromFen(pricing.payableFen),
    coupon_applied: pricing.couponApplied,
    coupon_reason: pricing.couponReason,
    coupon: pricing.coupon ? serializeCampaign(pricing.coupon) : null,
    items: pricing.lines.map(line => {
      const primaryPromotion = line.promotion || line.orderPromotion
      return {
        product_id: line.productId,
        name: line.name,
        qty: line.qty,
        original_price: engine.fromFen(line.originalPriceFen),
        promotion_discount: engine.fromFen(line.promotionDiscountFen || 0),
        coupon_discount: engine.fromFen(line.couponDiscountFen || 0),
        subtotal: engine.fromFen(line.linePayableFen),
        promotion: primaryPromotion ? {
          id: primaryPromotion.id,
          type: primaryPromotion.type,
          name: primaryPromotion.name,
          label: campaignLabel(primaryPromotion)
        } : null,
        order_promotion: line.orderPromotion ? {
          id: line.orderPromotion.id,
          type: line.orderPromotion.type,
          name: line.orderPromotion.name,
          label: campaignLabel(line.orderPromotion)
        } : null
      }
    })
  }
}

function validateCampaignPayload(input = {}) {
  const kind = String(input.kind || '')
  const type = String(input.type || '')
  if (kind === 'coupon' && !engine.COUPON_TYPES.has(type)) throw statusError('优惠券类型无效')
  if (kind === 'promotion' && !engine.PROMOTION_TYPES.has(type)) throw statusError('促销活动类型无效')
  if (!['coupon', 'promotion'].includes(kind)) throw statusError('营销类型无效')
  if (type === 'free_shipping') throw statusError('农资商城当前全场包邮，无需创建运费券')
  const name = String(input.name || '').trim()
  if (!name || name.length > 80) throw statusError('活动名称不能为空且不能超过80字')
  const startsAt = mysqlDate(input.starts_at)
  const endsAt = mysqlDate(input.ends_at)
  if (!startsAt || !endsAt || new Date(startsAt) >= new Date(endsAt)) throw statusError('活动开始和结束时间无效')
  if (new Date(endsAt) <= new Date()) throw statusError('活动结束时间必须晚于当前时间')
  const scopeType = ['all', 'category', 'products'].includes(input.scope_type) ? input.scope_type : 'all'
  const productIds = Array.from(new Set((Array.isArray(input.product_ids) ? input.product_ids : [])
    .map(Number).filter(value => Number.isInteger(value) && value > 0)))
  if (scopeType === 'products' && !productIds.length) throw statusError('请选择适用商品')
  if (scopeType === 'category' && !String(input.category || '').trim()) throw statusError('请选择适用分类')
  if (['flash_sale', 'special_price'].includes(type) && scopeType !== 'products') {
    throw statusError('秒杀和限时特价必须选择指定商品')
  }

  const thresholdAmount = Number(input.threshold_amount || 0)
  const thresholdQuantity = Number(input.threshold_quantity || 0)
  const discountAmount = Number(input.discount_amount || 0)
  const discountRate = Number(input.discount_rate == null ? 100 : input.discount_rate)
  const maxDiscount = Number(input.max_discount || 0)
  const specialPrice = Number(input.special_price || 0)
  const rawTotalQuota = input.total_quota
  const numericValues = [thresholdAmount, thresholdQuantity, discountAmount, discountRate, maxDiscount, specialPrice]
  if (numericValues.some(value => !Number.isFinite(value) || value < 0)) throw statusError('优惠数值格式无效')
  if (rawTotalQuota !== null && rawTotalQuota !== undefined && rawTotalQuota !== '' &&
      (!Number.isInteger(Number(rawTotalQuota)) || Number(rawTotalQuota) < 1)) {
    throw statusError('发行数量或活动库存必须是大于 0 的整数')
  }
  const rawPerUserLimit = input.per_user_limit
  if (rawPerUserLimit !== null && rawPerUserLimit !== undefined && rawPerUserLimit !== '' &&
      (!Number.isInteger(Number(rawPerUserLimit)) || Number(rawPerUserLimit) < 1)) {
    throw statusError('每人限领或限购数量必须是大于 0 的整数')
  }
  if (['cash', 'full_reduction', 'quantity_reduction', 'new_customer', 'tiered_reduction'].includes(type) && discountAmount <= 0 && !input.rules_json) {
    throw statusError('请填写优惠金额')
  }
  if (['full_reduction', 'new_customer'].includes(type) && (!(thresholdAmount > 0) || discountAmount >= thresholdAmount)) {
    throw statusError('满减门槛必须大于优惠金额')
  }
  if (type === 'quantity_reduction' && thresholdQuantity < 1) throw statusError('请填写满件数量')
  if (['percentage', 'limited_discount', 'multi_buy_discount'].includes(type) && (!(discountRate > 0) || discountRate >= 100)) {
    throw statusError('折扣必须在0.1折至9.9折之间')
  }
  if (type === 'percentage' && maxDiscount <= 0) throw statusError('折扣券必须设置最高优惠金额')
  if (['flash_sale', 'special_price'].includes(type) && specialPrice <= 0) throw statusError('请填写活动价格')
  if (type === 'flash_sale' && Number(input.total_quota || 0) < 1) throw statusError('秒杀活动必须设置活动库存')
  if (type === 'multi_buy_discount' && thresholdQuantity < 2) throw statusError('多件折扣至少设置2件')
  if (type === 'buy_x_get_y' && (Number(input.buy_quantity || 0) < 1 || Number(input.gift_quantity || 0) < 1)) {
    throw statusError('请填写买赠数量')
  }
  const rules = engine.parseRules(input.rules_json)
  if (type === 'tiered_reduction') {
    const tiers = Array.isArray(rules.tiers) ? rules.tiers : []
    if (!tiers.length || tiers.some(tier => !(Number(tier.threshold) > Number(tier.discount) && Number(tier.discount) > 0))) {
      throw statusError('阶梯满减规则无效')
    }
  }
  return {
    kind, type, name,
    description: String(input.description || '').trim().slice(0, 255),
    scopeType,
    category: String(input.category || '').trim(),
    productIds,
    thresholdAmount: Math.max(0, thresholdAmount || 0),
    thresholdQuantity: Math.max(0, Math.floor(thresholdQuantity || 0)),
    discountAmount: Math.max(0, discountAmount || 0),
    discountRate: Math.max(0, discountRate || 0),
    maxDiscount: Math.max(0, maxDiscount || 0),
    specialPrice: Math.max(0, specialPrice || 0),
    buyQuantity: Math.max(0, Math.floor(Number(input.buy_quantity) || 0)),
    giftQuantity: Math.max(0, Math.floor(Number(input.gift_quantity) || 0)),
    totalQuota: rawTotalQuota == null || rawTotalQuota === '' ? null : Math.floor(Number(rawTotalQuota)),
    perUserLimit: kind === 'coupon' ? 1 : Math.max(1, Number(rawPerUserLimit) || 1),
    rulesJson: JSON.stringify(rules),
    stackable: input.stackable ? 1 : 0,
    startsAt,
    endsAt
  }
}

async function saveCampaignProducts(conn, campaignId, merchantId, payload) {
  await conn.query('DELETE FROM marketing_campaign_products WHERE campaign_id=?', [campaignId])
  if (!payload.productIds.length) return
  const [products] = await conn.query(
    `SELECT id,price FROM products WHERE merchant_id=? AND id IN (${placeholders(payload.productIds)})`,
    [merchantId, ...payload.productIds]
  )
  if (products.length !== payload.productIds.length) throw statusError('包含不属于当前商户的商品', 403)
  for (const product of products) {
    if (['flash_sale', 'special_price'].includes(payload.type) && payload.specialPrice >= Number(product.price)) {
      throw statusError(`商品活动价必须低于原价：${product.id}`)
    }
    const quota = payload.type === 'flash_sale' ? payload.totalQuota : null
    await conn.query(
      `INSERT INTO marketing_campaign_products
        (campaign_id,product_id,role,promo_price,quota,available_stock)
       VALUES (?,?, 'eligible',?,?,?)`,
      [campaignId, product.id, ['flash_sale', 'special_price'].includes(payload.type) ? payload.specialPrice : null, quota, quota]
    )
  }
}

async function createCampaign(merchantId, input) {
  const payload = validateCampaignPayload(input)
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [result] = await conn.query(`
      INSERT INTO marketing_campaigns
        (merchant_id,kind,type,name,description,scope_type,category,threshold_amount,threshold_quantity,
         discount_amount,discount_rate,max_discount,special_price,buy_quantity,gift_quantity,total_quota,
         per_user_limit,rules_json,stackable,starts_at,ends_at,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft')
    `, [
      merchantId, payload.kind, payload.type, payload.name, payload.description, payload.scopeType, payload.category,
      payload.thresholdAmount, payload.thresholdQuantity, payload.discountAmount, payload.discountRate,
      payload.maxDiscount, payload.specialPrice, payload.buyQuantity, payload.giftQuantity, payload.totalQuota,
      payload.perUserLimit, payload.rulesJson, payload.stackable, payload.startsAt, payload.endsAt
    ])
    await saveCampaignProducts(conn, result.insertId, merchantId, payload)
    await conn.commit()
    return { id: result.insertId }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function updateCampaign(merchantId, campaignId, input) {
  const payload = validateCampaignPayload(input)
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[campaign]] = await conn.query('SELECT * FROM marketing_campaigns WHERE id=? AND merchant_id=? FOR UPDATE', [campaignId, merchantId])
    if (!campaign) throw statusError('活动不存在', 404)
    if (!EDITABLE_STATUSES.includes(campaign.status)) throw statusError('只有草稿或已驳回活动可以修改', 409)
    await conn.query(`
      UPDATE marketing_campaigns SET
        kind=?,type=?,name=?,description=?,scope_type=?,category=?,threshold_amount=?,threshold_quantity=?,
        discount_amount=?,discount_rate=?,max_discount=?,special_price=?,buy_quantity=?,gift_quantity=?,total_quota=?,
        per_user_limit=?,rules_json=?,stackable=?,starts_at=?,ends_at=?,status='draft',rejection_reason=''
      WHERE id=?
    `, [
      payload.kind, payload.type, payload.name, payload.description, payload.scopeType, payload.category,
      payload.thresholdAmount, payload.thresholdQuantity, payload.discountAmount, payload.discountRate,
      payload.maxDiscount, payload.specialPrice, payload.buyQuantity, payload.giftQuantity, payload.totalQuota,
      payload.perUserLimit, payload.rulesJson, payload.stackable, payload.startsAt, payload.endsAt, campaignId
    ])
    await saveCampaignProducts(conn, campaignId, merchantId, payload)
    await conn.commit()
    return { id: Number(campaignId) }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

function serializeCampaign(campaign) {
  const item = engine.normalizeCampaign(campaign)
  const now = new Date()
  let displayStatus = item.status
  if (ACTIVE_STATUSES.includes(item.status)) {
    if (new Date(item.starts_at) > now) displayStatus = 'scheduled'
    else if (new Date(item.ends_at) <= now) displayStatus = 'ended'
    else displayStatus = 'running'
  }
  return {
    id: item.id,
    merchant_id: item.merchant_id,
    merchant_name: item.merchant_name || item.company_name || '',
    kind: item.kind,
    type: item.type,
    name: item.name,
    description: item.description || '',
    label: campaignLabel(item),
    scope_type: item.scope_type,
    category: item.category || '',
    threshold_amount: engine.fromFen(item.thresholdAmountFen),
    threshold_quantity: item.thresholdQuantity,
    discount_amount: engine.fromFen(item.discountAmountFen),
    discount_rate: item.discountRate,
    max_discount: engine.fromFen(item.maxDiscountFen),
    special_price: engine.fromFen(item.specialPriceFen),
    buy_quantity: item.buyQuantity,
    gift_quantity: item.giftQuantity,
    total_quota: item.totalQuota,
    per_user_limit: item.perUserLimit,
    claimed_count: Number(item.claimed_count || 0),
    used_count: Number(item.used_count || 0),
    rules: item.rules,
    stackable: item.stackable,
    starts_at: item.starts_at,
    ends_at: item.ends_at,
    status: item.status,
    display_status: displayStatus,
    rejection_reason: item.rejection_reason || '',
    products: item.products,
    created_at: item.created_at,
    updated_at: item.updated_at
  }
}

async function listMerchantCampaigns(merchantId) {
  const campaigns = await queryCampaigns(db, 'c.merchant_id=?', [merchantId])
  return campaigns.map(serializeCampaign)
}

async function submitCampaign(merchantId, campaignId) {
  const [result] = await db.query(
    `UPDATE marketing_campaigns SET status='pending',submitted_at=NOW(),rejection_reason=''
      WHERE id=? AND merchant_id=? AND status IN ('draft','rejected')`,
    [campaignId, merchantId]
  )
  if (!result.affectedRows) throw statusError('活动不存在或当前状态不能提交审核', 409)
}

async function pauseCampaign(merchantId, campaignId) {
  const [result] = await db.query(
    `UPDATE marketing_campaigns SET status='paused' WHERE id=? AND merchant_id=? AND status IN ('approved','running')`,
    [campaignId, merchantId]
  )
  if (!result.affectedRows) throw statusError('活动不存在或当前状态不能暂停', 409)
}

async function listAdminCampaigns(status = '') {
  const where = status ? 'c.status=?' : '1=1'
  const campaigns = await queryCampaigns(db, where, status ? [status] : [])
  if (!campaigns.length) return []
  const merchantIds = Array.from(new Set(campaigns.map(item => item.merchant_id)))
  const [merchants] = await db.query(
    `SELECT id,company_name FROM merchants WHERE id IN (${placeholders(merchantIds)})`, merchantIds
  )
  const names = new Map(merchants.map(item => [Number(item.id), item.company_name]))
  return campaigns.map(item => ({ ...serializeCampaign(item), merchant_name: names.get(item.merchant_id) || '' }))
}

async function reviewCampaign(adminId, campaignId, approved, reason = '') {
  const status = approved ? 'approved' : 'rejected'
  const [result] = await db.query(
    `UPDATE marketing_campaigns SET status=?,rejection_reason=?,reviewed_by=?,reviewed_at=NOW()
      WHERE id=? AND status='pending'`,
    [status, approved ? '' : String(reason || '').trim().slice(0, 255), adminId, campaignId]
  )
  if (!result.affectedRows) throw statusError('活动不存在或已经审核', 409)
}

async function listClaimableCoupons(merchantId, userId) {
  const now = mysqlDate(new Date())
  const params = [now, now]
  let merchantFilter = ''
  if (merchantId) { merchantFilter = ' AND c.merchant_id=?'; params.push(merchantId) }
  const campaigns = await queryCampaigns(
    db,
    `c.kind='coupon' AND c.status IN ('approved','running') AND c.starts_at<=? AND c.ends_at>?${merchantFilter}`,
    params
  )
  let claimed = new Map()
  if (userId && campaigns.length) {
    const ids = campaigns.map(item => item.id)
    const [rows] = await db.query(
      `SELECT campaign_id,COUNT(*) AS total,MAX(id) AS user_coupon_id,
              MAX(CASE WHEN status='available' AND expires_at>NOW() THEN 1 ELSE 0 END) AS available
         FROM user_coupons WHERE user_id=? AND campaign_id IN (${placeholders(ids)}) GROUP BY campaign_id`,
      [userId, ...ids]
    )
    claimed = new Map(rows.map(row => [Number(row.campaign_id), row]))
  }
  return campaigns.map(campaign => {
    const state = claimed.get(campaign.id)
    const quotaReached = !!campaign.totalQuota && Number(campaign.claimed_count || 0) >= campaign.totalQuota
    const limitReached = !!state && Number(state.total) >= 1
    const available = !!(state && Number(state.available))
    return {
      ...serializeCampaign(campaign),
      can_claim: !quotaReached && !limitReached,
      claimed: !!state,
      available,
      claim_status: state ? 'claimed' : (quotaReached ? 'sold_out' : 'claimable'),
      user_coupon_id: state ? Number(state.user_coupon_id) : null
    }
  })
}

async function claimCoupon(campaignId, userId) {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[row]] = await conn.query(
      `SELECT * FROM marketing_campaigns WHERE id=? AND kind='coupon' FOR UPDATE`, [campaignId]
    )
    if (!row || !engine.isCampaignActive(engine.normalizeCampaign(row))) throw statusError('优惠券不存在或不在领取时间内', 404)
    if (row.total_quota != null && Number(row.claimed_count) >= Number(row.total_quota)) throw statusError('优惠券已领完', 409)
    const [[count]] = await conn.query('SELECT COUNT(*) AS total FROM user_coupons WHERE campaign_id=? AND user_id=?', [campaignId, userId])
    if (Number(count.total) >= 1) throw statusError('该优惠券每人只能领取一次', 409)
    const code = crypto.randomBytes(12).toString('hex').toUpperCase()
    const [result] = await conn.query(
      `INSERT INTO user_coupons (campaign_id,user_id,coupon_code,status,expires_at)
       VALUES (?,?,?,'available',?)`,
      [campaignId, userId, code, row.ends_at]
    )
    await conn.query('UPDATE marketing_campaigns SET claimed_count=claimed_count+1 WHERE id=?', [campaignId])
    await conn.commit()
    return { id: result.insertId, coupon_code: code }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function listUserCoupons(userId, status = '') {
  await db.query(`
    UPDATE user_coupons uc JOIN marketing_campaigns c ON c.id=uc.campaign_id
       SET uc.status='expired'
     WHERE uc.user_id=? AND uc.status='available'
       AND (uc.expires_at<=NOW() OR c.ends_at<=NOW() OR c.status NOT IN ('approved','running'))
  `, [userId])
  const params = [userId]
  const filter = status ? ' AND uc.status=?' : ''
  if (status) params.push(status)
  const [rows] = await db.query(`
    SELECT uc.id AS user_coupon_id,uc.coupon_code,uc.status AS user_coupon_status,
           uc.claimed_at,uc.used_at,uc.returned_at,uc.expires_at AS user_coupon_expires_at,
           c.*,m.company_name
      FROM user_coupons uc
      JOIN marketing_campaigns c ON c.id=uc.campaign_id
      JOIN merchants m ON m.id=c.merchant_id
     WHERE uc.user_id=?${filter}
     ORDER BY FIELD(uc.status,'available','locked','used','expired'),uc.expires_at ASC
  `, params)
  return rows.map(row => ({
    ...serializeCampaign(engine.normalizeCampaign({ ...row, id: row.campaign_id })),
    user_coupon_id: Number(row.user_coupon_id),
    coupon_code: row.coupon_code,
    coupon_status: row.user_coupon_status,
    claimed_at: row.claimed_at,
    used_at: row.used_at,
    returned_at: row.returned_at,
    expires_at: row.user_coupon_expires_at,
    merchant_name: row.company_name
  }))
}

async function reserveOrderMarketing(conn, orderId, userId, pricing, orderItemIds = new Map()) {
  const flashReservations = []
  const flashLines = pricing.lines.filter(line => line.promotion && line.promotion.type === 'flash_sale')
  if (flashLines.length) {
    if (!userId) throw statusError('请登录后参与秒杀活动', 401)
    await conn.query('SELECT id FROM users WHERE id=? FOR UPDATE', [userId])
  }
  for (const line of pricing.lines) {
    const promotion = line.promotion
    if (promotion && promotion.type === 'flash_sale') {
      const [[previous]] = await conn.query(`
        SELECT COALESCE(SUM(op.quantity),0) AS total
          FROM order_promotions op
          JOIN orders o ON o.id=op.order_id
         WHERE op.campaign_id=? AND op.type='flash_sale' AND o.user_id=?
           AND op.status IN ('locked','used') AND o.status NOT IN ('cancelled','refunded')
      `, [promotion.id, userId])
      if (Number(previous.total || 0) + line.qty > promotion.perUserLimit) {
        throw statusError(`该秒杀活动每人限购 ${promotion.perUserLimit} 件`, 409)
      }
      const [result] = await conn.query(
        `UPDATE marketing_campaign_products
            SET available_stock=available_stock-?
          WHERE campaign_id=? AND product_id=? AND available_stock>=?`,
        [line.qty, promotion.id, line.productId, line.qty]
      )
      if (!result.affectedRows) throw statusError(`商品「${line.name}」秒杀库存不足`, 409)
      flashReservations.push({ campaignId: promotion.id, productId: line.productId, qty: line.qty })
    }
    const promotionRecords = [
      {
        campaign: line.promotion,
        discountFen: line.productPromotionDiscountFen == null
          ? line.promotionDiscountFen
          : line.productPromotionDiscountFen
      },
      {
        campaign: line.orderPromotion,
        discountFen: line.orderPromotionDiscountFen || 0
      }
    ].filter(record => record.campaign && record.discountFen > 0)
    for (const record of promotionRecords) {
      const campaign = record.campaign
      await conn.query(`
        INSERT INTO order_promotions
          (order_id,order_item_id,campaign_id,kind,type,campaign_name,product_id,quantity,discount_amount,status)
        VALUES (?,?,?,?,?,?,?,?,?,'locked')
      `, [
        orderId, orderItemIds.get(line.productId) || null, campaign.id, 'promotion', campaign.type,
        campaign.name, line.productId, line.qty, engine.fromFen(record.discountFen)
      ])
    }
  }

  if (pricing.coupon) {
    const [locked] = await conn.query(
      `UPDATE user_coupons SET status='locked',locked_order_id=?,locked_at=NOW()
        WHERE id=? AND user_id=? AND status='available' AND expires_at>NOW()`,
      [orderId, pricing.coupon.userCouponId, userId]
    )
    if (!locked.affectedRows) throw statusError('优惠券已被使用或锁定，请重新选择', 409)
    await conn.query(`
      INSERT INTO order_promotions
        (order_id,campaign_id,user_coupon_id,kind,type,campaign_name,discount_amount,status)
      VALUES (?,?,?,?,?,?,?,'locked')
    `, [
      orderId, pricing.coupon.id, pricing.coupon.userCouponId, 'coupon', pricing.coupon.type,
      pricing.coupon.name, engine.fromFen(pricing.couponDiscountFen)
    ])
  }
  return flashReservations
}

async function markOrderPaid(orderId, executor = db) {
  const [records] = await executor.query(
    `SELECT * FROM order_promotions WHERE order_id=? AND status='locked'`, [orderId]
  )
  if (!records.length) return
  const coupon = records.find(item => item.kind === 'coupon' && item.user_coupon_id)
  if (coupon) {
    const [result] = await executor.query(
      `UPDATE user_coupons SET status='used',used_at=NOW() WHERE id=? AND locked_order_id=? AND status='locked'`,
      [coupon.user_coupon_id, orderId]
    )
    if (result.affectedRows) await executor.query('UPDATE marketing_campaigns SET used_count=used_count+1 WHERE id=?', [coupon.campaign_id])
  }
  const promotionCampaignIds = Array.from(new Set(
    records.filter(item => item.kind === 'promotion').map(item => Number(item.campaign_id)).filter(Boolean)
  ))
  for (const campaignId of promotionCampaignIds) {
    await executor.query('UPDATE marketing_campaigns SET used_count=used_count+1 WHERE id=?', [campaignId])
  }
  for (const record of records) {
    if (record.type === 'flash_sale' && record.product_id) {
      await executor.query(
        'UPDATE marketing_campaign_products SET sold_count=sold_count+? WHERE campaign_id=? AND product_id=?',
        [record.quantity, record.campaign_id, record.product_id]
      )
    }
  }
  await executor.query("UPDATE order_promotions SET status='used' WHERE order_id=? AND status='locked'", [orderId])
}

async function releaseOrderMarketing(orderId, executor = db) {
  const [records] = await executor.query(
    `SELECT * FROM order_promotions WHERE order_id=? AND status='locked'`, [orderId]
  )
  if (!records.length) return
  for (const record of records) {
    if (record.type === 'flash_sale' && record.product_id) {
      await executor.query(
        `UPDATE marketing_campaign_products SET available_stock=LEAST(COALESCE(quota,available_stock),available_stock+?)
          WHERE campaign_id=? AND product_id=?`,
        [record.quantity, record.campaign_id, record.product_id]
      )
    }
    if (record.kind === 'coupon' && record.user_coupon_id) {
      await executor.query(`
        UPDATE user_coupons uc JOIN marketing_campaigns c ON c.id=uc.campaign_id
           SET uc.status=IF(uc.expires_at>NOW() AND c.starts_at<=NOW() AND c.ends_at>NOW()
                            AND c.status IN ('approved','running'),'available','expired'),
               uc.locked_order_id=NULL,uc.locked_at=NULL
         WHERE uc.id=? AND uc.locked_order_id=? AND uc.status='locked'
      `, [record.user_coupon_id, orderId])
    }
  }
  await executor.query("UPDATE order_promotions SET status='released' WHERE order_id=? AND status='locked'", [orderId])
}

async function returnCouponAfterRefund(orderId, executor = db) {
  const [records] = await executor.query(
    `SELECT * FROM order_promotions WHERE order_id=? AND status='used'`, [orderId]
  )
  if (!records.length) return
  const coupon = records.find(item => item.kind === 'coupon' && item.user_coupon_id)
  if (coupon) {
    const [result] = await executor.query(`
      UPDATE user_coupons uc JOIN marketing_campaigns c ON c.id=uc.campaign_id
         SET uc.status=IF(uc.expires_at>NOW() AND c.starts_at<=NOW() AND c.ends_at>NOW()
                          AND c.status IN ('approved','running'),'available','expired'),
             uc.locked_order_id=NULL,uc.returned_at=NOW()
       WHERE uc.id=? AND uc.status='used'
    `, [coupon.user_coupon_id])
    if (result.affectedRows) {
      await executor.query('UPDATE marketing_campaigns SET used_count=GREATEST(0,used_count-1) WHERE id=?', [coupon.campaign_id])
    }
  }
  const promotionCampaignIds = Array.from(new Set(
    records.filter(item => item.kind === 'promotion').map(item => Number(item.campaign_id)).filter(Boolean)
  ))
  for (const campaignId of promotionCampaignIds) {
    await executor.query('UPDATE marketing_campaigns SET used_count=GREATEST(0,used_count-1) WHERE id=?', [campaignId])
  }
  await executor.query("UPDATE order_promotions SET status='refunded' WHERE order_id=? AND status='used'", [orderId])
}

module.exports = {
  campaignLabel,
  serializeCampaign,
  validateCampaignPayload,
  decorateProducts,
  priceOrder,
  priceOrderWithBestCoupon,
  isBetterCouponPricing,
  publicQuote,
  createCampaign,
  updateCampaign,
  listMerchantCampaigns,
  submitCampaign,
  pauseCampaign,
  listAdminCampaigns,
  reviewCampaign,
  listClaimableCoupons,
  claimCoupon,
  listUserCoupons,
  reserveOrderMarketing,
  markOrderPaid,
  releaseOrderMarketing,
  returnCouponAfterRefund,
  statusError
}
