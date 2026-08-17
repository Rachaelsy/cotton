const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const TYPES = new Set(['machinery', 'supplies'])
const CATEGORIES = {
  machinery: new Set(['耕整地', '播种铺膜', '田间管理', '采收运输']),
  supplies: new Set(['种子', '肥料', '农药', '地膜'])
}

function tokenPayload(req) {
  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ')) return null
  try { return jwt.verify(authorization.slice(7), process.env.JWT_SECRET) } catch { return null }
}

async function productAdminAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload) return fail(res, '管理员登录已过期', 401)
  try {
    if (payload.is_community_admin && ['public_admin', 'policy_editor'].includes(payload.permission)) {
      const [[account]] = await db.query(
        'SELECT id,is_active,auth_version FROM community_admins WHERE id=? LIMIT 1',
        [payload.id]
      )
      if (!account || !account.is_active || Number(account.auth_version) !== Number(payload.auth_version || 0)) {
        return fail(res, '公共服务管理员账号已停用或登录已失效', 401)
      }
      req.productAdmin = { id: Number(account.id), type: 'community' }
      return next()
    }
    if (payload.is_admin) {
      const [[account]] = await db.query(
        'SELECT id,is_admin,is_active,admin_auth_version FROM users WHERE id=? LIMIT 1',
        [payload.id]
      )
      if (!account || !account.is_admin || !account.is_active ||
          Number(account.admin_auth_version || 0) !== Number(payload.auth_version || 0)) {
        return fail(res, '平台管理员登录已失效', 401)
      }
      req.productAdmin = { id: Number(account.id), type: 'platform' }
      return next()
    }
    return fail(res, '无生产服务产品管理权限', 403)
  } catch (error) {
    console.error('[service-product-admin-auth]', error)
    return fail(res, '管理员身份校验失败', 500)
  }
}

function safeUrl(value) {
  const url = String(value || '').trim().slice(0, 500)
  return !url || /^https:\/\//i.test(url) || url.startsWith('/uploads/') || url.startsWith('/assets/') ? url : ''
}

function stringList(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/\r?\n|，|,/)
  return source.map(item => String(item).trim()).filter(Boolean).slice(0, 12).map(item => item.slice(0, 100))
}

function productBody(body = {}, forcedType = '') {
  const serviceType = TYPES.has(forcedType) ? forcedType : (TYPES.has(body.service_type) ? body.service_type : '')
  const requestedCategory = String(body.category || '').trim()
  const category = CATEGORIES[serviceType] && CATEGORIES[serviceType].has(requestedCategory) ? requestedCategory : ''
  const status = ['draft', 'published', 'offline'].includes(body.status) ? body.status : 'draft'
  return {
    serviceType,
    category,
    name: String(body.name || '').trim().slice(0, 160),
    modelName: String(body.model_name || body.modelName || '').trim().slice(0, 160),
    brand: String(body.brand || '').trim().slice(0, 120),
    manufacturer: String(body.manufacturer || '').trim().slice(0, 180),
    coverUrl: safeUrl(body.cover_url || body.coverUrl),
    intro: String(body.intro || '').trim().slice(0, 1000),
    features: stringList(body.features || body.features_json),
    applicable: String(body.applicable || '').trim().slice(0, 500),
    region: String(body.region || '喀什地区').trim().slice(0, 160),
    status,
    featured: body.is_featured === true || body.is_featured === 1 || body.is_featured === '1' ? 1 : 0,
    sortOrder: Math.max(-9999, Math.min(9999, Number.parseInt(body.sort_order, 10) || 0))
  }
}

function normalize(row) {
  let features = []
  try { features = JSON.parse(row.features_json || '[]') } catch {}
  return {
    id: Number(row.id), serviceType: row.service_type, category: row.category,
    name: row.name || '', modelName: row.model_name || '', brand: row.brand || '',
    manufacturer: row.manufacturer || '', coverUrl: row.cover_url || '', intro: row.intro || '',
    features: Array.isArray(features) ? features : [], applicable: row.applicable || '', region: row.region || '',
    status: row.status || 'draft', isFeatured: !!row.is_featured, sortOrder: Number(row.sort_order || 0),
    publishedAt: row.published_at || null, createdAt: row.created_at || null, updatedAt: row.updated_at || null
  }
}

