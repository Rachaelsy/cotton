const crypto = require('crypto')
const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const { getAiConfig, postAiJson } = require('../utils/ai-client')
const { resolveWeatherRegion, fetchRegionWeather, fetchCurrentLocationWeather } = require('../utils/region-weather')

const router = express.Router()
const DAILY_GENERATION_LIMIT = 100
const FARMER_CACHE_TTL_MS = 2 * 60 * 60 * 1000
const farmerGenerationJobs = new Map()
const ok = (res, data = null, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, status = 400) => res.status(status).json({ code: status, msg, data: null })
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)

function payload(req) {
  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ')) return null
  try { return jwt.verify(authorization.slice(7), process.env.JWT_SECRET) } catch { return null }
}

async function farmerAuth(req, res, next) {
  const token = payload(req)
  if (!token || token.role !== 'farmer' || !token.id) return fail(res, '请先登录农户账号', 401)
  try {
    // users.role 是兼容旧系统的主角色，同一个账号还可能同时拥有商户等身份。
    // 农户资格应以 farmers 档案为准，不能要求 users.role 永远等于 farmer。
    const [[user]] = await db.query(
      'SELECT u.id,u.is_active FROM users u INNER JOIN farmers f ON f.user_id=u.id WHERE u.id=? LIMIT 1',
      [token.id]
    )
    if (!user || !user.is_active) return fail(res, '农户账号不存在或已停用', 401)
    req.farmerId = Number(user.id)
    next()
  } catch (error) {
    console.error('[voice-briefing-farmer-auth]', error)
    return fail(res, '农户身份校验失败', 500)
  }
}

async function adminAuth(req, res, next) {
  const token = payload(req)
  if (!token) return fail(res, '管理员登录已过期', 401)
  try {
    if (token.is_community_admin && ['public_admin', 'policy_editor'].includes(token.permission)) {
      const [[account]] = await db.query('SELECT id,is_active,auth_version FROM community_admins WHERE id=? LIMIT 1', [token.id])
      if (!account || !account.is_active || Number(account.auth_version) !== Number(token.auth_version || 0)) return fail(res, '公共服务管理员登录已失效', 401)
      req.briefingAdmin = { id: Number(account.id), type: 'community' }
      return next()
    }
    if (token.is_admin) {
      const [[account]] = await db.query('SELECT id,is_admin,is_active,admin_auth_version FROM users WHERE id=? LIMIT 1', [token.id])
      if (!account || !account.is_admin || !account.is_active || Number(account.admin_auth_version || 0) !== Number(token.auth_version || 0)) return fail(res, '平台管理员登录已失效', 401)
      req.briefingAdmin = { id: Number(account.id), type: 'platform' }
      return next()
    }
    return fail(res, '无语音播报管理权限', 403)
  } catch (error) {
    console.error('[voice-briefing-admin-auth]', error)
    return fail(res, '管理员身份校验失败', 500)
  }
}

function dateOnly(value) {
  const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : ''
}

function maskPhone(value) {
  const phone = String(value || '')
  return phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '未填写手机号'
}

function rowData(row) {
  if (!row) return null
  return {
    id: Number(row.id), userId: Number(row.user_id), briefingDate: dateOnly(row.briefing_date),
    content: row.content || '', sourceType: row.source_type || 'manual', status: row.status || 'draft',
    generationCount: Number(row.generation_count || 0), provider: row.ai_provider || '', model: row.ai_model || '',
    generatedAt: row.generated_at || null, publishedAt: row.published_at || null, updatedAt: row.updated_at || null
  }
}

async function optionalRows(sql, params = []) {
  try { const [rows] = await db.query(sql, params); return rows } catch (error) {
    if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) return []
    throw error
  }
}

function requestedCoordinates(options = {}) {
  const latitude = Number(options.latitude)
  const longitude = Number(options.longitude)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}

