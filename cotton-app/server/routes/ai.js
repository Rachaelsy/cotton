const crypto = require('crypto')
const express = require('express')
const https = require('https')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { detectAiIntent, buildIntentReply } = require('../utils/ai-intent')

const router = express.Router()

const aiTempDir = path.join(__dirname, '../public/uploads/ai_temp')
const pestImageDir = path.join(__dirname, '../public/uploads/pest')
if (!fs.existsSync(aiTempDir)) fs.mkdirSync(aiTempDir, { recursive: true })
if (!fs.existsSync(pestImageDir)) fs.mkdirSync(pestImageDir, { recursive: true })

const PHOTO_MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp'
}
const rateBuckets = new Map()

function photoFileFilter(_req, file, cb) {
  if (PHOTO_MIME_EXT[file.mimetype]) return cb(null, true)
  cb(new Error('仅支持 JPG、PNG、WEBP、GIF、BMP 图片'))
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ code: 401, msg: '请先登录', data: null })
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ code: 401, msg: '登录已过期，请重新登录', data: null })
  }
}

function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    const now = Date.now()
    const rawKey = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`
    const key = `${keyPrefix}:${rawKey}`
    const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs }
    if (bucket.resetAt <= now) {
      bucket.count = 0
      bucket.resetAt = now + windowMs
    }
    bucket.count += 1
    rateBuckets.set(key, bucket)
    if (bucket.count > max) return res.status(429).json({ code: 429, msg: '请求过于频繁，请稍后再试', data: null })
    next()
  }
}

const chatRateLimit = rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'ai-chat' })
const photoRateLimit = rateLimit({ windowMs: 60 * 1000, max: 6, keyPrefix: 'ai-photo' })

const guardedPhotoUpload = multer({
  dest: aiTempDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: photoFileFilter
})

function uploadPhoto(req, res, next) {
  guardedPhotoUpload.single('photo')(req, res, error => {
    if (error) return res.status(400).json({ code: 400, msg: error.message, data: null })
    next()
  })
}

const CHAT_SYSTEM = '你是“小棉”，专为新疆棉花种植农户设计的 AI 农业助手。你擅长棉花种植、农事管理、棉花交易与农资使用建议。回答要简洁、实用、通俗，控制在 250 字内；如需步骤，请使用 1. 2. 3. 的格式。若无法确认，请明确说明并建议结合当地农技人员意见。'

const VISION_SYSTEM = '你是新疆棉花病虫害识别助手，必须基于图片中真实可见的信息判断，不得编造天气、面积、产量、地块历史或药效结论。'

const VISION_QUESTION = [
  '请只输出 JSON，不要输出 JSON 之外的任何文字。',
  '{',
  '  "diagnosis_name": "最可能的问题名称，没有把握时写待进一步确认",',
  '  "category": "虫害/病害/生理性/待确认",',
  '  "severity": "轻度/中度/重度/待确认",',
  '  "confidence": "高/中/低",',
  '  "summary": "一句话概括当前判断",',
  '  "symptoms": ["图片里直接看见的症状1", "症状2"],',
  '  "evidence": ["支持判断的依据1", "依据2"],',
  '  "actions": ["建议措施1", "建议措施2", "建议措施3"],',
  '  "products": [{ "name": "药剂或处理品名称", "usage": "怎么用", "note": "注意事项" }],',
  '  "warning": "如果暂不建议立即用药，写清原因；没有就写空字符串"',
  '}',
  '要求：',
  '1. 识别对象限定为棉花常见虫害、病害、生理性问题和营养异常。',
  '2. 如果图片不足以明确判断，diagnosis_name 必须写“待进一步确认”，并说明还需要观察什么。',
  '3. actions 必须具体、可执行，优先给田间处理建议。',
  '4. products 没把握时返回空数组。'
].join('\n')

function getVisionModel() {
  return String(process.env.SILICONFLOW_VISION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct').trim()
}

function getVisionConfig() {
  if (!process.env.SILICONFLOW_API_KEY) return null
  return {
    host: 'api.siliconflow.com',
    path: '/v1/chat/completions',
    apiKey: process.env.SILICONFLOW_API_KEY,
    provider: 'siliconflow',
    model: getVisionModel()
  }
}

function getChatConfig() {
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      host: 'api.deepseek.com',
      path: '/v1/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY,
      provider: 'deepseek',
      model: 'deepseek-chat'
    }
  }

  if (process.env.GROQ_API_KEY) {
    return {
      host: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      apiKey: process.env.GROQ_API_KEY,
      provider: 'groq',
      model: 'llama-3.3-70b-versatile'
    }
  }

  if (process.env.SILICONFLOW_API_KEY) {
    return {
      host: 'api.siliconflow.com',
      path: '/v1/chat/completions',
      apiKey: process.env.SILICONFLOW_API_KEY,
      provider: 'siliconflow',
      model: 'deepseek-ai/DeepSeek-V3'
    }
  }

  return null
}

function httpsPost(cfg, bodyObj, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(bodyObj)
    const req = https.request({
      hostname: cfg.host,
      port: 443,
      path: cfg.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let json
        try {
          json = JSON.parse(data)
        } catch (error) {
          return reject(new Error(`返回格式异常: ${data.slice(0, 160)}`))
        }

        if (json.error) return reject(new Error(json.error.message || JSON.stringify(json.error)))
        if (!json.choices) return reject(new Error(json.message || json.msg || `HTTP ${res.statusCode}: 服务异常`))
        resolve(json)
      })
    })

    req.on('error', reject)
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new Error('响应超时'))
    })
    req.write(bodyStr)
    req.end()
  })
}

function normalizeEnum(value, allowed, fallback) {
  const text = String(value || '').trim()
  return allowed.includes(text) ? text : fallback
}

function uniqueStringList(value, limit = 6) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const result = []
  value.forEach((item) => {
    const text = String(item || '').replace(/\s+/g, ' ').trim()
    if (!text || seen.has(text)) return
    seen.add(text)
    result.push(text)
  })
  return result.slice(0, limit)
}

function normalizeProducts(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const name = String(item.name || '').trim()
      const usage = String(item.usage || '').trim()
      const note = String(item.note || '').trim()
      if (!name && !usage && !note) return null
      return { name: name || '建议结合当地植保方案选药', usage, note }
    })
    .filter(Boolean)
    .slice(0, 4)
}

function categoryCodeFromValue(value) {
  if (value === '虫害') return 'pest'
  if (value === '病害') return 'disease'
  if (value === '生理性') return 'physiological'
  return 'unknown'
}

function severityCodeFromValue(value) {
  if (value === '轻度') return 'light'
  if (value === '中度') return 'medium'
  if (value === '重度') return 'severe'
  return 'unknown'
}

function confidenceCodeFromValue(value) {
  if (value === '高') return 'high'
  if (value === '中') return 'medium'
  return 'low'
}

function buildDiagnosisReply(diagnosis) {
  const lines = []
  lines.push(`判断：${diagnosis.diagnosis_name}（${diagnosis.category}，${diagnosis.severity}，可信度${diagnosis.confidence}）`)
  if (diagnosis.summary) lines.push(diagnosis.summary)
  if (diagnosis.actions.length) lines.push(`建议：${diagnosis.actions.join('；')}`)
  if (diagnosis.warning) lines.push(`提醒：${diagnosis.warning}`)
  return lines.join('\n')
}

function extractJsonObject(text) {
  const source = String(text || '').trim()
  if (!source) return null

  try {
    return JSON.parse(source)
  } catch (error) {}

  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(source.slice(start, end + 1))
    } catch (error) {}
  }
  return null
}

function fallbackDiagnosisFromText(text) {
  const clean = String(text || '').trim()
  const lines = clean
    .split(/\n+/)
    .map(item => item.replace(/^[\-\d\.\s]+/, '').trim())
    .filter(Boolean)

  return {
    diagnosis_name: '待进一步确认',
    category: '待确认',
    severity: '待确认',
    confidence: '低',
    summary: lines[0] || clean || '模型已返回结果，但暂未成功结构化。',
    symptoms: lines.slice(0, 2),
    evidence: [],
    actions: lines.slice(1, 4),
    products: [],
    warning: ''
  }
}

function normalizeDiagnosis(raw, replyText) {
  const source = raw && typeof raw === 'object' ? raw : fallbackDiagnosisFromText(replyText)
  const category = normalizeEnum(source.category, ['虫害', '病害', '生理性', '待确认'], '待确认')
  const severity = normalizeEnum(source.severity, ['轻度', '中度', '重度', '待确认'], '待确认')
  const confidence = normalizeEnum(source.confidence, ['高', '中', '低'], '低')

  const diagnosis = {
    diagnosis_name: String(source.diagnosis_name || '').trim() || '待进一步确认',
    category,
    category_code: categoryCodeFromValue(category),
    severity,
    severity_code: severityCodeFromValue(severity),
    confidence,
    confidence_code: confidenceCodeFromValue(confidence),
    summary: String(source.summary || '').replace(/\s+/g, ' ').trim() || '已完成图片分析，请结合田间症状进一步核实。',
    symptoms: uniqueStringList(source.symptoms, 5),
    evidence: uniqueStringList(source.evidence, 5),
    actions: uniqueStringList(source.actions, 5),
    products: normalizeProducts(source.products),
    warning: String(source.warning || '').replace(/\s+/g, ' ').trim()
  }

  if (!diagnosis.actions.length) {
    diagnosis.actions = ['建议补拍叶背、虫体或病斑近景，并结合当地植保方案进一步确认。']
  }
  if (!diagnosis.symptoms.length && diagnosis.summary) {
    diagnosis.symptoms = [diagnosis.summary]
  }

  return diagnosis
}

function extensionFromMime(mimeType, originalName) {
  return PHOTO_MIME_EXT[mimeType] || path.extname(originalName || '').trim().toLowerCase() || '.jpg'
}

function persistPestImage(buffer, mimeType, originalName) {
  const ext = extensionFromMime(mimeType, originalName)
  const filename = `pest-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
  fs.writeFileSync(path.join(pestImageDir, filename), buffer)
  return `/uploads/pest/${filename}`
}

