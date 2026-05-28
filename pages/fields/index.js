// pages/fields/index.js — 地块管理列表
const app  = getApp()
const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    loading: true,
    totalCount: 0,
    totalArea: '0',
    attentionCount: 0,
    warnFields: [],
    okFields: []
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    this._load()
  },

  async _load() {
    this.setData({ loading: true })
    try {
      const res = await auth.request('GET', '/api/plots')
      if (res.code === 200) {
        const plots = (res.data || []).map(p => this._format(p))
        const totalArea = plots.reduce((s, p) => s + parseFloat(p.area || 0), 0)
        const warn = plots.filter(p => p.status === 'attention')
        const ok   = plots.filter(p => p.status !== 'attention')
        this.setData({
          loading: false,
          totalCount:     plots.length,
          totalArea:      totalArea.toFixed(0),
          attentionCount: warn.length,
          warnFields: warn,
          okFields:   ok
        })
      } else {
        this.setData({ loading: false })
      }
    } catch {
      this.setData({ loading: false })
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  _format(p) {
    const score = p.health_score || 100
    let scoreCls = 'excel'
    if (score < 75) scoreCls = 'warn'
    else if (score < 88) scoreCls = 'good'

    let tagText = ''
    let tagType = 'ok'
    if (p.status === 'attention') {
      tagText = p.health_issue || '需关注'
      tagType = 'warn'
    } else if (score >= 90) {
      tagText = '长势优'
    } else if (score >= 80) {
      tagText = '长势良好'
    } else {
      tagText = '长势正常'
    }

    const date = p.updated_at
      ? new Date(p.updated_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + '日'
      : ''

    return { ...p, scoreCls, tagText, tagType, date }
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  },

  onFieldDetail(e) {
    const id = e.currentTarget.dataset.id
    app.globalData.currentPlot = [...this.data.warnFields, ...this.data.okFields].find(p => p.id === id)
    wx.navigateTo({ url: `/pages/fields/detail?id=${id}` })
  },

  onAddField() {
    wx.navigateTo({ url: '/pages/fields/draw' })
  }
})
