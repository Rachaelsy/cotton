const assert = require('assert')
const express = require('express')
const { EventEmitter } = require('events')
const https = require('https')
const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const { detectAiIntent } = require('../utils/ai-intent')

const serverDir = path.join(__dirname, '..')
const routeSource = fs.readFileSync(path.join(serverDir, 'routes', 'ai.js'), 'utf8')
assert.ok(fs.existsSync(path.join(serverDir, 'utils', 'ai-intent.js')))
assert.ok(routeSource.includes("require('../utils/ai-intent')"))

process.env.GROQ_API_KEY = ''
process.env.SILICONFLOW_API_KEY = ''
process.env.DEEPSEEK_API_KEY = ''
process.env.JWT_SECRET = 'ai-route-test-secret'

const aiRouter = require('../routes/ai')

async function requestChat(baseUrl, body) {
  const response = await fetch(baseUrl + '/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { status: response.status, json: await response.json() }
}

async function requestPhoto(baseUrl, token = '') {
  const form = new FormData()
  form.append('photo', new Blob(['fake-image-bytes'], { type: 'image/jpeg' }), 'leaf.jpg')
  const response = await fetch(baseUrl + '/api/ai/photo', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  })
  return { status: response.status, json: await response.json() }
}

function mockHttpsWithBodies(bodies, capture) {
  const originalRequest = https.request
  let index = 0
  https.request = (options, callback) => {
    capture.push(options)
    const req = new EventEmitter()
    req.write = () => {}
    req.end = () => {
      const response = new EventEmitter()
      response.statusCode = 200
      process.nextTick(() => {
        callback(response)
        response.emit('data', JSON.stringify(bodies[index++] || bodies[bodies.length - 1]))
        response.emit('end')
      })
    }
    req.setTimeout = () => {}
    req.destroy = () => {}
    return req
  }
  return () => {
    https.request = originalRequest
  }
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
  app.use('/uploads', express.static(path.join(serverDir, 'public', 'uploads')))
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = 'http://127.0.0.1:' + server.address().port

  try {
    const command = await requestChat(baseUrl, { message: '我要卖棉花', language: 'zh' })
    assert.strictEqual(command.status, 200)
    assert.strictEqual(command.json.code, 200)
    assert.strictEqual(command.json.data.intent.key, 'trade')
    assert.strictEqual(command.json.data.jump.url, '/pages/trade/index')
    assert.strictEqual(command.json.data.provider, 'local-intent')

    const normal = await requestChat(baseUrl, { message: '棉花什么时候打顶', language: 'zh' })
    assert.strictEqual(normal.status, 200)
    assert.strictEqual(normal.json.code, 200)
    assert.strictEqual(normal.json.data.jump, null)
    assert.match(normal.json.data.reply, /AI 文本接口/)

    process.env.SILICONFLOW_API_KEY = 'sk-siliconflow-test-key'
    process.env.DEEPSEEK_API_KEY = 'sk-deepseek-test-key'

    const captures = []
    const restore = mockHttpsWithBodies([
      { choices: [{ message: { content: 'DeepSeek test reply' } }] },
      {
        choices: [{ message: { content: JSON.stringify({
          diagnosis_name: '棉蚜',
          category: '虫害',
          severity: '中度',
          confidence: '高',
          summary: '叶背可见密集小虫体，疑似棉蚜。',
          symptoms: ['叶背聚集小型虫体', '叶片轻微卷曲'],
          evidence: ['虫体集中在嫩叶背面'],
          actions: ['优先检查虫口密度', '重点喷施叶背'],
          products: [{ name: '吡虫啉', usage: '按标签稀释后喷施', note: '避开高温时段' }],
          warning: '若天敌较多，可先小范围处理。'
        }) } }]
      }
    ], captures)

    const deepseek = await requestChat(baseUrl, { message: '棉花什么时候打顶', language: 'zh' })
    assert.strictEqual(deepseek.json.data.provider, 'deepseek')
    assert.strictEqual(deepseek.json.data.model, 'deepseek-chat')
    assert.strictEqual(captures[0].hostname, 'api.deepseek.com')

    const unauthorizedPhoto = await requestPhoto(baseUrl)
    assert.strictEqual(unauthorizedPhoto.status, 401)

    const token = jwt.sign({ id: 42, role: 'farmer' }, process.env.JWT_SECRET)
    const photo = await requestPhoto(baseUrl, token)
    restore()
    process.env.SILICONFLOW_API_KEY = ''
    process.env.DEEPSEEK_API_KEY = ''

    assert.strictEqual(photo.status, 200)
    assert.strictEqual(photo.json.code, 200)
    assert.strictEqual(photo.json.data.provider, 'siliconflow')
    assert.strictEqual(photo.json.data.diagnosis.diagnosis_name, '棉蚜')
    assert.strictEqual(photo.json.data.diagnosis.category_code, 'pest')
    assert.strictEqual(photo.json.data.diagnosis.severity_code, 'medium')
    assert.ok(photo.json.data.image_url.startsWith('/uploads/pest/'))
    assert.match(photo.json.data.reply, /棉蚜/)
    assert.strictEqual(captures[1].hostname, 'api.siliconflow.com')

    console.log('ai route tests passed')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
