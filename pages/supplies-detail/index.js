// pages/supplies-detail/index.js — 商品详情页
const app = getApp()

Page({
  data: {
    product: null,
    delivery: 'home',
    cartCount: 0,
    statusBarHeight: 20
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      product: app.globalData.selectedProduct,
      cartCount: app.globalData.cartCount
    })
  },

  onShow() {
    this.setData({ cartCount: app.globalData.cartCount })
  },

  onBack() {
    wx.navigateBack()
  },

  onDelivery(e) {
    this.setData({ delivery: e.currentTarget.dataset.type })
  },

  onAddToCart() {
    const p = this.data.product
    if (!p) return
    app.addToCart(p)
    this.setData({ cartCount: app.globalData.cartCount })
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onBuyNow() {
    const p = this.data.product
    if (!p) return
    app.addToCart(p)
    wx.navigateTo({ url: '/pages/supplies-cart/index' })
  },

  onGoCart() {
    wx.navigateTo({ url: '/pages/supplies-cart/index' })
  },

  onGoStore() {
    wx.navigateBack()
  },

  onCustomerService() {
    wx.showToast({ title: '正在连接客服...', icon: 'none' })
  },

  onEnterStore() {
    wx.showToast({ title: '进入店铺开发中', icon: 'none' })
  },

  onFavorite() {
    wx.showToast({ title: '已收藏', icon: 'success' })
  },

  onShare() {
    wx.showToast({ title: '分享功能开发中', icon: 'none' })
  }
})
