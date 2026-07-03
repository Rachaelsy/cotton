// pages/favorites/index.js — 我的收藏
const app = getApp()
const i18n = require('../../utils/i18n')

Page({
  data: {
    statusBarHeight: 20,
    copy: i18n.getPageCopy('favorites'),
    favorites: [],
    countText: '',
    cartCount: 0
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.applyLanguage()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    this.applyLanguage()
    this.setData({
      favorites: app.globalData.favorites || [],
      countText: this.textCopy.count((app.globalData.favorites || []).length),
      cartCount: app.globalData.cartCount
    })
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.textCopy = i18n.getCopy('favorites', lang)
    this.setData({
      copy: i18n.getPageCopy('favorites', lang)
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
    this.setData({ countText: this.textCopy.count((app.globalData.favorites || []).length) })
    wx.showToast({ title: this.textCopy.removed, icon: 'none', duration: 1000 })
  },

  onAddToCart(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.favorites.find(p => p.id === id)
    if (!product) return
    app.addToCart(product)
    this.setData({ cartCount: app.globalData.cartCount })
    wx.showToast({ title: this.textCopy.addedCart, icon: 'success', duration: 1200 })
  },

  onGoCart() {
    wx.navigateTo({ url: '/subpkg-supplies/supplies-cart/index' })
  },

  onGoShopping() {
    wx.navigateBack()
  }
})
