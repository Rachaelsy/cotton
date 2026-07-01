// server/routes/plots.js — 农户地块管理接口
const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const {
  normalizeCoordinates,
  calculateAreaMu,
  calculatePerimeterMeters
} = require('../../utils/plot-geometry')

const router = express.Router()
const IRRIGATION_OPTIONS = ['滴灌', '漫灌', '喷灌', '无']
const SOIL_OPTIONS = ['壤土', '沙壤土', '粘土', '沙土', '盐碱土']
const PLANTING_OPTIONS = ['已播种', '计划播种', '未播种']

const ok = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function farmerAuth(req, res, next) {
  const authorization = req.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) return fail(res, '请先登录', 401)
  try {
    req.user = jwt.verify(authorization.slice(7), process.env.JWT_SECRET)
    if (req.user.role !== 'farmer') return fail(res, '仅农户可管理地块', 403)
    next()
  } catch (error) {
    return fail(res, '登录已过期', 401)
  }
}

function parsePositiveId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function cleanText(value, maxLength = 64) {
  return String(value || '').trim().slice(0, maxLength)
}

function validDate(value) {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parsePlotInput(body, { requireBoundary = false } = {}) {
  const name = cleanText(body.name, 64)
  const variety = cleanText(body.variety, 64)
  const sowDate = body.sow_date || null
  const irrigation = cleanText(body.irrigation, 16) || '滴灌'
  const soilType = cleanText(body.soil_type, 32) || '壤土'
  const plantingStatus = cleanText(body.planting_status, 16) || '已播种'
  const note = cleanText(body.note, 1000)

  if (!name) return { error: '地块名称不能为空' }
  if (!variety) return { error: '棉花品种不能为空' }
  if (!validDate(sowDate)) return { error: '播种日期格式不正确' }
  if (!IRRIGATION_OPTIONS.includes(irrigation)) return { error: '灌溉方式不正确' }
  if (!SOIL_OPTIONS.includes(soilType)) return { error: '土壤类型不正确' }
  if (!PLANTING_OPTIONS.includes(plantingStatus)) return { error: '种植状态不正确' }

  const result = {
    name,
    variety,
    sowDate,
    irrigation,
    soilType,
    plantingStatus,
    note
  }

  if (requireBoundary) {
    const sourceCoordinates = Array.isArray(body.coordinates) ? body.coordinates : []
    const coordinates = normalizeCoordinates(sourceCoordinates)
    if (coordinates.length !== sourceCoordinates.length || coordinates.length < 3) {
      return { error: '地块边界至少需要 3 个有效顶点' }
    }
    if (coordinates.length > 500) return { error: '地块边界顶点不能超过 500 个' }
    const area = calculateAreaMu(coordinates)
    const perimeter = calculatePerimeterMeters(coordinates)
    if (!Number.isFinite(area) || area <= 0 || area > 1000000) return { error: '地块面积无效' }
    if (!Number.isFinite(perimeter) || perimeter <= 0) return { error: '地块周长无效' }
    result.coordinates = coordinates
    result.area = Number(area.toFixed(2))
    result.perimeter = Number(perimeter.toFixed(2))
  }

  return result
}

// GET /api/plots — 获取当前用户全部地块（支持可选搜索与筛选）
router.get('/', farmerAuth, async (req, res) => {
  try {
    const conditions = ['user_id=?']
    const params = [req.user.id]
    const keyword = cleanText(req.query.keyword, 64)
    const status = cleanText(req.query.status, 16)
    const minArea = Number(req.query.min_area)
    const maxArea = Number(req.query.max_area)

    if (keyword) {
      conditions.push('(name LIKE ? OR variety LIKE ? OR health_issue LIKE ?)')
      const like = `%${keyword}%`
      params.push(like, like, like)
    }
    if (status === 'attention') {
      conditions.push('status=?')
      params.push('attention')
    } else if (status === 'normal') {
      conditions.push('status<>?')
      params.push('attention')
    }
    if (Number.isFinite(minArea) && minArea >= 0) {
      conditions.push('area>=?')
      params.push(minArea)
    }
    if (Number.isFinite(maxArea) && maxArea > 0) {
      conditions.push('area<?')
      params.push(maxArea)
    }

    const [rows] = await db.query(
      `SELECT * FROM plots WHERE ${conditions.join(' AND ')}
       ORDER BY (status='attention') DESC, updated_at DESC, id DESC`,
      params
    )
    return ok(res, rows)
  } catch (error) {
    console.error('[plots-list]', error)
    return fail(res, '服务器错误', 500)
  }
})

// POST /api/plots — 新建地块（面积与周长由服务端按坐标计算）
router.post('/', farmerAuth, async (req, res) => {
  const input = parsePlotInput(req.body, { requireBoundary: true })
  if (input.error) return fail(res, input.error)
  try {
    const [result] = await db.query(
      `INSERT INTO plots
       (user_id,name,variety,area,perimeter,coordinates,sow_date,irrigation,soil_type,planting_status,note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id,
        input.name,
        input.variety,
        input.area,
        input.perimeter,
        JSON.stringify(input.coordinates),
        input.sowDate,
        input.irrigation,
        input.soilType,
        input.plantingStatus,
        input.note
      ]
    )
    return ok(res, {
      id: result.insertId,
      area: input.area,
      perimeter: input.perimeter
    }, '地块已保存')
  } catch (error) {
    console.error('[plots-create]', error)
    return fail(res, '保存失败', 500)
  }
})

// POST /api/plots/batch-delete — 批量删除本人地块
router.post('/batch-delete', farmerAuth, async (req, res) => {
  const ids = Array.isArray(req.body.ids)
    ? [...new Set(req.body.ids.map(parsePositiveId).filter(Boolean))].slice(0, 100)
    : []
  if (!ids.length) return fail(res, '请选择要删除的地块')
  try {
    const placeholders = ids.map(() => '?').join(',')
    const [result] = await db.query(
      `DELETE FROM plots WHERE user_id=? AND id IN (${placeholders})`,
      [req.user.id, ...ids]
    )
    return ok(res, { deleted: result.affectedRows }, `已删除 ${result.affectedRows} 块地`)
  } catch (error) {
    console.error('[plots-batch-delete]', error)
    return fail(res, '删除失败', 500)
  }
})

// GET /api/plots/:id — 获取单个地块与最近农事概览
router.get('/:id', farmerAuth, async (req, res) => {
  const id = parsePositiveId(req.params.id)
  if (!id) return fail(res, '地块编号无效')
  try {
    const [rows] = await db.query(
      'SELECT * FROM plots WHERE id=? AND user_id=?',
      [id, req.user.id]
    )
    if (!rows.length) return fail(res, '地块不存在', 404)

    let overview = { record_count: 0, recent_records: [] }
    try {
      const [countResult, recentResult] = await Promise.all([
        db.query('SELECT COUNT(*) AS total FROM farm_records WHERE user_id=? AND plot_id=?', [req.user.id, id]),
        db.query(
          `SELECT id,type,title,DATE_FORMAT(work_date,'%Y-%m-%d') AS work_date,work_time,amount,note
           FROM farm_records WHERE user_id=? AND plot_id=?
           ORDER BY work_date DESC, work_time DESC, id DESC LIMIT 3`,
          [req.user.id, id]
        )
      ])
      const countRow = countResult[0][0] || {}
      const recentRows = recentResult[0] || []
      overview = { record_count: Number(countRow.total || 0), recent_records: recentRows }
    } catch (overviewError) {
      console.warn('[plots-overview]', overviewError.message)
    }

    return ok(res, { ...rows[0], overview })
  } catch (error) {
    console.error('[plots-get]', error)
    return fail(res, '服务器错误', 500)
  }
})

// PUT /api/plots/:id — 更新地块基础信息
router.put('/:id', farmerAuth, async (req, res) => {
  const id = parsePositiveId(req.params.id)
  if (!id) return fail(res, '地块编号无效')
  const input = parsePlotInput(req.body)
  if (input.error) return fail(res, input.error)
  try {
    const [result] = await db.query(
      `UPDATE plots SET name=?,variety=?,sow_date=?,irrigation=?,soil_type=?,planting_status=?,note=?
       WHERE id=? AND user_id=?`,
      [
        input.name,
        input.variety,
        input.sowDate,
        input.irrigation,
        input.soilType,
        input.plantingStatus,
        input.note,
        id,
        req.user.id
      ]
    )
    if (!result.affectedRows) return fail(res, '地块不存在', 404)
    return ok(res, { id }, '更新成功')
  } catch (error) {
    console.error('[plots-update]', error)
    return fail(res, '更新失败', 500)
  }
})

// DELETE /api/plots/:id — 删除本人地块
router.delete('/:id', farmerAuth, async (req, res) => {
  const id = parsePositiveId(req.params.id)
  if (!id) return fail(res, '地块编号无效')
  try {
    const [result] = await db.query('DELETE FROM plots WHERE id=? AND user_id=?', [id, req.user.id])
    if (!result.affectedRows) return fail(res, '地块不存在', 404)
    return ok(res, { deleted: 1 }, '已删除')
  } catch (error) {
    console.error('[plots-delete]', error)
    return fail(res, '删除失败', 500)
  }
})

module.exports = router
