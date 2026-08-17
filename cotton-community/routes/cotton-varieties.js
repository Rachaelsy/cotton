const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const STATUS = new Set(['draft', 'published', 'offline'])
const SORT_SQL = {
  overall: 'overall_rank IS NULL,overall_rank ASC,sort_order ASC,id ASC',
  yield: 'yield_rank IS NULL,yield_rank ASC,overall_rank ASC,id ASC',
  quality: '(COALESCE(fiber_length_weighted,999)+COALESCE(fiber_strength_weighted,999)+COALESCE(micronaire_weighted,999)+COALESCE(uniformity_weighted,999)) ASC,overall_rank ASC,id ASC',
  lint: 'lint_rank IS NULL,lint_rank ASC,overall_rank ASC,id ASC'
}

function tokenPayload(req) {
  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ')) return null
  try { return jwt.verify(authorization.slice(7), process.env.JWT_SECRET) } catch { return null }
}

async function varietyAdminAuth(req, res, next) {
  const payload = tokenPayload(req)
  if (!payload) return fail(res, '管理员登录已过期', 401)
  try {
    if (payload.is_community_admin && ['public_admin', 'policy_editor'].includes(payload.permission)) {
      const [[account]] = await db.query('SELECT id,is_active,auth_version FROM community_admins WHERE id=? LIMIT 1', [payload.id])
      if (!account || !account.is_active || Number(account.auth_version) !== Number(payload.auth_version || 0)) {
        return fail(res, '公共服务管理员账号已停用或登录已失效', 401)
      }
      req.varietyAdmin = { id: Number(account.id), type: 'community' }
      return next()
    }
    if (payload.is_admin) {
      const [[account]] = await db.query('SELECT id,is_admin,is_active,admin_auth_version FROM users WHERE id=? LIMIT 1', [payload.id])
      if (!account || !account.is_admin || !account.is_active || Number(account.admin_auth_version || 0) !== Number(payload.auth_version || 0)) {
        return fail(res, '平台管理员登录已失效', 401)
      }
      req.varietyAdmin = { id: Number(account.id), type: 'platform' }
      return next()
    }
    return fail(res, '无品种优选管理权限', 403)
  } catch (error) {
    console.error('[cotton-variety-admin-auth]', error)
    return fail(res, '管理员身份校验失败', 500)
  }
}

function safeUrl(value) {
  const url = String(value || '').trim().slice(0, 500)
  return !url || /^https:\/\//i.test(url) || url.startsWith('/uploads/') || url.startsWith('/assets/') ? url : ''
}

function stringList(value, limit = 20) {
  const source = Array.isArray(value) ? value : String(value || '').split(/\r?\n|，|,/)
  return source.map(item => String(item).trim()).filter(Boolean).slice(0, limit).map(item => item.slice(0, 120))
}

function nullableNumber(value, min, max) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) return null
  return number
}

function nullableRank(value) { return nullableNumber(value, 1, 9999) }

