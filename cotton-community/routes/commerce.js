const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const clean = (value, max) => String(value || '').trim().slice(0, max)

const featuredMerchants = [
  {
    id: 'demo-xinjiang-chuanyue',
    name: '新疆川月农业科技有限公司',
    category: '智慧棉花与农业科技服务',
    location: '新疆喀什地区',
    registeredAddress: '新疆喀什地区莎车县叶尔羌街道办事处育才社区绿地八方城B-3-2013号商铺',
    contactName: '唐继军',
    phone: '18701971977',
    demo: false,
    productCount: 5,
    intro: '专注于智慧棉花生产管理，围绕品种筛选、作物长势监测、病虫害监测和水肥精准管理，为棉花种植提供数字化农业技术服务。'
  },
  {
    id: 'demo-guizhou-guolin-tianhua',
    name: '贵州国磷天化化工（集团）有限公司',
    category: '肥料与农业投入品',
    location: '贵州省贵阳市观山湖区',
    registeredAddress: '贵州省贵阳市观山湖区世纪城街道贵阳世纪城X组团1-5栋',
    contactName: '梁枫',
    phone: '18999702088',
    demo: false,
    productCount: 7,
    intro: '围绕农业肥料和生产投入品开展业务，提供复合肥、水溶肥等产品信息与农业施肥服务，服务农业生产中的养分管理需求。'
  },
  {
    id: 'demo-xinjiang-wanxiangle',
    name: '新疆万祥乐农资有限公司',
    category: '农业生产资料',
    location: '新疆喀什地区莎车县',
    registeredAddress: '新疆喀什地区莎车县米夏镇克斯木其17村米卡姆北路426号',
    contactName: '奴尔艾力',
    phone: '13899188660',
    demo: false,
    intro: '面向莎车县及周边农业生产经营者，提供种子、肥料、农膜和滴灌材料等农业生产资料，满足播种与田间管理环节的农资需求。'
  },
  {
    id: 'dupont-shandong-agriculture',
    name: '杜邦(山东)农业科技有限公司',
    category: '肥料与农业营养产品',
    location: '山东省菏泽市',
    registeredAddress: '山东省菏泽市北部经济开发区衡山路7号',
    contactName: '周建防',
    phone: '15305382000',
    demo: false,
    productCount: 6,
    intro: '围绕农业种植中的养分补充与土壤管理需求，提供大量元素水溶肥、含腐植酸水溶肥、有机水溶肥和氨基酸类营养产品。'
  }
].map(item => ({
  ...item,
  phone: item.phone || '',
  email: '',
  contactName: item.contactName || '',
  wechat: '',
  deliveryRadius: null,
  productCount: Number(item.productCount ?? 3),
  featured: true,
  demo: Boolean(item.demo)
}))

const formatMerchant = row => ({
  id: Number(row.id),
  name: row.company_name || '入驻商家',
  category: row.product_category || '棉花生产服务',
  location: row.location_name || '新疆喀什地区',
  phone: row.service_phone || '',
  email: row.contact_email || '',
  contactName: row.contact_name || '',
  wechat: row.wechat_id || '',
  registeredAddress: row.registered_address || '',
  deliveryRadius: row.delivery_radius == null ? null : Number(row.delivery_radius),
  intro: `主营${row.product_category || '棉花生产资料及配套服务'}，商家资料已经平台审核。`,
  productCount: Number(row.product_count || 0),
  featured: false,
  demo: false
})

function includeFeaturedMerchants(rows) {
  const byName = new Map(rows.map(item => [item.name, item]))
  const featured = featuredMerchants.map(profile => {
    const saved = byName.get(profile.name)
    if (!saved) return profile
    return {
      ...profile,
      ...saved,
      location: profile.location,
      phone: profile.phone,
      email: profile.email,
      contactName: profile.contactName,
      wechat: profile.wechat,
      registeredAddress: profile.registeredAddress,
      intro: profile.intro,
      featured: true,
      demo: Boolean(profile.demo)
    }
  })
  const featuredNames = new Set(featuredMerchants.map(item => item.name))
  return featured.concat(rows.filter(item => !featuredNames.has(item.name)))
}

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
      SELECT m.id,m.company_name,m.product_category,m.location_name,u.phone AS service_phone,
             u.real_name AS contact_name,m.contact_email,m.registered_address,
             m.wechat_id,m.delivery_radius,
             (SELECT COUNT(*) FROM products p WHERE p.merchant_id=m.id AND p.status='on') AS product_count
      FROM merchants m
      JOIN users u ON u.id=m.user_id AND u.is_active=1
      WHERE m.apply_status='approved'
      ORDER BY product_count DESC,m.id DESC
      LIMIT 100
    `)
    return ok(res, includeFeaturedMerchants(rows.map(formatMerchant)))
  } catch (error) {
    console.error('[commerce-merchants]', error)
    return ok(res, featuredMerchants)
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
