// pages/supplies-detail/index.js — 商品详情页
const app = getApp()

Page({
  data: {
    product: null,
    storeProducts: [],
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
      cartCount: app.globalData.cartCount
    })
    if (product) this._loadStoreProducts(product)
  },

  onShow() {
    this.setData({ cartCount: app.globalData.cartCount })
  },

  // 从全局商品列表中取同店其他商品（最多6个）
  _loadStoreProducts(product) {
    const all = app.globalData.products || []
    const storeProducts = all
      .filter(p => p.store === product.store && p.id !== product.id)
      .slice(0, 6)
    this.setData({ storeProducts })
  },

  onBack() {
    wx.navigateBack()
  },

  onFavorite() {
    const next = !this.data.favorited
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
    wx.showToast({ title: '进入店铺功能开发中', icon: 'none' })
  },

  onCustomerService() {
    wx.showToast({ title: '正在连接客服...', icon: 'none' })
  },

  onShowReviews() {
    wx.showToast({ title: '评价详情开发中', icon: 'none' })
  },

  onStoreProduct(e) {
    const id = e.currentTarget.dataset.id
    const product = (app.globalData.products || []).find(p => p.id === id)
    if (!product) return
    app.globalData.selectedProduct = product
    // 重新加载本页
    wx.redirectTo({ url: '/pages/supplies-detail/index' })
  }
})