router.post('/chat', chatRateLimit, async (req, res) => {
  const message = String(req.body.message || '').trim()
  if (!message) return res.json({ code: 400, msg: '消息不能为空', data: null })

  const lang = req.body.language === 'ug' ? 'ug' : 'zh'
  const displayMessage = String(req.body.displayMessage || message).trim()
  const intent = detectAiIntent(displayMessage || message, lang)
  const jump = intent ? intent.jump : null
  const cfg = getChatConfig()

  if (!cfg) {
    const reply = intent
      ? buildIntentReply(intent, lang)
      : '未配置可用的 AI 文本接口，请在 server/.env 中填写 DEEPSEEK_API_KEY、GROQ_API_KEY 或 SILICONFLOW_API_KEY。'
    return res.json({ code: 200, data: { reply, intent, jump, provider: intent ? 'local-intent' : 'none' } })
  }

  const history = Array.isArray(req.body.history) ? req.body.history.slice(-10) : []
  const intentHint = intent
    ? `\n用户意图：${intent.key}。如果回答涉及打开功能，请提醒用户点击页面中的对应入口。`
    : ''
  const languageHint = lang === 'ug'
    ? '\n请尽量使用维吾尔语回答；若专业术语难以表达，可保留少量中文农业术语。'
    : '\n请使用简洁中文回答。'

  const messages = [
    { role: 'system', content: CHAT_SYSTEM + languageHint + intentHint },
    ...history,
    { role: 'user', content: message }
  ]

  try {
    const result = await httpsPost(cfg, { model: cfg.model, messages, max_tokens: 600, temperature: 0.7 })
    const reply = String(result.choices[0].message.content || '').trim()
    return res.json({ code: 200, data: { reply, intent, jump, provider: cfg.provider, model: cfg.model } })
  } catch (error) {
    console.error('[ai-chat]', error.message)
    const reply = error.message.includes('超时')
      ? 'AI 回复超时，请稍后重试。'
      : error.message.includes('balance') || error.message.includes('insufficient')
        ? 'AI 接口余额不足，请联系管理员处理。'
        : `AI 暂时无法回答：${error.message}`
    return res.json({ code: 200, data: { reply, intent, jump, provider: cfg.provider, model: cfg.model } })
  }
})