function bodyOf(body = {}) {
  return {
    trialYear: nullableNumber(body.trial_year ?? body.trialYear, 1900, 2200),
    trialArea: String(body.trial_area || body.trialArea || '喀什地区').trim().slice(0, 160),
    name: String(body.name || '').trim().slice(0, 160),
    lintPercent: nullableNumber(body.lint_percent ?? body.lintPercent, 0, 100),
    lintRank: nullableRank(body.lint_rank ?? body.lintRank),
    lintWeighted: nullableNumber(body.lint_weighted ?? body.lintWeighted, 0, 9999),
    fiberLengthMm: nullableNumber(body.fiber_length_mm ?? body.fiberLengthMm, 0, 100),
    fiberLengthRank: nullableRank(body.fiber_length_rank ?? body.fiberLengthRank),
    fiberLengthWeighted: nullableNumber(body.fiber_length_weighted ?? body.fiberLengthWeighted, 0, 9999),
    fiberStrength: nullableNumber(body.fiber_strength_cn_tex ?? body.fiberStrengthCnTex, 0, 100),
    fiberStrengthRank: nullableRank(body.fiber_strength_rank ?? body.fiberStrengthRank),
    fiberStrengthWeighted: nullableNumber(body.fiber_strength_weighted ?? body.fiberStrengthWeighted, 0, 9999),
    micronaire: nullableNumber(body.micronaire_value ?? body.micronaireValue, 0, 20),
    micronaireRank: nullableRank(body.micronaire_rank ?? body.micronaireRank),
    micronaireWeighted: nullableNumber(body.micronaire_weighted ?? body.micronaireWeighted, 0, 9999),
    uniformityPercent: nullableNumber(body.uniformity_percent ?? body.uniformityPercent, 0, 100),
    uniformityRank: nullableRank(body.uniformity_rank ?? body.uniformityRank),
    uniformityWeighted: nullableNumber(body.uniformity_weighted ?? body.uniformityWeighted, 0, 9999),
    yieldKgMu: nullableNumber(body.seed_cotton_yield_kg_mu ?? body.seedCottonYieldKgMu, 0, 5000),
    yieldRank: nullableRank(body.yield_rank ?? body.yieldRank),
    yieldWeighted: nullableNumber(body.yield_weighted ?? body.yieldWeighted, 0, 9999),
    weightedTotal: nullableNumber(body.weighted_total ?? body.weightedTotal, 0, 9999),
    overallRank: nullableRank(body.overall_rank ?? body.overallRank),
    coverUrl: safeUrl(body.cover_url || body.coverUrl),
    suitableConditions: String(body.suitable_conditions || body.suitableConditions || '').trim().slice(0, 1000),
    strengths: stringList(body.strengths || body.strengths_json),
    recommendedCounties: stringList(body.recommended_counties || body.recommendedCounties || body.recommended_counties_json),
    notes: String(body.notes || '').trim().slice(0, 10000),
    sourceName: String(body.source_name || body.sourceName || '').trim().slice(0, 300),
    status: STATUS.has(body.status) ? body.status : 'draft',
    featured: body.is_featured === true || body.is_featured === 1 || body.is_featured === '1' ? 1 : 0,
    sortOrder: Math.max(-9999, Math.min(9999, Number.parseInt(body.sort_order ?? body.sortOrder, 10) || 0))
  }
}

function parseList(value) {
  try { const result = JSON.parse(value || '[]'); return Array.isArray(result) ? result : [] } catch { return [] }
}

function normalize(row) {
  return {
    id: Number(row.id), trialYear: Number(row.trial_year), trialArea: row.trial_area || '', name: row.name || '',
    lintPercent: row.lint_percent == null ? null : Number(row.lint_percent), lintRank: row.lint_rank == null ? null : Number(row.lint_rank), lintWeighted: row.lint_weighted == null ? null : Number(row.lint_weighted),
    fiberLengthMm: row.fiber_length_mm == null ? null : Number(row.fiber_length_mm), fiberLengthRank: row.fiber_length_rank == null ? null : Number(row.fiber_length_rank), fiberLengthWeighted: row.fiber_length_weighted == null ? null : Number(row.fiber_length_weighted),
    fiberStrengthCnTex: row.fiber_strength_cn_tex == null ? null : Number(row.fiber_strength_cn_tex), fiberStrengthRank: row.fiber_strength_rank == null ? null : Number(row.fiber_strength_rank), fiberStrengthWeighted: row.fiber_strength_weighted == null ? null : Number(row.fiber_strength_weighted),
    micronaireValue: row.micronaire_value == null ? null : Number(row.micronaire_value), micronaireRank: row.micronaire_rank == null ? null : Number(row.micronaire_rank), micronaireWeighted: row.micronaire_weighted == null ? null : Number(row.micronaire_weighted),
    uniformityPercent: row.uniformity_percent == null ? null : Number(row.uniformity_percent), uniformityRank: row.uniformity_rank == null ? null : Number(row.uniformity_rank), uniformityWeighted: row.uniformity_weighted == null ? null : Number(row.uniformity_weighted),
    seedCottonYieldKgMu: row.seed_cotton_yield_kg_mu == null ? null : Number(row.seed_cotton_yield_kg_mu), yieldRank: row.yield_rank == null ? null : Number(row.yield_rank), yieldWeighted: row.yield_weighted == null ? null : Number(row.yield_weighted),
    weightedTotal: row.weighted_total == null ? null : Number(row.weighted_total), overallRank: row.overall_rank == null ? null : Number(row.overall_rank),
    coverUrl: row.cover_url || '', suitableConditions: row.suitable_conditions || '', strengths: parseList(row.strengths_json),
    recommendedCounties: parseList(row.recommended_counties_json), notes: row.notes || '', sourceName: row.source_name || '',
    trialCount: row.trial_count == null ? null : Number(row.trial_count),
    status: row.status || 'draft', isFeatured: !!row.is_featured, sortOrder: Number(row.sort_order || 0),
    publishedAt: row.published_at || null, createdAt: row.created_at || null, updatedAt: row.updated_at || null
  }
}

