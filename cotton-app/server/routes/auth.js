// server/routes/auth.js — 注册 / 登录 / 身份校验接口
const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const db       = require('../db/database')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

function ok(res, data, msg = 'ok') {
  return res.json({ code: 200, msg, data })
}
function fail(res, msg, code = 400) {
  return res.status(code).json({ code, msg, data: null })
}

/** 生成 JWT Token */
function signToken(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  )
}

function signGuestToken(guestId) {
  return jwt.sign(
    { guestId: Number(guestId), role: 'guest', type: 'wechat_guest' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.GUEST_JWT_EXPIRES || '30d' }
  )
}

async function exchangeWechatCode(loginCode) {
  const appid = process.env.WX_APPID
  const secret = process.env.WX_SECRET
  if (!appid || !secret) {
    const error = new Error('微信身份服务未配置')
    error.statusCode = 503
    throw error
  }
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', appid)
  url.searchParams.set('secret', secret)
  url.searchParams.set('js_code', loginCode)
  url.searchParams.set('grant_type', 'authorization_code')
  const response = await fetch(url)
  const session = await response.json()
  if (!response.ok || session.errcode || !session.openid) {
    const error = new Error(`微信身份校验失败：${session.errmsg || session.errcode || response.status}`)
    error.statusCode = 502
    throw error
  }
  return session
}

async function claimGuestOrders(guestToken, userId, expectedOpenid = '') {
  if (!guestToken || !userId) return 0
  try {
    const payload = jwt.verify(guestToken, process.env.JWT_SECRET)
    if (payload.role !== 'guest' || !payload.guestId) return 0
    const [[guest]] = await db.query(
      'SELECT id,openid FROM wechat_guests WHERE id=? AND is_active=1',
      [payload.guestId]
    )
    if (!guest || (expectedOpenid && guest.openid !== expectedOpenid)) return 0
    const [result] = await db.query(
      'UPDATE orders SET user_id=?,guest_id=NULL WHERE guest_id=? AND user_id IS NULL',
      [userId, guest.id]
    )
    return Number(result.affectedRows || 0)
  } catch {
    return 0
  }
}

async function loadFarmerProfile(userId, executor = db) {
  try {
    const [rows] = await executor.query(
      'SELECT location,land_size,crop_type FROM farmers WHERE user_id=? LIMIT 1',
      [userId]
    )
    return rows[0] || null
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') throw error
    const [rows] = await executor.query(
      'SELECT location,land_size FROM farmers WHERE user_id=? LIMIT 1',
      [userId]
    )
    return rows[0] ? { ...rows[0], crop_type: '棉花' } : null
  }
}

async function createFarmerProfile(userId, profile = {}, executor = db) {
  const params = [userId, profile.location || '', parseFloat(profile.land_size) || 0]
  try {
    await executor.query(
      'INSERT INTO farmers (user_id,location,land_size,crop_type) VALUES (?,?,?,?)',
      [...params, profile.crop_type || '棉花']
    )
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') throw error
    await executor.query(
      'INSERT INTO farmers (user_id,location,land_size) VALUES (?,?,?)',
      params
    )
  }
}

function farmerSessionUser(user) {
  return { ...user, role: 'farmer' }
}

