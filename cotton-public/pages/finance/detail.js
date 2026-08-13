const auth = require('../../utils/auth')
const { articles, sourceGuides, getArticle } = require('../../utils/finance-data')

function getReadStorageKey() {
  const user = auth.getUser && auth.getUser()
  const identity = user && (user.id || user.phone)
  return `cotton_finance_read_${identity || 'guest'}`
}

Page({
  data: {
    article: {},
    sources: [],
    relatedArticles: [],
    hasRead: false
  },

  onLoad(options) {
    const article = getArticle(options.id)
    const readIds = wx.getStorageSync(getReadStorageKey()) || []
    const safeReadIds = Array.isArray(readIds) ? readIds : []
    this.setData({
      article,
      sources: sourceGuides[article.category] || [],
      hasRead: safeReadIds.includes(article.id),
      relatedArticles: articles.filter(item => item.id !== article.id).slice(0, 2)
    })
  },

  back() {
    wx.navigateBack({ fail: () => wx.navigateTo({ url: '/pages/finance/index' }) })
  },

  markRead() {
    const key = getReadStorageKey()
    const stored = wx.getStorageSync(key) || []
    const readIds = Array.isArray(stored) ? stored : []
    if (!readIds.includes(this.data.article.id)) readIds.push(this.data.article.id)
    wx.setStorageSync(key, readIds)
    this.setData({ hasRead: true })
    wx.showToast({ title: '已加入已读', icon: 'success' })
  },

  showChannels() {
    const channels = this.data.article.channels || []
    wx.showModal({
      title: '官方入口指引',
      content: channels.map((item, index) => `${index + 1}. ${item}`).join('\n'),
      confirmText: '复制清单',
      cancelText: '关闭',
      success: result => {
        if (result.confirm) this.copyChannels()
      }
    })
  },

  copyChannels() {
    const article = this.data.article
    const content = [`${article.title}—官方入口核验清单`]
      .concat((article.channels || []).map((item, index) => `${index + 1}. ${item}`))
      .concat(['提示：只通过官方渠道核验，不向个人账户缴费或转账。'])
      .join('\n')
    wx.setClipboardData({ data: content })
  },

  copySource(e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.url })
  },

  openArticle(e) {
    wx.redirectTo({ url: `/pages/finance/detail?id=${e.currentTarget.dataset.id}` })
  },

  openPolicyCenter() {
    wx.navigateTo({ url: '/pages/policy/index' })
  },

  onShareAppMessage() {
    return { title: this.data.article.title || '优棉金融知识服务', path: `/pages/finance/detail?id=${this.data.article.id}` }
  }
})
