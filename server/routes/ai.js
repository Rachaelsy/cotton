// server/routes/ai.js — AI 问答 + 图片分析代理
// 文字优先级：DEEPSEEK_API_KEY → GROQ_API_KEY → SILICONFLOW_API_KEY
// 视觉优先级：SILICONFLOW_API_KEY
const express = require('express')
const https   = require('https')
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const router  = express.Router()
const { detectAiIntent, buildIntentReply } = require('../../utils/ai-intent')

// 临时目录（分析后立即删除）
const aiTempDir = path.join(__dirname, '../public/uploads/ai_temp')
if (!fs.existsSync(aiTempDir)) fs.mkdirSync(aiTempDir, { recursive: true })

const photoUpload = multer({ dest: aiTempDir, limits: { fileSize: 8 * 1024 * 1024 } })

// ── System prompts ─────────────────────────────
const CHAT_SYSTEM = `你是"小棉"，专为新疆棉花种植农户设计的AI农业助手。
专业领域：棉花种植技术（播种、施肥、灌溉、打药时机）、病虫害识别与防治（棉蚜、棉铃虫、红蜘蛛、枯萎病等）、农事管理、棉花市场行情与销售。
回答要求：简洁实用、不超过250字、用通俗中文。列举步骤用"1. 2. 3."格式。不确定时说明"建议咨询当地农技站"。`

const VISION_QUESTION = `请分析这张棉花作物照片，告诉我：
1. 作物整体长势如何
2. 是否有病虫害（如有请说明是什么）
3. 是否有营养缺乏或其他异常
4. 具体防治或处理建议
请用简洁中文回答，不超过300字。`

// ── 获取当前可用的 API 配置 ────────────────────
function getApiConfig(needVision = false) {
  if (needVision && process.env.SILICONFLOW_API_KEY) {
    return {
      host:   'api.siliconflow.cn',
      path:   '/v1/chat/completions',
      apiKey: process.env.SILICONFLOW_API_KEY,
      provider: 'siliconflow',
      model:  'Qwen/Qwen2-VL-7B-Instruct'
    }
  }
  if (!needVision && process.env.DEEPSEEK_API_KEY) {
    return {
      host:   'api.deepseek.com',
      path:   '/v1/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY,
      provider: 'deepseek',
      model:  'deepseek-chat'
    }
  }
  if (process.env.GROQ_API_KEY && !needVision) {
    return {
      host:   'api.groq.com',
      path:   '/openai/v1/chat/completions',
      apiKey: process.env.GROQ_API_KEY,
      provider: 'groq',
      model:  'llama-3.3-70b-versatile'
    }
  }
  if (process.env.SILICONFLOW_API_KEY && !needVision) {
    return {
      host:   'api.siliconflow.cn',
      path:   '/v1/chat/completions',
      apiKey: process.env.SILICONFLOW_API_KEY,
      provider: 'siliconflow',
      model:  'deepseek-ai/DeepSeek-V3'
    }
  }
  return null
}

