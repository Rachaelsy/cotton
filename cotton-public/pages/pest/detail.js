const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')
const auth = require('../../utils/auth')
const { getPestCopy } = require('../../utils/pest-copy')

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    copy: getPestCopy('detail', i18n.getLanguage()),
    pest: {},
    loading: true,
    errorText: ''
  },

  onLoad(options = {}) {
    const sysInfo = wx.getSystemInfoSync()
    this.pestId = options.id
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight()
    })
    this.loadDetail()
  },

  onShow() {
    this.setData({ copy: getPestCopy('detail', i18n.getLanguage()) })
  },

  async loadDetail() {
    if (!this.pestId) {
      this.setData({ loading: false, errorText: '缺少病虫害知识编号' })
      return
    }
    this.setData({ loading: true, errorText: '' })
    try {
      const payload = await auth.request('GET', `/api/pest-knowledge/${this.pestId}`)
      if (!payload || payload.code !== 200 || !payload.data) throw new Error((payload && payload.msg) || '知识详情加载失败')
      const copy = getPestCopy('detail', i18n.getLanguage())
      const item = payload.data
      const coverUrl = item.coverUrl && item.coverUrl.startsWith('/') ? `${auth.BASE_URL}${item.coverUrl}` : item.coverUrl
      this.setData({
        copy,
        pest: {
          ...item,
          coverUrl,
          type: (copy.categoryLabels && copy.categoryLabels[item.category]) || item.categoryName || '病虫害'
        },
        loading: false
      })
    } catch (error) {
      console.error('[pest-knowledge-detail]', error)
      this.setData({ loading: false, errorText: error.message || '病虫害知识详情加载失败' })
    }
  },

  onRetry() { this.loadDetail() },
  onBack() { wx.navigateBack() },

  onShareAppMessage() {
    return {
      title: this.data.pest.name || '病虫害知识',
      path: `/pages/pest/detail?id=${this.pestId}`
    }
  }
})
