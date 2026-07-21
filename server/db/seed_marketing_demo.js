require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')
const marketing = require('../utils/marketing')

const PREFIX = '[测试] '

async function ensureCampaign(merchantId, adminId, definition, startsAt, endsAt) {
  const [[existing]] = await db.query(
    'SELECT id FROM marketing_campaigns WHERE merchant_id=? AND name=? LIMIT 1',
    [merchantId, definition.name]
  )
  let id = existing && Number(existing.id)
  if (!id) {
    const created = await marketing.createCampaign(merchantId, {
      ...definition,
      starts_at: startsAt,
      ends_at: endsAt
    })
    id = Number(created.id)
  }
  await db.query(`
    UPDATE marketing_campaigns
       SET status='approved',starts_at=?,ends_at=?,rejection_reason='',
           submitted_at=COALESCE(submitted_at,NOW()),reviewed_by=?,reviewed_at=NOW(),
           per_user_limit=?
      WHERE id=?
  `, [startsAt, endsAt, adminId, definition.kind === 'coupon' ? 1 : (definition.per_user_limit || 1), id])
  return id
}

async function run() {
  const requestedMerchantId = Number(process.env.MARKETING_DEMO_MERCHANT_ID || 0)
  const merchantParams = requestedMerchantId ? [requestedMerchantId] : []
  const merchantFilter = requestedMerchantId ? 'AND m.id=?' : ''
  const [[merchant]] = await db.query(`
    SELECT m.id,m.company_name
      FROM merchants m
     WHERE m.apply_status='approved' ${merchantFilter}
     ORDER BY m.id LIMIT 1
  `, merchantParams)
  if (!merchant) throw new Error('没有可用于测试的已审核商户')

  const [products] = await db.query(
    "SELECT id,name,price FROM products WHERE merchant_id=? AND status='on' AND stock>0 ORDER BY id LIMIT 3",
    [merchant.id]
  )
  if (products.length < 2) throw new Error('测试商户至少需要两件有库存的在售商品')
  const [[admin]] = await db.query('SELECT id FROM users WHERE is_admin=1 ORDER BY id LIMIT 1')
  const adminId = admin ? Number(admin.id) : null
  const startsAt = new Date(Date.now() - 5 * 60000)
  const endsAt = new Date(Date.now() + 30 * 86400000)

  const flashOriginal = Number(products[0].price)
  const flashPrice = Math.max(0.01, Number((flashOriginal * 0.5).toFixed(2)))
  const definitions = [
    {
      kind: 'coupon', type: 'cash', name: `${PREFIX}无门槛立减5元`,
      description: '模拟支付联调用，无门槛立减', scope_type: 'all', discount_amount: 5,
      total_quota: 200, per_user_limit: 1, stackable: true
    },
    {
      kind: 'coupon', type: 'full_reduction', name: `${PREFIX}满100减20元`,
      description: '测试满减门槛和最优券选择', scope_type: 'all', threshold_amount: 100,
      discount_amount: 20, total_quota: 200, per_user_limit: 1, stackable: false
    },
    {
      kind: 'coupon', type: 'percentage', name: `${PREFIX}9折券最高减15元`,
      description: '测试折扣封顶和活动叠加', scope_type: 'all', discount_rate: 90,
      max_discount: 15, total_quota: 200, per_user_limit: 1, stackable: true
    },
    {
      kind: 'promotion', type: 'flash_sale', name: `${PREFIX}${products[0].name}限量秒杀`,
      description: '测试秒杀库存、每人限购和取消回滚', scope_type: 'products',
      product_ids: [products[0].id], special_price: flashPrice, total_quota: 30,
      per_user_limit: 2, stackable: false
    },
    {
      kind: 'promotion', type: 'limited_discount', name: `${PREFIX}指定商品8折`,
      description: '测试商品活动价和购物车自动优惠', scope_type: 'products',
      product_ids: products.slice(1, 3).map(item => item.id), discount_rate: 80, stackable: true
    },
    {
      kind: 'promotion', type: 'tiered_reduction', name: `${PREFIX}阶梯满减`,
      description: '满100减15，满200减35', scope_type: 'all', stackable: true,
      rules_json: { tiers: [{ threshold: 100, discount: 15 }, { threshold: 200, discount: 35 }] }
    }
  ]

  const ids = []
  for (const definition of definitions) {
    ids.push(await ensureCampaign(merchant.id, adminId, definition, startsAt, endsAt))
  }
  console.log(JSON.stringify({
    merchant_id: Number(merchant.id),
    merchant_name: merchant.company_name,
    campaign_ids: ids,
    expires_at: endsAt.toISOString()
  }, null, 2))
}

run()
  .then(() => db.end())
  .catch(async error => {
    console.error('[seed-marketing-demo]', error.message)
    await db.end().catch(() => {})
    process.exit(1)
  })
