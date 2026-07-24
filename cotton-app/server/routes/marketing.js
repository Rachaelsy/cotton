const express = require('express')
const jwt = require('jsonwebtoken')
const marketing = require('../utils/marketing')

const router = express.Router()
const ok = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function readToken(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null
  try { return jwt.verify(auth.slice(7), process.env.JWT_SECRET) } catch { return null }
}

function farmerAuth(req, res, next) {
  const payload = readToken(req)
  if (!payload) return fail(res, '请先登录', 401)
  if (payload.role !== 'farmer') return fail(res, '仅农户可使用优惠券', 403)
  req.user = payload
  next()
}

function optionalFarmerAuth(req, _res, next) {
  const payload = readToken(req)
  req.user = payload && payload.role === 'farmer' ? payload : null
  next()
}

function merchantAuth(req, res, next) {
  const payload = readToken(req)
  if (!payload) return fail(res, '请先登录', 401)
  if (payload.role !== 'merchant' || !payload.merchant_id) return fail(res, '仅商户可管理营销活动', 403)
  req.merchant = payload
  next()
}

function adminAuth(req, res, next) {
  const payload = readToken(req)
  if (!payload) return fail(res, '请先登录', 401)
  if (!payload.is_admin) return fail(res, '无管理员权限', 403)
  req.admin = payload
  next()
}

function handleError(res, error, fallback = '操作失败') {
  console.error('[marketing]', error)
  return fail(res, error.message || fallback, error.statusCode || 500)
}

router.get('/coupons', optionalFarmerAuth, async (req, res) => {
  try {
    const merchantId = Number(req.query.merchant_id) || null
    return ok(res, await marketing.listClaimableCoupons(merchantId, req.user && req.user.id))
  } catch (error) { return handleError(res, error, '优惠券加载失败') }
})

router.get('/coupons/mine', farmerAuth, async (req, res) => {
  try {
    const status = ['available', 'locked', 'used', 'expired'].includes(req.query.status) ? req.query.status : ''
    return ok(res, await marketing.listUserCoupons(req.user.id, status))
  } catch (error) { return handleError(res, error, '我的优惠券加载失败') }
})

router.post('/coupons/:id/claim', farmerAuth, async (req, res) => {
  try {
    const campaignId = Number(req.params.id)
    if (!campaignId) return fail(res, '优惠券编号无效')
    return ok(res, await marketing.claimCoupon(campaignId, req.user.id), '领取成功')
  } catch (error) { return handleError(res, error, '领取失败') }
})

router.post('/quote/best', optionalFarmerAuth, async (req, res) => {
  try {
    const result = await marketing.priceOrderWithBestCoupon(require('../db/database'), {
      items: req.body.items,
      userId: req.user && req.user.id
    })
    return ok(res, {
      ...marketing.publicQuote(result.pricing),
      user_coupon_id: result.selectedUserCouponId,
      auto_coupon_applied: !!result.selectedUserCouponId,
      evaluated_coupons: result.evaluatedCoupons
    }, result.selectedUserCouponId ? '已自动选择最优优惠券' : '优惠计算成功')
  } catch (error) { return handleError(res, error, '优惠计算失败') }
})

router.post('/quote', optionalFarmerAuth, async (req, res) => {
  try {
    if (req.body.user_coupon_id && !req.user) return fail(res, '请登录后使用优惠券', 403)
    const pricing = await marketing.priceOrder(require('../db/database'), {
      items: req.body.items,
      userId: req.user && req.user.id,
      userCouponId: Number(req.body.user_coupon_id) || null,
      lock: false
    })
    return ok(res, marketing.publicQuote(pricing), '优惠计算成功')
  } catch (error) { return handleError(res, error, '优惠计算失败') }
})

router.get('/merchant/campaigns', merchantAuth, async (req, res) => {
  try { return ok(res, await marketing.listMerchantCampaigns(req.merchant.merchant_id)) }
  catch (error) { return handleError(res, error, '营销活动加载失败') }
})

router.post('/merchant/campaigns', merchantAuth, async (req, res) => {
  try { return ok(res, await marketing.createCampaign(req.merchant.merchant_id, req.body), '活动草稿已创建') }
  catch (error) { return handleError(res, error, '创建失败') }
})

router.put('/merchant/campaigns/:id', merchantAuth, async (req, res) => {
  try { return ok(res, await marketing.updateCampaign(req.merchant.merchant_id, Number(req.params.id), req.body), '活动已保存') }
  catch (error) { return handleError(res, error, '保存失败') }
})

router.post('/merchant/campaigns/:id/submit', merchantAuth, async (req, res) => {
  try {
    await marketing.submitCampaign(req.merchant.merchant_id, Number(req.params.id))
    return ok(res, null, '已提交管理员审核')
  } catch (error) { return handleError(res, error, '提交失败') }
})

router.patch('/merchant/campaigns/:id/pause', merchantAuth, async (req, res) => {
  try {
    await marketing.pauseCampaign(req.merchant.merchant_id, Number(req.params.id))
    return ok(res, null, '活动已暂停')
  } catch (error) { return handleError(res, error, '暂停失败') }
})

router.get('/admin/campaigns', adminAuth, async (req, res) => {
  try { return ok(res, await marketing.listAdminCampaigns(String(req.query.status || ''))) }
  catch (error) { return handleError(res, error, '营销审核列表加载失败') }
})

router.patch('/admin/campaigns/:id/review', adminAuth, async (req, res) => {
  try {
    const approved = req.body.approved === true || req.body.action === 'approve'
    if (!approved && !String(req.body.reason || '').trim()) return fail(res, '驳回时请填写原因')
    await marketing.reviewCampaign(req.admin.id, Number(req.params.id), approved, req.body.reason)
    return ok(res, null, approved ? '活动已通过审核' : '活动已驳回')
  } catch (error) { return handleError(res, error, '审核失败') }
})

module.exports = router
