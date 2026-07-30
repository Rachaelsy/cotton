const DEFAULT_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_MAX_ATTEMPTS = 8
const PLACEHOLDER_PATTERN = /TODO|change[_-]?in[_-]?production|replace|your[_-]?secret|example/i

function assertRuntimeConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return
  const jwtSecret = String(env.JWT_SECRET || '')
  if (jwtSecret.length < 32 || PLACEHOLDER_PATTERN.test(jwtSecret)) {
    throw new Error('[config] JWT_SECRET 必须使用至少 32 位的随机字符串，不能使用示例占位值')
  }
  if (!String(env.DB_HOST || '').trim() || !String(env.DB_NAME || '').trim()) {
    throw new Error('[config] 生产环境必须配置 DB_HOST 和 DB_NAME')
  }
  const identityDataKey = String(env.IDENTITY_DATA_KEY || '')
  if (identityDataKey.length < 32 || PLACEHOLDER_PATTERN.test(identityDataKey)) {
    throw new Error('[config] IDENTITY_DATA_KEY 必须使用至少 32 位的随机字符串，不能使用示例占位值')
  }
}

function createCorsOptionsDelegate(env = process.env) {
  const configured = new Set(String(env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(item => item.trim().replace(/\/+$/, ''))
    .filter(Boolean))

  return function corsOptions(req, callback) {
    const origin = String(req.get('origin') || '').replace(/\/+$/, '')
    if (!origin) return callback(null, { origin: false })
    if (env.NODE_ENV !== 'production') return callback(null, { origin: true })

    const host = String(req.get('x-forwarded-host') || req.get('host') || '')
    const protocol = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim()
    const sameOrigin = host && origin === `${protocol}://${host}`
    callback(null, {
      origin: sameOrigin || configured.has(origin),
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600
    })
  }
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=(self)')
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store')
  next()
}

function createLoginRateLimiter(options = {}) {
  const windowMs = Math.max(1000, Number(options.windowMs) || DEFAULT_WINDOW_MS)
  const maxAttempts = Math.max(2, Number(options.maxAttempts) || DEFAULT_MAX_ATTEMPTS)
  const attempts = new Map()

  function requestKey(req) {
    const identity = String(
      req.body && (req.body.phone || req.body.username || req.body.account) || ''
    ).trim().toLowerCase().slice(0, 128)
    const ip = String(req.ip || req.socket && req.socket.remoteAddress || 'unknown')
    return `${req.path}|${ip}|${identity || '-'}`
  }

  function prune(now) {
    if (attempts.size < 2000) return
    for (const [key, item] of attempts) {
      if (item.windowStartedAt + windowMs <= now && item.blockedUntil <= now) attempts.delete(key)
    }
  }

  return function loginRateLimit(req, res, next) {
    const now = Date.now()
    const key = requestKey(req)
    const current = attempts.get(key)

    if (current && current.blockedUntil > now) {
      const retryAfter = Math.max(1, Math.ceil((current.blockedUntil - now) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({
        code: 429,
        msg: `登录尝试过多，请在 ${Math.ceil(retryAfter / 60)} 分钟后重试`,
        data: null
      })
    }

    res.once('finish', () => {
      const status = Number(res.statusCode) || 200
      if (status >= 200 && status < 300) {
        attempts.delete(key)
        return
      }
      if (![400, 401, 403].includes(status)) return

      const latestNow = Date.now()
      const previous = attempts.get(key)
      const active = previous && previous.windowStartedAt + windowMs > latestNow
        ? previous
        : { count: 0, windowStartedAt: latestNow, blockedUntil: 0 }
      active.count += 1
      if (active.count >= maxAttempts) active.blockedUntil = latestNow + windowMs
      attempts.set(key, active)
      prune(latestNow)
    })

    next()
  }
}

function createIpRateLimiter(options = {}) {
  const windowMs = Math.max(1000, Number(options.windowMs) || DEFAULT_WINDOW_MS)
  const maxRequests = Math.max(1, Number(options.maxRequests) || 20)
  const message = String(options.message || '操作过于频繁，请稍后重试')
  const namespace = String(options.namespace || 'request')
  const requests = new Map()

  return function ipRateLimit(req, res, next) {
    const now = Date.now()
    const ip = String(req.ip || req.socket && req.socket.remoteAddress || 'unknown')
    const key = `${namespace}|${ip}`
    const previous = requests.get(key)
    const current = previous && previous.windowStartedAt + windowMs > now
      ? previous
      : { count: 0, windowStartedAt: now }

    if (current.count >= maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((current.windowStartedAt + windowMs - now) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({ code: 429, msg: message, data: null })
    }

    current.count += 1
    requests.set(key, current)
    if (requests.size > 2000) {
      for (const [storedKey, item] of requests) {
        if (item.windowStartedAt + windowMs <= now) requests.delete(storedKey)
      }
    }
    next()
  }
}

function createApiErrorHandler(options = {}) {
  const logger = options.logger || console
  return function apiErrorHandler(error, _req, res, next) {
    if (res.headersSent) return next(error)
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ code: 400, msg: '请求内容不是有效的 JSON', data: null })
    }
    if (error?.type === 'entity.too.large' || Number(error?.status) === 413) {
      return res.status(413).json({ code: 413, msg: '请求内容过大', data: null })
    }
    if (error?.name === 'MulterError' || error?.code === 'UPLOAD_TYPE_INVALID') {
      return res.status(400).json({ code: 400, msg: error.message || '上传文件无效', data: null })
    }
    logger.error('[uncaught]', error)
    return res.status(500).json({ code: 500, msg: '服务器内部错误', data: null })
  }
}

module.exports = {
  assertRuntimeConfig,
  createApiErrorHandler,
  createCorsOptionsDelegate,
  securityHeaders,
  createLoginRateLimiter,
  createIpRateLimiter
}
