const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    user: null,
    stats: {
      todayOrders: 12,
      pendingAmount: '2,340.00',
      onSaleCount: 8,
      monthRevenue: '18,670.00'
    },
    recentOrders: [
      { id: 'DD202505250001', goods: '复合肥料（尿素）x2袋', amount: '90.00', status: 'pending', statusLabel: '待发货' },
      { id: 'DD202505250002', goods: '农药杀虫剂 x3瓶', amount: '114.00', status: 'done', statusLabel: '已完成' },
      { id: 'DD202505250003', goods: '棉花催熟剂 x1升', amount: '62.00', status: 'pending', statusLabel: '待发货' },
      { id: 'DD202505240004', goods: '复合肥料（尿素）x5袋', amount: '225.00', status: 'done', statusLabel: '已完成' }
    ]
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
  },

  goProducts() { wx.reLaunch({ url: '/pages/merchant/products' }) },
  goOrders()   { wx.reLaunch({ url: '/pages/merchant/orders' }) },
  goFinance()  { wx.reLaunch({ url: '/pages/merchant/finance' }) },

  goOrderDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.showToast({ title: `订单${id}详情开发中`, icon: 'none' })
  }
})
