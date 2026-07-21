// server/routes/products.js — 商品接口
const express = require('express')
const db = require('../db/database')
const { authMiddleware, roleGuard } = require('../middleware/auth')
const marketing = require('../utils/marketing')

const router = express.Router()

function ok(res, data, msg = 'ok') { return res.json({ code: 200, msg, data }) }
function fail(res, msg, code = 400) { return res.status(code).json({ code, msg, data: null }) }

// ─────────────────────────────────────────────
// GET /api/products  — 公开：农户浏览所有在售商品（含商家名称）
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, lat, lng } = req.query
    const hasGeo = lat && lng && !isNaN(lat) && !isNaN(lng)
    const distExpr = hasGeo
      ? `ROUND(ST_Distance_Sphere(POINT(m.longitude, m.latitude), POINT(?, ?)) / 1000, 1)`
      : `NULL`
    let sql = `
      SELECT p.*, m.company_name, m.wechat_id AS merchant_wechat,
             m.latitude AS merchant_lat, m.longitude AS merchant_lng,
             m.location_name AS merchant_location, m.delivery_radius,
             ${distExpr} AS delivery_distance_km,
             IFNULL((SELECT SUM(oi.qty) FROM order_items oi WHERE oi.product_id = p.id), 0) AS sold
      FROM products p
      LEFT JOIN merchants m ON m.id = p.merchant_id
      WHERE p.status = 'on'
    `
    const params = []
    if (hasGeo) params.push(parseFloat(lng), parseFloat(lat))
    if (category && category !== '全部') {
      sql += ' AND p.category = ?'
      params.push(category)
    }
    if (req.query.merchant_id) {
      sql += ' AND p.merchant_id = ?'
      params.push(parseInt(req.query.merchant_id))
    }
    sql += ' ORDER BY p.created_at DESC'
    const [rows] = await db.query(sql, params)
    rows.forEach(p => {
      p.delivery_radius = p.delivery_radius != null ? Number(p.delivery_radius) : null
      p.delivery_distance_km = p.delivery_distance_km != null ? Number(p.delivery_distance_km) : null
      // 商户有定位 + 农户有定位时才判定超范围
      p.out_of_range = p.delivery_distance_km != null && p.delivery_radius != null
        && p.delivery_distance_km > p.delivery_radius
    })
    return ok(res, await marketing.decorateProducts(rows))
  } catch (err) {
    console.error('[products list]', err)
    return fail(res, '获取商品列表失败', 500)
  }
})

// ─────────────────────────────────────────────
// GET /api/products/reviews?merchant_id=X — 公开：获取该商户的评价列表
// ─────────────────────────────────────────────
router.get('/reviews', async (req, res) => {
  const merchantId = parseInt(req.query.merchant_id)
  if (!merchantId) return fail(res, '缺少商户ID')
  const limit = Math.min(parseInt(req.query.limit) || 20, 50)
  try {
    const [rows] = await db.query(`
      SELECT r.id, r.rating, r.content, r.reply,
             IF(r.is_anonymous, '匿名用户', r.farmer_name) AS farmer_name,
             DATE_FORMAT(r.created_at,'%Y-%m') AS month
      FROM reviews r
      WHERE r.merchant_id = ?
      ORDER BY r.created_at DESC LIMIT ?
    `, [merchantId, limit])
    const [[stats]] = await db.query(
      'SELECT COUNT(*) AS total, IFNULL(AVG(rating),0) AS avg FROM reviews WHERE merchant_id=?',
      [merchantId]
    )
    return ok(res, {
      reviews:    rows,
      total:      stats.total,
      avg_rating: parseFloat(stats.avg).toFixed(1)
    })
  } catch (e) {
    console.error('[reviews-public]', e)
    return fail(res, '获取评价失败', 500)
  }
})

// ─────────────────────────────────────────────
// 以下接口需要登录且身份为 merchant
// ─────────────────────────────────────────────

// GET /api/products/:id — 公开：商品详情
router.get('/:id(\\d+)', async (req, res) => {
  const id = parseInt(req.params.id)
  try {
    const [[product]] = await db.query(`
      SELECT p.*, m.company_name, m.wechat_id AS merchant_wechat,
             m.latitude AS merchant_lat, m.longitude AS merchant_lng,
             m.location_name AS merchant_location, m.delivery_radius,
             IFNULL((SELECT SUM(oi.qty) FROM order_items oi WHERE oi.product_id = p.id), 0) AS sold
      FROM products p
      LEFT JOIN merchants m ON m.id = p.merchant_id
      WHERE p.id = ? AND p.status = 'on'
      LIMIT 1
    `, [id])
    if (!product) return fail(res, '商品不存在或已下架', 404)
    product.delivery_radius = product.delivery_radius != null ? Number(product.delivery_radius) : null
    const [decorated] = await marketing.decorateProducts([product])
    return ok(res, decorated)
  } catch (err) {
    console.error('[product detail]', err)
    return fail(res, '获取商品详情失败', 500)
  }
})

