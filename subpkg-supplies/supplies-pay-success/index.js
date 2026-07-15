// pages/supplies-pay-success/index.js
const app = getApp()
const i18n = require('../../utils/i18n')
const COPY = {
  zh: { success:'支付成功',splitPrefix:'已为您拆分为',splitSuffix:'个商家订单',preparing:'商家已收到您的订单，正在备货中',totalItems:'等共',piece:'件商品',orderNo:'订单号',copy:'复制',time:'下单时间',method:'支付方式',wechat:'微信支付',paid:'合计实付',orders:'查看全部订单',home:'返回首页',notice:'商家确认发货后，您将收到通知',unknown:'未知商家',copied:'已复制' },
  ug: { success:'تۆلەش مۇۋەپپەقىيەتلىك',splitPrefix:'زاكاز ',splitSuffix:' ساتقۇچىغا ئايرىلدى',preparing:'ساتقۇچى زاكازنى تاپشۇرۇۋالدى، مال تەييارلاۋاتىدۇ',totalItems:'جەمئىي',piece:'دانە مال',orderNo:'زاكاز نومۇرى',copy:'كۆچۈرۈش',time:'زاكاز ۋاقتى',method:'تۆلەش ئۇسۇلى',wechat:'ۋېيشىن تۆلىمى',paid:'تۆلەنگەن پۇل',orders:'بارلىق زاكازلار',home:'باش بەتكە قايتىش',notice:'ساتقۇچى ئەۋەتكەندىن كېيىن ئۇقتۇرۇش تاپشۇرۇۋالىسىز',unknown:'نامەلۇم ساتقۇچى',copied:'كۆچۈرۈلدى' }
}

Page({
  data: {
    statusBarHeight: 20,
    orders: [],          // [{ store, orderNo, total, itemCount, firstItem }]
    grandTotal: '0',
    createTimeStr: '',
    multiStore: false
    ,copy: COPY.zh
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const lang = i18n.getLanguage()
    const copy = COPY[lang] || COPY.zh
    this.setData({ statusBarHeight: info.statusBarHeight || 20, copy })

    const orders = app.globalData.currentOrders || []
    if (!orders.length) return

    const pad = n => String(n).padStart(2, '0')
    const d = new Date(orders[0].createTime || Date.now())
    const createTimeStr = `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`

    const grandTotal = orders.reduce((s, o) => s + (o.total || 0), 0)

    const orderRows = orders.map(o => {
      const items = o.items || []
      const firstItem = items[0] || {}
      const no = o.orderNo || (o.orderId ? o.orderId.toString().slice(-10).toUpperCase() : '')
      return {
        store: o.store || copy.unknown,
        orderNo: no,
        total: String(o.total || 0),
        itemCount: items.length,
        firstItem
      }
    })

    this.setData({
      orders: orderRows,
      grandTotal: String(grandTotal),
      createTimeStr,
      multiStore: orders.length > 1
    })
  },

  onCopyNo(e) {
    const no = e.currentTarget.dataset.no
    wx.setClipboardData({
      data: no,
      success: () => wx.showToast({ title: this.data.copy.copied, icon: 'success', duration: 1000 })
    })
  },

  onViewOrder() {
    wx.redirectTo({ url: '/subpkg-supplies/my-orders/index' })
  },

  onHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
