// pages/machine/track.js — 订单跟踪
const auth = require('../../utils/auth')

const STEPS = [
  { key: 'pending',   label: '待接单' },
  { key: 'accepted',  label: '已接单' },
  { key: 'departed',  label: '已出发' },
  { key: 'arrived',   label: '已到场' },
  { key: 'working',   label: '作业中' },
  { key: 'completed', label: '已完成' }
]

Page({
  data: {
    statusBarHeight: 20,
    orderId: null,
    order: null,
    steps: STEPS,
    stepIndex: 0,
    cancelled: false,
    loading: true
  },

  onLoad(query) {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, orderId: query.id })
  },

  onShow() {
    if (this.data.orderId) this.loadOrder()
  },

  async loadOrder() {
    try {
      const res = await auth.request('GET', `/api/machine-orders/${this.data.orderId}`)
      if (res.code === 200) {
        const o = res.data
        const cancelled = o.status === 'cancelled'
        const stepIndex = STEPS.findIndex(s => s.key === o.status)
        this.setData({
          order: o, cancelled,
          stepIndex: stepIndex < 0 ? 0 : stepIndex,
          loading: false
        })
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: res.msg || '加载失败', icon: 'none' })
      }
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  onContact() {
    const o = this.data.order
    if (o && o.operator_phone) wx.makePhoneCall({ phoneNumber: o.operator_phone, fail: () => {} })
    else wx.showToast({ title: '暂无联系电话', icon: 'none' })
  },

  onCancel() {
    wx.showModal({
      title: '取消预约', content: '确定取消该预约吗？定金将原路退回。',
      confirmColor: '#DC2626',
      success: async (r) => {
        if (!r.confirm) return
        try {
          const res = await auth.request('PATCH', `/api/machine-orders/${this.data.orderId}/cancel`, {})
          if (res.code === 200) { wx.showToast({ title: '已取消', icon: 'none' }); this.loadOrder() }
          else wx.showToast({ title: res.msg || '取消失败', icon: 'none' })
        } catch (e) { wx.showToast({ title: '网络异常', icon: 'none' }) }
      }
    })
  },

  onReview() {
    wx.navigateTo({ url: `/pages/machine/review?id=${this.data.orderId}` })
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.redirectTo({ url: '/subpkg-supplies/my-orders/index' })
  }
})
