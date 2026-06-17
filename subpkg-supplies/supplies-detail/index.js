// pages/supplies-detail/index.js — 商品详情页
const app = getApp()

const auth = require('../../utils/auth')

Page({
  data: {
    product: null,
    favorited: false,
    cartCount: 0,
    statusBarHeight: 20,
    showCsPopup: false,
    showQualityPopup: false,
    reviews: [],
    reviewTotal: 0,
    avgRating: '0.0',
    reviewsLoaded: false
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
    if (product?.merchant_id) this._loadReviews(product.merchant_id)
  },

  onShow() {
    this.setData({ cartCount: app.globalData.cartCount })
  },

  async _loadReviews(merchantId) {
    try {
      const res = await auth.request('GET', `/api/products/reviews?merchant_id=${merchantId}&limit=5`)
      if (res.code === 200) {
        this.setData({
          reviews:      res.data.reviews || [],
          reviewTotal:  res.data.total   || 0,
          avgRating:    res.data.avg_rating || '0.0',
          reviewsLoaded: true
        })
      }
    } catch { /* 评价加载失败不影响商品展示 */ }
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
    wx.navigateTo({ url: '/subpkg-supplies/supplies-cart/index' })
  },

  onGoCart() {
    wx.navigateTo({ url: '/subpkg-supplies/supplies-cart/index' })
  },

  onGoStore() {
    const p = this.data.product
    if (!p) return
    const storeName = encodeURIComponent(p.store || p.company_name || '店铺')
    wx.navigateTo({
      url: `/subpkg-supplies/supplies-store/index?merchant_id=${p.merchant_id}&store_name=${storeName}`
    })
  },

  onCustomerService() {
    const p = this.data.product
    if (!p) return
    if (!p.merchant_wechat) {
      wx.showToast({ title: '该商家暂未设置客服微信', icon: 'none' })
      return
    }
    this.setData({ showCsPopup: true })
  },

  onCloseCsPopup() {
    this.setData({ showCsPopup: false })
  },

  onCopyWechat() {
    const wechat = this.data.product?.merchant_wechat
    if (!wechat) return
    wx.setClipboardData({
      data: wechat,
      success: () => wx.showToast({ title: '微信号已复制', icon: 'success' })
    })
  },

  onShowReviews() {
    wx.showToast({ title: `共 ${this.data.reviewTotal} 条评价`, icon: 'none' })
  },

  onQualityGuarantee() {
    this.setData({ showQualityPopup: true })
  },

  onCloseQualityPopup() {
    this.setData({ showQualityPopup: false })
  }
})