router.get('/', async (req, res) => {
  const sort = SORT_SQL[req.query.sort] ? req.query.sort : 'overall'
  const requestedYear = nullableNumber(req.query.year, 1900, 2200)
  try {
    let year = requestedYear
    if (!year) {
      const [[latest]] = await db.query("SELECT MAX(trial_year) AS year FROM community_cotton_varieties WHERE status='published'")
      year = latest && latest.year ? Number(latest.year) : null
    }
    if (!year) return ok(res, [])
    const orderSql = SORT_SQL[sort]
    const [rows] = await db.query(
      `SELECT * FROM community_cotton_varieties WHERE status='published' AND trial_year=? ORDER BY ${orderSql} LIMIT 300`,
      [year]
    )
    return ok(res, rows.map(normalize))
  } catch (error) {
    console.error('[cotton-variety-list]', error)
    return fail(res, '品种试验数据加载失败', 500)
  }
})

router.get('/admin/list', varietyAdminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM community_cotton_varieties ORDER BY trial_year DESC,overall_rank IS NULL,overall_rank ASC,id ASC LIMIT 1000')
    return ok(res, rows.map(normalize))
  } catch (error) {
    console.error('[cotton-variety-admin-list]', error)
    return fail(res, '品种管理列表加载失败', 500)
  }
})