async function resolveBroadcastWeather(registeredRegion, options = {}) {
  const coordinates = requestedCoordinates(options)
  if (coordinates) {
    try {
      const weather = await fetchCurrentLocationWeather(coordinates.latitude, coordinates.longitude)
      return {
        weather,
        region: {
          name: weather.region || '当前位置', registeredLocation: registeredRegion.registeredLocation,
          usedDefault: false, fallbackReason: '', source: 'current_location'
        }
      }
    } catch (error) {
      console.warn(`[voice-current-location-weather] ${error.message}; fallback to ${registeredRegion.name}`)
    }
  }
  const weather = await fetchRegionWeather(registeredRegion).catch(error => {
    console.warn(`[voice-region-weather] ${registeredRegion.name}: ${error.message}`)
    return null
  })
  return {
    weather,
    region: {
      name: registeredRegion.name, registeredLocation: registeredRegion.registeredLocation,
      usedDefault: registeredRegion.usedDefault, fallbackReason: registeredRegion.fallbackReason,
      source: coordinates ? 'registered_location_fallback' : 'registered_location'
    }
  }
}

async function buildContext(userId, date, options = {}) {
  const [[farmer]] = await db.query(
    `SELECT u.id,u.phone,u.nickname,u.real_name,f.location
       FROM users u LEFT JOIN farmers f ON f.user_id=u.id
      WHERE u.id=? AND u.role='farmer' AND u.is_active=1 LIMIT 1`,
    [userId]
  )
  if (!farmer) return null
  const registeredRegion = resolveWeatherRegion(farmer.location)
  const [plots, work, weather, broadcastWeather] = await Promise.all([
    optionalRows('SELECT id,name,area,variety,growth_stage FROM plots WHERE user_id=? ORDER BY id', [userId]),
    optionalRows(
      `SELECT w.plot_id,w.time_label,w.title,w.content,w.priority,p.name AS plot_name
         FROM community_plot_daily_work w INNER JOIN plots p ON p.id=w.plot_id
        WHERE p.user_id=? AND w.work_date=? AND w.status='published'
        ORDER BY p.id,w.sort_order,w.id`, [userId, date]
    ),
    optionalRows(
      `SELECT o.plot_id,o.observed_hour,o.temperature,o.precipitation,o.provider
         FROM weather_observations o
         INNER JOIN (SELECT plot_id,MAX(observed_hour) AS latest FROM weather_observations GROUP BY plot_id) latest
           ON latest.plot_id=o.plot_id AND latest.latest=o.observed_hour
         INNER JOIN plots p ON p.id=o.plot_id
        WHERE p.user_id=?`, [userId]
    ),
    resolveBroadcastWeather(registeredRegion, options)
  ])
  const workMap = new Map()
  work.forEach(item => {
    const list = workMap.get(Number(item.plot_id)) || []
    list.push({ time: item.time_label || '今日完成', title: item.title, content: item.content || '', priority: item.priority || 'normal' })
    workMap.set(Number(item.plot_id), list)
  })
  const weatherMap = new Map(weather.map(item => [Number(item.plot_id), {
    observedAt: item.observed_hour, temperature: item.temperature == null ? null : Number(item.temperature),
    precipitation: Number(item.precipitation || 0), provider: item.provider || ''
  }]))
  return {
    date,
    farmer: { id: Number(farmer.id), name: farmer.nickname || farmer.real_name || '棉农朋友', phoneMasked: maskPhone(farmer.phone), location: farmer.location || '' },
    weatherRegion: broadcastWeather.region,
    regionWeather: broadcastWeather.weather,
    plots: plots.map(plot => ({
      id: Number(plot.id), name: plot.name || `地块${plot.id}`, area: Number(plot.area || 0), variety: plot.variety || '', growthStage: plot.growth_stage || '',
      work: workMap.get(Number(plot.id)) || [], weather: weatherMap.get(Number(plot.id)) || null
    }))
  }
}

