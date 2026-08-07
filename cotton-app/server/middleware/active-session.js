const jwt = require('jsonwebtoken')

function createActiveSessionGuard(options = {}) {
  const database = options.database || require('../db/database')
  const jwtLib = options.jwtLib || jwt
  const secret = options.secret || process.env.JWT_SECRET
  const logger = options.logger || console

  return async function activeSessionGuard(req, res, next) {
    const authorization = String(req.headers.authorization || '')
    if (!authorization.startsWith('Bearer ')) return next()

    let payload
    try {
      payload = jwtLib.verify(authorization.slice(7), secret)
    } catch {
      return next()
    }

    if (payload.role === 'guest') return next()
    const accountId = Number(payload.id || 0)
    if (!accountId) return next()

    try {
      const isCommunityAdmin = Boolean(payload.is_community_admin)
      const isAdmin = Boolean(payload.is_admin)
      const table = isCommunityAdmin
        ? 'community_admins'
        : (payload.role === 'expert' && payload.is_expert ? 'experts' : 'users')
      const fields = isCommunityAdmin
        ? 'id,is_active,auth_version'
        : (isAdmin ? 'id,is_active,is_admin,admin_auth_version' : 'id,is_active')
      const [rows] = await database.query(`SELECT ${fields} FROM ${table} WHERE id=? LIMIT 1`, [accountId])
      const account = rows[0]
      if (!account || !Number(account.is_active)) {
        return res.status(401).json({
          code: 401,
          msg: '账号已停用或不存在，请联系平台管理员',
          data: null
        })
      }
      if (isCommunityAdmin && Number(payload.auth_version || 0) !== Number(account.auth_version || 0)) {
        return res.status(401).json({
          code: 401,
          msg: '公益管理员登录状态已失效，请重新登录',
          data: null
        })
      }
      if (isAdmin && (
        !Number(account.is_admin) ||
        Number(payload.auth_version || 0) !== Number(account.admin_auth_version || 0)
      )) {
        return res.status(401).json({
          code: 401,
          msg: '管理员登录状态已失效，请重新登录',
          data: null
        })
      }
      req.activeAccount = account
      return next()
    } catch (error) {
      logger.error('[active-session]', error)
      return res.status(503).json({
        code: 503,
        msg: '账号状态暂时无法验证，请稍后重试',
        data: null
      })
    }
  }
}

module.exports = { createActiveSessionGuard }
