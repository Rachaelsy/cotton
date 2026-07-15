// pages/machine/pay.js — 农机预约微信支付
const app  = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const machineI18n = require('../../utils/machine-i18n')

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: machineI18n.getCopy('pay'),
    orderId: null,
    order: null,
    payMode: 'deposit',  // deposit | full
    paymentStage: 'deposit',
    balanceAmount: '0.00',
    paying: false
  },

  onLoad(query) {
    const info = wx.getSystemInfoSync()
    const order = app.globalData.machineOrder || null
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      orderId: query.id,
      order,
      balanceAmount: order ? Math.max(0, Number(order.total_price || 0) - Number(order.deposit || 0)).toFixed(2) : '0.00',
      paymentStage: query.stage === 'balance' ? 'balance' : (query.mode === 'full' ? 'full' : 'deposit'),
      payMode: query.stage === 'balance' ? 'balance' : (query.mode === 'full' ? 'full' : 'deposit')
    })
    if (!order) this.loadOrder()
  },

  onShow() {
    const lang = i18n.getLanguage()
    if (lang !== this.data.lang) this.setData({ lang, copy: machineI18n.getCopy('pay', lang) })
  },

  async loadOrder() {
    try {
      const res = await auth.request('GET', `/api/machine-orders/${this.data.orderId}`)
      if (res.code !== 200) throw new Error(res.msg || this.data.copy.loadFail)
      const order = res.data
      this.setData({
        order,
        balanceAmount: Math.max(0, Number(order.total_price || 0) - Number(order.deposit_paid_amount || order.deposit || 0)).toFixed(2)
      })
    } catch (error) {
      wx.showToast({ title: error.message || this.data.copy.loadFail, icon: 'none' })
    }
  },

  onPayMode(e) {
    if (this.data.paymentStage === 'balance') return
    const mode = e.currentTarget.dataset.mode
    this.setData({ payMode: mode, paymentStage: mode })
  },

  async onPay() {
    if (this.data.paying) return
    this.setData({ paying: true })
    try {
      const prepay = await auth.request('POST', '/api/pay/wechat/prepay', {
        orderType: 'machine',
        orderId: this.data.orderId,
        payMode: this.data.payMode,
        paymentStage: this.data.paymentStage
      })
      if (prepay.code !== 200 || !(prepay.data && prepay.data.payParams)) {
        throw new Error(prepay.msg || this.data.copy.unavailable)
      }
      await this._requestPayment(prepay.data.payParams)
      const confirm = await auth.request('POST', '/api/pay/wechat/confirm', {
        orderType: 'machine',
        orderId: this.data.orderId,
        paymentStage: this.data.paymentStage
      })
      if (confirm.code !== 200) throw new Error(confirm.msg || this.data.copy.syncFail)
      wx.showToast({ title: this.data.copy.success, icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/machine/track?id=${this.data.orderId}` })
      }, 1200)
    } catch (e) {
      this.setData({ paying: false })
      wx.showToast({ title: e.message || this.data.copy.incomplete, icon: 'none' })
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