function contextHash(context) {
  return crypto.createHash('sha256').update(JSON.stringify(context)).digest('hex')
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function batchGroupData(context) {
  const region = normalizeText(context?.weatherRegion?.name) || '莎车县'
  const tasks = []
  ;(context?.plots || []).forEach(plot => {
    ;(plot.work || []).forEach(item => tasks.push({
      time: normalizeText(item.time || '今日完成'),
      title: normalizeText(item.title),
      content: normalizeText(item.content),
      priority: normalizeText(item.priority || 'normal')
    }))
  })
  const uniqueTasks = [...new Map(tasks.map(item => [JSON.stringify(item), item])).values()]
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'zh-CN'))
  return { region, weather: context?.regionWeather || null, tasks: uniqueTasks }
}

function singlePromptData(context) {
  const tasks = []
  ;(context?.plots || []).forEach(plot => {
    ;(plot.work || []).forEach(item => tasks.push({
      plot: normalizeText(plot.name),
      time: normalizeText(item.time || '今日完成'),
      title: normalizeText(item.title),
      content: normalizeText(item.content),
      priority: normalizeText(item.priority || 'normal')
    }))
  })
  return {
    date: context?.date || '',
    location: normalizeText(context?.weatherRegion?.name) || '莎车县',
    weatherSource: context?.weatherRegion?.source || 'registered_location',
    weather: context?.regionWeather || null,
    tasks
  }
}

function generationContextHash(context) {
  return contextHash(singlePromptData(context))
}

function batchGroupKey(context) {
  const data = batchGroupData(context)
  return crypto.createHash('sha256').update(JSON.stringify({ region: data.region, tasks: data.tasks })).digest('hex')
}

function aiPrompt(context) {
  return [
    '请根据下方结构化数据生成一段面向棉农的简短中文语音播报稿。',
    '要求：60至120个汉字；不寒暄、不铺垫、不重复；先播报 location 对应的 weather 当前真实天气，天气讲完后再按地块播报今日农事（数据来自 tasks）；只保留对作业有用的天气要素和最重要的任务，紧急任务优先。weatherSource=current_location 表示天气来自农户点击时的手机定位，其他值表示定位失败后使用注册地区。',
    'weather 非空就表示已有可用天气，必须播报地区、温度、天气状况和重要预警，不得说“暂无天气”；只有 weather 为空时才说“当前暂无可用天气观测”。',
    '只能使用输入数据，严禁编造天气、预警、农事任务、农药剂量或具体处方。tasks 为空时说明今日暂无已发布农事。',
    '天气数据属于最近一次真实观测，不得表述为未来预报。不要使用 Markdown、序号标题、括号注释或免责声明，只输出最终播报正文。',
    JSON.stringify(singlePromptData(context))
  ].join('\n')
}

function batchSharedData(contexts) {
  const items = contexts.map(batchGroupData)
  const weather = items.map(item => item.weather).filter(Boolean)
    .sort((a, b) => new Date(b.observedAt || 0) - new Date(a.observedAt || 0))[0] || null
  return { region: items[0]?.region || '', weather, tasks: items[0]?.tasks || [] }
}

function batchAiPrompt(contexts) {
  return [
    '请根据下方同一地区、相同今日农事的结构化数据，生成一段可供该组所有棉农共用的简短中文语音播报稿。',
    '要求：60至120个汉字；不称呼姓名，不提地块名称；不寒暄、不铺垫、不重复；先讲该地区最新真实天气，再讲今日农事；只保留对作业有用的天气要素和最重要任务，紧急任务优先。',
    'weather 字段非空就表示已有可用天气，必须播报温度和降水，不得说“暂无天气”；只有 weather 为空时才说“当前暂无可用天气观测”。',
    '只能使用输入数据，严禁编造天气、预警、农事任务、农药剂量或具体处方。tasks 为空时说明今日暂无已发布农事。',
    '天气属于最近一次真实观测，不得表述为未来预报。不要使用 Markdown、序号标题、括号注释或免责声明，只输出最终播报正文。',
    JSON.stringify(batchSharedData(contexts))
  ].join('\n')
}

