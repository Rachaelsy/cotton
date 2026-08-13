const express = require('express')

const router = express.Router()
const DEFAULT_QUOTE_URL = 'https://hq.sinajs.cn/list=nf_CF0'
const CACHE_MS = 30 * 1000
const REQUEST_TIMEOUT_MS = 5000
let cache = null

function numberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function decodeBuffer(buffer) {
  try {
    return new TextDecoder('gbk').decode(buffer)
  } catch (_) {
    return Buffer.from(buffer).toString('utf8')
  }
}

function parseSinaQuote(text, fetchedAt = new Date()) {
  const matched = String(text || '').match(/="([\s\S]*?)"/)
  if (!matched || !matched[1]) throw new Error('行情源返回内容为空')
  const fields = matched[1].split(',').map(item => item.trim())
  // 新浪商品期货连续行情字段：名称、时间、开、高、低、昨收、买、卖、最新、
  // 结算、昨结、买量、卖量、成交量、持仓量、交易所、品种、日期。
  const last = numberValue(fields[8])
  const previousSettlement = numberValue(fields[10])
  if (!last) throw new Error('行情源未返回有效价格')

  const change = previousSettlement ? round(last - previousSettlement) : null
  const changePercent = previousSettlement ? round(change / previousSettlement * 100) : null
  const date = fields.find(value => /^20\d{2}-\d{2}-\d{2}$/.test(value)) || ''
  const rawTime = fields[1] || ''
  const time = /^\d{6}$/.test(rawTime)
    ? `${rawTime.slice(0, 2)}:${rawTime.slice(2, 4)}:${rawTime.slice(4, 6)}`
    : (fields.find(value => /^\d{2}:\d{2}:\d{2}$/.test(value)) || '')
  const providerTime = date ? `${date}${time ? ` ${time}` : ''}` : ''

  return {
    symbol: 'CF0',
    contract: '棉花主力连续',
    exchange: '郑州商品交易所',
    price: last,
    unit: '元/吨',
    change,
    changePercent,
    open: numberValue(fields[2]),
    high: numberValue(fields[3]),
    low: numberValue(fields[4]),
    previousSettlement,
    providerTime,
    fetchedAt: fetchedAt.toISOString(),
    source: '新浪财经公开行情',
    sourceUrl: 'https://finance.sina.com.cn/money/future/quote.html?code=CF0',
    delayNotice: '公开行情可能延迟，请以郑州商品交易所及持牌机构终端为准',
    available: true
  }
}

function parseCustomQuote(payload, fetchedAt = new Date()) {
  const input = payload && payload.data ? payload.data : payload
  const price = numberValue(input && input.price)
  if (!price) throw new Error('自定义行情源未返回有效 price')
  const previousSettlement = numberValue(input.previousSettlement || input.previous_settlement || input.preSettlement)
  const change = input.change == null
    ? (previousSettlement ? round(price - previousSettlement) : null)
    : Number(input.change)
  const changePercent = input.changePercent == null
    ? (previousSettlement ? round((price - previousSettlement) / previousSettlement * 100) : null)
    : Number(input.changePercent)
  return {
    symbol: String(input.symbol || 'CF0'),
    contract: String(input.contract || '棉花主力连续'),
    exchange: String(input.exchange || '郑州商品交易所'),
    price,
    unit: String(input.unit || '元/吨'),
    change: Number.isFinite(change) ? round(change) : null,
    changePercent: Number.isFinite(changePercent) ? round(changePercent) : null,
    open: numberValue(input.open),
    high: numberValue(input.high),
    low: numberValue(input.low),
    previousSettlement,
    providerTime: String(input.providerTime || input.updatedAt || ''),
    fetchedAt: fetchedAt.toISOString(),
    source: String(input.source || process.env.FINANCE_QUOTE_SOURCE || '授权行情服务'),
    sourceUrl: String(input.sourceUrl || ''),
    delayNotice: String(input.delayNotice || '行情仅供信息参考，请以交易所及持牌机构终端为准'),
    available: true
  }
}

async function fetchQuote() {
  const now = new Date()
  const provider = String(process.env.FINANCE_QUOTE_PROVIDER || 'sina').toLowerCase()
  const url = String(process.env.FINANCE_QUOTE_URL || (provider === 'sina' ? DEFAULT_QUOTE_URL : '')).trim()
  if (!url || !/^https:\/\//i.test(url)) throw new Error('未配置有效的 HTTPS 行情源')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: provider === 'sina' ? { Referer: 'https://finance.sina.com.cn/' } : {},
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`行情源请求失败（${response.status}）`)
    if (provider === 'sina') return parseSinaQuote(decodeBuffer(await response.arrayBuffer()), now)
    return parseCustomQuote(await response.json(), now)
  } finally {
    clearTimeout(timer)
  }
}

router.get('/cotton-futures', async (_req, res) => {
  const now = Date.now()
  if (cache && now - cache.cachedAt < CACHE_MS) {
    res.set('Cache-Control', 'public, max-age=15')
    return res.json({ code: 200, msg: 'ok', data: cache.quote })
  }
  try {
    const quote = await fetchQuote()
    cache = { cachedAt: now, quote }
    res.set('Cache-Control', 'public, max-age=15')
    return res.json({ code: 200, msg: 'ok', data: quote })
  } catch (error) {
    console.error('[cotton-futures]', error.message)
    if (cache && cache.quote) {
      return res.json({
        code: 200,
        msg: '行情源暂时不可用，当前显示最近一次成功数据',
        data: { ...cache.quote, stale: true, delayNotice: '行情源暂时不可用，当前为缓存数据，请勿作为交易依据' }
      })
    }
    return res.status(503).json({
      code: 503,
      msg: '棉花期货行情暂不可用，请稍后刷新',
      data: { available: false, source: '', delayNotice: '未显示任何估算或虚构价格' }
    })
  }
})

module.exports = router
module.exports.parseSinaQuote = parseSinaQuote
module.exports.parseCustomQuote = parseCustomQuote