function sessionUserResponse(user, role = user.role) {
  return {
    id: user.id,
    phone: user.phone,
    role,
    real_name: user.real_name || '',
    is_verified: !!user.is_verified,
    avatar_url: user.avatar_url || null
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/register  注册接口
// ─────────────────────────────────────────────
/**
 * 请求体：
 *   phone        {string} 手机号（11位）
 *   password     {string} 密码（6-20位）
 *   role         {string} 'farmer' | 'merchant'
 *   real_name    {string} 姓名
 *   --- 农户额外字段 ---
 *   location     {string} 所在地区
 *   land_size    {number} 承包面积（亩）
 *   crop_type    {string} 主种作物
 *   --- 商户额外字段 ---
 *   company_name     {string} 企业/店铺名称
 *   business_license {string} 营业执照号
 *   product_category {string} 经营品类
 */
router.post('/register', async (req, res) => {
  const { phone, password, role, real_name,
          location, land_size, crop_type,
          company_name, business_license, product_category, guestToken } = req.body

  // ── 基础校验 ──────────────────────────────
  if (!/^1\d{10}$/.test(phone))
    return fail(res, '手机号格式不正确')
  if (!password || password.length < 6 || password.length > 20)
    return fail(res, '密码需为6-20位')
  if (!['farmer', 'merchant'].includes(role))
    return fail(res, '身份类型不正确，应为 farmer 或 merchant')
  if (!real_name || !real_name.trim())
    return fail(res, '请填写姓名')

  try {
    // ── 检查手机号是否已注册 ─────────────────
    const [rows] = await db.query('SELECT * FROM users WHERE phone=?', [phone])
    if (rows.length > 0) {
      if (role !== 'farmer') return fail(res, '该手机号已注册')
      const existing = rows[0]
      if (!existing.is_active) return fail(res, '账号已被禁用，请联系客服', 403)
      const profile = await loadFarmerProfile(existing.id)
      if (profile) return fail(res, '该手机号已注册农户身份，请直接登录', 409)
      if (!existing.password || !await bcrypt.compare(password, existing.password)) {
        return fail(res, '该手机号已有网页端账号，请填写原账号密码以注册农户身份', 409)
      }
      await createFarmerProfile(existing.id, { location, land_size, crop_type })
      const farmerUser = farmerSessionUser(existing)
      const token = signToken(farmerUser)
      await claimGuestOrders(guestToken, existing.id)
      return ok(res, {
        token, role: 'farmer', phone: existing.phone,
        real_name: existing.real_name || real_name.trim(),
        is_verified: !!existing.is_verified, avatar_url: existing.avatar_url || null,
        location: location || '', land_size: parseFloat(land_size) || 0, crop_type: crop_type || '棉花'
      }, '农户身份注册成功')
    }

    // ── 加密密码 ─────────────────────────────
    const hash = await bcrypt.hash(password, 10)

    // ── 插入 users ────────────────────────────
    const [result] = await db.query(
      'INSERT INTO users (phone,password,role,real_name) VALUES (?,?,?,?)',
      [phone, hash, role, real_name.trim()]
    )
    const userId = result.insertId

    // ── 插入角色扩展信息 ───────────────────────
    if (role === 'farmer') {
      await createFarmerProfile(userId, { location, land_size, crop_type })
    } else if (role === 'merchant') {
      await db.query(
        'INSERT INTO merchants (user_id,company_name,business_license,product_category) VALUES (?,?,?,?)',
        [userId, company_name || '', business_license || '', product_category || '']
      )
    }

    // ── 签发 Token ────────────────────────────
    const token = signToken({ id: userId, phone, role })
    await claimGuestOrders(guestToken, userId)
    return ok(res, { token, role, phone, real_name: real_name.trim(), is_verified: false }, '注册成功')

  } catch (err) {
    console.error('[register]', err)
    return fail(res, '服务器错误，请稍后重试', 500)
  }
})

// ─────────────────────────────────────────────
// POST /api/auth/login  登录接口
// ─────────────────────────────────────────────
/**
 * 请求体：
 *   phone    {string} 手机号
 *   password {string} 密码
 */
router.post('/login', async (req, res) => {
  const { phone, password, role: requestedRole, guestToken } = req.body

  if (!phone || !password) return fail(res, '手机号和密码不能为空')

  try {
    // ── 查询用户 ──────────────────────────────
    const [rows] = await db.query('SELECT * FROM users WHERE phone=?', [phone])
    if (rows.length === 0) return fail(res, '手机号未注册', 404)

    const user = rows[0]
    if (!user.is_active) return fail(res, '账号已被禁用，请联系客服', 403)

    // ── 校验密码 ──────────────────────────────
    const match = user.password && await bcrypt.compare(password, user.password)
    if (!match) return fail(res, '密码错误')

    // ── 查询角色扩展信息 ───────────────────────
    let profile = {}
    let sessionUser = user
    if (requestedRole === 'farmer') {
      const farmerProfile = await loadFarmerProfile(user.id)
      if (!farmerProfile) return fail(res, '该账号尚未注册农户身份，请先完成农户注册', 403)
      profile = farmerProfile
      sessionUser = farmerSessionUser(user)
    } else if (user.role === 'farmer') {
      profile = await loadFarmerProfile(user.id) || {}
    } else {
      const [rows2] = await db.query(
        'SELECT company_name,business_license,product_category,apply_status,reject_reason,sub_mchid,wechat_applyment_state FROM merchants WHERE user_id=?', [user.id]
      )
      if (rows2.length) {
        const m = rows2[0]
        if (m.apply_status === 'pending')
          return fail(res, '入驻申请审核中，请耐心等待管理员审核（1-3个工作日）', 403)
        if (m.apply_status === 'rejected')
          return fail(res, `入驻申请已被拒绝：${m.reject_reason || '不符合入驻条件'}`, 403)
        profile = { company_name: m.company_name, business_license: m.business_license, product_category: m.product_category }
      }
    }

    // ── 记录登录日志 ──────────────────────────
    db.query(
      'INSERT INTO login_logs (user_id,ip) VALUES (?,?)',
      [user.id, req.ip]
    ).catch(() => {})

    // ── 签发 Token ────────────────────────────
    const token = signToken(sessionUser)
    await claimGuestOrders(guestToken, user.id)
    return ok(res, {
      token,
      role:       sessionUser.role,
      real_name:  user.real_name,
      is_verified: !!user.is_verified,
      avatar_url: user.avatar_url || null,
      ...profile
    }, '登录成功')

  } catch (err) {
    console.error('[login]', err)
    return fail(res, '服务器错误，请稍后重试', 500)
  }
})

// ─────────────────────────────────────────────
// GET /api/auth/verify  身份校验接口
// ─────────────────────────────────────────────
/**
 * Header: Authorization: Bearer <token>
 * 返回当前登录用户的基本信息
 */
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id=? AND is_active=1', [req.user.id])
    if (rows.length === 0) return fail(res, '用户不存在或已被禁用', 404)

    const user = rows[0]
    const sessionRole = req.user.role || user.role

    // 查角色扩展
    let profile = {}
    if (sessionRole === 'farmer') {
      const farmerProfile = await loadFarmerProfile(user.id)
      if (!farmerProfile) return fail(res, '农户身份不存在，请重新注册', 403)
      profile = farmerProfile
    } else {
      const [r] = await db.query(
        'SELECT company_name,business_license,product_category FROM merchants WHERE user_id=?', [user.id]
      )
      if (r.length) profile = r[0]
    }

    return ok(res, { ...sessionUserResponse(user, sessionRole), ...profile })
  } catch (err) {
    console.error('[verify]', err)
    return fail(res, '服务器错误', 500)
  }
})