router.post('/photo', requireAuth, photoRateLimit, uploadPhoto, async (req, res) => {
  if (!req.file) return res.json({ code: 400, msg: '未收到图片', data: null })

  const filePath = req.file.path
  const mimeType = req.file.mimetype || 'image/jpeg'

  try {
    const buffer = fs.readFileSync(filePath)
    const imageUrl = persistPestImage(buffer, mimeType, req.file.originalname)
    const base64 = buffer.toString('base64')
    fs.unlink(filePath, () => {})

    const cfg = getVisionConfig()
    if (!cfg) {
      return res.json({
        code: 200,
        data: {
          reply: '未配置硅基流动视觉模型，暂时无法进行病虫害识别。',
          image_url: imageUrl,
          diagnosis: null
        }
      })
    }

    const messages = [
      { role: 'system', content: `${CHAT_SYSTEM}\n${VISION_SYSTEM}` },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: VISION_QUESTION }
        ]
      }
    ]

    const result = await httpsPost(cfg, {
      model: cfg.model,
      messages,
      max_tokens: 900,
      temperature: 0.2,
      response_format: { type: 'json_object' }
    }, 60000)

    const rawReply = String(result.choices[0].message.content || '').trim()
    const diagnosis = normalizeDiagnosis(extractJsonObject(rawReply), rawReply)
    const reply = buildDiagnosisReply(diagnosis)

    return res.json({
      code: 200,
      data: {
        reply,
        image_url: imageUrl,
        diagnosis,
        provider: cfg.provider,
        model: cfg.model,
        raw_reply: rawReply
      }
    })
  } catch (error) {
    fs.unlink(filePath, () => {})
    console.error('[ai-vision]', error.message)
    const reply = error.message.includes('401') || error.message.toLowerCase().includes('unauthorized')
      ? '硅基流动鉴权失败，请检查 SILICONFLOW_API_KEY 或模型权限。'
      : error.message.includes('balance') || error.message.includes('insufficient')
        ? '病虫害识别接口余额不足，请联系管理员处理。'
        : `病虫害识别失败：${error.message}`
    return res.json({ code: 200, data: { reply, diagnosis: null } })
  }
})

module.exports = router
