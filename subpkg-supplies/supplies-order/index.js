// pages/supplies-order/index.js — 订单详情
const app  = getApp()
const auth = require('../../utils/auth')

// DB status → 中文状态
const DB_STATUS_MAP = {
  pending_ship: '待发货',
  shipped:      '已发货',
  completed:    '已完成',
  refund:       '售后中'
}

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
  },
  '售后中': {
    icon: '🔄',
    label: '售后中',
    sub: '退款/售后处理中，请耐心等待',
    stepIndex: 1,
    shipped: false
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
    shipped: false,
    canConfirmReceipt: false,
    isCompleted: false,
    showSuccessPopup: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this._loadOrder()
  },

  onShow() {
    this._loadOrder()
  },

  async _loadOrder() {
    const saved = app.globalData.currentOrder || {}
    let order = { ...saved }

    // 每次展示都从 API 刷新最新状态，避免发货后本地缓存仍显示旧值
    if (saved.orderId) {
      try {
        const res = await auth.request('GET', '/api/orders/my')
        if (res.code === 200 && Array.isArray(res.data)) {
          const fresh = res.data.find(o => String(o.id) === String(saved.orderId))
          if (fresh) {
            order.status      = DB_STATUS_MAP[fresh.status] || '待发货'
            order.logisticsNo = fresh.logistics_no || ''
          }
        }
      } catch (e) {
        // 网络异常时保持本地缓存数据，不阻断页面展示
      }
    }

    const payLabels = { alipay: '支付宝', wechat: '微信支付', bank: '银行卡' }
    const no = order.orderNo
      || (order.orderId ? String(order.orderId).slice(-10).toUpperCase()
                        : 'MG' + Date.now().toString().slice(-10))

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
      shipped: cfg.shipped,
      canConfirmReceipt: status === '已发货',
      isCompleted:       status === '已完成'
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
    const orderId = this.data.order.orderId
    wx.navigateTo({ url: `/subpkg-supplies/supplies-aftersale/index?order_id=${orderId}` })
  },

  onConfirmReceipt() {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品？确认后订单将完成，无法申请退款。',
      confirmText: '确认收货',
      confirmColor: '#16A34A',
      cancelText: '再等等',
      success: async (res) => {
        if (!res.confirm) return
        const orderId = this.data.order.orderId
        if (!orderId) return
        try {
          const result = await auth.request('PATCH', `/api/orders/${orderId}/confirm`)
          if (result.code === 200) {
            await this._loadOrder()
            this.setData({ showSuccessPopup: true })
          } else {
            wx.showToast({ title: result.msg || '操作失败', icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '网络异常，请重试', icon: 'none' })
        }
      }
    })
  },

  onCloseSuccessPopup() {
    this.setData({ showSuccessPopup: false })
  },

  onReview() {
    wx.showToast({ title: '评价功能开发中', icon: 'none' })
  },

  onLogistics() {
    if (!this.data.shipped) {
      wx.showToast({ title: '商家尚未发货', icon: 'none', duration: 1500 })
      return
    }
    const no = this.data.order.logisticsNo
    if (no) {
      wx.showModal({
        title: '物流信息',
        content: `物流单号：${no}\n\n可复制单号至快递平台查询物流详情`,
        confirmText: '复制单号',
        cancelText: '关闭',
        success: (r) => {
          if (r.confirm) wx.setClipboardData({ data: no })
        }
      })
    } else {
      wx.showToast({ title: '商家暂未填写物流单号', icon: 'none' })
    }
  }
})
