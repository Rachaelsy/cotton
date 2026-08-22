const express = require('express')
const { getAiConfig, postAiJson } = require('../utils/ai-client')

const router = express.Router()
const buckets = new Map()
const systemPrompt = [
  '你是喀什优棉公共服务平台的棉花种植学习助手。',
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

router.post('/chat', rateLimit, async (req, res) => {
  const message = String(req.body.message || '').trim()
  if (!message) return res.status(400).json({ code: 400, msg: '消息不能为空', data: null })
  const cfg = getAiConfig()
  if (!cfg) {
    return res.json({ code: 200, data: { reply: '课程 AI 问答尚未配置，请联系管理员填写 AI 服务密钥。', provider: 'none' } })
  }

  const history = Array.isArray(req.body.history)
    ? req.body.history.slice(-8).filter(item => item && ['user', 'assistant'].includes(item.role))
    : []
  try {
    const result = await postAiJson(cfg, {
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
