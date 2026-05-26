// pages/supplies-pay-success/index.js
const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    firstItem: {},
    moreCount: 0,
    orderNo: '',
    totalAmount: '0',
    payMethodLabel: '微信支付',
    createTimeStr: ''
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })

    const order = app.globalData.currentOrder
    if (!order) return

    const items = order.items || []
    const firstItem = items[0] || {}
    const payLabels = { alipay: '支付宝', wechat: '微信支付', bank: '银行卡' }

    const no = order.orderId
      ? order.orderId.slice(-10).toUpperCase()
      : 'MG' + Date.now().toString().slice(-10)

    const d = new Date(order.createTime || Date.now())
    const pad = n => String(n).padStart(2, '0')
    const createTimeStr = `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`

    this.setData({
      firstItem,
      moreCount: items.length - 1,
      orderNo: no,
      totalAmount: String(order.total || 0),
      payMethodLabel: payLabels[order.payMethod] || '微信支付',
      createTimeStr
    })
  },

  onCopyNo() {
    wx.setClipboardData({
      data: this.data.orderNo,
      success: () => wx.showToast({ title: '已复制', icon: 'success', duration: 1000 })
    })
  },

  onViewOrder() {
    wx.redirectTo({ url: '/pages/supplies-order/index' })
  },

  onHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
