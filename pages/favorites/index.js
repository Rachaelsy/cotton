// pages/favorites/index.js — 我的收藏
const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    favorites: [],
    cartCount: 0
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    this.setData({
      favorites: app.globalData.favorites || [],
      cartCount: app.globalData.cartCount
    })
  },

  onBack() {
    wx.navigateBack()
  },

  onProductTap(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.favorites.find(p => p.id === id)
    if (!product) return
    app.globalData.selectedProduct = product
    wx.navigateTo({ url: '/subpkg-supplies/supplies-detail/index' })
  },

  onRemoveFav(e) {
    const id = e.currentTarget.dataset.id
    app.removeFromFavorites(id)
    this.setData({ favorites: [...app.globalData.favorites] })
    wx.showToast({ title: '已取消收藏', icon: 'none', duration: 1000 })
  },

  onAddToCart(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.favorites.find(p => p.id === id)
    if (!product) return
    app.addToCart(product)
    this.setData({ cartCount: app.globalData.cartCount })
    wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1200 })
  },

  onGoCart() {
    wx.navigateTo({ url: '/subpkg-supplies/supplies-cart/index' })
  },

  onGoShopping() {
    wx.navigateBack()
  }
})
