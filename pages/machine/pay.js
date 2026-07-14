// pages/machine/pay.js — 农机预约微信支付
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
      const prepay = await auth.request('POST', '/api/pay/wechat/prepay', {
        orderType: 'machine',
        orderId: this.data.orderId,
        payMode: this.data.payMode
      })
      if (prepay.code !== 200 || !(prepay.data && prepay.data.payParams)) {
        throw new Error(prepay.msg || '微信支付暂不可用')
      }
      await this._requestPayment(prepay.data.payParams)
      const confirm = await auth.request('POST', '/api/pay/wechat/confirm', {
        orderType: 'machine',
        orderId: this.data.orderId
      })
      if (confirm.code !== 200) throw new Error(confirm.msg || '支付状态同步失败')
      wx.showToast({ title: '支付成功', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/machine/track?id=${this.data.orderId}` })
      }, 1200)
    } catch (e) {
      this.setData({ paying: false })
      wx.showToast({ title: e.message || '支付未完成', icon: 'none' })
    }
  },

  _requestPayment(payParams) {
    return new Promise((resolve, reject) => {
      wx.requestPayment({
        ...payParams,
        success: resolve,
        fail: reject
      })
    })
  },

  onBack() { wx.navigateBack() }
})
