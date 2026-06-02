// server/routes/admin.js — 后台管理 API
const express  = require('express')
const router   = express.Router()
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const multer   = require('multer')
const path     = require('path')
const fs       = require('fs')
const db       = require('../db/database')
const { broadcastAnnouncement } = require('../utils/notify')

// ── 图片上传配置 ─────────────────────────────────────────
const uploadDir = path.join(__dirname, '../public/uploads/products')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => cb(null, `prod_${Date.now()}${path.extname(file.originalname)}`)
})
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('只允许上传图片'))
    cb(null, true)
  }
})

const JWT_SECRET  = process.env.JWT_SECRET
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'

// ── 管理员身份验证中间件 ──────────────────────────────────
const R_OK   = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const R_FAIL = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function adminAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ code: 401, msg: '未授权' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (!payload.is_admin) return res.status(403).json({ code: 403, msg: '无管理员权限' })
    req.admin = payload
    next()
  } catch {
    res.status(401).json({ code: 401, msg: 'Token 无效或已过期' })
  }
}

// ── POST /api/admin/login ────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body
    if (!phone || !password) return res.status(400).json({ code: 400, msg: '请填写账号和密码' })
    const [rows] = await db.query('SELECT * FROM users WHERE phone=?', [phone])
    const user = rows[0]
    if (!user) return res.status(404).json({ code: 404, msg: '账号不存在' })
    if (!user.is_admin) return res.status(403).json({ code: 403, msg: '非管理员账号' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ code: 401, msg: '密码错误' })
    const token = jwt.sign(
      { id: user.id, phone: user.phone, real_name: user.real_name, is_admin: true },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    )
    res.json({ code: 200, msg: '登录成功', data: { token, real_name: user.real_name } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/upload（图片上传）────────────────────
router.post('/upload', adminAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ code: 400, msg: '未选择图片' })
  res.json({ code: 200, data: { url: `/uploads/products/${req.file.filename}` } })
})

// ── GET /api/admin/stats ─────────────────────────────────
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [[{ totalUsers }]]       = await db.query('SELECT COUNT(*) AS totalUsers FROM users WHERE is_admin=0')
    const [[{ totalFarmers }]]     = await db.query('SELECT COUNT(*) AS totalFarmers FROM users WHERE role="farmer"')
    const [[{ totalMerchants }]]   = await db.query('SELECT COUNT(*) AS totalMerchants FROM users WHERE role="merchant"')
    const [[{ pendingApps }]]      = await db.query('SELECT COUNT(*) AS pendingApps FROM merchants WHERE apply_status="pending"')
    const [[{ totalProducts }]]    = await db.query('SELECT COUNT(*) AS totalProducts FROM products')
    const [[{ onSaleProducts }]]   = await db.query('SELECT COUNT(*) AS onSaleProducts FROM products WHERE status="on"')
    res.json({ code: 200, data: { totalUsers, totalFarmers, totalMerchants, pendingApps, totalProducts, onSaleProducts } })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/farmers（手动新增农户）──────────────
