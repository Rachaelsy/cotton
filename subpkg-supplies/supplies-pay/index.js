// subpkg-supplies/supplies-pay/index.js — 待付款页
const app  = getApp()
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    orders: [],
    grandTotal: '0',
    countdownStr: '30:00',
    secondsLeft: 30 * 60,
    expired: false,
    paying: false,
    cancelling: false
  },

  _timer: null,

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })

    const raw = app.globalData.currentOrders || []
    if (!raw.length) { wx.navigateBack(); return }

    const grandTotal = raw.reduce((s, o) => s + (o.total || 0), 0)
    const orders = raw.map(o => ({
      orderId:   o.orderId,
      orderNo:   o.orderNo || '',
      store:     o.store || '未知商家',
      total:     String(o.total || 0),
      itemCount: (o.items || []).length,
      firstItem: (o.items || [])[0] || {}
    }))

    // 若订单携带真实截止时间（从 my-orders 进入），用剩余秒数覆盖默认值
    let secondsLeft = 30 * 60
    const now = Date.now()
    raw.forEach(o => {
      if (o.payExpiresAt) {
        const left = Math.floor((new Date(o.payExpiresAt).getTime() - now) / 1000)
        if (left < secondsLeft) secondsLeft = left
      }
    })
    secondsLeft = Math.max(0, secondsLeft)
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
    const ss = String(secondsLeft % 60).padStart(2, '0')

    this.setData({ orders, grandTotal: String(grandTotal), secondsLeft, countdownStr: `${mm}:${ss}` })
    if (secondsLeft <= 0) {
      this.setData({ expired: true })
    } else {
      this._startCountdown()
    }
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer)
  },

  _startCountdown() {
    this._timer = setInterval(() => {
      const left = this.data.secondsLeft - 1
      if (left <= 0) {
        clearInterval(this._timer)
        this.setData({ secondsLeft: 0, countdownStr: '00:00', expired: true })
        wx.showModal({
          title: '订单已超时',
          content: '超过30分钟未付款，订单已自动取消，库存已释放',
          showCancel: false,
          confirmText: '知道了',
          success: () => wx.redirectTo({ url: '/subpkg-supplies/my-orders/index' })
        })
        return
      }
      const mm = String(Math.floor(left / 60)).padStart(2, '0')
      const ss = String(left % 60).padStart(2, '0')
      this.setData({ secondsLeft: left, countdownStr: `${mm}:${ss}` })
    }, 1000)
  },

  async onPay() {
    if (this.data.paying || this.data.expired) return
    this.setData({ paying: true })

    const orders = app.globalData.currentOrders || []
    let allOk = true
    for (const o of orders) {
      if (!o.orderId) continue
      try {
        const prepay = await auth.request('POST', '/api/pay/wechat/prepay', {
          orderType: 'supply',
          orderId: o.orderId
        })
        if (prepay.code !== 200 || !(prepay.data && prepay.data.payParams)) {
          wx.showToast({ title: prepay.msg || '微信支付暂不可用', icon: 'none' })
          allOk = false
          break
        }
        await this._requestPayment(prepay.data.payParams)
        const confirm = await auth.request('POST', '/api/pay/wechat/confirm', {
          orderType: 'supply',
          orderId: o.orderId
        })
        if (confirm.code !== 200) throw new Error(confirm.msg || '支付状态同步失败')
      } catch {
        wx.showToast({ title: '支付未完成', icon: 'none' })
        allOk = false
        break
      }
    }

    this.setData({ paying: false })
    if (allOk) {
      if (this._timer) clearInterval(this._timer)
      wx.redirectTo({ url: '/subpkg-supplies/supplies-pay-success/index' })
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

  async onCancel() {
    if (this.data.cancelling) return
    const confirmed = await new Promise(resolve =>
      wx.showModal({
        title: '取消订单',
        content: '确定取消所有订单吗？库存将立即恢复。',
        confirmText: '确认取消',
        confirmColor: '#FF3B30',
        success: r => resolve(r.confirm)
      })
    )
    if (!confirmed) return

    this.setData({ cancelling: true })
    const orders = app.globalData.currentOrders || []
    for (const o of orders) {
      if (!o.orderId) continue
      await auth.request('PATCH', `/api/orders/${o.orderId}/cancel`, {}).catch(() => {})
    }
    if (this._timer) clearInterval(this._timer)
    app.globalData.currentOrders = []
    this.setData({ cancelling: false })
    wx.redirectTo({ url: '/subpkg-supplies/my-orders/index' })
  }
})
