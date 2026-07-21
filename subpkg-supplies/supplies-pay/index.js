// subpkg-supplies/supplies-pay/index.js — 待付款页
const app  = getApp()
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')
const i18n = require('../../utils/i18n')

const COPY = {
  zh: { title:'待付款',countdown:'请在',countdownEnd:'内完成支付，超时自动取消',expired:'订单已超时，即将自动关闭',goods:'商品',items:'件',orderNo:'订单号',total:'合计应付',cancelling:'取消中…',cancel:'取消订单',paying:'支付中…',pay:'立即支付',mockPay:'模拟支付',mockNotice:'模拟支付已开启，本次不会扣款',unknown:'未知商家',timeoutTitle:'订单已超时',timeoutContent:'超过30分钟未付款，订单已自动取消，库存已释放',know:'知道了',unavailable:'微信支付暂不可用',syncFail:'支付状态同步失败',incomplete:'支付未完成',cancelContent:'确定取消所有订单吗？库存将立即恢复。',cancelConfirm:'确认取消' },
  ug: { title:'تۆلەشنى كۈتۈش',countdown:'',countdownEnd:'ئىچىدە تۆلەڭ، ۋاقىت ئۆتسە ئاپتوماتىك بىكار بولىدۇ',expired:'زاكاز ۋاقتى ئۆتتى، ئاپتوماتىك تاقىلىدۇ',goods:'مەھسۇلات',items:'دانە',orderNo:'زاكاز نومۇرى',total:'جەمئىي تۆلەش',cancelling:'بىكار قىلىۋاتىدۇ…',cancel:'زاكازنى بىكار قىلىش',paying:'تۆلەۋاتىدۇ…',pay:'ھازىر تۆلەش',mockPay:'تەقلىدىي تۆلەش',mockNotice:'تەقلىدىي تۆلەش ئېچىلدى، پۇل تۇتۇلمايدۇ',unknown:'نامەلۇم سودىگەر',timeoutTitle:'زاكاز ۋاقتى ئۆتتى',timeoutContent:'30 مىنۇت ئىچىدە تۆلەنمىگەچكە زاكاز بىكار قىلىندى ۋە مال سانى ئەسلىگە كەلدى',know:'بىلدىم',unavailable:'WeChat تۆلەشنى ئىشلەتكىلى بولمايدۇ',syncFail:'تۆلەش ھالىتى ماسلاشمىدى',incomplete:'تۆلەش تاماملانمىدى',cancelContent:'بارلىق زاكاز بىكار قىلىنسۇنمۇ؟ مال سانى ئەسلىگە كېلىدۇ.',cancelConfirm:'بىكار قىلىش' }
}

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: COPY[i18n.getLanguage()],
    capsuleSafeRight: 0,
    orders: [],
    grandTotal: '0',
    countdownStr: '30:00',
    secondsLeft: 30 * 60,
    expired: false,
    mockPayment: false,
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
      store:     o.store || this.data.copy.unknown,
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
    this._loadPaymentMode()
  },

  async _loadPaymentMode() {
    try {
      const result = await auth.request('GET', '/api/pay/wechat/mode')
      this.setData({ mockPayment: !!(result.data && result.data.mock) })
    } catch {
      this.setData({ mockPayment: false })
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
          title: this.data.copy.timeoutTitle,
          content: this.data.copy.timeoutContent,
          showCancel: false,
          confirmText: this.data.copy.know,
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
        if (prepay.code !== 200 || !prepay.data || (!prepay.data.mock && !prepay.data.payParams)) {
          wx.showToast({ title: prepay.msg || this.data.copy.unavailable, icon: 'none' })
          allOk = false
          break
        }
        if (!prepay.data.mock) await this._requestPayment(prepay.data.payParams)
        const confirm = await auth.request('POST', '/api/pay/wechat/confirm', {
          orderType: 'supply',
          orderId: o.orderId
        })
        if (confirm.code !== 200) throw new Error(confirm.msg || this.data.copy.syncFail)
      } catch {
        wx.showToast({ title: this.data.copy.incomplete, icon: 'none' })
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

  onShow() {
    const lang = i18n.getLanguage()
    if (lang !== this.data.lang) this.setData({ lang, copy: COPY[lang] })
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
        title: this.data.copy.cancel,
        content: this.data.copy.cancelContent,
        confirmText: this.data.copy.cancelConfirm,
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
