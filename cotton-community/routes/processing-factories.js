const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })

function tokenPayload(req) {
  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ')) return null
  try { return jwt.verify(authorization.slice(7), process.env.JWT_SECRET) } catch { return null }
}

async function factoryAdminAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload) return fail(res, '管理员登录已过期', 401)
  try {
    if (payload.is_community_admin && ['public_admin', 'policy_editor'].includes(payload.permission)) {
      const [[account]] = await db.query('SELECT id,is_active,auth_version FROM community_admins WHERE id=? LIMIT 1', [payload.id])
      if (!account || !account.is_active || Number(account.auth_version) !== Number(payload.auth_version || 0)) {
        return fail(res, '公共服务管理员账号已停用或登录已失效', 401)
      }
      req.factoryAdmin = { id: Number(account.id), type: 'community' }
      return next()
    }
    if (payload.is_admin) {
      const [[account]] = await db.query('SELECT id,is_admin,is_active,admin_auth_version FROM users WHERE id=? LIMIT 1', [payload.id])
      if (!account || !account.is_admin || !account.is_active || Number(account.admin_auth_version || 0) !== Number(payload.auth_version || 0)) {
        return fail(res, '平台管理员登录已失效', 401)
      }
      req.factoryAdmin = { id: Number(account.id), type: 'platform' }
      return next()
    }
    return fail(res, '无加工服务管理权限', 403)
  } catch (error) {
    console.error('[processing-factory-admin-auth]', error)
    return fail(res, '管理员身份校验失败', 500)
  }
}

function safeUrl(value) {
  const url = String(value || '').trim().slice(0, 500)
  return !url || /^https:\/\//i.test(url) || url.startsWith('/uploads/') || url.startsWith('/assets/') ? url : ''
}

function stringList(value, limit = 20, itemLimit = 160) {
  const source = Array.isArray(value) ? value : String(value || '').split(/\r?\n|，|,/)
  return source.map(item => String(item).trim()).filter(Boolean).slice(0, limit).map(item => item.slice(0, itemLimit))
}

function imageList(value) {
  return stringList(value, 12, 500).map(safeUrl).filter(Boolean)
}

function optionalNumber(value, min, max) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max ? number : null
}

function factoryBody(body = {}) {
  return {
    name: String(body.name || '').trim().slice(0, 200),
    shortName: String(body.short_name || body.shortName || '').trim().slice(0, 100),
    county: String(body.county || '').trim().slice(0, 80),
    address: String(body.address || '').trim().slice(0, 300),
    longitude: optionalNumber(body.longitude, -180, 180),
    latitude: optionalNumber(body.latitude, -90, 90),
    annualCapacityTons: optionalNumber(body.annual_capacity_tons ?? body.annualCapacityTons, 0, 999999999),
    managerName: String(body.manager_name || body.managerName || '').trim().slice(0, 80),
    contactPhone: String(body.contact_phone || body.contactPhone || '').trim().slice(0, 40),
    intro: String(body.intro || '').trim().slice(0, 3000),
    imageUrls: imageList(body.image_urls || body.imageUrls),
    services: stringList(body.services, 20, 100),
    publicCode: String(body.public_code || body.publicCode || '').trim().slice(0, 40) || null,
    rating: String(body.rating || '').trim().slice(0, 20),
    officialAddress: String(body.official_address || body.officialAddress || '').trim().slice(0, 300),
    mapName: String(body.map_name || body.mapName || '').trim().slice(0, 200),
    officialSource: String(body.official_source || body.officialSource || '').trim().slice(0, 500),
    mapSource: String(body.map_source || body.mapSource || '').trim().slice(0, 300),
    verifiedAt: /^\d{4}-\d{2}-\d{2}$/.test(String(body.verified_at || body.verifiedAt || '')) ? String(body.verified_at || body.verifiedAt) : null,
    status: ['draft', 'published', 'offline'].includes(body.status) ? body.status : 'draft',
    featured: body.is_featured === true || body.is_featured === 1 || body.is_featured === '1' ? 1 : 0,
    sortOrder: Math.max(-9999, Math.min(9999, Number.parseInt(body.sort_order ?? body.sortOrder, 10) || 0))
  }
}

function parseJsonList(value) {
  try { const result = JSON.parse(value || '[]'); return Array.isArray(result) ? result : [] } catch { return [] }
}

function dateOnly(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // mysql2 将 +08:00 的 DATE 午夜表示为前一日 16:00 UTC，按产品时区还原日期。
    return new Date(value.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

function normalize(row) {
  return {
    id: Number(row.id), name: row.name || '', shortName: row.short_name || '', county: row.county || '',
    address: row.address || '', longitude: Number(row.longitude), latitude: Number(row.latitude),
    annualCapacityTons: row.annual_capacity_tons === null ? null : Number(row.annual_capacity_tons),
    managerName: row.manager_name || '', contactPhone: row.contact_phone || '', intro: row.intro || '',
    imageUrls: parseJsonList(row.image_urls_json), services: parseJsonList(row.services_json),
    publicCode: row.public_code || '', rating: row.rating || '', officialAddress: row.official_address || '',
    mapName: row.map_name || '', officialSource: row.official_source || '', mapSource: row.map_source || '',
    verifiedAt: dateOnly(row.verified_at), status: row.status || 'draft', isFeatured: !!row.is_featured,
    sortOrder: Number(row.sort_order || 0), publishedAt: row.published_at || null,
    createdAt: row.created_at || null, updatedAt: row.updated_at || null
  }
}

router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM community_processing_factories WHERE status='published' ORDER BY is_featured DESC,sort_order ASC,id ASC LIMIT 500")
    return ok(res, rows.map(normalize))
  } catch (error) {
    console.error('[processing-factory-list]', error)
    return fail(res, '加工厂列表加载失败', 500)
  }
})

