// pages/machine/track.js — 订单跟踪
const app = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const machineI18n = require('../../utils/machine-i18n')

const STEPS = [
  { key: 'pending',   label: '待接单' },
  { key: 'accepted',  label: '已接单' },
  { key: 'departed',  label: '已出发' },
  { key: 'arrived',   label: '已到场' },
  { key: 'working',   label: '作业中' },
  { key: 'completed', label: '已完成' }
]

function localizedSteps(lang) {
  return STEPS.map(step => ({ ...step, label: machineI18n.statusLabel(step.key, lang) }))
}

function displayTime(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').replace(/\.\d{3}Z$/, '').slice(0, 16)
}

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: machineI18n.getCopy('track'),
    orderId: null,
    order: null,
    steps: localizedSteps(i18n.getLanguage()),
    stepIndex: 0,
    cancelled: false,
    mapVisible: false,
    mapLatitude: 0,
    mapLongitude: 0,
    markers: [],
    polyline: [],
    locationText: '',
    loading: true
  },

  onLoad(query) {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, orderId: query.id })
  },

  onShow() {
    const lang = i18n.getLanguage()
    if (lang !== this.data.lang) this.setData({ lang, copy: machineI18n.getCopy('track', lang), steps: localizedSteps(lang) })
    if (this.data.orderId) {
      this.loadOrder()
      this.pollTimer = setInterval(() => this.loadOrder(true), 15000)
    }
  },

  onHide() { if (this.pollTimer) clearInterval(this.pollTimer) },
  onUnload() { if (this.pollTimer) clearInterval(this.pollTimer) },

  async loadOrder(silent = false) {
    try {
      const res = await auth.request('GET', `/api/machine-orders/${this.data.orderId}`)
      if (res.code === 200) {
        const o = res.data
        const cancelled = o.status === 'cancelled'
        const stepIndex = STEPS.findIndex(s => s.key === o.status)
        const farmerLat = Number(o.farmer_lat)
        const farmerLng = Number(o.farmer_lng)
        const opLat = Number(o.op_lat)
        const opLng = Number(o.op_lng)
        const mapVisible = Number.isFinite(farmerLat) && Number.isFinite(farmerLng) &&
          Number.isFinite(opLat) && Number.isFinite(opLng) && farmerLat !== 0 && opLat !== 0
        const markers = mapVisible ? [
          { id: 1, latitude: farmerLat, longitude: farmerLng, title: this.data.copy.plot, width: 30, height: 30 },
          { id: 2, latitude: opLat, longitude: opLng, title: this.data.copy.contactOperator, width: 30, height: 30 }
        ] : []
        const statusLabel = o.status === 'pending' && o.pay_status === 'unpaid'
          ? this.data.copy.awaitingPayment
          : machineI18n.statusLabel(o.status, this.data.lang)
        const refundStatusText = o.refund_status === 'FAILED'
          ? this.data.copy.refundFailed
          : (o.refund_status && o.refund_status !== 'SUCCESS' ? this.data.copy.refundProcessing : '')
        this.setData({
          order: {
            ...o,
            status_label: statusLabel,
            paid_amount_text: Number(o.paid_amount || 0).toFixed(2),
            pay_expires_text: displayTime(o.pay_expires_at),
            refund_status_text: refundStatusText
          }, cancelled,
          stepIndex: stepIndex < 0 ? 0 : stepIndex,
          mapVisible,
          mapLatitude: mapVisible ? (farmerLat + opLat) / 2 : 0,
          mapLongitude: mapVisible ? (farmerLng + opLng) / 2 : 0,
          markers,
          polyline: mapVisible ? [{ points: [
            { latitude: farmerLat, longitude: farmerLng },
            { latitude: opLat, longitude: opLng }
          ], color: '#1F6F63', width: 4, dottedLine: true }] : [],
          locationText: o.is_live_location ? this.data.copy.live : this.data.copy.base,
          loading: false
        })
      } else {
        this.setData({ loading: false })
        if (!silent) wx.showToast({ title: res.msg || this.data.copy.loadFail, icon: 'none' })
      }
    } catch (e) {
      this.setData({ loading: false })
      if (!silent) wx.showToast({ title: this.data.copy.network, icon: 'none' })
    }
  },

  onContact() {
    const o = this.data.order
    if (o && o.operator_phone) wx.makePhoneCall({ phoneNumber: o.operator_phone, fail: () => {} })
    else wx.showToast({ title: this.data.copy.noPhone, icon: 'none' })
  },

  onCancel() {
    wx.showModal({
      title: this.data.copy.cancelTitle, content: this.data.copy.cancelContent,
      confirmColor: '#DC2626',
      success: async (r) => {
        if (!r.confirm) return
        try {
          const res = await auth.request('PATCH', `/api/machine-orders/${this.data.orderId}/cancel`, {})
          if (res.code === 200) { wx.showToast({ title: this.data.copy.cancelledToast, icon: 'none' }); this.loadOrder() }
          else wx.showToast({ title: res.msg || this.data.copy.cancelFail, icon: 'none' })
        } catch (e) { wx.showToast({ title: this.data.copy.network, icon: 'none' }) }
      }
    })
  },

  onReview() {
    wx.navigateTo({ url: `/pages/machine/review?id=${this.data.orderId}` })
  },

  onPayBalance() {
    app.globalData.machineOrder = this.data.order
    wx.navigateTo({ url: `/pages/machine/pay?id=${this.data.orderId}&stage=balance` })
  },

  onPayInitial() {
    app.globalData.machineOrder = this.data.order
    wx.navigateTo({ url: `/pages/machine/pay?id=${this.data.orderId}` })
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.redirectTo({ url: '/pages/machine/orders' })
  }
})
