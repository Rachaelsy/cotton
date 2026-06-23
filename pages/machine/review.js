// pages/machine/review.js — 农机服务评价（分项）
const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    orderId: null,
    dims: [
      { key: 'score_timely',   label: '及时性',   score: 5 },
      { key: 'score_quality',  label: '作业质量', score: 5 },
      { key: 'score_attitude', label: '服务态度', score: 5 },
      { key: 'score_price',    label: '价格合理', score: 5 }
    ],
    stars: [1, 2, 3, 4, 5],
    content: '',
    submitting: false
  },

  onLoad(query) {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, orderId: query.id })
  },

  onStar(e) {
    const { dim, val } = e.currentTarget.dataset
    const dims = this.data.dims.map(d => d.key === dim ? { ...d, score: Number(val) } : d)
    this.setData({ dims })
  },

  onContent(e) { this.setData({ content: e.detail.value }) },

  async onSubmit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    const body = { content: this.data.content }
    this.data.dims.forEach(d => { body[d.key] = d.score })
    try {
      const res = await auth.request('POST', `/api/machine-orders/${this.data.orderId}/review`, body)
      if (res.code === 200) {
        wx.showToast({ title: '评价成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1200)
      } else {
        this.setData({ submitting: false })
        wx.showToast({ title: res.msg || '评价失败', icon: 'none' })
      }
    } catch (e) {
      this.setData({ submitting: false })
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  onBack() { wx.navigateBack() }
})