async function requestAiContent(config, prompt) {
  const result = await postAiJson(config, {
    model: config.model,
    messages: [{ role: 'system', content: '你是喀什优棉公共服务平台的农业播报编辑，只根据提供的数据撰写，不得补充未知事实。' }, { role: 'user', content: prompt }],
    max_tokens: 280,
    temperature: 0.35
  })
  const content = String(result.choices?.[0]?.message?.content || '').trim().slice(0, 3000)
  if (!content) throw new Error('大模型未生成有效播报')
  return content
}

async function saveAiDraft({ userId, date, content, context, config, adminId }) {
  await db.query(
    `INSERT INTO community_voice_briefings
     (user_id,briefing_date,content,source_type,status,context_snapshot,context_hash,generation_count,ai_provider,ai_model,generated_at,created_by,updated_by)
     VALUES (?,?,?,'ai','draft',?,?,1,?,?,NOW(),?,?)
     ON DUPLICATE KEY UPDATE content=VALUES(content),source_type='ai',status='draft',context_snapshot=VALUES(context_snapshot),context_hash=VALUES(context_hash),
     generation_count=generation_count+1,ai_provider=VALUES(ai_provider),ai_model=VALUES(ai_model),generated_at=NOW(),updated_by=VALUES(updated_by)`,
    [userId, date, content, JSON.stringify(context), contextHash(context), config.provider, config.model, adminId, adminId]
  )
}

async function saveFarmerGeneratedBriefing({ userId, date, content, context, config }) {
  await db.query(
    `INSERT INTO community_voice_briefings
     (user_id,briefing_date,content,source_type,status,context_snapshot,context_hash,generation_count,ai_provider,ai_model,generated_at,published_at)
     VALUES (?,?,?,'ai','published',?,?,1,?,?,NOW(),NOW())
     ON DUPLICATE KEY UPDATE content=VALUES(content),source_type='ai',status='published',context_snapshot=VALUES(context_snapshot),context_hash=VALUES(context_hash),
     generation_count=generation_count+1,ai_provider=VALUES(ai_provider),ai_model=VALUES(ai_model),generated_at=NOW(),published_at=NOW(),updated_by=NULL`,
    [userId, date, content, JSON.stringify(context), generationContextHash(context), config.provider, config.model]
  )
}

function isFreshCache(row, hash) {
  if (!row || row.status !== 'published' || row.context_hash !== hash || !row.generated_at) return false
  const generatedAt = new Date(row.generated_at).getTime()
  return Number.isFinite(generatedAt) && Date.now() - generatedAt >= 0 && Date.now() - generatedAt < FARMER_CACHE_TTL_MS
}

async function generateFarmerBriefing(userId, date, options = {}) {
  const context = await buildContext(userId, date, options)
  if (!context) throw Object.assign(new Error('农户不存在'), { status: 404 })
  const hash = generationContextHash(context)
  const [[existing]] = await db.query('SELECT * FROM community_voice_briefings WHERE user_id=? AND briefing_date=? LIMIT 1', [userId, date])
  if (isFreshCache(existing, hash)) return { briefing: rowData(existing), cached: true, stale: false }
  if (Number(existing && existing.generation_count || 0) >= DAILY_GENERATION_LIMIT) {
    if (existing && existing.status === 'published' && existing.content) return { briefing: rowData(existing), cached: true, stale: true }
    throw Object.assign(new Error(`当天最多生成${DAILY_GENERATION_LIMIT}次，请稍后再试`), { status: 429 })
  }
  const config = getAiConfig()
  if (!config) {
    if (existing && existing.status === 'published' && existing.content) return { briefing: rowData(existing), cached: true, stale: true }
    throw Object.assign(new Error('尚未配置大模型 API 密钥'), { status: 503 })
  }
  try {
    const content = await requestAiContent(config, aiPrompt(context))
    await saveFarmerGeneratedBriefing({ userId, date, content, context, config })
    const [[saved]] = await db.query('SELECT * FROM community_voice_briefings WHERE user_id=? AND briefing_date=? LIMIT 1', [userId, date])
    return { briefing: rowData(saved), cached: false, stale: false }
  } catch (error) {
    if (existing && existing.status === 'published' && existing.content) return { briefing: rowData(existing), cached: true, stale: true }
    throw error
  }
}

