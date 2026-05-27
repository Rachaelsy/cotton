// pages/supplies-pay-success/index.js
const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    orders: [],          // [{ store, orderNo, total, itemCount, firstItem }]
    grandTotal: '0',
    createTimeStr: '',
    multiStore: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })

    const orders = app.globalData.currentOrders || []
    if (!orders.length) return

    const pad = n => String(n).padStart(2, '0')
    const d = new Date(orders[0].createTime || Date.now())
    const createTimeStr = `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`

    const grandTotal = orders.reduce((s, o) => s + (o.total || 0), 0)

    const orderRows = orders.map(o => {
      const items = o.items || []
      const firstItem = items[0] || {}
      const no = o.orderNo || (o.orderId ? o.orderId.toString().slice(-10).toUpperCase() : '')
      return {
        store: o.store || '未知商家',
        orderNo: no,
        total: String(o.total || 0),
        itemCount: items.length,
        firstItem
      }
    })

    this.setData({
      orders: orderRows,
      grandTotal: String(grandTotal),
      createTimeStr,
      multiStore: orders.length > 1
    })
  },

  onCopyNo(e) {
    const no = e.currentTarget.dataset.no
    wx.setClipboardData({
      data: no,
      success: () => wx.showToast({ title: '已复制', icon: 'success', duration: 1000 })
    })
  },

  onViewOrder() {
    wx.redirectTo({ url: '/subpkg-supplies/my-orders/index' })
  },

  onHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
