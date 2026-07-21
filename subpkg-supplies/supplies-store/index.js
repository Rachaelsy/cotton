// pages/supplies-store/index.js — 店铺详情页
const app = getApp()
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')
const i18n = require('../../utils/i18n')
const COPY = {
  zh: { goodsPrefix:'共',goodsSuffix:'件商品',loading:'加载中...',empty:'该店铺暂无商品',store:'店铺',verified:'认证商家',other:'其他',all:'全部',loadFail:'加载失败',selected:'已选',piece:'件',estimate:'预估',bestCoupon:'最优券省',checkout:'去结算',max:'库存不足' },
  ug: { goodsPrefix:'جەمئىي',goodsSuffix:'دانە مال',loading:'يۈكلىنىۋاتىدۇ...',empty:'بۇ دۇكاندا مال يوق',store:'دۇكان',verified:'دەلىللەنگەن ساتقۇچى',other:'باشقا',all:'ھەممىسى',loadFail:'يۈكلەش مەغلۇپ',selected:'تاللاندى',piece:'دانە',estimate:'مۆلچەر',bestCoupon:'ئەڭ ياخشى بېلەت',checkout:'ھېسابلاش',max:'ئامبار يېتەرلىك ئەمەس' }
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
    cartTotal: '0.00',
    cartCouponDiscount: '0.00',
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
    this.setData({ lang, copy, cats: catOptions(canonicalCats, lang, copy) })
    this._syncCartState()
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
        this._syncCartState()
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
          rating:    5.0,
          original_price: Number(p.original_price !== undefined ? p.original_price : p.price),
          display_price: Number(p.display_price !== undefined ? p.display_price : p.price)
        }))
        const catSet = new Set(products.map(p => p.cat).filter(Boolean))
        const cats = ['全部', ...catSet]
        const name = products.length > 0
          ? (products[0].company_name || this.data.storeName)
          : this.data.storeName
        this.setData({ products, displayProds: products, cats: catOptions(cats, this.data.lang, this.data.copy), storeName: name, loading: false })
        this._syncCartState()
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
    const product = this.data.products.find(p => String(p.id) === String(id))
    if (!product) return
    app.globalData.selectedProduct = product
    wx.navigateTo({ url: '/subpkg-supplies/supplies-detail/index' })
  },

  onAddToCart(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.products.find(p => String(p.id) === String(id))
    if (!product) return
    const current = (app.globalData.cart || []).find(item => String(item.id) === String(id))
    if (current && Number(current.qty) >= Number(product.stock)) {
      wx.showToast({ title: this.data.copy.max, icon: 'none' })
      return
    }
    app.addToCart(product)
    this._syncCartState()
  },

  onQtyMinus(e) {
    const id = e.currentTarget.dataset.id
    const item = (app.globalData.cart || []).find(cartItem => String(cartItem.id) === String(id))
    if (!item) return
    if (Number(item.qty) > 1) {
      item.qty--
      app.saveCart()
    } else {
      app.removeFromCart(id)
    }
    this._syncCartState()
  },

  _syncCartState() {
    const summary = app.getCartSummary()
    const quoteVersion = (this._cartQuoteVersion || 0) + 1
    this._cartQuoteVersion = quoteVersion
    const qtyById = new Map((app.globalData.cart || []).map(item => [String(item.id), Number(item.qty) || 0]))
    const attachQty = product => ({ ...product, cartQty: qtyById.get(String(product.id)) || 0 })
    this.setData({
      products: this.data.products.map(attachQty),
      displayProds: this.data.displayProds.map(attachQty),
      cartCount: summary.count,
      cartTotal: summary.total,
      cartCouponDiscount: '0.00'
    })
    clearTimeout(this._cartQuoteTimer)
    if (summary.count) {
      this._cartQuoteTimer = setTimeout(() => this._loadBestCartSummary(quoteVersion), 80)
    }
  },

  async _loadBestCartSummary(quoteVersion) {
    const summary = await app.getBestCartSummary()
    if (quoteVersion !== this._cartQuoteVersion || summary.count !== app.globalData.cartCount) return
    this.setData({ cartTotal: summary.total, cartCouponDiscount: summary.couponDiscount })
  },

  onGoCart() {
    wx.navigateTo({ url: '/subpkg-supplies/supplies-cart/index' })
  },

  onCheckout() {
    if (!this.data.cartCount) return
    wx.navigateTo({ url: '/subpkg-supplies/supplies-checkout/index' })
  },

  onCoupons() {
    wx.navigateTo({ url: `/subpkg-supplies/marketing-coupons/index?merchant_id=${this.data.merchantId}` })
  }
})
