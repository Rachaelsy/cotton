// pages/my-orders/index.js — 我的订单
const app  = getApp()
const auth = require('../../utils/auth')

const STATUS_MAP = {
  pending_ship: { label: '待发货', cls: 'tag-ship',      icon: '📦' },
  shipped:      { label: '配送中', cls: 'tag-shipped',   icon: '🚚' },
  completed:    { label: '已完成', cls: 'tag-done',      icon: '✅' },
  refund:       { label: '售后中', cls: 'tag-refund',    icon: '🔄' },
  pending_pay:  { label: '待付款', cls: 'tag-pending',   icon: '💳' }
}

const TABS = [
  { key: 'all',          label: '全部' },
  { key: 'pending_ship', label: '待发货' },
  { key: 'shipped',      label: '配送中' },
  { key: 'completed',    label: '已完成' }
]

Page({
  data: {
    statusBarHeight: 20,
    tabs: TABS,
    activeTab: 'all',
    orders: [],
    loading: true,
    empty: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this._load('all')
  },

  onShow() {
    this._load(this.data.activeTab)
  },

  async _load(tab) {
    this.setData({ loading: true, empty: false })
    try {
      const qs = tab === 'all' ? '' : `?status=${tab}`
      const res = await auth.request('GET', '/api/orders/my' + qs)
      if (res.code === 200) {
        const orders = (res.data || []).map(o => {
          const st = STATUS_MAP[o.status] || { label: o.status, cls: 'tag-done', icon: '📦' }
          return {
            ...o,
            statusLabel: st.label,
            statusCls:   st.cls,
            statusIcon:  st.icon,
            firstItem:   o.items && o.items[0] ? o.items[0] : null,
            moreCount:   o.items && o.items.length > 1 ? o.items.length - 1 : 0,
            createDate:  o.created_at ? o.created_at.toString().slice(0, 16).replace('T', ' ') : ''
          }
        })
        this.setData({ orders, loading: false, empty: orders.length === 0 })
      } else {
        this.setData({ loading: false, empty: true })
        wx.showToast({ title: res.msg || '加载失败', icon: 'none' })
      }
    } catch (e) {
      this.setData({ loading: false, empty: true })
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.activeTab) return
    this.setData({ activeTab: key })
    this._load(key)
  },

  onOrderTap(e) {
    const order = e.currentTarget.dataset.order
    app.globalData.currentOrder = {
      orderId:       order.id,
      orderNo:       order.order_no,
      items:         order.items,
      subtotal:      order.subtotal,
      deliveryFee:   order.delivery_fee,
      total:         order.total,
      payMethod:     order.pay_method,
      status:        this._dbStatusToLabel(order.status),
      address:       order.address,
      receiverName:  order.receiver_name,
      receiverPhone: order.receiver_phone
    }
    wx.navigateTo({ url: '/subpkg-supplies/supplies-order/index' })
  },

  _dbStatusToLabel(dbStatus) {
    const map = { pending_ship: '待发货', shipped: '已发货', completed: '已完成', refund: '售后中' }
    return map[dbStatus] || '待发货'
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/my/index' })
  }
})
