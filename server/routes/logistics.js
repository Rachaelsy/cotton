const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const logistics = require('../utils/logistics')

const router = express.Router()
const ok = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function farmerAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return fail(res, '请先登录', 401)
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    if (payload.role && payload.role !== 'farmer') return fail(res, '仅农户可查看订单物流', 403)
    req.user = payload
    next()
  } catch {
    return fail(res, '登录已过期，请重新登录', 401)
  }
}

router.get('/carriers', async (_req, res) => {
  try {
    if (!logistics.isConfigured()) return fail(res, '微信物流助手未配置', 503)
    const accounts = await logistics.listDeliveryAccounts()
    if (!accounts.length) return fail(res, '小程序尚未绑定可用的快递账号', 409)
    return ok(res, accounts)
  } catch (error) {
    console.error('[wechat-logistics-accounts]', error)
    return fail(res, error.message || '微信快递账号加载失败', 502)
  }
})

router.get('/orders/:id', farmerAuth, async (req, res) => {
  try {
    const [[order]] = await db.query(
      `SELECT o.id, o.user_id, o.status, o.logistics_no, o.logistics_company,
              o.wechat_logistics_order_id, o.logistics_queried_at, u.openid
       FROM orders o LEFT JOIN users u ON u.id=o.user_id
       WHERE o.id=? AND o.user_id=?`,
      [req.params.id, req.user.id]
    )
    if (!order) return fail(res, '订单不存在', 404)
    if (!order.logistics_no || !order.logistics_company) return fail(res, '商家尚未填写完整物流信息', 409)

    const lastQuery = order.logistics_queried_at ? new Date(order.logistics_queried_at).getTime() : 0
    const queryDue = !lastQuery || Date.now() - lastQuery >= 30 * 60 * 1000
    const wantsRefresh = req.query.refresh === '1'
    if (!order.wechat_logistics_order_id) return fail(res, '该订单不是通过微信物流助手发货', 409)
    if (logistics.isConfigured() && (queryDue || wantsRefresh)) {
      await logistics.refreshOrder(order)
    }

    const data = await logistics.loadOrderLogistics(order.id)
    return ok(res, data, data.error && !data.events.length ? data.error : 'ok')
  } catch (error) {
    console.error('[order-logistics]', error)
    return fail(res, '物流信息加载失败', 500)
  }
})

module.exports = router