router.get('/today', farmerAuth, asyncRoute(async (req, res) => {
  const date = dateOnly(req.query.date)
  if (!date) return fail(res, '请提供正确日期')
  const [[row]] = await db.query("SELECT * FROM community_voice_briefings WHERE user_id=? AND briefing_date=? AND status='published' LIMIT 1", [req.farmerId, date])
  return ok(res, rowData(row))
}))

router.post('/generate', farmerAuth, asyncRoute(async (req, res) => {
  const date = dateOnly(req.body.briefing_date || req.body.briefingDate)
  if (!date) return fail(res, '请提供正确日期')
  const key = `${req.farmerId}:${date}`
  const locationOptions = { latitude: req.body.latitude, longitude: req.body.longitude }
  let job = farmerGenerationJobs.get(key)
  if (!job) {
    job = generateFarmerBriefing(req.farmerId, date, locationOptions).finally(() => farmerGenerationJobs.delete(key))
    farmerGenerationJobs.set(key, job)
  }
  try {
    const result = await job
    const message = result.stale ? '智能播报暂时无法更新，已使用最近一次内容' : (result.cached ? '已使用两小时内的智能播报' : '智能播报已生成并保存')
    return ok(res, { ...result.briefing, cached: result.cached, stale: result.stale, cacheHours: 2 }, message)
  } catch (error) {
    console.error('[voice-briefing-farmer-generate]', error.message)
    return fail(res, `智能播报生成失败：${error.message}`, error.status || 502)
  }
}))

router.get('/admin/farmers', adminAuth, asyncRoute(async (req, res) => {
  const date = dateOnly(req.query.date)
  if (!date) return fail(res, '请提供正确日期')
  const [rows] = await db.query(
    `SELECT u.id,u.phone,u.nickname,u.real_name,f.location,COUNT(DISTINCT p.id) AS plot_count,
            COUNT(DISTINCT w.id) AS work_count,b.status,b.source_type,b.updated_at,b.generation_count
       FROM users u LEFT JOIN farmers f ON f.user_id=u.id LEFT JOIN plots p ON p.user_id=u.id
       LEFT JOIN community_plot_daily_work w ON w.plot_id=p.id AND w.work_date=? AND w.status='published'
       LEFT JOIN community_voice_briefings b ON b.user_id=u.id AND b.briefing_date=?
      WHERE u.role='farmer' AND u.is_active=1
      GROUP BY u.id,u.phone,u.nickname,u.real_name,f.location,b.status,b.source_type,b.updated_at,b.generation_count
      ORDER BY b.updated_at DESC,u.id DESC`, [date, date]
  )
  return ok(res, rows.map(row => ({
    id: Number(row.id), name: row.nickname || row.real_name || '棉农朋友', phoneMasked: maskPhone(row.phone), location: row.location || '',
    plotCount: Number(row.plot_count || 0), workCount: Number(row.work_count || 0), status: row.status || 'none',
    sourceType: row.source_type || '', generationCount: Number(row.generation_count || 0), updatedAt: row.updated_at || null
  })))
}))

