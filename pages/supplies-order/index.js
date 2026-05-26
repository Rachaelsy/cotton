// pages/supplies-order/index.js — 订单详情
const app = getApp()

const STATUS_CONFIG = {
  '待发货': {
    icon: '📦',
    label: '待发货',
    sub: '商家正在备货，请耐心等待',
    stepIndex: 1,
    shipped: false
  },
  '已发货': {
    icon: '🚚',
    label: '配送中',
    sub: '商品已发出，预计近日送达',
    stepIndex: 2,
    shipped: true
  },
  '已完成': {
    icon: '✅',
    label: '已完成',
    sub: '订单已完成，感谢您的购买',
    stepIndex: 3,
    shipped: true
  }
}

const STEPS = ['已下单', '待发货', '已发货', '已完成']

Page({
  data: {
    statusBarHeight: 20,
    order: {},
    orderNo: '',
    payMethodLabel: '微信支付',
    statusIcon: '📦',
    statusLabel: '待发货',
    statusSub: '商家正在备货，请耐心等待',
    steps: [],
    shipped: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this._loadOrder()
  },

  onShow() {
    this._loadOrder()
  },

  _loadOrder() {
    const order = app.globalData.currentOrder || {}
    const payLabels = { alipay: '支付宝', wechat: '微信支付', bank: '银行卡' }

    const no = order.orderId
      ? order.orderId.slice(-10).toUpperCase()
      : 'MG' + Date.now().toString().slice(-10)

    const status = order.status || '待发货'
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['待发货']

    const stepIndex = cfg.stepIndex
    const steps = STEPS.map((label, i) => ({
      label,
      done: i < stepIndex,
      active: i === stepIndex
    }))

    this.setData({
      order,
      orderNo: no,
      payMethodLabel: payLabels[order.payMethod] || '微信支付',
      statusIcon: cfg.icon,
      statusLabel: cfg.label,
      statusSub: cfg.sub,
      steps,
      shipped: cfg.shipped
    })
  },

  onBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  onCopyNo() {
    wx.setClipboardData({
      data: this.data.orderNo,
      success: () => wx.showToast({ title: '已复制', icon: 'success', duration: 1000 })
    })
  },

  onContact() {
    wx.showModal({
      title: '联系卖家',
      content: '即将拨打卖家电话，是否继续？',
      confirmText: '拨打',
      confirmColor: '#22c55e',
      success(res) {
        if (res.confirm) {
          wx.showToast({ title: '拨打电话功能开发中', icon: 'none' })
        }
      }
    })
  },

  onAfterSale() {
    wx.showModal({
      title: '退款 / 售后',
      content: '申请退款后，商家将在48小时内处理。确认申请？',
      confirmText: '申请退款',
      confirmColor: '#FF3B30',
      success(res) {
        if (res.confirm) {
          wx.showToast({ title: '退款申请已提交', icon: 'success', duration: 1500 })
        }
      }
    })
  },

  onLogistics() {
    if (!this.data.shipped) {
      wx.showToast({ title: '商家尚未发货', icon: 'none', duration: 1500 })
      return
    }
    wx.showToast({ title: '查看物流功能开发中', icon: 'none' })
  }
})
