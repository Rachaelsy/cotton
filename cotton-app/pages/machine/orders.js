// pages/machine/orders.js — 我的农机预约
const app = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const machineI18n = require('../../utils/machine-i18n')
const BADGE = {
  pending: 'b-pending', accepted: 'b-progress', departed: 'b-progress',
  arrived: 'b-progress', working: 'b-progress', completed: 'b-done', cancelled: 'b-cancel'
}

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: machineI18n.getCopy('orders'),
    tabs: machineI18n.orderTabs(),
    activeTab: 'all',
    orders: [],
    loading: true
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    const lang = i18n.getLanguage()
    if (lang !== this.data.lang) this.setData({ lang, copy: machineI18n.getCopy('orders', lang), tabs: machineI18n.orderTabs(lang) })
    this.load(this.data.activeTab)
  },

  async load(tab) {
    this.setData({ loading: true })
    const qs = tab === 'all' ? '' : `?status=${tab}`
    try {
      const res = await auth.request('GET', '/api/machine-orders/my' + qs)
      if (res.code === 200) {
        const orders = (res.data || []).map(o => {
          const payLabel = o.pay_status === 'paid' ? this.data.copy.paidFull
            : o.pay_status === 'partial' ? this.data.copy.paidDeposit
              : o.pay_status === 'refunded' ? this.data.copy.refunded : this.data.copy.awaitingPayment
          return {
            ...o,
            status_label: o.status === 'pending' && o.pay_status === 'unpaid'
              ? this.data.copy.awaitingPayment : machineI18n.statusLabel(o.status, this.data.lang),
            pay_status_label: payLabel,
            badgeCls: BADGE[o.status] || 'b-progress'
          }
        })
        this.setData({ orders, loading: false })
      } else {
        this.setData({ orders: [], loading: false })
      }
    } catch (e) {
      this.setData({ orders: [], loading: false })
      wx.showToast({ title: this.data.copy.network, icon: 'none' })
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
      title: this.data.copy.deleteTitle,
      content: this.data.copy.deleteContent,
      confirmColor: '#DC2626',
      success: async (r) => {
        if (!r.confirm) return
        try {
          const res = await auth.request('DELETE', `/api/machine-orders/${id}`)
          if (res.code === 200) { wx.showToast({ title: this.data.copy.deleted, icon: 'none' }); this.load(this.data.activeTab) }
          else wx.showToast({ title: res.msg || this.data.copy.deleteFail, icon: 'none' })
        } catch (e) { wx.showToast({ title: this.data.copy.network, icon: 'none' }) }
      }
    })
  },

  onPay(e) {
    const id = e.currentTarget.dataset.id
    const stage = e.currentTarget.dataset.stage || 'deposit'
    const order = this.data.orders.find(item => String(item.id) === String(id))
    if (order) app.globalData.machineOrder = order
    wx.navigateTo({ url: `/pages/machine/pay?id=${id}${stage === 'balance' ? '&stage=balance' : ''}` })
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  }
})