router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT variety.*,
              (SELECT COUNT(*) FROM community_cotton_varieties peer
               WHERE peer.status='published' AND peer.trial_year=variety.trial_year) AS trial_count
       FROM community_cotton_varieties variety
       WHERE variety.id=? AND variety.status='published' LIMIT 1`,
      [req.params.id]
    )
    if (!row) return fail(res, '品种资料不存在或尚未发布', 404)
    return ok(res, normalize(row))
  } catch (error) {
    console.error('[cotton-variety-detail]', error)
    return fail(res, '品种资料加载失败', 500)
  }
})

router.post('/admin', varietyAdminAuth, async (req, res) => {
  const item = bodyOf(req.body)
  if (!item.trialYear || !item.trialArea || !item.name) return fail(res, '试验年份、试验区域和品种名称不能为空')
  try {
    const [result] = await db.query(
      `INSERT INTO community_cotton_varieties
       (trial_year,trial_area,name,lint_percent,lint_rank,lint_weighted,fiber_length_mm,fiber_length_rank,fiber_length_weighted,
        fiber_strength_cn_tex,fiber_strength_rank,fiber_strength_weighted,micronaire_value,micronaire_rank,micronaire_weighted,
        uniformity_percent,uniformity_rank,uniformity_weighted,seed_cotton_yield_kg_mu,yield_rank,yield_weighted,weighted_total,overall_rank,
        cover_url,suitable_conditions,strengths_json,recommended_counties_json,notes,source_name,status,is_featured,sort_order,published_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?='published',NOW(),NULL),?,?)`,
      valuesOf(item, req.varietyAdmin.id)
    )
    return ok(res, { id: Number(result.insertId) }, item.status === 'published' ? '品种资料已发布' : '品种资料已保存')
  } catch (error) {
    console.error('[cotton-variety-create]', error)
    return fail(res, error.code === 'ER_DUP_ENTRY' ? '同一年份已存在同名品种' : '品种资料保存失败', error.code === 'ER_DUP_ENTRY' ? 409 : 500)
  }
})

function valuesOf(item, adminId, includeId = false, id = null) {
  const values = [item.trialYear,item.trialArea,item.name,item.lintPercent,item.lintRank,item.lintWeighted,item.fiberLengthMm,item.fiberLengthRank,item.fiberLengthWeighted,
    item.fiberStrength,item.fiberStrengthRank,item.fiberStrengthWeighted,item.micronaire,item.micronaireRank,item.micronaireWeighted,
    item.uniformityPercent,item.uniformityRank,item.uniformityWeighted,item.yieldKgMu,item.yieldRank,item.yieldWeighted,item.weightedTotal,item.overallRank,
    item.coverUrl,item.suitableConditions,JSON.stringify(item.strengths),JSON.stringify(item.recommendedCounties),item.notes,item.sourceName,item.status,item.featured,item.sortOrder,item.status,adminId]
  if (!includeId) values.push(adminId)
  if (includeId) values.push(id)
  return values
}

router.put('/admin/:id', varietyAdminAuth, async (req, res) => {
  const item = bodyOf(req.body)
  if (!item.trialYear || !item.trialArea || !item.name) return fail(res, '试验年份、试验区域和品种名称不能为空')
  try {
    const [result] = await db.query(
      `UPDATE community_cotton_varieties SET trial_year=?,trial_area=?,name=?,lint_percent=?,lint_rank=?,lint_weighted=?,fiber_length_mm=?,fiber_length_rank=?,fiber_length_weighted=?,
       fiber_strength_cn_tex=?,fiber_strength_rank=?,fiber_strength_weighted=?,micronaire_value=?,micronaire_rank=?,micronaire_weighted=?,uniformity_percent=?,uniformity_rank=?,uniformity_weighted=?,
       seed_cotton_yield_kg_mu=?,yield_rank=?,yield_weighted=?,weighted_total=?,overall_rank=?,cover_url=?,suitable_conditions=?,strengths_json=?,recommended_counties_json=?,notes=?,source_name=?,
       status=?,is_featured=?,sort_order=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_by=? WHERE id=?`,
      valuesOf(item, req.varietyAdmin.id, true, req.params.id)
    )
    if (!result.affectedRows) return fail(res, '品种资料不存在', 404)
    return ok(res, null, '品种资料已更新')
  } catch (error) {
    console.error('[cotton-variety-update]', error)
    return fail(res, error.code === 'ER_DUP_ENTRY' ? '同一年份已存在同名品种' : '品种资料更新失败', error.code === 'ER_DUP_ENTRY' ? 409 : 500)
  }
})

router.patch('/admin/:id/status', varietyAdminAuth, async (req, res) => {
  const status = STATUS.has(req.body.status) ? req.body.status : ''
  if (!status) return fail(res, '品种资料状态不正确')
  try {
    const [result] = await db.query("UPDATE community_cotton_varieties SET status=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_by=? WHERE id=?", [status,status,req.varietyAdmin.id,req.params.id])
    if (!result.affectedRows) return fail(res, '品种资料不存在', 404)
    return ok(res, null, status === 'published' ? '品种资料已发布' : status === 'offline' ? '品种资料已下线' : '品种资料已转为草稿')
  } catch (error) {
    console.error('[cotton-variety-status]', error)
    return fail(res, '品种资料状态更新失败', 500)
  }
})

router.delete('/admin/:id', varietyAdminAuth, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM community_cotton_varieties WHERE id=?', [req.params.id])
    if (!result.affectedRows) return fail(res, '品种资料不存在', 404)
    return ok(res, null, '品种资料已删除')
  } catch (error) {
    console.error('[cotton-variety-delete]', error)
    return fail(res, '品种资料删除失败', 500)
  }
})

module.exports = router