// ─────────────────────────────────────────────
// POST /api/auth/wechat-guest  仅用 wx.login 建立免登录下单身份
// ─────────────────────────────────────────────
router.post('/wechat-guest', async (req, res) => {
  const loginCode = String(req.body.loginCode || '').trim()
  if (!loginCode) return fail(res, '缺少微信临时登录凭证')
  try {
    const { openid, unionid } = await exchangeWechatCode(loginCode)
    await db.query(
      `INSERT INTO wechat_guests (openid,unionid,last_seen_at)
       VALUES (?,?,NOW())
       ON DUPLICATE KEY UPDATE
       unionid=COALESCE(VALUES(unionid),unionid),is_active=1,last_seen_at=NOW()`,
      [openid, unionid || null]
    )
    const [[guest]] = await db.query(
      'SELECT id FROM wechat_guests WHERE openid=? AND is_active=1 LIMIT 1',
      [openid]
    )
    if (!guest) return fail(res, '微信游客身份创建失败', 500)
    return ok(res, {
      token: signGuestToken(guest.id),
      role: 'guest',
      expiresIn: process.env.GUEST_JWT_EXPIRES || '30d'
    }, '微信身份已建立')
  } catch (error) {
    console.error('[wechat-guest]', error)
    return fail(res, error.message || '微信身份建立失败', error.statusCode || 500)
  }
})

// ─────────────────────────────────────────────
// POST /api/auth/wx-login  微信登录 + 手机号绑定
// ─────────────────────────────────────────────
/**
 * 请求体：
 *   loginCode  {string} wx.login() 返回的临时 code（换取 openid）
 *   phoneCode  {string} getPhoneNumber 返回的 code（换取手机号）
 */
