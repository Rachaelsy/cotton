// pages/machine/detail.js — 农机详情
const app  = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const machineI18n = require('../../utils/machine-i18n')

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: machineI18n.getCopy('detail'),
    id: null,
    lat: null,
    lng: null,
    machine: null,
    loading: true
  },

  onLoad(query) {
    const info = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      id: query.id,
      lat: query.lat || null,
      lng: query.lng || null
    })
    this.loadDetail()
  },

  onShow() {
    const lang = i18n.getLanguage()
    if (lang !== this.data.lang) this.setData({ lang, copy: machineI18n.getCopy('detail', lang) })
  },

  async loadDetail() {
    let qs = ''
    if (this.data.lat && this.data.lng) qs = `?lat=${this.data.lat}&lng=${this.data.lng}`
    try {
      const res = await auth.request('GET', `/api/machines/${this.data.id}${qs}`)
      if (res.code === 200) {
        const m = res.data
        m.priceText = Number(m.price).toFixed(m.price % 1 === 0 ? 0 : 1)
        m.distText = m.distance_km != null ? `${m.distance_km}km` : ''
        m.ratingText = Number(m.rating_avg).toFixed(1)
        this.setData({ machine: m, loading: false })
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: res.msg || this.data.copy.loadFail, icon: 'none' })
      }
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: this.data.copy.network, icon: 'none' })
    }
  },

  onContact() {
    const m = this.data.machine
    if (m && m.org_phone) {
      wx.makePhoneCall({ phoneNumber: m.org_phone, fail: () => {} })
    } else {
      wx.showToast({ title: this.data.copy.noPhone, icon: 'none' })
    }
  },

  onBook() {
    if (!this.data.machine || !Number(this.data.machine.payment_ready)) {
      wx.showToast({ title: this.data.copy.paymentPending, icon: 'none' })
      return
    }
    if (!auth.isLoggedIn()) {
      wx.showModal({
        title: this.data.copy.loginTitle,
        content: this.data.copy.loginContent,
        confirmText: this.data.copy.goLogin,
        success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/login/index' }) }
      })
      return
    }
    app.globalData.selectedMachine = this.data.machine
    let url = `/pages/machine/booking?id=${this.data.id}`
    if (this.data.lat && this.data.lng) url += `&lat=${this.data.lat}&lng=${this.data.lng}`
    wx.navigateTo({ url })
  },

  onBack() {
    wx.navigateBack()
  }
})