// ── 通用 HTTPS POST ────────────────────────────
function httpsPost(cfg, bodyObj, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(bodyObj)
    const req = https.request({
      hostname: cfg.host,
      port:     443,
      path:     cfg.path,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${cfg.apiKey}`,
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        let json
        try { json = JSON.parse(data) } catch {
          return reject(new Error('返回格式异常: ' + data.slice(0, 120)))
        }
        // 兼容 OpenAI 格式 {"error":{...}} 和 Siliconflow/其他格式 {"code":xxx,"message":"..."}
        if (json.error)   return reject(new Error(json.error.message || JSON.stringify(json.error)))
        if (!json.choices) {
          const msg = json.message || json.msg || `HTTP ${res.statusCode}: 服务异常`
          return reject(new Error(msg))
        }
        resolve(json)
      })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('响应超时')) })
    req.write(bodyStr)
    req.end()
  })
}

// ─────────────────────────────────────────────
// POST /api/ai/chat — 文字问答
// ─────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const message = (req.body.message || '').trim()
  if (!message) return res.json({ code: 400, msg: '消息不能为空', data: null })
  const lang = req.body.language === 'ug' ? 'ug' : 'zh'
  const displayMessage = (req.body.displayMessage || message).trim()
  const intent = detectAiIntent(displayMessage || message, lang)
  const jump = intent ? intent.jump : null

  const cfg = getApiConfig(false)
  if (!cfg) {
    const reply = intent
      ? buildIntentReply(intent, lang)
      : '⚠️ 未配置任何 AI API Key，请在 server/.env 中填写 GROQ_API_KEY、SILICONFLOW_API_KEY 或 DEEPSEEK_API_KEY。'
    return res.json({ code: 200, data: { reply, intent, jump, provider: intent ? 'local-intent' : 'none' } })
  }

  const history  = Array.isArray(req.body.history) ? req.body.history.slice(-10) : []
  const intentHint = intent
    ? `\n用户意图：${intent.key}。如回答涉及打开功能，请提醒用户点击下方入口卡片。`
    : ''
  const languageHint = lang === 'ug'
    ? '\n请尽量使用维吾尔语回答；如果专业词难以表达，可以保留少量中文农业术语。'
    : '\n请使用简洁中文回答。'
  const messages = [
    { role: 'system', content: `${CHAT_SYSTEM}${languageHint}${intentHint}` },
    ...history,
    { role: 'user', content: message }
  ]

  try {
    const result = await httpsPost(cfg, { model: cfg.model, messages, max_tokens: 600, temperature: 0.7 })
    const reply  = result.choices[0].message.content.trim()
    return res.json({ code: 200, data: { reply, intent, jump, provider: cfg.provider, model: cfg.model } })
  } catch (e) {
    console.error('[ai-chat]', e.message)
    const reply = e.message.includes('超时') ? '⏱ 响应超时，请稍后重试。'
      : e.message.includes('balance') || e.message.includes('insufficient') ? '⚠️ API 余额不足，请联系管理员更换免费 Key。'
      : `小棉暂时无法回答（${e.message}）`
    return res.json({ code: 200, data: { reply, intent, jump, provider: cfg.provider, model: cfg.model } })
  }
})

// ─────────────────────────────────────────────
// POST /api/ai/photo — 图片分析（multipart，字段名 photo）
// ─────────────────────────────────────────────
router.post('/photo', photoUpload.single('photo'), async (req, res) => {
  if (!req.file) return res.json({ code: 400, msg: '未收到图片', data: null })

  const filePath = req.file.path
  const mimeType = req.file.mimetype || 'image/jpeg'

  try {
    const buffer = fs.readFileSync(filePath)
    const base64 = buffer.toString('base64')
    fs.unlink(filePath, () => {})

    const cfg = getApiConfig(true)   // 需要视觉能力
    if (!cfg) {
      return res.json({ code: 200, data: { reply: '⚠️ 图片分析需要 SILICONFLOW_API_KEY，当前未配置。' } })
    }

    // 若当前 API 是 Groq（不支持视觉），改用 Siliconflow
    let visionCfg = cfg
    if (cfg.host === 'api.groq.com') {
      if (process.env.SILICONFLOW_API_KEY) {
        visionCfg = {
          host:   'api.siliconflow.cn',
          path:   '/v1/chat/completions',
          apiKey: process.env.SILICONFLOW_API_KEY,
          provider: 'siliconflow',
          model:  'Qwen/Qwen2-VL-7B-Instruct'
        }
      } else {
        // Groq 无视觉，降级为文字描述提示
        return res.json({ code: 200, data: { reply: '📷 收到您的照片！Groq 暂不支持图片分析。请用文字描述照片里看到的症状（如叶片颜色、虫害特征），小棉来帮您分析。' } })
      }
    }

    const dataUrl  = `data:${mimeType};base64,${base64}`
    const messages = [
      { role: 'system', content: CHAT_SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text',      text: VISION_QUESTION }
        ]
      }
    ]

    const result = await httpsPost(visionCfg,
      { model: visionCfg.model, messages, max_tokens: 600 },
      60000)
    const reply = result.choices[0].message.content.trim()
    return res.json({ code: 200, data: { reply } })
  } catch (e) {
    fs.unlink(filePath, () => {})
    console.error('[ai-vision]', e.message)
    const reply = e.message.includes('balance') || e.message.includes('insufficient')
      ? '⚠️ 图片分析 API 余额不足。请用文字描述症状，小棉依然可以帮您诊断。'
      : `图片分析失败（${e.message}），请用文字描述症状。`
    return res.json({ code: 200, data: { reply } })
  }
})

module.exports = router
