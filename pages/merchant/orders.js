const auth = require('../../utils/auth')

const STATUS_MAP = {
  pending_ship: { label: '待发货', cls: 'pending' },
  shipped:      { label: '已发货', cls: 'shipped' },
  completed:    { label: '已完成', cls: 'done' },
  aftersale:    { label: '售后中', cls: 'refund' },
  refund:       { label: '售后中', cls: 'refund' }
}

Page({
  data: {
    statusBarHeight: 20,
    tab: 'all',
    tabs: [
      { key: 'all',          label: '全部' },
      { key: 'pending_ship', label: '待发货' },
      { key: 'shipped',      label: '已发货' },
      { key: 'completed',    label: '已完成' },
      { key: 'aftersale',    label: '售后中' }
    ],
    orders: [],
    loading: false,
    showShipModal: false,
    pendingShipId: null,
    logisticsInput: ''
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    if (!auth.requireLogin()) return
    this._loadOrders()
  },

  async _loadOrders() {
    this.setData({ loading: true })
    try {
      const { tab } = this.data
      const qs = tab === 'all' ? '' : `?status=${tab}`
      const res = await auth.request('GET', '/api/merchant/orders' + qs)
      if (res.code === 200) {
        const orders = (res.data || []).map(o => {
          const st = STATUS_MAP[o.status] || { label: o.status, cls: '' }
          return {
            id:          o.id,
            orderNo:     o.order_no,
            buyer:       o.farmer_name || o.receiver_name || '买家',
            buyerPhone:  o.farmer_phone || o.receiver_phone || '',
            address:     o.address || '',
            goods:       (o.items || []).map(i => `${i.name}×${i.qty}`).join('、'),
            amount:      parseFloat(o.total || 0).toFixed(2),
            time:        String(o.created_at || '').slice(0, 16).replace('T', ' '),
            status:      o.status,
            statusLabel: st.label,
            statusCls:   st.cls,
            logisticsNo: o.logistics_no || '',
            address:     o.address || '',
            receiverName:  o.receiver_name || '',
            receiverPhone: o.receiver_phone || ''
          }
        })
        this.setData({ orders, loading: false })
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: res.msg || '加载失败', icon: 'none' })
      }
    } catch {
      this.setData({ loading: false })
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.tab) return
    this.setData({ tab: key }, () => this._loadOrders())
  },

  // 详情：弹窗展示关键信息
  onDetail(e) {
    const id = e.currentTarget.dataset.id
    const o = this.data.orders.find(o => o.id === id)
    if (!o) return
    wx.showModal({
      title: `订单 ${o.orderNo}`,
      content: `买家：${o.buyer}${o.buyerPhone ? '（' + o.buyerPhone + '）' : ''}\n收货：${o.receiverName} ${o.receiverPhone}\n地址：${o.address}\n商品：${o.goods}\n状态：${o.statusLabel}${o.logisticsNo ? '\n物流：' + o.logisticsNo : ''}`,
      showCancel: false,
      confirmText: '关闭'
    })
  },

  // 发货：打开弹窗填写物流单号
  onShip(e) {
    this.setData({ showShipModal: true, pendingShipId: e.currentTarget.dataset.id, logisticsInput: '' })
  },

  onLogisticsInput(e) {
    this.setData({ logisticsInput: e.detail.value })
  },

  onCancelShip() {
    this.setData({ showShipModal: false, pendingShipId: null, logisticsInput: '' })
  },

  async onConfirmShip() {
    const { logisticsInput, pendingShipId } = this.data
    if (!logisticsInput.trim()) { wx.showToast({ title: '请填写物流单号', icon: 'none' }); return }
    try {
      const res = await auth.request('PATCH', `/api/merchant/orders/${pendingShipId}/ship`, {
        logistics_no: logisticsInput.trim()
      })
      if (res.code === 200) {
        wx.showToast({ title: '发货成功', icon: 'success' })
        this.setData({ showShipModal: false, pendingShipId: null, logisticsInput: '' })
        this._loadOrders()
      } else {
        wx.showToast({ title: res.msg || '发货失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
    }
  },

  // 售后：跳转售后管理 tab
  onAftersaleHandle() {
    wx.showToast({ title: '请前往售后管理处理', icon: 'none' })
  },

  onExportOrders() {
    const token = wx.getStorageSync('token')
    if (!token) { wx.showToast({ title: '请先登录', icon: 'none' }); return }
    const { BASE_URL } = require('../../utils/auth')
    const url = `${BASE_URL}/api/merchant/orders/export?token=${encodeURIComponent(token)}`
    wx.showLoading({ title: '正在导出...' })
    wx.downloadFile({
      url,
      success: (dl) => {
        wx.hideLoading()
        if (dl.statusCode !== 200) { wx.showToast({ title: '导出失败', icon: 'none' }); return }
        wx.openDocument({
          filePath: dl.tempFilePath,
          showMenu: true,
          fileType: 'doc',
          fail: () => wx.showModal({
            title: '导出成功',
            content: '文件已下载，请在手机文件管理器查看',
            showCancel: false
          })
        })
      },
      fail: () => { wx.hideLoading(); wx.showToast({ title: '导出失败，请检查网络', icon: 'none' }) }
    })
  }
})
