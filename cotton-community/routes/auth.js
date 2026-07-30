const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const db = require('../db/database')
const { isProductionDefaultCredential } = require('../utils/default-credentials')

const router = express.Router()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })

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
  const password = String(req.body.password || '')
  const realName = String(req.body.real_name || '').trim()
  const location = String(req.body.location || '').trim().slice(0, 128)
  const landSize = Math.max(0, Number(req.body.land_size) || 0)

  if (!/^1\d{10}$/.test(phone)) return fail(res, '手机号格式不正确')
  if (password.length < 6 || password.length > 20) return fail(res, '密码需为6-20位')
  if (!realName) return fail(res, '请填写姓名或称呼')

  let conn
  try {
    conn = await db.getConnection()
    await conn.beginTransaction()
    const [[existing]] = await conn.query('SELECT * FROM users WHERE phone=? FOR UPDATE', [phone])
    if (existing) {
      await conn.rollback()
      if (!existing.is_active) return fail(res, '账号已被禁用，请联系客服', 403)
      return fail(res, '该手机号已有平台账号，请直接登录', 409)
    }

    const hash = await bcrypt.hash(password, 10)
    const [userResult] = await conn.query(
      "INSERT INTO users (phone,password,role,real_name) VALUES (?,?,'farmer',?)",
      [phone, hash, realName]
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
    const [[user]] = await db.query('SELECT * FROM users WHERE phone=? LIMIT 1', [phone])
    if (!user) return fail(res, '账号不存在', 404)
    if (!user.is_admin) return fail(res, '非管理员账号', 403)
    if (!user.is_active) return fail(res, '账号已被禁用', 403)
    if (!user.password || !await bcrypt.compare(password, user.password)) return fail(res, '密码错误', 401)
    return ok(res, { token: signAdmin(user), real_name: user.real_name || '管理员' }, '登录成功')
  } catch (error) {
    console.error('[community-admin-login]', error)
    return fail(res, '服务器错误，请稍后重试', 500)
  }
})

module.exports = router