router.get('/', async (req, res) => {
  const type = String(req.query.type || '')
  if (!TYPES.has(type)) return fail(res, '请选择农机或农资产品类型')
  const params = [type]
  let categorySql = ''
  const category = String(req.query.category || '').trim()
  if (category && CATEGORIES[type].has(category)) { categorySql = ' AND category=?'; params.push(category) }
  try {
    const [rows] = await db.query(
      `SELECT * FROM community_service_products WHERE service_type=? AND status='published'${categorySql}
       ORDER BY is_featured DESC,sort_order ASC,published_at DESC,id DESC LIMIT 200`,
      params
    )
    return ok(res, rows.map(normalize))
  } catch (error) {
    console.error('[service-product-list]', error)
    return fail(res, '产品目录加载失败', 500)
  }
})

router.get('/admin/list', productAdminAuth, async (req, res) => {
  const type = String(req.query.type || '')
  if (!TYPES.has(type)) return fail(res, '请选择农机或农资产品类型')
  try {
    const [rows] = await db.query(
      'SELECT * FROM community_service_products WHERE service_type=? ORDER BY updated_at DESC,id DESC LIMIT 500',
      [type]
    )
    return ok(res, rows.map(normalize))
  } catch (error) {
    console.error('[service-product-admin-list]', error)
    return fail(res, '产品管理列表加载失败', 500)
  }
})

router.post('/admin', productAdminAuth, async (req, res) => {
  const product = productBody(req.body)
  if (!product.serviceType || !product.category || !product.name || !product.intro) {
    return fail(res, '产品类型、分类、名称和简介不能为空')
  }
  try {
    const [result] = await db.query(
      `INSERT INTO community_service_products
       (service_type,category,name,model_name,brand,manufacturer,cover_url,intro,features_json,applicable,region,status,is_featured,sort_order,published_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?='published',NOW(),NULL),?,?)`,
      [product.serviceType, product.category, product.name, product.modelName, product.brand, product.manufacturer,
       product.coverUrl, product.intro, JSON.stringify(product.features), product.applicable, product.region,
       product.status, product.featured, product.sortOrder, product.status, req.productAdmin.id, req.productAdmin.id]
    )
    return ok(res, { id: Number(result.insertId) }, product.status === 'published' ? '产品已上架' : '产品已保存')
  } catch (error) {
    console.error('[service-product-create]', error)
    return fail(res, '产品保存失败', 500)
  }
})

router.put('/admin/:id', productAdminAuth, async (req, res) => {
  const product = productBody(req.body)
  if (!product.serviceType || !product.category || !product.name || !product.intro) {
    return fail(res, '产品类型、分类、名称和简介不能为空')
  }
  try {
    const [result] = await db.query(
      `UPDATE community_service_products SET service_type=?,category=?,name=?,model_name=?,brand=?,manufacturer=?,
       cover_url=?,intro=?,features_json=?,applicable=?,region=?,status=?,is_featured=?,sort_order=?,
       published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_by=? WHERE id=?`,
      [product.serviceType, product.category, product.name, product.modelName, product.brand, product.manufacturer,
       product.coverUrl, product.intro, JSON.stringify(product.features), product.applicable, product.region,
       product.status, product.featured, product.sortOrder, product.status, req.productAdmin.id, req.params.id]
    )
    if (!result.affectedRows) return fail(res, '产品不存在', 404)
    return ok(res, null, product.status === 'published' ? '产品已上架' : product.status === 'offline' ? '产品已下架' : '产品已保存')
  } catch (error) {
    console.error('[service-product-update]', error)
    return fail(res, '产品更新失败', 500)
  }
})

router.patch('/admin/:id/status', productAdminAuth, async (req, res) => {
  const status = ['draft', 'published', 'offline'].includes(req.body.status) ? req.body.status : ''
  if (!status) return fail(res, '产品状态不正确')
  try {
    const [result] = await db.query(
      `UPDATE community_service_products SET status=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_by=? WHERE id=?`,
      [status, status, req.productAdmin.id, req.params.id]
    )
    if (!result.affectedRows) return fail(res, '产品不存在', 404)
    return ok(res, null, status === 'published' ? '产品已上架' : status === 'offline' ? '产品已下架' : '产品已转为草稿')
  } catch (error) {
    console.error('[service-product-status]', error)
    return fail(res, '产品状态更新失败', 500)
  }
})

router.delete('/admin/:id', productAdminAuth, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM community_service_products WHERE id=?', [req.params.id])
    if (!result.affectedRows) return fail(res, '产品不存在', 404)
    return ok(res, null, '产品已删除')
  } catch (error) {
    console.error('[service-product-delete]', error)
    return fail(res, '产品删除失败', 500)
  }
})

module.exports = router
