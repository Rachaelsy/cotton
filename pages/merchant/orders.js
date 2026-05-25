const auth = require('../../utils/auth')

const MOCK_ORDERS = [
  { id: 'DD202505250001', buyer: '古丽巴哈尔', goods: '复合肥料（尿素）x2袋', amount: '90.00', time: '10:32', status: 'pending', statusLabel: '待发货' },
  { id: 'DD202505250002', buyer: '买买提·阿不都', goods: '农药杀虫剂 x3瓶', amount: '114.00', time: '09:15', status: 'done', statusLabel: '已完成' },
  { id: 'DD202505250003', buyer: '阿依古丽', goods: '棉花催熟剂 x1升', amount: '62.00', time: '08:50', status: 'pending', statusLabel: '待发货' },
  { id: 'DD202505240004', buyer: '热依拉', goods: '复合肥料（尿素）x5袋', amount: '225.00', time: '昨天 16:20', status: 'done', statusLabel: '已完成' },
  { id: 'DD202505240005', buyer: '艾力·肉孜', goods: '滴灌带 x2卷', amount: '560.00', time: '昨天 14:10', status: 'done', statusLabel: '已完成' },
  { id: 'DD202505230006', buyer: '麦尔哈巴', goods: '农药杀虫剂 x1瓶', amount: '38.00', time: '05-23 11:30', status: 'refund', statusLabel: '退款中' }
]

Page({
  data: {
    statusBarHeight: 20,
    tab: 'all',
    orders: [],
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待发货' },
      { key: 'done', label: '已完成' },
      { key: 'refund', label: '退款' }
    ]
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    if (!auth.requireLogin()) return
    this._loadOrders()
  },

  _loadOrders() {
    const { tab } = this.data
    const list = tab === 'all' ? [...MOCK_ORDERS] : MOCK_ORDERS.filter(o => o.status === tab)
    this.setData({ orders: list })
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.key }, () => this._loadOrders())
  },

  onShip(e) {
    const id = e.currentTarget.dataset.id
    const order = MOCK_ORDERS.find(o => o.id === id)
    if (!order) return
    wx.showModal({
      title: '确认发货',
      content: `确认为买家 "${order.buyer}" 发货？`,
      confirmText: '确认发货',
      success: (res) => {
        if (res.confirm) {
          order.status = 'done'
          order.statusLabel = '已完成'
          this._loadOrders()
          wx.showToast({ title: '发货成功', icon: 'success' })
        }
      }
    })
  },

  onRefundHandle(e) {
    const id = e.currentTarget.dataset.id
    wx.showActionSheet({
      itemList: ['同意退款', '拒绝退款'],
      success: (res) => {
        const order = MOCK_ORDERS.find(o => o.id === id)
        if (!order) return
        if (res.tapIndex === 0) {
          order.status = 'done'
          order.statusLabel = '已退款'
        } else {
          order.status = 'done'
          order.statusLabel = '已完成'
        }
        this._loadOrders()
        wx.showToast({ title: '处理成功', icon: 'success' })
      }
    })
  },

  onDetail(e) {
    wx.showToast({ title: '订单详情开发中', icon: 'none' })
  }
})