router.get('/admin/list', factoryAdminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM community_processing_factories ORDER BY updated_at DESC,id DESC LIMIT 1000')
    return ok(res, rows.map(normalize))
  } catch (error) {
    console.error('[processing-factory-admin-list]', error)
    return fail(res, '加工厂管理列表加载失败', 500)
  }
})

router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await db.query("SELECT * FROM community_processing_factories WHERE id=? AND status='published' LIMIT 1", [req.params.id])
    if (!row) return fail(res, '加工厂信息不存在', 404)
    return ok(res, normalize(row))
  } catch (error) {
    console.error('[processing-factory-detail]', error)
    return fail(res, '加工厂详情加载失败', 500)
  }
})

router.post('/admin', factoryAdminAuth, async (req, res) => {
  const factory = factoryBody(req.body)
  if (!factory.name || !factory.county || !factory.address || factory.longitude === null || factory.latitude === null || !factory.intro) {
    return fail(res, '名称、县市、地址、经纬度和简介不能为空')
  }
  try {
    const [result] = await db.query(
      `INSERT INTO community_processing_factories
       (name,short_name,county,address,longitude,latitude,annual_capacity_tons,manager_name,contact_phone,intro,image_urls_json,services_json,public_code,rating,official_address,map_name,official_source,map_source,verified_at,status,is_featured,sort_order,published_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?='published',NOW(),NULL),?,?)`,
      [factory.name, factory.shortName, factory.county, factory.address, factory.longitude, factory.latitude,
       factory.annualCapacityTons, factory.managerName, factory.contactPhone, factory.intro, JSON.stringify(factory.imageUrls),
       JSON.stringify(factory.services), factory.publicCode, factory.rating, factory.officialAddress, factory.mapName,
       factory.officialSource, factory.mapSource, factory.verifiedAt, factory.status, factory.featured, factory.sortOrder,
       factory.status, req.factoryAdmin.id, req.factoryAdmin.id]
    )
    return ok(res, { id: Number(result.insertId) }, factory.status === 'published' ? '加工厂已发布' : '加工厂已保存')
  } catch (error) {
    console.error('[processing-factory-create]', error)
    return fail(res, error.code === 'ER_DUP_ENTRY' ? '公示代码已存在' : '加工厂保存失败', error.code === 'ER_DUP_ENTRY' ? 409 : 500)
  }
})

router.put('/admin/:id', factoryAdminAuth, async (req, res) => {
  const factory = factoryBody(req.body)
  if (!factory.name || !factory.county || !factory.address || factory.longitude === null || factory.latitude === null || !factory.intro) {
    return fail(res, '名称、县市、地址、经纬度和简介不能为空')
  }
  try {
    const [result] = await db.query(
      `UPDATE community_processing_factories SET name=?,short_name=?,county=?,address=?,longitude=?,latitude=?,annual_capacity_tons=?,manager_name=?,contact_phone=?,intro=?,image_urls_json=?,services_json=?,public_code=?,rating=?,official_address=?,map_name=?,official_source=?,map_source=?,verified_at=?,status=?,is_featured=?,sort_order=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_by=? WHERE id=?`,
      [factory.name, factory.shortName, factory.county, factory.address, factory.longitude, factory.latitude,
       factory.annualCapacityTons, factory.managerName, factory.contactPhone, factory.intro, JSON.stringify(factory.imageUrls),
       JSON.stringify(factory.services), factory.publicCode, factory.rating, factory.officialAddress, factory.mapName,
       factory.officialSource, factory.mapSource, factory.verifiedAt, factory.status, factory.featured, factory.sortOrder,
       factory.status, req.factoryAdmin.id, req.params.id]
    )
    if (!result.affectedRows) return fail(res, '加工厂不存在', 404)
    return ok(res, null, '加工厂信息已更新')
  } catch (error) {
    console.error('[processing-factory-update]', error)
    return fail(res, error.code === 'ER_DUP_ENTRY' ? '公示代码已存在' : '加工厂更新失败', error.code === 'ER_DUP_ENTRY' ? 409 : 500)
  }
})

router.patch('/admin/:id/status', factoryAdminAuth, async (req, res) => {
  const status = ['draft', 'published', 'offline'].includes(req.body.status) ? req.body.status : ''
  if (!status) return fail(res, '加工厂状态不正确')
  try {
    const [result] = await db.query("UPDATE community_processing_factories SET status=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_by=? WHERE id=?", [status, status, req.factoryAdmin.id, req.params.id])
    if (!result.affectedRows) return fail(res, '加工厂不存在', 404)
    return ok(res, null, status === 'published' ? '加工厂已发布' : status === 'offline' ? '加工厂已下线' : '加工厂已转为草稿')
  } catch (error) {
    console.error('[processing-factory-status]', error)
    return fail(res, '加工厂状态更新失败', 500)
  }
})

router.delete('/admin/:id', factoryAdminAuth, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM community_processing_factories WHERE id=?', [req.params.id])
    if (!result.affectedRows) return fail(res, '加工厂不存在', 404)
    return ok(res, null, '加工厂已删除')
  } catch (error) {
    console.error('[processing-factory-delete]', error)
    return fail(res, '加工厂删除失败', 500)
  }
})

module.exports = router
