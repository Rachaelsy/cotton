// subpkg-supplies/my-orders/index.js — 我的订单（农资 + 农机 统一列表）
const app  = getApp()
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')
const i18n = require('../../utils/i18n')
const machineI18n = require('../../utils/machine-i18n')

const COPY = {
  zh: { title:'我的订单',loading:'加载中…',empty:'暂无订单',emptySub:'去农资商城或农机租赁看看吧',supplies:'农资',goods:'商品',piece:'件',shipped:'已发货',due:'待付',paid:'实付',cancel:'取消订单',pay:'去支付',delete:'删除订单',machine:'农机',noPlot:'不指定地块',mu:'亩',total:'总价',network:'网络异常',merchantOrder:'商家订单',cancelTitle:'取消订单',cancelContent:'确认取消该订单？库存将立即恢复。',cancelConfirm:'确认取消',cancelled:'已取消',cancelFail:'取消失败',deleted:'已删除',deleteFail:'删除失败',deleteTitle:'删除订单',deleteContent:'确定删除该订单记录吗？删除后不可恢复。' },
  ug: { title:'زاكازلىرىم',loading:'يۈكلىنىۋاتىدۇ…',empty:'زاكاز يوق',emptySub:'ماتېرىيال ياكى ماشىنا مۇلازىمىتىنى كۆرۈڭ',supplies:'ماتېرىيال',goods:'مەھسۇلات',piece:'دانە',shipped:'يەتكۈزۈلدى',due:'تۆلەش',paid:'تۆلەندى',cancel:'زاكازنى بىكار قىلىش',pay:'تۆلەش',delete:'زاكازنى ئۆچۈرۈش',machine:'ماشىنا',noPlot:'يەر بەلگىلەنمىگەن',mu:'مو',total:'ئومۇمىي باھا',network:'تور نورمال ئەمەس',merchantOrder:'سودىگەر زاكازى',cancelTitle:'زاكازنى بىكار قىلىش',cancelContent:'زاكاز بىكار قىلىنسۇنمۇ؟ مال سانى ئەسلىگە كېلىدۇ.',cancelConfirm:'بىكار قىلىش',cancelled:'بىكار قىلىندى',cancelFail:'بىكار قىلىش مەغلۇپ',deleted:'ئۆچۈرۈلدى',deleteFail:'ئۆچۈرۈش مەغلۇپ',deleteTitle:'زاكازنى ئۆچۈرۈش',deleteContent:'زاكاز خاتىرىسى ئۆچۈرۈلسۇنمۇ؟ قايتۇرغىلى بولمايدۇ.' }
}

const STATUS_UG = { pending_payment:'تۆلەشنى كۈتۈش',pending_ship:'مال چىقىرىشنى كۈتۈش',shipped:'يەتكۈزۈلۈۋاتىدۇ',completed:'تاماملاندى',refunded:'قايتۇرۇش تامام',refund:'قايتۇرۇش جەريانىدا',cancelled:'بىكار قىلىندى' }

function tabs(lang) {
  return lang === 'ug' ? [{key:'all',label:'ھەممىسى'},{key:'ongoing',label:'ئىجرا'},{key:'done',label:'تامام'},{key:'cancelled',label:'بىكار'}] : TABS
}

const STATUS_MAP = {
  pending_payment: { label: '待付款', cls: 'tag-pending',   icon: '💳' },
  pending_ship:    { label: '待发货', cls: 'tag-ship',      icon: '📦' },
  shipped:         { label: '配送中', cls: 'tag-shipped',   icon: '🚚' },
  completed:       { label: '已完成', cls: 'tag-done',      icon: '✅' },
  refunded:        { label: '售后完成', cls: 'tag-refunded', icon: '🔁' },
  refund:          { label: '售后中', cls: 'tag-refund',    icon: '🔄' },
  cancelled:       { label: '已取消', cls: 'tag-cancel',    icon: '❌' }
}

const MACHINE_STATUS = {
  pending:   { label: '待接单', cls: 'tag-pending' },
  accepted:  { label: '已接单', cls: 'tag-shipped' },
  departed:  { label: '已出发', cls: 'tag-shipped' },
  arrived:   { label: '已到场', cls: 'tag-shipped' },
  working:   { label: '作业中', cls: 'tag-shipped' },
  completed: { label: '已完成', cls: 'tag-done' },
  cancelled: { label: '已取消', cls: 'tag-cancel' }
}

