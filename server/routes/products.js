// server/routes/products.js — 商品接口
const express = require('express')
const db = require('../db/database')
const { authMiddleware, roleGuard } = require('../middleware/auth')

const router = express.Router()

function ok(res, data, msg = 'ok') { return res.json({ code: 200, msg, data }) }
function fail(res, msg, code = 400) { return res.status(code).json({ code, msg, data: null }) }

// ─────────────────────────────────────────────
// GET /api/products  — 公开：农户浏览所有在售商品（含商家名称）
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category } = req.query
    let sql = `
      SELECT p.*, m.company_name
      FROM products p
      LEFT JOIN merchants m ON m.id = p.merchant_id
      WHERE p.status = 'on'
    `
    const params = []
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
    return ok(res, rows)
  } catch (err) {
    console.error('[products list]', err)
    return fail(res, '获取商品列表失败', 500)
  }
})

// ─────────────────────────────────────────────
// 以下接口需要登录且身份为 merchant
// ─────────────────────────────────────────────

// GET /api/products/mine  — 商户：获取自己的商品
router.get('/mine', authMiddleware, roleGuard('merchant'), async (req, res) => {
  try {
    const { status } = req.query
    let sql = 'SELECT * FROM products WHERE merchant_id = ?'
    const params = [req.user.id]
    if (status === 'on' || status === 'off') { sql += ' AND status = ?'; params.push(status) }
    sql += ' ORDER BY created_at DESC'
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
    const [result] = await db.query(
      'INSERT INTO products (merchant_id,name,category,price,unit,stock,description,icon) VALUES (?,?,?,?,?,?,?,?)',
      [req.user.id, name.trim(), category || '', parseFloat(price), unit || '', parseInt(stock) || 0, description || '', icon || '📦']
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
    const [rows] = await db.query('SELECT id FROM products WHERE id=? AND merchant_id=?', [id, req.user.id])
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
    const [rows] = await db.query('SELECT id FROM products WHERE id=? AND merchant_id=?', [id, req.user.id])
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
    const [rows] = await db.query('SELECT id FROM products WHERE id=? AND merchant_id=?', [id, req.user.id])
    if (!rows.length) return fail(res, '商品不存在或无权限', 404)
    await db.query('DELETE FROM products WHERE id=?', [id])
    return ok(res, null, '已删除')
  } catch (err) {
    console.error('[products delete]', err)
    return fail(res, '删除失败', 500)
  }
})

module.exports = router
