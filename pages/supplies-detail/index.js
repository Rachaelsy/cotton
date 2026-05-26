// pages/supplies-detail/index.js — 商品详情页
const app = getApp()

Page({
  data: {
    product: null,
    favorited: false,
    cartCount: 0,
    statusBarHeight: 20
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const product = app.globalData.selectedProduct
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      product,
      cartCount: app.globalData.cartCount,
      favorited: product ? app.isFavorited(product.id) : false
    })
  },

  onShow() {
    this.setData({ cartCount: app.globalData.cartCount })
  },

  onBack() {
    wx.navigateBack()
  },

  onFavorite() {
    const p = this.data.product
    if (!p) return
    const next = !this.data.favorited
    if (next) app.addToFavorites(p)
    else app.removeFromFavorites(p.id)
    this.setData({ favorited: next })
    wx.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'none', duration: 1200 })
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
    const p = this.data.product
    if (!p) return
    const storeName = encodeURIComponent(p.store || p.company_name || '店铺')
    wx.navigateTo({
      url: `/pages/supplies-store/index?merchant_id=${p.merchant_id}&store_name=${storeName}`
    })
  },

  onCustomerService() {
    wx.showToast({ title: '正在连接客服...', icon: 'none' })
  },

  onShowReviews() {
    wx.showToast({ title: '评价详情开发中', icon: 'none' })
  }
})
