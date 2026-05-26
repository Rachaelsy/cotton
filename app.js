// app.js
// 棉管家小程序 - 主入口

// ⚠️ 使用云开发前，请先在微信开发者工具中开启「云开发」并创建环境
// 将下面的 YOUR_CLOUD_ENV_ID 替换为您的云环境ID（如 cloud1-xxxxxxxx）
const CLOUD_ENV = 'YOUR_CLOUD_ENV_ID'

const { PRODUCTS } = require('./utils/data')
const auth = require('./utils/auth')

App({
  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: CLOUD_ENV,
        traceUser: true
      })
    }

    // 从本地存储恢复购物车
    try {
      const saved = wx.getStorageSync('cart')
      if (saved && Array.isArray(saved)) this.globalData.cart = saved
    } catch (e) {}

    // 从本地存储恢复收藏
    try {
      const savedFavs = wx.getStorageSync('favorites')
      if (savedFavs && Array.isArray(savedFavs)) this.globalData.favorites = savedFavs
    } catch (e) {}

    this._refreshCartCount()

    // 获取系统信息
    const info = wx.getSystemInfoSync()
    this.globalData.statusBarHeight = info.statusBarHeight || 20
    this.globalData.navBarHeight = 44

    // 恢复本地用户信息；静默验证 Token，过期则清除但不强制跳转
    const cachedUser = auth.getUser()
    if (cachedUser) {
      this.globalData.user = cachedUser
      auth.verify().then(valid => {
        if (!valid) {
          // Token 失效：清除本地状态，页面自行刷新 UI
          this.globalData.user = null
        }
      })
    }
  },

  // 刷新购物车数量
  _refreshCartCount() {
    this.globalData.cartCount = this.globalData.cart.reduce(
      (s, c) => s + (c.qty || 0), 0
    )
  },

  // 持久化购物车到本地存储
  saveCart() {
    wx.setStorageSync('cart', this.globalData.cart)
    this._refreshCartCount()
    // 通知已注册的监听器（如农资首页的购物车角标）
    if (typeof this.onCartChange === 'function') {
      this.onCartChange(this.globalData.cartCount)
    }
  },

  // 加入购物车
  addToCart(product) {
    const cart = this.globalData.cart
    const existing = cart.find(c => c.id === product.id)
    if (existing) {
      existing.qty++
    } else {
      cart.push({ ...product, qty: 1 })
    }
    this.saveCart()
  },

  // 从购物车移除
  removeFromCart(productId) {
    const cart = this.globalData.cart
    const idx = cart.findIndex(c => c.id === productId)
    if (idx >= 0) cart.splice(idx, 1)
    this.saveCart()
  },

  // 清空购物车
  clearCart() {
    this.globalData.cart = []
    this.saveCart()
  },

  // 收藏相关
  saveFavorites() {
    wx.setStorageSync('favorites', this.globalData.favorites)
  },

  addToFavorites(product) {
    const favs = this.globalData.favorites
    if (!favs.find(f => f.id === product.id)) {
      favs.push({ ...product })
      this.saveFavorites()
    }
  },

  removeFromFavorites(productId) {
    const favs = this.globalData.favorites
    const idx = favs.findIndex(f => f.id === productId)
    if (idx >= 0) {
      favs.splice(idx, 1)
      this.saveFavorites()
    }
  },

  isFavorited(productId) {
    return this.globalData.favorites.some(f => f.id === productId)
  },

  // 初始化云数据库商品（首次运行时播种）
  async initCloudProducts() {
    if (!wx.cloud) return
    try {
      const db = wx.cloud.database()
      const res = await db.collection('products').count()
      if (res.total === 0) {
        // 播种初始商品数据
        for (const p of PRODUCTS) {
          await db.collection('products').add({ data: p }).catch(() => {})
        }
        console.log('云数据库商品数据已初始化')
      }
    } catch (e) {
      console.warn('云数据库初始化失败，将使用本地数据:', e.message)
    }
  },

  globalData: {
    cart: [],
    cartCount: 0,
    favorites: [],
    statusBarHeight: 20,
    navBarHeight: 44,
    user: null,
    selectedProduct: null,
    localProducts: PRODUCTS
  }
})
