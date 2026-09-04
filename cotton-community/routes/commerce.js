const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const clean = (value, max) => String(value || '').trim().slice(0, max)

function signedIn(req, res, next) {
  const value = String(req.headers.authorization || '')
  if (!value.startsWith('Bearer ')) return fail(res, '请先登录后发布信息', 401)
  try {
    req.viewer = jwt.verify(value.slice(7), process.env.JWT_SECRET)
    return next()
  } catch {
    return fail(res, '登录已过期，请重新登录', 401)
  }
}

router.get('/merchants', async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.id,m.company_name,m.product_category,m.location_name,'' AS service_phone,
             m.wechat_id,m.delivery_radius,
             COUNT(DISTINCT CASE WHEN p.status='on' THEN p.id END) AS product_count
      FROM merchants m
      JOIN users u ON u.id=m.user_id AND u.is_active=1
      LEFT JOIN products p ON p.merchant_id=m.id
      WHERE m.apply_status='approved'
      GROUP BY m.id
      ORDER BY product_count DESC,m.id DESC
      LIMIT 100
    `)
    return ok(res, rows.map(row => ({
      id: Number(row.id),
      name: row.company_name || '入驻商户',
      category: row.product_category || '棉花生产服务',
      location: row.location_name || '新疆喀什地区',
      phone: row.service_phone || '',
      wechat: row.wechat_id || '',
      deliveryRadius: row.delivery_radius == null ? null : Number(row.delivery_radius),
      intro: `主营${row.product_category || '棉花生产资料及配套服务'}，商户资料已经平台审核。`,
      productCount: Number(row.product_count || 0)
    })))
  } catch (error) {
    console.error('[commerce-merchants]', error)
    return fail(res, '商户信息暂时无法加载', 500)
  }
})

router.get('/listings', async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id,listing_type,title,content,contact_name,contact_phone,region,created_at
      FROM community_market_listings
      WHERE status='published' AND (expires_at IS NULL OR expires_at>=NOW())
      ORDER BY is_featured DESC,created_at DESC
      LIMIT 100
    `)
    return ok(res, rows)
  } catch (error) {
    console.error('[commerce-listings]', error)
    return fail(res, '本地供需信息暂时无法加载', 500)
  }
})

router.post('/listings', signedIn, async (req, res) => {
  const type = clean(req.body.type, 20)
  const title = clean(req.body.title, 120)
  const content = clean(req.body.content, 1500)
  const contactName = clean(req.body.contactName, 64)
  const contactPhone = clean(req.body.contactPhone, 24).replace(/[\s-]/g, '')
  const region = clean(req.body.region, 120)
  if (!['供应', '求购', '农机服务', '运输服务', '加工服务'].includes(type)) return fail(res, '请选择信息类型')
  if (title.length < 4 || content.length < 10) return fail(res, '请完整填写标题和信息详情')
  if (!/^1\d{10}$/.test(contactPhone)) return fail(res, '请填写正确的手机号')
  try {
    const [result] = await db.query(`
      INSERT INTO community_market_listings
      (user_id,listing_type,title,content,contact_name,contact_phone,region,status)
      VALUES (?,?,?,?,?,?,?,'pending')
    `, [req.viewer.id, type, title, content, contactName, contactPhone, region])
    return ok(res, { id: Number(result.insertId), status: 'pending' }, '信息已提交，审核通过后展示')
  } catch (error) {
    console.error('[commerce-listing-create]', error)
    return fail(res, '提交失败，请稍后重试', 500)
  }
})

module.exports = router
