const https = require('https')

function getAiConfig() {
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

function postAiJson(config, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const request = https.request({
      hostname: config.host,
      port: 443,
      path: config.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.key}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, response => {
      let data = ''
      response.on('data', chunk => { data += chunk })
      response.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.error) return reject(new Error(result.error.message || 'AI 服务异常'))
          if (response.statusCode >= 400) return reject(new Error(`AI 服务返回 ${response.statusCode}`))
          resolve(result)
        } catch (error) {
          reject(error instanceof SyntaxError ? new Error('AI 服务返回格式异常') : error)
        }
      })
    })
    request.on('error', reject)
    request.setTimeout(30000, () => request.destroy(new Error('AI 回复超时')))
    request.write(body)
    request.end()
  })
}

module.exports = { getAiConfig, postAiJson }
