// subpkg-supplies/my-orders/index.js — 我的订单（农资 + 农机 统一列表）
const app  = getApp()
const auth = require('../../utils/auth')

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
    tabs: TABS,
    activeTab: 'all',
    orders: [],        // 合并后用于展示的列表
    loading: true,
    empty: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this._all = []
    this._load()
  },

  onShow() { this._load() },

  // 同时拉农资订单 + 农机预约，合并按时间排序
  async _load() {
    this.setData({ loading: true, empty: false })
    try {
      const [supRes, macRes] = await Promise.all([
        auth.request('GET', '/api/orders/my').catch(() => ({ code: 0, data: [] })),
        auth.request('GET', '/api/machine-orders/my').catch(() => ({ code: 0, data: [] }))
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
          statusLabel: st.label, statusCls: st.cls, statusIcon: st.icon,
          bucket: bucketOf(o.status),
          status: o.status,
          total: o.total,
          firstItem,
          moreCount: o.items && o.items.length > 1 ? o.items.length - 1 : 0,
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
          statusLabel: st.label, statusCls: st.cls,
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
      wx.showToast({ title: '网络异常', icon: 'none' })
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
      subtotal: o.subtotal, deliveryFee: o.delivery_fee, total: o.total,
      payMethod: o.pay_method, status: this._dbStatusToLabel(o.status),
      address: o.address, receiverName: o.receiver_name, receiverPhone: o.receiver_phone,
      merchantPhone: firstItem.merchantPhone || '', merchantWechat: firstItem.merchantWechat || ''
    }
    wx.navigateTo({ url: '/subpkg-supplies/supplies-order/index' })
  },

  onPayOrder(e) {
    const o = e.currentTarget.dataset.order.raw
    app.globalData.currentOrders = [{
      orderId: o.id, orderNo: o.order_no, store: o.company_name || '商家订单',
      items: o.items || [], total: o.total, payExpiresAt: o.pay_expires_at
    }]
    wx.navigateTo({ url: '/subpkg-supplies/supplies-pay/index' })
  },

  async onCancelOrder(e) {
    const o = e.currentTarget.dataset.order.raw
    const confirmed = await new Promise(resolve =>
      wx.showModal({ title: '取消订单', content: '确认取消该订单？库存将立即恢复。',
        confirmText: '确认取消', confirmColor: '#FF3B30', success: r => resolve(r.confirm) }))
    if (!confirmed) return
    try {
      const res = await auth.request('PATCH', `/api/orders/${o.id}/cancel`, {})
      if (res.code === 200) { wx.showToast({ title: '已取消', icon: 'success' }); this._load() }
      else wx.showToast({ title: res.msg || '取消失败', icon: 'none' })
    } catch { wx.showToast({ title: '网络错误', icon: 'none' }) }
  },

  async onDeleteOrder(e) {
    const id = e.currentTarget.dataset.id
    if (!await this._confirmDelete()) return
    try {
      const res = await auth.request('DELETE', `/api/orders/${id}`)
      if (res.code === 200) { wx.showToast({ title: '已删除', icon: 'none' }); this._load() }
      else wx.showToast({ title: res.msg || '删除失败', icon: 'none' })
    } catch (e) { wx.showToast({ title: '网络错误', icon: 'none' }) }
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
      if (res.code === 200) { wx.showToast({ title: '已删除', icon: 'none' }); this._load() }
      else wx.showToast({ title: res.msg || '删除失败', icon: 'none' })
    } catch (e) { wx.showToast({ title: '网络错误', icon: 'none' }) }
  },

  _confirmDelete() {
    return new Promise(resolve =>
      wx.showModal({ title: '删除订单', content: '确定删除该订单记录吗？删除后不可恢复。',
        confirmText: '删除', confirmColor: '#FF3B30', success: r => resolve(r.confirm) }))
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
