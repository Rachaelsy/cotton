// pages/supplies-store/index.js — 店铺详情页
const app = getApp()
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')
const i18n = require('../../utils/i18n')
const COPY = {
  zh: { goodsPrefix:'共',goodsSuffix:'件商品',loading:'加载中...',empty:'该店铺暂无商品',store:'店铺',verified:'认证商家',other:'其他',all:'全部',loadFail:'加载失败',cartAdded:'已加入购物车' },
  ug: { goodsPrefix:'جەمئىي',goodsSuffix:'دانە مال',loading:'يۈكلىنىۋاتىدۇ...',empty:'بۇ دۇكاندا مال يوق',store:'دۇكان',verified:'دەلىللەنگەن ساتقۇچى',other:'باشقا',all:'ھەممىسى',loadFail:'يۈكلەش مەغلۇپ',cartAdded:'ھارۋىغا قوشۇلدى' }
}

function catOptions(cats, lang, copy) {
  return cats.map(value => ({ value, label: value === '全部' ? copy.all : i18n.localizeText(value, lang) }))
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    merchantId: null,
    storeName: '',
    products: [],
    displayProds: [],
    cats: [{ value: '全部', label: COPY.zh.all }],
    catSel: '全部',
    loading: true,
    cartCount: 0,
    lang: 'zh', copy: COPY.zh
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    const merchantId = options.merchant_id ? parseInt(options.merchant_id) : null
    const storeName  = options.store_name  ? decodeURIComponent(options.store_name) : ''
    const lang = i18n.getLanguage()
    const copy = COPY[lang] || COPY.zh
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      merchantId,
      storeName: storeName || copy.store,
      lang, copy,
      cartCount: app.globalData.cartCount
    })
    this._loadProducts(merchantId, storeName)
  },

  onShow() {
    const lang = i18n.getLanguage()
    const copy = COPY[lang] || COPY.zh
    const canonicalCats = this.data.cats.map(item => item.value || item)
    this.setData({ cartCount: app.globalData.cartCount, lang, copy, cats: catOptions(canonicalCats, lang, copy) })
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
        this.setData({ products, displayProds: products, cats: catOptions(cats, this.data.lang, this.data.copy), loading: false })
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
          store:     p.company_name || this.data.copy.verified,
          cat:       p.category || '其他',
          sold:      parseInt(p.sold) || 0,
          rating:    5.0
        }))
        const catSet = new Set(products.map(p => p.cat).filter(Boolean))
        const cats = ['全部', ...catSet]
        const name = products.length > 0
          ? (products[0].company_name || this.data.storeName)
          : this.data.storeName
        this.setData({ products, displayProds: products, cats: catOptions(cats, this.data.lang, this.data.copy), storeName: name, loading: false })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('[store load]', e)
      this.setData({ loading: false })
      wx.showToast({ title: this.data.copy.loadFail, icon: 'none' })
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
    wx.showToast({ title: this.data.copy.cartAdded, icon: 'success', duration: 1200 })
  },

  onGoCart() {
    wx.navigateTo({ url: '/subpkg-supplies/supplies-cart/index' })
  }
})
