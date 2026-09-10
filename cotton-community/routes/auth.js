const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const db = require('../db/database')
const { isProductionDefaultCredential } = require('../utils/default-credentials')

const router = express.Router()
const DEFAULT_FARMER_LOCATION = '喀什地区莎车县'
const PRIVACY_CONSENT_VERSION = '2026-09-04'
const CAPTCHA_TTL_MS = 5 * 60 * 1000
const captchaChallenges = new Map()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })

const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim())

function createCaptcha() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const code = Array.from({ length: 4 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('')
  const id = crypto.randomBytes(24).toString('hex')
  const lines = Array.from({ length: 7 }, () => {
    const x1 = crypto.randomInt(0, 180)
    const y1 = crypto.randomInt(0, 58)
    const x2 = crypto.randomInt(0, 180)
    const y2 = crypto.randomInt(0, 58)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`
  }).join('')
  const letters = code.split('').map((letter, index) => {
    const x = 29 + index * 39
    const y = 39 + crypto.randomInt(-3, 4)
    const rotate = crypto.randomInt(-14, 15)
    return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})">${letter}</text>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="58" viewBox="0 0 180 58"><rect width="180" height="58" rx="7" fill="#edf4ef"/><g stroke="#9cb6a7" stroke-width="1" opacity=".65">${lines}</g><g fill="#154f3b" font-family="Arial,sans-serif" font-size="28" font-weight="700">${letters}</g></svg>`
  captchaChallenges.set(id, { code, expiresAt: Date.now() + CAPTCHA_TTL_MS, attempts: 0 })
  return { id, image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` }
}

function verifyCaptcha(id, value) {
  const key = String(id || '')
  const challenge = captchaChallenges.get(key)
  if (!challenge || challenge.expiresAt < Date.now()) {
    captchaChallenges.delete(key)
    return false
  }
  challenge.attempts += 1
  const matched = challenge.code === String(value || '').trim().toUpperCase()
  if (matched || challenge.attempts >= 5) captchaChallenges.delete(key)
  return matched
}

const cleanupCaptchaTimer = setInterval(() => {
  const now = Date.now()
  for (const [id, challenge] of captchaChallenges) {
    if (challenge.expiresAt < now) captchaChallenges.delete(id)
  }
}, CAPTCHA_TTL_MS)
cleanupCaptchaTimer.unref()

router.get('/captcha', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  return ok(res, createCaptcha(), '验证码已生成')
})

function signUser(user, role = user.role) {
  return jwt.sign(
    { id: Number(user.id), phone: user.phone, role, real_name: user.real_name || '' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  )
}

function signAdmin(user) {
  return jwt.sign(
    {
      id: Number(user.id),
      phone: user.phone,
      real_name: user.real_name || '',
      is_admin: true,
      auth_version: Number(user.admin_auth_version || 0)
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ADMIN_JWT_EXPIRES || '12h' }
  )
}

function signCommunityAdmin(account) {
  return jwt.sign(
    {
      id: Number(account.id),
      phone: account.phone,
      real_name: account.display_name || '公共服务平台管理员',
      role: 'community_admin',
      is_community_admin: true,
      permission: account.permission_key || 'public_admin',
      auth_version: Number(account.auth_version || 0)
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ADMIN_JWT_EXPIRES || '12h' }
  )
}

function validateCommunityAdminPassword(value) {
  const password = String(value || '')
  if (password.length < 10 || password.length > 72) return '新密码需为10-72位'
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return '新密码必须同时包含大写字母、小写字母、数字和特殊符号'
  }
  return ''
}

router.post('/login', async (req, res) => {
  const phone = String(req.body.phone || '').trim()
  const password = String(req.body.password || '')
  if (!phone || !password) return fail(res, '手机号和密码不能为空')
  if (isProductionDefaultCredential(phone, password)) {
    return fail(res, '测试账号在正式环境中已停用，请使用正式账号', 403)
  }

  try {
    const [[user]] = await db.query('SELECT * FROM users WHERE phone=? LIMIT 1', [phone])
    if (!user) return fail(res, '手机号未注册', 404)
    if (!user.is_active) return fail(res, '账号已被禁用，请联系客服', 403)
    if (!user.password || !await bcrypt.compare(password, user.password)) return fail(res, '密码错误', 401)

    return ok(res, {
      token: signUser(user),
      role: user.role,
      real_name: user.real_name || '',
      avatar_url: user.avatar_url || null
    }, '登录成功')
  } catch (error) {
    console.error('[community-login]', error)
    return fail(res, '服务器错误，请稍后重试', 500)
  }
})

router.post('/register', async (req, res) => {
  const phone = String(req.body.phone || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const realName = String(req.body.real_name || '').trim()
  const location = String(req.body.location || '').trim().slice(0, 128) || DEFAULT_FARMER_LOCATION
  const landSize = Math.max(0, Number(req.body.land_size) || 0)

  if (!/^1\d{10}$/.test(phone)) return fail(res, '手机号格式不正确')
  if (!validEmail(email)) return fail(res, '邮箱格式不正确')
  if (password.length < 6 || password.length > 20) return fail(res, '密码需为6-20位')
  if (!realName) return fail(res, '请填写姓名或称呼')
  if (req.body.privacy_consent !== true) return fail(res, '请先阅读并同意隐私政策与服务条款')
  if (!verifyCaptcha(req.body.captcha_id, req.body.captcha_code)) return fail(res, '验证码错误或已过期，请刷新后重试')

  let conn
  try {
    conn = await db.getConnection()
    await conn.beginTransaction()
    const [[existing]] = await conn.query('SELECT * FROM users WHERE phone=? OR email=? FOR UPDATE', [phone, email])
    if (existing) {
      await conn.rollback()
      if (!existing.is_active) return fail(res, '账号已被禁用，请联系客服', 403)
      return fail(res, existing.phone === phone ? '该手机号已有平台账号，请直接登录' : '该邮箱已被注册', 409)
    }

    const hash = await bcrypt.hash(password, 10)
    const [userResult] = await conn.query(
      "INSERT INTO users (phone,email,password,role,real_name,privacy_consent_version,privacy_consent_at) VALUES (?,?,?,'farmer',?,?,NOW())",
      [phone, email, hash, realName, PRIVACY_CONSENT_VERSION]
    )
    await conn.query(
      "INSERT INTO farmers (user_id,location,land_size,crop_type) VALUES (?,?,?,'棉花')",
      [userResult.insertId, location, landSize]
    )
    await conn.commit()

    const user = { id: userResult.insertId, phone, role: 'farmer', real_name: realName }
    return ok(res, {
      token: signUser(user),
      role: 'farmer',
      real_name: realName,
      avatar_url: null
    }, '注册成功')
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {})
    console.error('[community-register]', error)
    return fail(res, '服务器错误，请稍后重试', 500)
  } finally {
    if (conn) conn.release()
  }
})

router.post('/register/merchant', async (req, res) => {
  const phone = String(req.body.phone || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const realName = String(req.body.real_name || '').trim()
  const companyName = String(req.body.company_name || '').trim()
  const companyType = ['individual', 'enterprise', 'cooperative'].includes(req.body.company_type)
    ? req.body.company_type
    : 'enterprise'
  const businessLicense = String(req.body.business_license || '').trim().toUpperCase()
  const productCategory = String(req.body.product_category || '').trim().slice(0, 64)
  const registeredAddress = String(req.body.registered_address || '').trim().slice(0, 255)

  if (!/^1\d{10}$/.test(phone)) return fail(res, '手机号格式不正确')
  if (!validEmail(email)) return fail(res, '邮箱格式不正确')
  if (password.length < 6 || password.length > 20) return fail(res, '密码需为6-20位')
  if (!realName) return fail(res, '请填写联系人姓名')
  if (!companyName) return fail(res, '请填写店铺或企业名称')
  if (!/^[0-9A-Z]{15,18}$/.test(businessLicense)) return fail(res, '请填写正确的营业执照号或统一社会信用代码')
  if (!productCategory) return fail(res, '请填写经营品类')
  if (!registeredAddress) return fail(res, '请填写经营或注册地址')
  if (req.body.privacy_consent !== true) return fail(res, '请先阅读并同意隐私政策与服务条款')
  if (!verifyCaptcha(req.body.captcha_id, req.body.captcha_code)) return fail(res, '验证码错误或已过期，请刷新后重试')

  let conn
  try {
    conn = await db.getConnection()
    await conn.beginTransaction()
    const [[existing]] = await conn.query('SELECT id,phone,email FROM users WHERE phone=? OR email=? FOR UPDATE', [phone, email])
    if (existing) {
      await conn.rollback()
      return fail(res, existing.phone === phone ? '该手机号已有平台账号' : '该邮箱已被注册', 409)
    }
    const hash = await bcrypt.hash(password, 10)
    const [userResult] = await conn.query(
      `INSERT INTO users
       (phone,email,password,role,real_name,is_active,privacy_consent_version,privacy_consent_at)
       VALUES (?,?,?,'merchant',?,0,?,NOW())`,
      [phone, email, hash, realName, PRIVACY_CONSENT_VERSION]
    )
    await conn.query(
      `INSERT INTO merchants
       (user_id,company_name,business_license,product_category,company_type,contact_email,registered_address,apply_status)
       VALUES (?,?,?,?,?,?,?,'pending')`,
      [userResult.insertId, companyName, businessLicense, productCategory, companyType, email, registeredAddress]
    )
    await conn.commit()
    return ok(res, { status: 'pending' }, '商家注册申请已提交，请等待管理员审核')
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {})
    console.error('[community-merchant-register]', error)
    return fail(res, '服务器错误，请稍后重试', 500)
  } finally {
    if (conn) conn.release()
  }
})

router.post('/ticket-login', async (req, res) => {
  const ticket = String(req.body.ticket || '').trim()
  if (!ticket || ticket.length > 128) return fail(res, '登录票据无效', 400)
  const ticketHash = crypto.createHash('sha256').update(ticket).digest('hex')
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[record]] = await conn.query(
      `SELECT id,user_id FROM community_sso_tickets
        WHERE ticket_hash=? AND used_at IS NULL AND expires_at>NOW() FOR UPDATE`,
      [ticketHash]
    )
    if (!record) {
      await conn.rollback()
      return fail(res, '登录票据已失效，请从小程序重新进入', 401)
    }
    const [[user]] = await conn.query(
      `SELECT u.*,f.location,f.land_size,f.crop_type
         FROM users u LEFT JOIN farmers f ON f.user_id=u.id
        WHERE u.id=? AND u.is_active=1 LIMIT 1`,
      [record.user_id]
    )
    if (!user) {
      await conn.rollback()
      return fail(res, '账号不存在或已被禁用', 403)
    }
    await conn.query('UPDATE community_sso_tickets SET used_at=NOW() WHERE id=?', [record.id])
    await conn.commit()
    return ok(res, {
      token: signUser(user, 'farmer'),
      role: 'farmer',
      real_name: user.real_name || '',
      phone: user.phone || '',
      avatar_url: user.avatar_url || null,
      location: user.location || '',
      land_size: Number(user.land_size || 0),
      crop_type: user.crop_type || '棉花'
    }, '已同步小程序账号')
  } catch (error) {
    await conn.rollback().catch(() => {})
    console.error('[community-ticket-login]', error)
    return fail(res, '账号同步失败，请稍后重试', 500)
  } finally {
    conn.release()
  }
})

router.post('/admin/login', async (req, res) => {
  const phone = String(req.body.phone || '').trim()
  const password = String(req.body.password || '')
  if (!phone || !password) return fail(res, '请填写账号和密码')
  if (isProductionDefaultCredential(phone, password)) {
    return fail(res, '请先登录核心管理后台修改默认密码', 403)
  }

  try {
    const [[communityAdmin]] = await db.query('SELECT * FROM community_admins WHERE phone=? LIMIT 1', [phone])
    if (communityAdmin) {
      if (!communityAdmin.is_active) return fail(res, '账号已被禁用', 403)
      if (!communityAdmin.password || !await bcrypt.compare(password, communityAdmin.password)) return fail(res, '密码错误', 401)
      await db.query('UPDATE community_admins SET last_login_at=NOW() WHERE id=?', [communityAdmin.id])
      return ok(res, {
        token: signCommunityAdmin(communityAdmin),
        real_name: communityAdmin.display_name || '公共服务平台管理员',
        permission: communityAdmin.permission_key || 'public_admin',
        redirect: '/knowledge/policy-admin.html'
      }, '登录成功')
    }

    const [[user]] = await db.query('SELECT * FROM users WHERE phone=? LIMIT 1', [phone])
    if (!user) return fail(res, '账号不存在', 404)
    if (!user.is_admin) return fail(res, '非管理员账号', 403)
    if (!user.is_active) return fail(res, '账号已被禁用', 403)
    if (!user.password || !await bcrypt.compare(password, user.password)) return fail(res, '密码错误', 401)
    return ok(res, {
      token: signAdmin(user),
      real_name: user.real_name || '管理员',
      permission: 'platform_admin',
      redirect: '/admin/dashboard.html?panel=knowledgeContents'
    }, '登录成功')
  } catch (error) {
    console.error('[community-admin-login]', error)
    return fail(res, '服务器错误，请稍后重试', 500)
  }
})

router.post('/admin/change-password', async (req, res) => {
  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ')) return fail(res, '请先登录', 401)
  let payload
  try { payload = jwt.verify(authorization.slice(7), process.env.JWT_SECRET) } catch { return fail(res, '登录已过期，请重新登录', 401) }
  if (!payload.is_community_admin || payload.role !== 'community_admin') return fail(res, '无公共服务管理员权限', 403)

  const oldPassword = String(req.body.old_password || '')
  const newPassword = String(req.body.new_password || '')
  if (!oldPassword || !newPassword) return fail(res, '请填写当前密码和新密码')
  if (oldPassword === newPassword) return fail(res, '新密码不能与当前密码相同')
  const passwordError = validateCommunityAdminPassword(newPassword)
  if (passwordError) return fail(res, passwordError)

  try {
    const [[account]] = await db.query('SELECT password,is_active FROM community_admins WHERE id=? LIMIT 1', [payload.id])
    if (!account || !account.is_active) return fail(res, '公共服务管理员账号不存在或已停用', 404)
    if (!await bcrypt.compare(oldPassword, account.password)) return fail(res, '当前密码不正确', 401)
    const hash = await bcrypt.hash(newPassword, 12)
    await db.query('UPDATE community_admins SET password=?,auth_version=auth_version+1 WHERE id=?', [hash, payload.id])
    return ok(res, null, '密码修改成功，请重新登录')
  } catch (error) {
    console.error('[community-admin-change-password]', error)
    return fail(res, '密码修改失败，请稍后重试', 500)
  }
})

module.exports = router
