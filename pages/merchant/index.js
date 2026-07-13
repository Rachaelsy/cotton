const auth = require('../../utils/auth')

const STATUS_CLS = {
  pending_ship: 'pending', shipped: 'pending',
  completed: 'done', aftersale: 'refund', refund: 'refund', refunded: 'refund'
}
const STATUS_LBL = {
  pending_ship: '待发货', shipped: '已发货',
  completed: '已完成', aftersale: '售后中', refund: '售后中', refunded: '退款成功'
}

Page({
  data: {
    statusBarHeight: 20,
    user: null,
    stats: {
      todayOrders: '--', pendingAmount: '--',
      onSaleCount: '--', monthRevenue: '--',
      pendingShip: 0, pendingAftersale: 0
    },
    recentOrders: []
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    if (!auth.requireLogin()) return
    const user = auth.getUser() || getApp().globalData.user
    if (user && user.role !== 'merchant') {
      wx.reLaunch({ url: '/pages/index/index' })
      return
    }
    this.setData({ user })
    this._loadStats()
    this._loadRecentOrders()
  },

  async _loadStats() {
    try {
      const res = await auth.request('GET', '/api/merchant/stats')
      if (res.code === 200) {
        const d = res.data
        this.setData({
          stats: {
            todayOrders:     d.today_orders    || 0,
            pendingAmount:   d.pending_settlement || '0.00',
            onSaleCount:     d.on_sale         || 0,
            monthRevenue:    d.monthly_sales   || '0.00',
            pendingShip:     d.pending_ship    || 0,
            pendingAftersale: d.pending_aftersale || 0
          }
        })
      }
    } catch {}
  },

  async _loadRecentOrders() {
    try {
      const res = await auth.request('GET', '/api/merchant/orders')
      if (res.code === 200) {
        const recentOrders = (res.data || []).slice(0, 4).map(o => ({
          id:          o.id,
          orderNo:     o.order_no,
          goods:       (o.items || []).map(i => `${i.name}×${i.qty}`).join('、') || '商品',
          amount:      parseFloat(o.total || 0).toFixed(2),
          status:      STATUS_CLS[o.status] || 'done',
          statusLabel: STATUS_LBL[o.status] || o.status
        }))
        this.setData({ recentOrders })
      }
    } catch {}
  },

  goProducts() { wx.reLaunch({ url: '/pages/merchant/products' }) },
  goOrders()   { wx.reLaunch({ url: '/pages/merchant/orders' }) },
  goFinance()  { wx.reLaunch({ url: '/pages/merchant/finance' }) },

  goOrderDetail() {
    wx.reLaunch({ url: '/pages/merchant/orders' })
  }
})
