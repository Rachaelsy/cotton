// server/middleware/auth.js — JWT 鉴权中间件
const jwt = require('jsonwebtoken')

/**
 * 验证 Bearer Token，将解码后的用户信息挂载到 req.user
 * 使用方式：router.get('/protected', authMiddleware, handler)
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ code: 401, msg: '请先登录' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded   // { id, phone, role }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, msg: '登录已过期，请重新登录' })
    }
    return res.status(401).json({ code: 401, msg: 'Token 无效' })
  }
}

/**
 * 角色权限守卫
 * 用法：roleGuard('merchant')  或  roleGuard(['farmer','merchant'])
 */
function roleGuard(...roles) {
  const allowed = roles.flat()
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 401, msg: '未登录' })
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ code: 403, msg: '权限不足' })
    }
    next()
  }
}

module.exports = { authMiddleware, roleGuard }
