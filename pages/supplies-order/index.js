// pages/supplies-order/index.js — 订单追踪
const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    timeline: [
      { title: '配送员已到达 疏附县', sub: '王师傅正在前往您的地头，电话 138****5678', time: '今日 10:25' },
      { title: '包裹已到达 喀什市分拨中心', sub: '已出库，预计今日送达', time: '今日 06:40' },
      { title: '包裹已发出', sub: '丰禾农资旗舰店 · 乌鲁木齐仓库', time: '昨日 14:20' },
      { title: '商家已接单', sub: '订单已创建，正在备货中', time: '昨日 09:15' }
    ],
    orderItems: [],
    orderNo: '',
    orderTotal: '0',
    orderTotalWithFee: '10',
    payMethodLabel: '微信支付'
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })

    const order = app.globalData.currentOrder
    if (order) {
      const payLabels = { alipay: '支付宝', wechat: '微信支付', bank: '银行卡' }
      const no = order.orderId
        ? order.orderId.slice(-8).toUpperCase()
        : 'DD' + Date.now().toString().slice(-10)
      this.setData({
        orderItems: order.items || [],
        orderNo: no,
        orderTotal: String(order.subtotal || 0),
        orderTotalWithFee: String(order.total || 10),
        payMethodLabel: payLabels[order.payMethod] || '微信支付'
      })
    }
  },

  onBack() {
    wx.switchTab({ url: '/pages/supplies/index' })
  },

  onMore() {
    wx.showToast({ title: '更多操作开发中', icon: 'none' })
  },

  onDoor() {
    wx.showToast({ title: '已申请配货上门', icon: 'success' })
  },

  onCallDriver() {
    wx.showToast({ title: '拨打电话：138****5678', icon: 'none' })
  },

  onMsgDriver() {
    wx.showToast({ title: '发送消息功能开发中', icon: 'none' })
  },

  onContact() {
    wx.showToast({ title: '正在连接客服...', icon: 'none' })
  },

  onAfterSale() {
    wx.showToast({ title: '售后申请功能开发中', icon: 'none' })
  },

  onConfirmReceive() {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到全部商品？',
      confirmText: '确认收货',
      confirmColor: '#4CAF50',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '已确认收货！感谢购买', icon: 'success', duration: 1500 })
          setTimeout(() => {
            wx.switchTab({ url: '/pages/supplies/index' })
          }, 1500)
        }
      }
    })
  }
})
