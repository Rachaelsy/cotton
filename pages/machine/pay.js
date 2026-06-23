// pages/machine/pay.js — 农机预约支付（模拟）
const app  = getApp()
const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    orderId: null,
    order: null,
    payMode: 'deposit',  // deposit | full
    paying: false
  },

  onLoad(query) {
    const info = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      orderId: query.id,
      order: app.globalData.machineOrder || null
    })
  },

  onPayMode(e) { this.setData({ payMode: e.currentTarget.dataset.mode }) },

  async onPay() {
    if (this.data.paying) return
    this.setData({ paying: true })
    try {
      const res = await auth.request('PATCH', `/api/machine-orders/${this.data.orderId}/pay`, {})
      if (res.code === 200) {
        wx.showToast({ title: '支付成功', icon: 'success' })
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/machine/track?id=${this.data.orderId}` })
        }, 1200)
      } else {
        this.setData({ paying: false })
        wx.showToast({ title: res.msg || '支付失败', icon: 'none' })
      }
    } catch (e) {
      this.setData({ paying: false })
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  onBack() { wx.navigateBack() }
})