router.get('/admin/:userId', adminAuth, asyncRoute(async (req, res) => {
  const userId = Number(req.params.userId)
  const date = dateOnly(req.query.date)
  if (!userId || !date) return fail(res, '农户和日期不能为空')
  const context = await buildContext(userId, date)
  if (!context) return fail(res, '农户不存在', 404)
  const [[briefing]] = await db.query('SELECT * FROM community_voice_briefings WHERE user_id=? AND briefing_date=? LIMIT 1', [userId, date])
  return ok(res, { context, briefing: rowData(briefing) })
}))

router.post('/admin/generate', adminAuth, asyncRoute(async (req, res) => {
  const userId = Number(req.body.user_id || req.body.userId)
  const date = dateOnly(req.body.briefing_date || req.body.briefingDate)
  if (!userId || !date) return fail(res, '请选择农户和播报日期')
  const config = getAiConfig()
  if (!config) return fail(res, '尚未配置大模型 API 密钥', 503)
  const context = await buildContext(userId, date)
  if (!context) return fail(res, '农户不存在', 404)
  const [[existing]] = await db.query('SELECT generation_count FROM community_voice_briefings WHERE user_id=? AND briefing_date=? LIMIT 1', [userId, date])
  if (Number(existing && existing.generation_count || 0) >= DAILY_GENERATION_LIMIT) return fail(res, `该农户当天最多生成${DAILY_GENERATION_LIMIT}次，请直接手动编辑`, 429)
  try {
    const content = await requestAiContent(config, aiPrompt(context))
    await saveAiDraft({ userId, date, content, context, config, adminId: req.briefingAdmin.id })
    const [[saved]] = await db.query('SELECT * FROM community_voice_briefings WHERE user_id=? AND briefing_date=? LIMIT 1', [userId, date])
    return ok(res, rowData(saved), 'AI 播报已生成，请审核后发布')
  } catch (error) {
    console.error('[voice-briefing-generate]', error.message)
    return fail(res, `AI 生成失败：${error.message}`, 502)
  }
}))

router.put('/admin/:userId', adminAuth, asyncRoute(async (req, res) => {
  const userId = Number(req.params.userId)
  const date = dateOnly(req.body.briefing_date || req.body.briefingDate)
  const content = String(req.body.content || '').trim().slice(0, 3000)
  const status = ['draft', 'published', 'offline'].includes(req.body.status) ? req.body.status : 'draft'
  if (!userId || !date || !content) return fail(res, '农户、日期和播报内容不能为空')
  const context = await buildContext(userId, date)
  if (!context) return fail(res, '农户不存在', 404)
  const [[existing]] = await db.query('SELECT source_type,content FROM community_voice_briefings WHERE user_id=? AND briefing_date=? LIMIT 1', [userId, date])
  const sourceType = existing && existing.source_type === 'ai' && existing.content !== content ? 'ai_edited' : (existing ? existing.source_type : 'manual')
  await db.query(
    `INSERT INTO community_voice_briefings
     (user_id,briefing_date,content,source_type,status,context_snapshot,context_hash,published_at,created_by,updated_by)
     VALUES (?,?,?,?,?,?,?,IF(?='published',NOW(),NULL),?,?)
     ON DUPLICATE KEY UPDATE content=VALUES(content),source_type=VALUES(source_type),status=VALUES(status),context_snapshot=VALUES(context_snapshot),context_hash=VALUES(context_hash),
     published_at=CASE WHEN VALUES(status)='published' THEN NOW() ELSE published_at END,updated_by=VALUES(updated_by)`,
    [userId, date, content, sourceType, status, JSON.stringify(context), contextHash(context), status, req.briefingAdmin.id, req.briefingAdmin.id]
  )
  const [[saved]] = await db.query('SELECT * FROM community_voice_briefings WHERE user_id=? AND briefing_date=? LIMIT 1', [userId, date])
  return ok(res, rowData(saved), status === 'published' ? '播报已发布到小程序' : '播报草稿已保存')
}))

module.exports = router
