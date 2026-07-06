const assert = require('assert')
const express = require('express')
const { EventEmitter } = require('events')
const https = require('https')
const { detectAiIntent } = require('../../utils/ai-intent')

process.env.GROQ_API_KEY = ''
process.env.SILICONFLOW_API_KEY = ''
process.env.DEEPSEEK_API_KEY = ''

const aiRouter = require('../routes/ai')

async function request(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { status: response.status, json: await response.json() }
}

async function run() {
  const tradeIntent = detectAiIntent('我要卖棉花')
  assert.strictEqual(tradeIntent.key, 'trade')
  assert.strictEqual(tradeIntent.jump.url, '/pages/trade/index')
  assert.strictEqual(tradeIntent.jump.method, 'navigateTo')
  assert.strictEqual(tradeIntent.jump.autoOpen, true)

  const growthIntent = detectAiIntent('我要看长势')
  assert.strictEqual(growthIntent.key, 'plots')
  assert.strictEqual(growthIntent.jump.url, '/pages/fields/index')
  assert.strictEqual(growthIntent.jump.autoOpen, true)

  const weatherIntent = detectAiIntent('查一下今天地块天气')
  assert.strictEqual(weatherIntent.key, 'weather')
  assert.strictEqual(weatherIntent.jump.url, '/pages/weather/index')

  const ugSuppliesIntent = detectAiIntent('دېھقانچىلىق دورىسى سېتىۋالماقچى')
  assert.strictEqual(ugSuppliesIntent.key, 'supplies')
  assert.strictEqual(ugSuppliesIntent.jump.url, '/subpkg-supplies/supplies/index')

  const app = express()
  app.use(express.json())
  app.use('/api/ai', aiRouter)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  try {
    const command = await request(baseUrl, { message: '我要卖棉花', language: 'zh' })
    assert.strictEqual(command.status, 200)
    assert.strictEqual(command.json.code, 200)
    assert.strictEqual(command.json.data.intent.key, 'trade')
    assert.strictEqual(command.json.data.jump.url, '/pages/trade/index')
    assert.strictEqual(command.json.data.jump.autoOpen, true)
    assert.match(command.json.data.reply, /棉花交易/)
    assert.strictEqual(command.json.data.provider, 'local-intent')

    const normal = await request(baseUrl, { message: '棉花什么时候打顶', language: 'zh' })
    assert.strictEqual(normal.status, 200)
    assert.strictEqual(normal.json.code, 200)
    assert.strictEqual(normal.json.data.jump, null)
    assert.match(normal.json.data.reply, /未配置任何 AI API Key/)

    const originalRequest = https.request
    let capturedRequest = null
    https.request = (options, callback) => {
      capturedRequest = options
      const req = new EventEmitter()
      req.write = () => {}
      req.end = () => {
        const response = new EventEmitter()
        response.statusCode = 200
        process.nextTick(() => {
          callback(response)
          response.emit('data', JSON.stringify({
            choices: [{ message: { content: 'DeepSeek test reply' } }]
          }))
          response.emit('end')
        })
      }
      req.setTimeout = () => {}
      req.destroy = () => {}
      return req
    }
    process.env.SILICONFLOW_API_KEY = 'sk-siliconflow-real-looking-test-key'
    process.env.DEEPSEEK_API_KEY = 'sk-deepseek-real-looking-test-key'
    const deepseek = await request(baseUrl, { message: '棉花什么时候打顶', language: 'zh' })
    https.request = originalRequest
    process.env.SILICONFLOW_API_KEY = ''
    process.env.DEEPSEEK_API_KEY = ''
    assert.strictEqual(deepseek.json.data.provider, 'deepseek')
    assert.strictEqual(deepseek.json.data.model, 'deepseek-chat')
    assert.strictEqual(capturedRequest.hostname, 'api.deepseek.com')

    console.log('ai route tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
