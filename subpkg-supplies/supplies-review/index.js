// subpkg-supplies/supplies-review/index.js — 买家评价
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    orderId: null,
    orderNo: '',
    items: [],
    rating: 0,
    content: '',
    isAnonymous: false,
    submitting: false,
    submitted: false
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      orderId:  options.order_id || null,
      orderNo:  options.order_no  || '',
      items:    options.items ? JSON.parse(decodeURIComponent(options.items)) : []
    })
  },

  onStarTap(e) {
    this.setData({ rating: parseInt(e.currentTarget.dataset.val) })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  onAnonymousChange(e) {
    this.setData({ isAnonymous: e.detail.value })
  },

  async onSubmit() {
    if (!this.data.rating) {
      wx.showToast({ title: '请先选择星级', icon: 'none' }); return
    }
    if (this.data.submitting) return
    this.setData({ submitting: true })
    try {
      const res = await auth.request('POST', `/api/orders/${this.data.orderId}/review`, {
        rating:       this.data.rating,
        content:      this.data.content.trim(),
        is_anonymous: this.data.isAnonymous
      })
      if (res.code === 200) {
        this.setData({ submitted: true })
      } else {
        wx.showToast({ title: res.msg || '提交失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
    this.setData({ submitting: false })
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/my/index' })
  },

  onDone() {
    wx.navigateBack()
  }
})
