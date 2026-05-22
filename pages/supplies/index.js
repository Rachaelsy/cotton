// pages/supplies/index.js — 农资商城首页
const app = getApp()
const { PRODUCTS, CATS } = require('../../utils/data')

Page({
  data: {
    statusBarHeight: 20,
    products: [],
    cats: CATS,
    catSel: '全部',
    flashProds: [],
    displayProds: [],
    cartCount: 0,
    timer: { h: '00', m: '24', s: '44' }
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this._loadProducts()
    this._startTimer()
  },

  onShow() {
    this.setData({ cartCount: app.globalData.cartCount })
  },

  onHide() {
    this._stopTimer()
  },

  onUnload() {
    this._stopTimer()
  },

  // 加载商品数据（优先云数据库，兜底本地数据）
  async _loadProducts() {
    let products = PRODUCTS

    if (wx.cloud) {
      try {
        const db = wx.cloud.database()
        const res = await db.collection('products').limit(20).get()
        if (res.data && res.data.length > 0) {
          // 云数据库有数据，统一格式（_id → id）
          products = res.data.map(p => ({ ...p, id: p._id || p.id }))
        } else {
          // 云库为空，播种本地数据
          app.initCloudProducts()
        }
      } catch (e) {
        // 云不可用，使用本地数据
        console.warn('云数据库不可用，使用本地数据')
      }
    }

    // 保存到全局，供详情页使用
    app.globalData.products = products

    this.setData({
      products,
      flashProds: products.slice(0, 3),
      displayProds: products
    })
  },

  // 分类筛选
  onCat(e) {
    const name = e.currentTarget.dataset.name
    const products = this.data.products
    const displayProds = name === '全部'
      ? products
      : products.filter(p => p.cat === name)
    this.setData({ catSel: name, displayProds })
  },

  // 点击商品进入详情
  onProduct(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.products.find(p => p.id === id)
    if (!product) return
    app.globalData.selectedProduct = product
    wx.navigateTo({ url: '/pages/supplies-detail/index' })
  },

  // 点击秒杀商品进入详情
  onFlashItem(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.flashProds.find(p => p.id === id)
    if (!product) return
    app.globalData.selectedProduct = product
    wx.navigateTo({ url: '/pages/supplies-detail/index' })
  },

  // 加入购物车（不跳转）
  onAddToCart(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.products.find(p => p.id === id)
    if (!product) return
    app.addToCart(product)
    this.setData({ cartCount: app.globalData.cartCount })
    wx.showToast({
      title: product.name.slice(0, 8) + '…已加入购物车',
      icon: 'none',
      duration: 1500
    })
  },

  // 跳转购物车
  goCart() {
    wx.navigateTo({ url: '/pages/supplies-cart/index' })
  },

  // 搜索（待开发）
  onSearch() {
    wx.showToast({ title: '搜索功能开发中', icon: 'none' })
  },

  // 活动横幅
  onBanner() {
    wx.showToast({ title: '活动详情开发中', icon: 'none' })
  },

  // 倒计时
  _startTimer() {
    let total = 24 * 60 + 44 // 秒
    const tick = () => {
      if (total <= 0) { this._stopTimer(); return }
      total--
      const h = Math.floor(total / 3600)
      const m = Math.floor((total % 3600) / 60)
      const s = total % 60
      this.setData({
        'timer.h': String(h).padStart(2, '0'),
        'timer.m': String(m).padStart(2, '0'),
        'timer.s': String(s).padStart(2, '0')
      })
    }
    this._timerInterval = setInterval(tick, 1000)
  },

  _stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval)
      this._timerInterval = null
    }
  }
})
