// server/routes/machines.js — 农户端：农机浏览（含真实距离）
const express = require('express')
const db      = require('../db/database')
const router  = express.Router()

const ok   = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function parseJSON(str, fallback) {
  try { return str ? JSON.parse(str) : fallback } catch { return fallback }
}

// ─────────────────────────────────────────────────────────────
// GET /api/machines — 农机列表
// 查询参数：lat, lng（农户参考点）, category, sort=distance|price|rating|recommend
// 返回每台机具的真实 distance_km（提供 lat/lng 时）
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { lat, lng, category, sort = 'recommend' } = req.query
  const hasGeo = lat && lng && !isNaN(lat) && !isNaN(lng)
  try {
    // ST_Distance_Sphere 接收 POINT(经度,纬度)，返回米
    // 机具自身坐标优先，未填则用机主基地坐标兜底
    const distExpr = hasGeo
      ? `ROUND(ST_Distance_Sphere(POINT(COALESCE(m.longitude, o.longitude), COALESCE(m.latitude, o.latitude)), POINT(?, ?)) / 1000, 1)`
      : `NULL`
    let sql = `
      SELECT m.id, m.operator_id, m.name, m.category, m.icon, m.price, m.price_orig,
             m.unit, m.latitude, m.longitude, m.location_name, m.service_radius,
             m.spec_badges, m.params,
             m.description, m.status, m.rating_avg, m.order_count,
             o.org_name, o.response_time, o.rating_avg AS org_rating,
             ${distExpr} AS distance_km
      FROM machines m
      JOIN operators o ON o.id = m.operator_id
      WHERE m.status IN ('on','busy') AND o.apply_status = 'approved'
    `
    const params = []
    if (hasGeo) params.push(parseFloat(lng), parseFloat(lat))
    if (category && category !== '全部') { sql += ' AND m.category = ?'; params.push(category) }

    // 排序
    if (sort === 'distance' && hasGeo) sql += ' ORDER BY distance_km IS NULL, distance_km ASC'
    else if (sort === 'price')         sql += ' ORDER BY m.price ASC'
    else if (sort === 'rating')        sql += ' ORDER BY m.rating_avg DESC'
    else                               sql += ' ORDER BY m.order_count DESC, m.rating_avg DESC'

    const [rows] = await db.query(sql, params)
    rows.forEach(m => {
      m.spec_badges = parseJSON(m.spec_badges, [])
      m.params = parseJSON(m.params, [])
      m.distance_km = m.distance_km !== null ? Number(m.distance_km) : null
      m.service_radius = Number(m.service_radius)
      m.out_of_range = m.distance_km !== null && m.distance_km > m.service_radius
    })
    // 有定位时，只返回能服务到农户的农机（超出范围的不展示，避免距离排序失去意义）
    const result = hasGeo ? rows.filter(m => !m.out_of_range) : rows
    return ok(res, result)
  } catch (e) {
    console.error('[machines-list]', e)
    return fail(res, '获取农机列表失败', 500)
  }
})

// ─────────────────────────────────────────────────────────────
// GET /api/machines/:id — 农机详情（含机手信息 + 评价）
// 可带 ?lat=&lng= 以返回距离
// ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { lat, lng } = req.query
  const hasGeo = lat && lng && !isNaN(lat) && !isNaN(lng)
  try {
    const distExpr = hasGeo
      ? `ROUND(ST_Distance_Sphere(POINT(COALESCE(m.longitude, o.longitude), COALESCE(m.latitude, o.latitude)), POINT(?, ?)) / 1000, 1)`
      : `NULL`
    const params = []
    if (hasGeo) params.push(parseFloat(lng), parseFloat(lat))
    params.push(req.params.id)
    const [[m]] = await db.query(`
      SELECT m.*, ${distExpr} AS distance_km,
             o.org_name, o.contact, o.phone AS org_phone, o.service_area,
             o.response_time, o.rating_avg AS org_rating, o.location_name AS org_location
      FROM machines m
      JOIN operators o ON o.id = m.operator_id
      WHERE m.id = ?
    `, params)
    if (!m) return fail(res, '机具不存在', 404)
    m.spec_badges = parseJSON(m.spec_badges, [])
    m.params = parseJSON(m.params, [])
    m.distance_km = m.distance_km !== null && m.distance_km !== undefined ? Number(m.distance_km) : null
    m.service_radius = Number(m.service_radius)
    m.out_of_range = m.distance_km !== null && m.distance_km > m.service_radius

    // 评价
    const [reviews] = await db.query(`
      SELECT id, farmer_name, score_timely, score_quality, score_attitude, score_price,
             rating, content, reply, DATE_FORMAT(created_at,'%Y-%m-%d') AS date
      FROM machine_reviews WHERE machine_id=? ORDER BY created_at DESC LIMIT 20
    `, [req.params.id])
    const [[stats]] = await db.query(
      'SELECT COUNT(*) AS total, IFNULL(AVG(rating),5) AS avg FROM machine_reviews WHERE machine_id=?',
      [req.params.id]
    )
    return ok(res, {
      ...m,
      reviews,
      review_total: stats.total,
      review_avg: parseFloat(stats.avg).toFixed(1)
    })
  } catch (e) {
    console.error('[machine-detail]', e)
    return fail(res, '获取详情失败', 500)
  }
})

module.exports = router