router.post('/wx-login', async (req, res) => {
  const { loginCode, phoneCode, guestToken } = req.body
  if (!loginCode || !phoneCode) return fail(res, '缺少 loginCode 或 phoneCode')

  const appid  = process.env.WX_APPID
  const secret = process.env.WX_SECRET
  if (!appid || !secret) return fail(res, '微信登录未配置，请使用手机号登录', 503)

  try {
    // ── 1. code 换 openid + session_key ────────
    const session = await exchangeWechatCode(loginCode)
    const { openid, unionid } = session

    // ── 2. 获取 access_token ───────────────────
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`
    const tokenResp = await fetch(tokenUrl)
    const tokenData = await tokenResp.json()
    if (tokenData.errcode) return fail(res, '获取 access_token 失败')

    // ── 3. phoneCode 换手机号 ──────────────────
    const phoneResp = await fetch(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${tokenData.access_token}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: phoneCode }) }
    )
    const phoneData = await phoneResp.json()
    if (phoneData.errcode) return fail(res, '获取手机号失败，请重试')
    const phone = phoneData.phone_info.phoneNumber

    // ── 4. 查找已有账号（openid 或 手机号）───────
    let user
    const [byOpenid] = await db.query('SELECT * FROM users WHERE openid=?', [openid])
    if (byOpenid.length > 0) {
      user = byOpenid[0]
    } else if (unionid) {
      const [byUnionid] = await db.query('SELECT * FROM users WHERE unionid=?', [unionid])
      if (byUnionid.length > 0) user = byUnionid[0]
    }
    if (!user) {
      const [byPhone] = await db.query('SELECT * FROM users WHERE phone=?', [phone])
      if (byPhone.length > 0) {
        user = byPhone[0]
      }
    }
    if (user) {
      await db.query(
        'UPDATE users SET openid=?,unionid=COALESCE(?,unionid) WHERE id=?',
        [openid, unionid || null, user.id]
      )
    }

    // ── 5. 不存在则自动注册为农户 ───────────────
    if (!user) {
      const [result] = await db.query(
        'INSERT INTO users (phone,openid,unionid,role,is_active) VALUES (?,?,?,?,1)',
        [phone, openid, unionid || null, 'farmer']
      )
      await createFarmerProfile(result.insertId)
      const [newRow] = await db.query('SELECT * FROM users WHERE id=?', [result.insertId])
      user = newRow[0]
    }

    if (!user.is_active) return fail(res, '账号已被禁用，请联系客服', 403)

    // ── 6. 微信授权手机号即视为注册/登录农户身份 ──
    let profile = await loadFarmerProfile(user.id)
    if (!profile) {
      await createFarmerProfile(user.id)
      profile = { location: '', land_size: 0, crop_type: '棉花' }
    }

    const sessionUser = farmerSessionUser(user)
    const token = signToken(sessionUser)
    await claimGuestOrders(guestToken, user.id, openid)
    return ok(res, {
      token, role: 'farmer', real_name: user.real_name || '', phone: user.phone,
      is_verified: !!user.is_verified, ...profile
    }, '登录成功')

  } catch (err) {
    console.error('[wx-login]', err)
    return fail(res, '微信登录失败，请稍后重试', 500)
  }
})

// ─────────────────────────────────────────────
// PUT /api/auth/profile  更新个人资料
// ─────────────────────────────────────────────
router.put('/profile', authMiddleware, async (req, res) => {
  const { real_name, location, land_size, avatar_url } = req.body
  if (!real_name || !real_name.trim()) return fail(res, '姓名不能为空')
  try {
    await db.query('UPDATE users SET real_name=?, avatar_url=? WHERE id=?',
      [real_name.trim(), avatar_url || null, req.user.id])
    if (req.user.role === 'farmer') {
      await db.query(
        'UPDATE farmers SET location=?, land_size=? WHERE user_id=?',
        [location || '', parseFloat(land_size) || 0, req.user.id]
      )
    }
    return ok(res, null, '保存成功')
  } catch (err) {
    console.error('[profile]', err)
    return fail(res, '保存失败')
  }
})

// ─────────────────────────────────────────────
// POST /api/auth/logout  登出
// ─────────────────────────────────────────────
router.post('/logout', authMiddleware, (req, res) => {
  return ok(res, null, '已退出登录')
})

module.exports = router
