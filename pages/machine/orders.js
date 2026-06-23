// pages/machine/orders.js — 我的农机预约
const auth = require('../../utils/auth')

const TABS = [
  { key: 'all',       label: '全部' },
  { key: 'pending',   label: '待接单' },
  { key: 'ongoing',   label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' }
]
const BADGE = {
  pending: 'b-pending', accepted: 'b-progress', departed: 'b-progress',
  arrived: 'b-progress', working: 'b-progress', completed: 'b-done', cancelled: 'b-cancel'
}

Page({
  data: {
    statusBarHeight: 20,
    tabs: TABS,
    activeTab: 'all',
    orders: [],
    loading: true
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() { this.load(this.data.activeTab) },

  async load(tab) {
    this.setData({ loading: true })
    const qs = tab === 'all' ? '' : `?status=${tab}`
    try {
      const res = await auth.request('GET', '/api/machine-orders/my' + qs)
      if (res.code === 200) {
        const orders = (res.data || []).map(o => ({ ...o, badgeCls: BADGE[o.status] || 'b-progress' }))
        this.setData({ orders, loading: false })
      } else {
        this.setData({ orders: [], loading: false })
      }
    } catch (e) {
      this.setData({ orders: [], loading: false })
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.activeTab) return
    this.setData({ activeTab: key })
    this.load(key)
  },

  onOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/machine/track?id=${id}` })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除订单',
      content: '确定删除该订单记录吗？删除后不可恢复。',
      confirmColor: '#DC2626',
      success: async (r) => {
        if (!r.confirm) return
        try {
          const res = await auth.request('DELETE', `/api/machine-orders/${id}`)
          if (res.code === 200) { wx.showToast({ title: '已删除', icon: 'none' }); this.load(this.data.activeTab) }
          else wx.showToast({ title: res.msg || '删除失败', icon: 'none' })
        } catch (e) { wx.showToast({ title: '网络异常', icon: 'none' }) }
      }
    })
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  }
})
