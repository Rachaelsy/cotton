const jwt = require('jsonwebtoken')

function tokenPayload(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null
  return jwt.verify(auth.slice(7), process.env.JWT_SECRET)
}

function principalFromPayload(payload) {
  if (!payload) return null
  if (payload.role === 'guest' && Number(payload.guestId) > 0) {
    return { type: 'guest', id: Number(payload.guestId), payload }
  }
  if (payload.role === 'farmer' && Number(payload.id) > 0) {
    return { type: 'user', id: Number(payload.id), payload }
  }
  return null
}

function attachPrincipal(req, principal) {
  req.principal = principal
  req.user = principal && principal.type === 'user' ? principal.payload : null
  req.guest = principal && principal.type === 'guest' ? principal.payload : null
}

function optionalPrincipal(req, _res, next) {
  try {
    attachPrincipal(req, principalFromPayload(tokenPayload(req)))
  } catch {
    attachPrincipal(req, null)
  }
  next()
}

function principalAuth(req, res, next) {
  try {
    const principal = principalFromPayload(tokenPayload(req))
    if (!principal) {
      return res.status(401).json({ code: 401, msg: '请先建立微信身份或登录', data: null })
    }
    attachPrincipal(req, principal)
    next()
  } catch (error) {
    const msg = error.name === 'TokenExpiredError' ? '身份已过期，请重新进入结算页' : '身份凭证无效'
    return res.status(401).json({ code: 401, msg, data: null })
  }
}

function ownerCondition(principal, alias = '') {
  if (!principal) throw new Error('missing principal')
  const prefix = alias ? `${alias}.` : ''
  return principal.type === 'guest'
    ? { sql: `${prefix}guest_id=?`, params: [principal.id] }
    : { sql: `${prefix}user_id=?`, params: [principal.id] }
}

module.exports = {
  tokenPayload,
  principalFromPayload,
  optionalPrincipal,
  principalAuth,
  ownerCondition
}
