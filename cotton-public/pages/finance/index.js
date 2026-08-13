const auth = require('../../utils/auth')
const { categories, articles } = require('../../utils/finance-data')

function getReadStorageKey() {
  const user = auth.getUser && auth.getUser()
  const identity = user && (user.id || user.phone)
  return `cotton_finance_read_${identity || 'guest'}`
}

function signedText(value, suffix = '') {
  const number = Number(value)
  if (!Number.isFinite(number)) return '--'
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}${suffix}`
}

function priceText(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '--'
}

function timeText(value) {
  if (!value) return '更新时间待获取'
  const raw = String(value).replace('T', ' ').replace(/\.\d{3}Z$/, '')
  return raw.length > 19 ? raw.slice(0, 19) : raw
}

Page({
  data: {
    categories,
    statusBarHeight: 20,
    readCount: 0,
    totalCount: articles.length,
    quoteLoading: true,
    quoteError: '',
    quote: {
      available: false, priceText: '--', changeText: '--', percentText: '--',
      trendClass: 'flat', contract: '棉花主力连续', unit: '元/吨',
      openText: '--', highText: '--', lowText: '--',
      updatedText: '正在获取行情', source: '', delayNotice: '行情仅供信息参考'
    }
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    const readIds = wx.getStorageSync(getReadStorageKey()) || []
    const readSet = new Set(Array.isArray(readIds) ? readIds : [])
    this.setData({ readCount: articles.filter(item => readSet.has(item.id)).length })
    this.loadQuote()
    this.startQuoteTimer()
  },

  onHide() { this.stopQuoteTimer() },
  onUnload() { this.stopQuoteTimer() },

  startQuoteTimer() {
    this.stopQuoteTimer()
    this.quoteTimer = setInterval(() => this.loadQuote(true), 30000)
  },

  stopQuoteTimer() {
    if (this.quoteTimer) clearInterval(this.quoteTimer)
    this.quoteTimer = null
  },

  async loadQuote(force = false) {
    if (this.quoteRequest && !force) return this.quoteRequest
    this.setData({ quoteLoading: true, quoteError: '' })
    this.quoteRequest = auth.request('GET', '/api/market/cotton-futures')
      .then(res => {
        if (res.code !== 200 || !(res.data && res.data.available)) throw new Error(res.msg || '行情暂不可用')
        const item = res.data
        const change = Number(item.change)
        const trendClass = Number.isFinite(change) ? (change > 0 ? 'up' : change < 0 ? 'down' : 'flat') : 'flat'
        this.setData({
          quoteLoading: false,
          quoteError: '',
          quote: {
            ...item,
            priceText: priceText(item.price),
            changeText: signedText(item.change),
            percentText: signedText(item.changePercent, '%'),
            openText: priceText(item.open),
            highText: priceText(item.high),
            lowText: priceText(item.low),
            trendClass,
            updatedText: timeText(item.providerTime || item.fetchedAt)
          }
        })
      })
      .catch(error => {
        this.setData({
          quoteLoading: false,
          quoteError: error.message || '行情暂不可用',
          quote: {
            available: false, priceText: '--', changeText: '--', percentText: '--', trendClass: 'flat',
            contract: '棉花主力连续', unit: '元/吨', openText: '--', highText: '--', lowText: '--', updatedText: '点击重新获取', source: '',
            delayNotice: '未显示任何估算或虚构价格，请以郑商所及持牌机构终端为准'
          }
        })
      })
      .finally(() => { this.quoteRequest = null })
    return this.quoteRequest
  },

  refreshQuote() { this.loadQuote(true) },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) }) },
  openCategory(event) { wx.navigateTo({ url: `/pages/finance/channel?key=${event.currentTarget.dataset.key}` }) },
  showBoundary() {
    wx.showModal({
      title: '服务边界说明',
      content: '优棉金融提供行情信息、金融知识和官方入口指引，不提供贷款申请、保险销售、期货开户、交易撮合、荐单或收益承诺。行情可能延迟，仅供信息参考。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },
  openPolicyCenter() { wx.navigateTo({ url: '/pages/policy/index' }) },
  onShareAppMessage() { return { title: '优棉金融 · 棉农金融知识与行情参考', path: '/pages/finance/index' } }
})
