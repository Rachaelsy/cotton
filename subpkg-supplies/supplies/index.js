// pages/supplies/index.js — 农资商城首页
const app = getApp()
const layout = require('../../utils/layout')
const { PRODUCTS, CATS } = require('../../utils/data')

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    products: [],
    cats: CATS,
    catSel: '全部',
    searchKeyword: '',
    displayProds: [],
    cartCount: 0,
    showQualityPopup: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })
    // 先尝试定位（用于判断是否超出商户配送范围），无论成败都加载
    wx.getLocation({
      type: 'gcj02',
      success: (res) => { this._lat = res.latitude; this._lng = res.longitude; this._loadProducts() },
      fail: () => { this._lat = null; this._lng = null; this._loadProducts() }
    })
  },

  onShow() {
    this.setData({ cartCount: app.globalData.cartCount })
  },

  // 加载商品数据（优先后端 API，兜底本地数据）
  async _loadProducts() {
    // 立即渲染本地数据，避免网络等待期间显示空列表
    app.globalData.products = PRODUCTS
    this.setData({ products: PRODUCTS, displayProds: PRODUCTS })

    try {
      const auth = require('../../utils/auth')
      const geoQs = (this._lat && this._lng) ? `?lat=${this._lat}&lng=${this._lng}` : ''
      const res = await auth.request('GET', '/api/products' + geoQs)
      if (res.code === 200 && res.data && res.data.length > 0) {
        const products = res.data.map(p => ({
          ...p,
          id:        String(p.id),
          spec:      p.unit || '',
          imgBg:     p.image_url ? '#F5EEE6' : 'linear-gradient(135deg,#C8902E,#D4A043)',
          image_url: p.image_url ? `${auth.BASE_URL}${p.image_url}` : null,
          hot:       false,
          isNew:     false,
          sold:      parseInt(p.sold) || 0,
          rating:    5.0,
          store:           p.company_name || '认证商家',
          cat:             p.category || '其他',
          merchant_wechat: p.merchant_wechat || '',
          outOfRange:      !!p.out_of_range,
          deliveryText:    p.delivery_distance_km != null ? `${p.delivery_distance_km}km` : ''
        }))
        app.globalData.products = products
        const { catSel } = this.data
        const displayProds = catSel === '全部' ? products : products.filter(p => p.cat === catSel)
        this.setData({ products, displayProds })
      }
    } catch (e) {
      console.warn('后端 API 不可用，使用本地数据:', e.message)
    }
  },

  // 统一过滤：分类 + 关键词
  _filter(products, catSel, keyword) {
    let list = catSel === '全部' ? products : products.filter(p => p.cat === catSel)
    if (keyword) {
      const kw = keyword.toLowerCase()
      list = list.filter(p => p.name && p.name.toLowerCase().includes(kw))
    }
    return list
  },

  // 分类筛选
  onCat(e) {
    const name = e.currentTarget.dataset.name
    const displayProds = this._filter(this.data.products, name, this.data.searchKeyword)
    this.setData({ catSel: name, displayProds })
  },

  // 搜索输入（实时过滤）
  onSearchInput(e) {
    const keyword = e.detail.value
    const displayProds = this._filter(this.data.products, this.data.catSel, keyword)
    this.setData({ searchKeyword: keyword, displayProds })
  },

  // 键盘确认搜索
  onSearchConfirm(e) {
    const keyword = e.detail.value
    const displayProds = this._filter(this.data.products, this.data.catSel, keyword)
    this.setData({ searchKeyword: keyword, displayProds })
  },

  // 清除搜索
  onSearchClear() {
    const displayProds = this._filter(this.data.products, this.data.catSel, '')
    this.setData({ searchKeyword: '', displayProds })
  },

  // 点击商品进入详情
  onProduct(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.products.find(p => p.id === id)
    if (!product) return
    app.globalData.selectedProduct = product
    wx.navigateTo({ url: '/subpkg-supplies/supplies-detail/index' })
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
    wx.navigateTo({ url: '/subpkg-supplies/supplies-cart/index' })
  },

  // 活动横幅：春耕特惠，展示种子和化肥类商品
  onBanner() {
    const promoCategories = ['种子', '化肥']
    const promoProds = this.data.products.filter(p => promoCategories.includes(p.cat))
    if (!promoProds.length) {
      wx.showToast({ title: '暂无促销商品', icon: 'none' }); return
    }
    this.setData({ catSel: '全部', searchKeyword: '', displayProds: promoProds })
    wx.showToast({ title: '🌱 春耕特惠 · 种子化肥专区', icon: 'none', duration: 2000 })
  },

  onQualityBanner() {
    this.setData({ showQualityPopup: true })
  },

  onCloseQualityPopup() {
    this.setData({ showQualityPopup: false })
  },

})
