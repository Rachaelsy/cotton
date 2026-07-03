// pages/supplies-store/index.js — 店铺详情页
const app = getApp()
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    merchantId: null,
    storeName: '',
    products: [],
    displayProds: [],
    cats: ['全部'],
    catSel: '全部',
    loading: true,
    cartCount: 0
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    const merchantId = options.merchant_id ? parseInt(options.merchant_id) : null
    const storeName  = options.store_name  ? decodeURIComponent(options.store_name) : ''
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      merchantId,
      storeName: storeName || '店铺',
      cartCount: app.globalData.cartCount
    })
    this._loadProducts(merchantId, storeName)
  },

  onShow() {
    this.setData({ cartCount: app.globalData.cartCount })
  },

  async _loadProducts(merchantId, storeName) {
    this.setData({ loading: true })
    try {
      // 优先从全局已加载商品中按店铺名筛选（与列表显示完全一致）
      const globalProds = app.globalData.products || []
      if (globalProds.length > 0 && storeName) {
        const products = globalProds.filter(p => p.store === storeName)
        const catSet = new Set(products.map(p => p.cat).filter(Boolean))
        const cats = ['全部', ...catSet]
        this.setData({ products, displayProds: products, cats, loading: false })
        return
      }
      // 兜底：调用 API，merchant_id 作为 data 参数而非内嵌 URL
      const res = await auth.request('GET', '/api/products', { merchant_id: merchantId })
      if (res.code === 200 && res.data) {
        const products = res.data.map(p => ({
          ...p,
          id:        String(p.id),
          spec:      p.unit || '',
          imgBg:     p.image_url ? '#F5EEE6' : 'linear-gradient(135deg,#C8902E,#D4A043)',
          image_url: p.image_url ? `${auth.BASE_URL}${p.image_url}` : null,
          store:     p.company_name || '认证商家',
          cat:       p.category || '其他',
          sold:      parseInt(p.sold) || 0,
          rating:    5.0
        }))
        const catSet = new Set(products.map(p => p.cat).filter(Boolean))
        const cats = ['全部', ...catSet]
        const name = products.length > 0
          ? (products[0].company_name || this.data.storeName)
          : this.data.storeName
        this.setData({ products, displayProds: products, cats, storeName: name, loading: false })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('[store load]', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onCat(e) {
    const cat = e.currentTarget.dataset.cat
    const displayProds = cat === '全部'
      ? this.data.products
      : this.data.products.filter(p => p.cat === cat)
    this.setData({ catSel: cat, displayProds })
  },

  onBack() {
    wx.navigateBack()
  },

  onProductTap(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.products.find(p => p.id === id)
    if (!product) return
    app.globalData.selectedProduct = product
    wx.navigateTo({ url: '/subpkg-supplies/supplies-detail/index' })
  },

  onAddToCart(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.products.find(p => p.id === id)
    if (!product) return
    app.addToCart(product)
    this.setData({ cartCount: app.globalData.cartCount })
    wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1200 })
  },

  onGoCart() {
    wx.navigateTo({ url: '/subpkg-supplies/supplies-cart/index' })
  }
})