// GET /api/products/mine  — 商户：获取自己的商品
router.get('/mine', authMiddleware, roleGuard('merchant'), async (req, res) => {
  try {
    const { status } = req.query
    let sql = 'SELECT p.* FROM products p JOIN merchants m ON m.id = p.merchant_id WHERE m.user_id = ?'
    const params = [req.user.id]
    if (status === 'on' || status === 'off') { sql += ' AND p.status = ?'; params.push(status) }
    sql += ' ORDER BY p.created_at DESC'
    const [rows] = await db.query(sql, params)
    return ok(res, rows)
  } catch (err) {
    console.error('[products mine]', err)
    return fail(res, '获取失败', 500)
  }
})

// POST /api/products  — 商户：上架商品
router.post('/', authMiddleware, roleGuard('merchant'), async (req, res) => {
  const { name, category, price, unit, stock, description, icon } = req.body
  if (!name || !name.trim()) return fail(res, '商品名称不能为空')
  if (!price || isNaN(price) || price <= 0) return fail(res, '请填写正确的价格')
  try {
    const [[m]] = await db.query('SELECT id FROM merchants WHERE user_id=?', [req.user.id])
    if (!m) return fail(res, '商户信息不存在', 404)
    const [result] = await db.query(
      'INSERT INTO products (merchant_id,name,category,price,unit,stock,description,icon) VALUES (?,?,?,?,?,?,?,?)',
      [m.id, name.trim(), category || '', parseFloat(price), unit || '', parseInt(stock) || 0, description || '', icon || '📦']
    )
    return ok(res, { id: result.insertId }, '商品已上架')
  } catch (err) {
    console.error('[products add]', err)
    return fail(res, '上架失败', 500)
  }
})

// PUT /api/products/:id  — 商户：编辑商品
router.put('/:id', authMiddleware, roleGuard('merchant'), async (req, res) => {
  const { name, category, price, unit, stock, description, icon } = req.body
  const { id } = req.params
  try {
    const [[m]] = await db.query('SELECT id FROM merchants WHERE user_id=?', [req.user.id])
    const [rows] = await db.query('SELECT id FROM products WHERE id=? AND merchant_id=?', [id, m?.id])
    if (!rows.length) return fail(res, '商品不存在或无权限', 404)
    await db.query(
      'UPDATE products SET name=?,category=?,price=?,unit=?,stock=?,description=?,icon=? WHERE id=?',
      [name, category || '', parseFloat(price), unit || '', parseInt(stock) || 0, description || '', icon || '📦', id]
    )
    return ok(res, null, '修改成功')
  } catch (err) {
    console.error('[products edit]', err)
    return fail(res, '修改失败', 500)
  }
})

// PATCH /api/products/:id/status  — 商户：切换上架/下架
router.patch('/:id/status', authMiddleware, roleGuard('merchant'), async (req, res) => {
  const { id } = req.params
  const { status } = req.body
  if (!['on', 'off'].includes(status)) return fail(res, '状态值无效')
  try {
    const [[m]] = await db.query('SELECT id FROM merchants WHERE user_id=?', [req.user.id])
    const [rows] = await db.query('SELECT id FROM products WHERE id=? AND merchant_id=?', [id, m?.id])
    if (!rows.length) return fail(res, '商品不存在或无权限', 404)
    await db.query('UPDATE products SET status=? WHERE id=?', [status, id])
    return ok(res, null, status === 'on' ? '已上架' : '已下架')
  } catch (err) {
    console.error('[products status]', err)
    return fail(res, '操作失败', 500)
  }
})

// DELETE /api/products/:id  — 商户：删除商品
router.delete('/:id', authMiddleware, roleGuard('merchant'), async (req, res) => {
  const { id } = req.params
  try {
    const [[m]] = await db.query('SELECT id FROM merchants WHERE user_id=?', [req.user.id])
    const [rows] = await db.query('SELECT id FROM products WHERE id=? AND merchant_id=?', [id, m?.id])
    if (!rows.length) return fail(res, '商品不存在或无权限', 404)
    await db.query('DELETE FROM products WHERE id=?', [id])
    return ok(res, null, '已删除')
  } catch (err) {
    console.error('[products delete]', err)
    return fail(res, '删除失败', 500)
  }
})

module.exports = router
