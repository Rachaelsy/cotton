const express = require('express')
const https = require('https')

const router = express.Router()
const buckets = new Map()
const systemPrompt = [
  '你是棉知学堂的棉花种植学习助手。',
  '回答应围绕棉花播种、田间管理、水肥、病虫害、采收和质量控制，使用简洁、可执行的中文。',
  '涉及农药剂量、灾害处置或无法确认的田间症状时，必须提醒用户核对产品标签并咨询当地农技人员。',
  '不要编造具体天气、地块数据、检测结果或政策。回答控制在500字内。'
].join('')

function rateLimit(req, res, next) {
  const now = Date.now()
  const key = req.ip || req.socket.remoteAddress || 'unknown'
  const bucket = buckets.get(key) || { count: 0, resetAt: now + 60000 }
  if (bucket.resetAt <= now) {
    bucket.count = 0
    bucket.resetAt = now + 60000
  }
  bucket.count += 1
  buckets.set(key, bucket)
  if (bucket.count > 30) return res.status(429).json({ code: 429, msg: '请求过于频繁，请稍后再试', data: null })
  next()
}

function config() {
  if (process.env.DEEPSEEK_API_KEY) {
    return { host: 'api.deepseek.com', path: '/v1/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-chat', provider: 'deepseek' }
  }
  if (process.env.GROQ_API_KEY) {
    return { host: 'api.groq.com', path: '/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile', provider: 'groq' }
  }
  if (process.env.SILICONFLOW_API_KEY) {
    return { host: 'api.siliconflow.com', path: '/v1/chat/completions', key: process.env.SILICONFLOW_API_KEY, model: 'deepseek-ai/DeepSeek-V3', provider: 'siliconflow' }
  }
  return null
}

function postJson(cfg, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const request = https.request({
      hostname: cfg.host,
      port: 443,
      path: cfg.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.key}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, response => {
      let data = ''
      response.on('data', chunk => { data += chunk })
      response.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.error) return reject(new Error(result.error.message || 'AI 服务异常'))
          resolve(result)
        } catch {
          reject(new Error('AI 服务返回格式异常'))
        }
      })
    })
    request.on('error', reject)
    request.setTimeout(30000, () => request.destroy(new Error('AI 回复超时')))
    request.write(body)
    request.end()
  })
}

router.post('/chat', rateLimit, async (req, res) => {
  const message = String(req.body.message || '').trim()
  if (!message) return res.status(400).json({ code: 400, msg: '消息不能为空', data: null })
  const cfg = config()
  if (!cfg) {
    return res.json({ code: 200, data: { reply: '课程 AI 问答尚未配置，请联系管理员填写 AI 服务密钥。', provider: 'none' } })
  }

  const history = Array.isArray(req.body.history)
    ? req.body.history.slice(-8).filter(item => item && ['user', 'assistant'].includes(item.role))
    : []
  try {
    const result = await postJson(cfg, {
      model: cfg.model,
      messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }],
      max_tokens: 800,
      temperature: 0.5
    })
    const reply = String(result.choices?.[0]?.message?.content || '').trim()
    return res.json({ code: 200, data: { reply: reply || '暂时没有生成有效回答，请稍后重试。', provider: cfg.provider, model: cfg.model } })
  } catch (error) {
    console.error('[community-ai]', error.message)
    return res.json({ code: 200, data: { reply: `AI 暂时无法回答：${error.message}`, provider: cfg.provider } })
  }
})

module.exports = router