// 通用筛选桶
const TABS = [
  { key: 'all',       label: '全部' },
  { key: 'ongoing',   label: '进行中' },
  { key: 'done',      label: '已完成' },
  { key: 'cancelled', label: '已取消' }
]

function bucketOf(status) {
  if (status === 'cancelled') return 'cancelled'
  if (status === 'completed' || status === 'refunded') return 'done'
  return 'ongoing'
}

function fmtDate(dt) {
  return dt ? dt.toString().slice(0, 16).replace('T', ' ') : ''
}

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: COPY[i18n.getLanguage()],
    capsuleSafeRight: 0,
    tabs: tabs(i18n.getLanguage()),
    activeTab: 'all',
    orders: [],        // 合并后用于展示的列表
    loading: true,
    empty: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })
    this._all = []
    this._load()
  },

  onShow() {
    const lang = i18n.getLanguage()
    if (lang !== this.data.lang) this.setData({ lang, copy: COPY[lang], tabs: tabs(lang) })
    this._load()
  },

  // 同时拉农资订单 + 农机预约，合并按时间排序
  async _load() {
    this.setData({ loading: true, empty: false })
    try {
      const [supRes, macRes] = await Promise.all([
        auth.guestRequest('GET', '/api/orders/my').catch(() => ({ code: 0, data: [] })),
        auth.isLoggedIn()
          ? auth.request('GET', '/api/machine-orders/my').catch(() => ({ code: 0, data: [] }))
          : Promise.resolve({ code: 200, data: [] })
      ])

      const supplies = (supRes.code === 200 ? supRes.data : []).map(o => {
        const st = STATUS_MAP[o.status] || { label: o.status, cls: 'tag-done', icon: '📦' }
        const firstItem = (() => {
          const it = o.items && o.items[0] ? o.items[0] : null
          if (it && it.image_url) it.image_url = auth.BASE_URL + it.image_url
          return it
        })()
        return {
          type: 'supplies',
          id: o.id, raw: o,
          statusLabel: this.data.lang === 'ug' ? (STATUS_UG[o.status] || st.label) : st.label, statusCls: st.cls, statusIcon: st.icon,
          bucket: bucketOf(o.status),
          status: o.status,
          total: o.total,
          firstItem,
          moreCount: o.items && o.items.length > 1 ? o.items.length - 1 : 0,
          logisticsLatest: o.logistics_latest || '',
          logisticsStatus: o.logistics_status || '',
          logisticsCompanyName: o.logistics_company_name || '',
          logisticsNo: o.logistics_no || '',
          logisticsFallback: [o.logistics_company_name, o.logistics_no].filter(Boolean).join(' '),
          createDate: fmtDate(o.created_at),
          _ts: o.created_at ? new Date(o.created_at).getTime() : 0,
          canDelete: o.status === 'completed' || o.status === 'refunded' || o.status === 'cancelled'
        }
      })

      const machine = (macRes.code === 200 ? macRes.data : []).map(o => {
        const st = MACHINE_STATUS[o.status] || { label: o.status_label || o.status, cls: 'tag-done' }
        return {
          type: 'machine',
          id: o.id, raw: o,
          statusLabel: machineI18n.statusLabel(o.status, this.data.lang), statusCls: st.cls,
          bucket: bucketOf(o.status),
          status: o.status,
          machineName: o.machine_name, machineIcon: o.machine_icon,
          plotName: o.plot_name, workArea: o.work_area, workDate: o.work_date,
          workAddress: o.work_address,
          total: o.total_price, deposit: o.deposit,
          createDate: fmtDate(o.created_at),
          _ts: o.created_at ? new Date(o.created_at).getTime() : 0,
          canDelete: o.status === 'completed' || o.status === 'cancelled'
        }
      })

      this._all = supplies.concat(machine).sort((a, b) => b._ts - a._ts)
      this._applyFilter()
    } catch (e) {
      this.setData({ loading: false, empty: true })
      wx.showToast({ title: this.data.copy.network, icon: 'none' })
    }
  },

  _applyFilter() {
    const tab = this.data.activeTab
    const orders = tab === 'all' ? this._all : this._all.filter(o => o.bucket === tab)
    this.setData({ orders, loading: false, empty: orders.length === 0 })
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.activeTab) return
    this.setData({ activeTab: key })
    this._applyFilter()
  },

  // ── 农资订单 ──────────────────────────────
  onOrderTap(e) {
    const o = e.currentTarget.dataset.order.raw
    if (o.status === 'pending_payment') { this.onPayOrder(e); return }
    const firstItem = (o.items || [])[0] || {}
    app.globalData.currentOrder = {
      orderId: o.id, orderNo: o.order_no, items: o.items,
      subtotal: o.subtotal, originalSubtotal: o.original_subtotal,
      promotionDiscount: o.promotion_discount, couponDiscount: o.coupon_discount,
      merchantDiscount: o.merchant_discount, deliveryFee: o.delivery_fee, total: o.total,
      payMethod: o.pay_method, status: this._dbStatusToLabel(o.status),
      address: o.address, receiverName: o.receiver_name, receiverPhone: o.receiver_phone,
      logisticsNo: o.logistics_no || '', logisticsCompany: o.logistics_company || '',
      logisticsCompanyName: o.logistics_company_name || '', logisticsStatus: o.logistics_status || '',
      logisticsLatest: o.logistics_latest || '', logisticsUpdatedAt: o.logistics_updated_at || '',
      merchantPhone: firstItem.merchantPhone || '', merchantWechat: firstItem.merchantWechat || ''
    }
    wx.navigateTo({ url: '/subpkg-supplies/supplies-order/index' })
  },

  onPayOrder(e) {
    const o = e.currentTarget.dataset.order.raw
    app.globalData.currentOrders = [{
      orderId: o.id, orderNo: o.order_no, store: o.company_name || this.data.copy.merchantOrder,
      items: o.items || [], total: o.total, payExpiresAt: o.pay_expires_at
    }]
    wx.navigateTo({ url: '/subpkg-supplies/supplies-pay/index' })
  },

  async onCancelOrder(e) {
    const o = e.currentTarget.dataset.order.raw
    const confirmed = await new Promise(resolve =>
      wx.showModal({ title: this.data.copy.cancelTitle, content: this.data.copy.cancelContent,
        confirmText: this.data.copy.cancelConfirm, confirmColor: '#FF3B30', success: r => resolve(r.confirm) }))
    if (!confirmed) return
    try {
      const res = await auth.guestRequest('PATCH', `/api/orders/${o.id}/cancel`, {})
      if (res.code === 200) { wx.showToast({ title: this.data.copy.cancelled, icon: 'success' }); this._load() }
      else wx.showToast({ title: res.msg || this.data.copy.cancelFail, icon: 'none' })
    } catch { wx.showToast({ title: this.data.copy.network, icon: 'none' }) }
  },

  async onDeleteOrder(e) {
    const id = e.currentTarget.dataset.id
    if (!await this._confirmDelete()) return
    try {
      const res = await auth.guestRequest('DELETE', `/api/orders/${id}`)
      if (res.code === 200) { wx.showToast({ title: this.data.copy.deleted, icon: 'none' }); this._load() }
      else wx.showToast({ title: res.msg || this.data.copy.deleteFail, icon: 'none' })
    } catch (e) { wx.showToast({ title: this.data.copy.network, icon: 'none' }) }
  },

  // ── 农机预约 ──────────────────────────────
  onMachineTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/machine/track?id=${id}` })
  },

  async onMachineDelete(e) {
    const id = e.currentTarget.dataset.id
    if (!await this._confirmDelete()) return
    try {
      const res = await auth.request('DELETE', `/api/machine-orders/${id}`)
      if (res.code === 200) { wx.showToast({ title: this.data.copy.deleted, icon: 'none' }); this._load() }
      else wx.showToast({ title: res.msg || this.data.copy.deleteFail, icon: 'none' })
    } catch (e) { wx.showToast({ title: this.data.copy.network, icon: 'none' }) }
  },

  _confirmDelete() {
    return new Promise(resolve =>
      wx.showModal({ title: this.data.copy.deleteTitle, content: this.data.copy.deleteContent,
        confirmText: this.data.copy.delete, confirmColor: '#FF3B30', success: r => resolve(r.confirm) }))
  },

  _dbStatusToLabel(dbStatus) {
    const map = {
      pending_payment: '待付款', pending_ship: '待发货', shipped: '已发货',
      completed: '已完成', refund: '售后中', refunded: '售后完成', cancelled: '已取消'
    }
    return map[dbStatus] || '待发货'
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/my/index' })
  }
})