router.post('/farmers', adminAuth, async (req, res) => {
  try {
    const { phone, password, real_name, location, land_size, is_verified } = req.body
    if (!/^1\d{10}$/.test(phone))        return res.status(400).json({ code: 400, msg: '手机号格式不正确' })
    if (!password || password.length < 6) return res.status(400).json({ code: 400, msg: '密码不能少于6位' })
    if (!real_name || !real_name.trim())  return res.status(400).json({ code: 400, msg: '请填写姓名' })
    const [exist] = await db.query('SELECT id FROM users WHERE phone=?', [phone])
    if (exist.length > 0) return res.status(400).json({ code: 400, msg: '该手机号已注册' })
    const hash = await bcrypt.hash(password, 10)
    const [r] = await db.query(
      'INSERT INTO users (phone,password,role,real_name,is_verified) VALUES (?,?,?,?,?)',
      [phone, hash, 'farmer', real_name.trim(), is_verified ? 1 : 0]
    )
    await db.query(
      'INSERT INTO farmers (user_id,location,land_size) VALUES (?,?,?)',
      [r.insertId, location || '', parseFloat(land_size) || 0]
    )
    res.json({ code: 200, msg: '农户已创建' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── GET /api/admin/farmers ───────────────────────────────
router.get('/farmers', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.phone, u.real_name, u.is_verified, u.is_active, u.created_at,
             f.id AS farmer_id, f.location, f.land_size
      FROM users u LEFT JOIN farmers f ON f.user_id = u.id
      WHERE u.role = 'farmer'
      ORDER BY u.created_at DESC
    `)
    res.json({ code: 200, data: rows })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PUT /api/admin/farmers/:id ───────────────────────────
router.put('/farmers/:id', adminAuth, async (req, res) => {
  try {
    const { real_name, location, land_size, is_verified } = req.body
    const userId = req.params.id
    if (real_name !== undefined)
      await db.query('UPDATE users SET real_name=? WHERE id=?', [real_name, userId])
    if (is_verified !== undefined)
      await db.query('UPDATE users SET is_verified=? WHERE id=?', [is_verified ? 1 : 0, userId])
    await db.query(
      'UPDATE farmers SET location=?, land_size=? WHERE user_id=?',
      [location, parseFloat(land_size) || 0, userId]
    )
    res.json({ code: 200, msg: '农户信息已更新' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/merchants（手动新增商户，自动批准）──
router.post('/merchants', adminAuth, async (req, res) => {
  try {
    const { phone, password, real_name, company_name, business_license, product_category, is_verified } = req.body
    if (!/^1\d{10}$/.test(phone))         return res.status(400).json({ code: 400, msg: '手机号格式不正确' })
    if (!password || password.length < 6)  return res.status(400).json({ code: 400, msg: '密码不能少于6位' })
    if (!real_name || !real_name.trim())   return res.status(400).json({ code: 400, msg: '请填写联系人姓名' })
    if (!company_name || !company_name.trim()) return res.status(400).json({ code: 400, msg: '请填写店铺名称' })
    const [exist] = await db.query('SELECT id FROM users WHERE phone=?', [phone])
    if (exist.length > 0) return res.status(400).json({ code: 400, msg: '该手机号已注册' })
    const hash = await bcrypt.hash(password, 10)
    const [r] = await db.query(
      'INSERT INTO users (phone,password,role,real_name,is_verified,is_active) VALUES (?,?,?,?,?,1)',
      [phone, hash, 'merchant', real_name.trim(), is_verified ? 1 : 0]
    )
    await db.query(
      'INSERT INTO merchants (user_id,company_name,business_license,product_category,apply_status) VALUES (?,?,?,?,?)',
      [r.insertId, company_name.trim(), business_license || '', product_category || '', 'approved']
    )
    res.json({ code: 200, msg: '商户已创建并自动批准' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── GET /api/admin/merchants ─────────────────────────────
router.get('/merchants', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.phone, u.real_name, u.is_verified, u.is_active, u.created_at,
             m.id AS merchant_id, m.company_name, m.business_license, m.product_category,
             m.apply_status, m.reject_reason, m.commission_rate,
             (SELECT COUNT(*) FROM products p WHERE p.merchant_id = m.id) AS product_count
      FROM users u LEFT JOIN merchants m ON m.user_id = u.id
      WHERE u.role = 'merchant'
      ORDER BY u.created_at DESC
    `)
    res.json({ code: 200, data: rows })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PUT /api/admin/merchants/:id ─────────────────────────
router.put('/merchants/:id', adminAuth, async (req, res) => {
  try {
    const { real_name, company_name, business_license, product_category, is_verified } = req.body
    const userId = req.params.id
    if (real_name !== undefined)
      await db.query('UPDATE users SET real_name=? WHERE id=?', [real_name, userId])
    if (is_verified !== undefined)
      await db.query('UPDATE users SET is_verified=? WHERE id=?', [is_verified ? 1 : 0, userId])
    await db.query(
      'UPDATE merchants SET company_name=?, business_license=?, product_category=? WHERE user_id=?',
      [company_name, business_license || '', product_category || '', userId]
    )
    res.json({ code: 200, msg: '商户信息已更新' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PATCH /api/admin/merchants/:id/commission ────────────
router.patch('/merchants/:id/commission', adminAuth, async (req, res) => {
  const rate = parseFloat(req.body.commission_rate)
  if (isNaN(rate) || rate < 0 || rate > 100)
    return R_FAIL(res, '佣金费率需在 0 ~ 100 之间')
  try {
    await db.query('UPDATE merchants SET commission_rate=? WHERE user_id=?', [rate, req.params.id])
    R_OK(res, { commission_rate: rate }, '佣金费率已更新')
  } catch (e) {
    console.error(e); R_FAIL(res, '更新失败')
  }
})

// ── GET /api/admin/applications ──────────────────────────
router.get('/applications', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.phone, u.real_name, u.created_at,
             m.id AS merchant_id, m.company_name, m.business_license,
             m.product_category, m.apply_status, m.reject_reason
      FROM users u LEFT JOIN merchants m ON m.user_id = u.id
      WHERE u.role = 'merchant' AND m.apply_status = 'pending'
      ORDER BY u.created_at ASC
    `)
    res.json({ code: 200, data: rows })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/applications/:id/approve ─────────────
router.post('/applications/:id/approve', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id
    await db.query('UPDATE merchants SET apply_status="approved" WHERE user_id=?', [userId])
    await db.query('UPDATE users SET is_active=1 WHERE id=?', [userId])
    res.json({ code: 200, msg: '已批准入驻申请' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/applications/:id/reject ──────────────
router.post('/applications/:id/reject', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id
    const { reason } = req.body
    await db.query(
      'UPDATE merchants SET apply_status="rejected", reject_reason=? WHERE user_id=?',
      [reason || '不符合入驻条件', userId]
    )
    res.json({ code: 200, msg: '已拒绝入驻申请' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/products（手动新增商品）─────────────
router.post('/products', adminAuth, async (req, res) => {
  try {
    const { merchant_id, name, category, icon, price, unit, stock, status, image_url, description, detail } = req.body
    if (!merchant_id) return res.status(400).json({ code: 400, msg: '请选择所属商户' })
    if (!name || !name.trim()) return res.status(400).json({ code: 400, msg: '请填写商品名称' })
    await db.query(
      'INSERT INTO products (merchant_id,name,category,icon,price,unit,stock,status,image_url,description,detail) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [merchant_id, name.trim(), category || '', icon || '', parseFloat(price) || 0, unit || '', parseInt(stock) || 0, status || 'on', image_url || null, description || '', detail || '']
    )
    res.json({ code: 200, msg: '商品已创建' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── GET /api/admin/products ──────────────────────────────
router.get('/products', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, m.company_name
      FROM products p LEFT JOIN merchants m ON m.id = p.merchant_id
      ORDER BY p.created_at DESC
    `)
    res.json({ code: 200, data: rows })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── DELETE /api/admin/products/:id ───────────────────────
router.delete('/products/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id=?', [req.params.id])
    res.json({ code: 200, msg: '商品已删除' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PUT /api/admin/products/:id ──────────────────────────
router.put('/products/:id', adminAuth, async (req, res) => {
  try {
    const { name, category, icon, price, unit, stock, status, image_url, description, detail } = req.body
    await db.query(
      'UPDATE products SET name=?, category=?, icon=?, price=?, unit=?, stock=?, status=?, image_url=?, description=?, detail=? WHERE id=?',
      [name, category, icon || '', parseFloat(price) || 0, unit || '', parseInt(stock) || 0, status || 'on', image_url || null, description || '', detail || '', req.params.id]
    )
    res.json({ code: 200, msg: '商品信息已更新' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── GET /api/admin/orders ────────────────────────────────
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const { status } = req.query
    let sql = `
      SELECT o.id, o.order_no, o.farmer_name, o.farmer_phone,
             o.receiver_name, o.receiver_phone, o.address,
             o.subtotal, o.delivery_fee, o.total,
             o.pay_method, o.status, o.logistics_no, o.note,
             o.created_at,
             GROUP_CONCAT(
               CONCAT(i.icon,'|',i.name,'|',i.spec,'|',i.price,'|',i.qty)
               SEPARATOR ';;'
             ) AS items_raw
      FROM orders o
      LEFT JOIN order_items i ON i.order_id = o.id
    `
    const params = []
    if (status && status !== 'all') { sql += ' WHERE o.status = ?'; params.push(status) }
    sql += ' GROUP BY o.id ORDER BY o.created_at DESC'

    const [rows] = await db.query(sql, params)
    const orders = rows.map(o => ({
      ...o,
      items: (o.items_raw || '').split(';;').filter(Boolean).map(s => {
        const [icon, name, spec, price, qty] = s.split('|')
        return { icon, name, spec, price: parseFloat(price), qty: parseInt(qty) }
      })
    }))
    res.json({ code: 200, data: orders })
  } catch (e) {
    console.error('[admin-orders]', e)
    res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PATCH /api/admin/orders/:id/status ──────────────────
router.patch('/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { status, logistics_no } = req.body
    const valid = ['pending_ship', 'shipped', 'completed', 'refund']
    if (!valid.includes(status)) return res.status(400).json({ code: 400, msg: '状态无效' })
    const fields = ['status=?']
    const params = [status]
    if (logistics_no) { fields.push('logistics_no=?'); params.push(logistics_no) }
    params.push(req.params.id)
    await db.query(`UPDATE orders SET ${fields.join(',')} WHERE id=?`, params)
    res.json({ code: 200, msg: '已更新' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── PATCH /api/admin/users/:id/status ───────────────────
router.patch('/users/:id/status', adminAuth, async (req, res) => {
  try {
    const { is_active } = req.body
    await db.query('UPDATE users SET is_active=? WHERE id=?', [is_active ? 1 : 0, req.params.id])
    res.json({ code: 200, msg: is_active ? '已启用账号' : '已禁用账号' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ── POST /api/admin/apply（公开）商户入驻申请 ─────────────
router.post('/apply', async (req, res) => {
  try {
    const { phone, password, real_name, company_name, business_license, product_category } = req.body
    if (!/^1\d{10}$/.test(phone))        return res.status(400).json({ code: 400, msg: '手机号格式不正确' })
    if (!password || password.length < 6) return res.status(400).json({ code: 400, msg: '密码不能少于6位' })
    if (!real_name || !real_name.trim())  return res.status(400).json({ code: 400, msg: '请填写联系人姓名' })
    if (!company_name || !company_name.trim()) return res.status(400).json({ code: 400, msg: '请填写店铺/企业名称' })

    const [exist] = await db.query('SELECT id FROM users WHERE phone=?', [phone])
    if (exist.length > 0) return res.status(400).json({ code: 400, msg: '该手机号已注册' })

    const hash = await bcrypt.hash(password, 10)
    const [result] = await db.query(
      'INSERT INTO users (phone,password,role,real_name,is_active) VALUES (?,?,?,?,0)',
      [phone, hash, 'merchant', real_name.trim()]
    )
    const userId = result.insertId
    await db.query(
      'INSERT INTO merchants (user_id,company_name,business_license,product_category,apply_status) VALUES (?,?,?,?,?)',
      [userId, company_name.trim(), business_license || '', product_category || '', 'pending']
    )
    res.json({ code: 200, msg: '申请已提交，请等待管理员审核（1-3个工作日）' })
  } catch (e) {
    console.error(e); res.status(500).json({ code: 500, msg: '服务器错误' })
  }
})

// ─────────────────────────────────────────────────────────────
// GET  /api/admin/announcements — 公告列表
// POST /api/admin/announcements — 发布公告（广播给所有商户）
// DELETE /api/admin/announcements/:id — 删除公告
// ─────────────────────────────────────────────────────────────
router.get('/announcements', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100')
    return R_OK(res, rows)
  } catch(e) { console.error('[admin-announcements]', e); return R_FAIL(res, '服务器错误', 500) }
})

router.post('/announcements', adminAuth, async (req, res) => {
  const { title, content } = req.body
  if (!title?.trim()) return R_FAIL(res, '请填写公告标题')
  if (!content?.trim()) return R_FAIL(res, '请填写公告内容')
  try {
    const [r] = await db.query(
      'INSERT INTO announcements (title, content) VALUES (?,?)',
      [title.trim(), content.trim()]
    )
    const count = await broadcastAnnouncement(r.insertId, title.trim(), content.trim())
    return R_OK(res, { id: r.insertId, merchant_count: count },
      `公告已发布，已通知 ${count} 家商户`)
  } catch(e) { console.error('[admin-announcement-post]', e); return R_FAIL(res, '服务器错误', 500) }
})

router.delete('/announcements/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM announcements WHERE id=?', [req.params.id])
    return R_OK(res, null, '已删除')
  } catch(e) { return R_FAIL(res, '服务器错误', 500) }
})

// ── GET /api/admin/aftersales — 全平台售后申请列表 ──────────
router.get('/aftersales', adminAuth, async (req, res) => {
  try {
    const { status } = req.query
    let sql = `
      SELECT ar.id, ar.order_no, ar.farmer_name, ar.aftersale_type,
             ar.reason, ar.other_reason, ar.description, ar.images,
             ar.status, ar.handle_note, ar.created_at, ar.updated_at,
             m.company_name
      FROM aftersale_requests ar
      LEFT JOIN merchants m ON m.id = ar.merchant_id
    `
    const params = []
    if (status && status !== 'all') { sql += ' WHERE ar.status = ?'; params.push(status) }
    sql += ' ORDER BY ar.created_at DESC'
    const [rows] = await db.query(sql, params)
    return R_OK(res, rows)
  } catch (e) {
    console.error('[admin-aftersales]', e); return R_FAIL(res, '服务器错误', 500)
  }
})

// ── GET /api/admin/finance — 各商户财务汇总 ─────────────────
router.get('/finance', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        m.id AS merchant_id, m.company_name, m.commission_rate, u.phone,
        COALESCE(cs.total_sales,  0) AS total_sales,
        COALESCE(av.available,    0) AS available_amount,
        COALESCE(fr.frozen,       0) AS frozen_amount,
        COALESCE(wp.withdrawn,    0) AS withdrawn_amount,
        COALESCE(pw.pending_cnt,  0) AS pending_withdrawals
      FROM merchants m
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN (
        SELECT oi.merchant_id, SUM(oi.subtotal) AS total_sales
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'completed' GROUP BY oi.merchant_id
      ) cs ON cs.merchant_id = m.id
      LEFT JOIN (
        SELECT oi.merchant_id, SUM(oi.subtotal) AS available
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.fund_status = 'available' GROUP BY oi.merchant_id
      ) av ON av.merchant_id = m.id
      LEFT JOIN (
        SELECT oi.merchant_id, SUM(oi.subtotal) AS frozen
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.fund_status = 'frozen' GROUP BY oi.merchant_id
      ) fr ON fr.merchant_id = m.id
      LEFT JOIN (
        SELECT merchant_id, SUM(amount) AS withdrawn
        FROM withdrawals WHERE status = 'paid' GROUP BY merchant_id
      ) wp ON wp.merchant_id = m.id
      LEFT JOIN (
        SELECT merchant_id, COUNT(*) AS pending_cnt
        FROM withdrawals WHERE status = 'pending' GROUP BY merchant_id
      ) pw ON pw.merchant_id = m.id
      WHERE m.apply_status = 'approved'
      ORDER BY total_sales DESC
    `)
    return R_OK(res, rows)
  } catch (e) {
    console.error('[admin-finance]', e); return R_FAIL(res, '服务器错误', 500)
  }
})

// ── GET /api/admin/withdrawals — 全平台提现申请列表 ─────────
router.get('/withdrawals', adminAuth, async (req, res) => {
  try {
    const { status } = req.query
    let sql = `
      SELECT w.id, w.amount, w.status, w.note, w.created_at, w.paid_at,
             m.company_name, u.phone
      FROM withdrawals w
      LEFT JOIN merchants m ON m.id = w.merchant_id
      LEFT JOIN users u ON u.id = m.user_id
    `
    const params = []
    if (status && status !== 'all') { sql += ' WHERE w.status = ?'; params.push(status) }
    sql += ' ORDER BY w.created_at DESC'
    const [rows] = await db.query(sql, params)
    return R_OK(res, rows)
  } catch (e) {
    console.error('[admin-withdrawals]', e); return R_FAIL(res, '服务器错误', 500)
  }
})

// ── PATCH /api/admin/withdrawals/:id/handle — 审批提现 ──────
router.patch('/withdrawals/:id/handle', adminAuth, async (req, res) => {
  try {
    const { action, note } = req.body
    if (!['approve', 'reject'].includes(action)) return R_FAIL(res, '无效操作')
    const id = req.params.id
    if (action === 'approve') {
      await db.query(
        "UPDATE withdrawals SET status='paid', note=?, paid_at=NOW() WHERE id=? AND status='pending'",
        [note || '', id]
      )
    } else {
      await db.query(
        "UPDATE withdrawals SET status='rejected', note=? WHERE id=? AND status='pending'",
        [note || '', id]
      )
    }
    return R_OK(res, null, action === 'approve' ? '已批准提现' : '已拒绝提现')
  } catch (e) {
    console.error('[admin-withdrawals-handle]', e); return R_FAIL(res, '服务器错误', 500)
  }
})

module.exports = router
