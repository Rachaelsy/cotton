const auth = require('../../utils/auth')
const layout = require('../../utils/layout')

function formatDate(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}

function decorateCoupon(item, mine = false) {
  let valueText = `¥${Number(item.discount_amount || 0)}`
  let valueUnit = ''
  if (item.type === 'percentage') {
    valueText = String(Number(item.discount_rate || 0) / 10)
    valueUnit = '折'
  } else if (item.type === 'free_shipping') {
    valueText = '免'
    valueUnit = '运费'
  }
  let condition = '无门槛可用'
  if (Number(item.threshold_amount) > 0) condition = `满 ¥${Number(item.threshold_amount)} 可用`
  else if (Number(item.threshold_quantity) > 0) condition = `满 ${Number(item.threshold_quantity)} 件可用`
  if (item.type === 'new_customer') condition = `新用户专享 · ${condition}`
  const statusLabels = { available: '可使用', locked: '订单占用中', used: '已使用', expired: '已过期' }
  const claimLabels = { claimed: '已领取', available: '已领取', limit_reached: '已领取', sold_out: '已领完', claimable: '领取' }
  return {
    ...item,
    valueText,
    valueUnit,
    condition,
    validity: `${formatDate(item.starts_at)} - ${formatDate(item.expires_at || item.ends_at)}`,
    statusText: mine ? (statusLabels[item.coupon_status] || item.coupon_status) : '',
    claimText: claimLabels[item.claim_status] || (item.can_claim ? '领取' : '暂不可领'),
    disabled: mine && item.coupon_status !== 'available'
  }
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    activeTab: 'center',
    merchantId: '',
    coupons: [],
    mine: [],
    loading: true
  },

  onLoad(options = {}) {
    const info = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      merchantId: options.merchant_id || ''
    })
    this.loadCoupons()
  },

  onBack() { wx.navigateBack() },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab })
    tab === 'mine' ? this.loadMine() : this.loadCoupons()
  },

  async loadCoupons() {
    this.setData({ loading: true })
    try {
      const query = this.data.merchantId ? `?merchant_id=${this.data.merchantId}` : ''
      const res = await auth.request('GET', '/api/marketing/coupons' + query)
      this.setData({ coupons: res.code === 200 ? (res.data || []).map(item => decorateCoupon(item)) : [] })
    } catch {
      this.setData({ coupons: [] })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadMine() {
    if (!auth.isLoggedIn()) {
      this.setData({ mine: [], loading: false })
      wx.showModal({
        title: '请先登录',
        content: '登录后可查看和使用已领取的优惠券。',
        confirmText: '去登录',
        success: result => { if (result.confirm) wx.navigateTo({ url: '/pages/login/index' }) }
      })
      return
    }
    this.setData({ loading: true })
    try {
      const res = await auth.request('GET', '/api/marketing/coupons/mine')
      this.setData({ mine: res.code === 200 ? (res.data || []).map(item => decorateCoupon(item, true)) : [] })
    } catch {
      this.setData({ mine: [] })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onClaim(e) {
    if (e.currentTarget.dataset.can !== true && e.currentTarget.dataset.can !== 'true') return
    const id = Number(e.currentTarget.dataset.id)
    if (!auth.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }
    try {
      const res = await auth.request('POST', `/api/marketing/coupons/${id}/claim`)
      if (res.code === 200) {
        wx.showToast({ title: '领取成功', icon: 'success' })
        this.loadCoupons()
      } else wx.showToast({ title: res.msg || '领取失败', icon: 'none' })
    } catch {
      wx.showToast({ title: '领取失败，请稍后重试', icon: 'none' })
    }
  },

  onUse() {
    wx.redirectTo({ url: '/subpkg-supplies/supplies/index' })
  }
})
