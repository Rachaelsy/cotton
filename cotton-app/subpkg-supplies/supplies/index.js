// pages/supplies/index.js — 农资商城首页
const app = getApp()
const layout = require('../../utils/layout')
const { CATS } = require('../../utils/data')
const i18n = require('../../utils/i18n')

const COPY = {
  zh: { title:'农资供应',coupons:'领券中心',couponSub:'先领券，结算自动选优惠',search:'搜索农药、化肥、种子…',spring:'春耕特惠',seedFert:'种子化肥',discount:'全场8折起',quality:'质量保证',certified:'认证农资',compensation:'假一赔十',popular:'棉农都在买',more:'更多 ›',new:'新品',hot:'热销',merchant:'认证商家',notFound:'未找到相关商品',empty:'该分类暂无商品',loadFail:'商品加载失败，请稍后重试',selected:'已选',piece:'件',estimate:'预估',bestCoupon:'最优券省',checkout:'去结算',max:'库存不足',genuine:'正品保证',genuineDesc:'所有商品均来自认证农资企业，假一赔十',return7:'7天退换',returnDesc:'收货后7天内可按规则申请退换',transport:'运输保障',transportDesc:'运输途中损坏，可凭照片申请售后',compliance:'合规认证',complianceDesc:'农药、化肥等应持有合法登记证书',know:'我知道了' },
  ug: { title:'دېھقانچىلىق ماتېرىياللىرى',coupons:'ئېتىبار بېلىتى',couponSub:'ئالدى بىلەن بېلەت ئېلىڭ',search:'دورا، ئوغۇت، ئۇرۇق ئىزدەش…',spring:'ئەتىيازلىق ئېتىبار',seedFert:'ئۇرۇق ۋە ئوغۇت',discount:'%20 تىن باشلانغان ئېتىبار',quality:'سۈپەت كاپالىتى',certified:'تەستىقلانغان ماتېرىيال',compensation:'ساختا بولسا تۆلەم',popular:'دېھقانلار سېتىۋاتىدۇ',more:'تېخىمۇ كۆپ ›',new:'يېڭى',hot:'قىزىق',merchant:'تەستىقلانغان سودىگەر',notFound:'ماس مەھسۇلات تېپىلمىدى',empty:'بۇ تۈردە مەھسۇلات يوق',loadFail:'مەھسۇلات يۈكلەنمىدى',selected:'تاللاندى',piece:'دانە',estimate:'مۆلچەر',bestCoupon:'ئەڭ ياخشى بېلەت',checkout:'ھېسابلاش',max:'ئامبار يېتەرلىك ئەمەس',genuine:'ھەقىقىي مەھسۇلات كاپالىتى',genuineDesc:'مەھسۇلاتلار تەستىقلانغان كارخانىلاردىن تەمىنلىنىدۇ',return7:'7 كۈن ئىچىدە قايتۇرۇش',returnDesc:'تاپشۇرۇۋالغاندىن كېيىن قائىدە بويىچە قايتۇرۇشقا بولىدۇ',transport:'توشۇش كاپالىتى',transportDesc:'توشۇشتا بۇزۇلسا رەسىم بىلەن بىر تەرەپ قىلىشنى ئىلتىماس قىلىڭ',compliance:'قانۇنلۇق تەستىق',complianceDesc:'دورا ۋە ئوغۇتنىڭ قانۇنلۇق تىزىملاش ئىسپاتى بولۇشى كېرەك',know:'بىلدىم' }
}

const CAT_UG = { '全部':'ھەممىسى','农药':'دورا','化肥':'ئوغۇت','种子':'ئۇرۇق','农膜':'يېپىش پەردىسى','农具':'دېھقانچىلىق قورالى','其他':'باشقا' }

function displayCats(lang) {
  return CATS.map(item => ({ ...item, label: lang === 'ug' ? (CAT_UG[item.name] || item.name) : item.name }))
}

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: COPY[i18n.getLanguage()],
    capsuleSafeRight: 0,
    products: [],
    cats: displayCats(i18n.getLanguage()),
    catSel: '全部',
    searchKeyword: '',
    displayProds: [],
    cartCount: 0,
    cartTotal: '0.00',
    cartCouponDiscount: '0.00',
    cartQuoteError: '',
    showQualityPopup: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })
    this._loadProducts()
  },

  onShow() {
    const lang = i18n.getLanguage()
    this.setData({ lang, copy: COPY[lang], cats: displayCats(lang) })
    this._syncCartState()
  },

  // 商品必须来自后端，避免本地演示商品 ID 与数据库商品 ID 冲突
  async _loadProducts() {
    const cached = app.globalData.products || []
    if (cached.length) this.setData({ products: cached, displayProds: cached })

    try {
      const auth = require('../../utils/auth')
      const res = await auth.request('GET', '/api/products')
      if (res.code === 200 && Array.isArray(res.data)) {
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
          original_price: Number(p.original_price !== undefined ? p.original_price : p.price),
          display_price: Number(p.display_price !== undefined ? p.display_price : p.price),
          store:           p.company_name || this.data.copy.merchant,
          cat:             p.category || '其他',
          merchant_wechat: p.merchant_wechat || ''
        }))
        app.globalData.products = products
        this._reconcileCart(products)
        const { catSel } = this.data
        const displayProds = catSel === '全部' ? products : products.filter(p => p.cat === catSel)
        this.setData({ products, displayProds })
        this._syncCartState()
      }
    } catch (e) {
      console.warn('商品 API 不可用:', e.message)
      if (!cached.length) wx.showToast({ title: this.data.copy.loadFail, icon: 'none' })
    }
  },

  _reconcileCart(products) {
    const byId = new Map(products.map(product => [String(product.id), product]))
    const nextCart = (app.globalData.cart || []).flatMap(item => {
      const product = byId.get(String(item.id))
      // 旧版本地演示商品没有 merchant_id，不能带入真实下单链路
      if (!product || !item.merchant_id) return []
      const stock = Number(product.stock)
      const qty = Math.min(Math.max(Number(item.qty) || 1, 1), Number.isFinite(stock) ? stock : 999)
      return qty > 0 ? [{ ...item, ...product, qty }] : []
    })
    app.globalData.cart = nextCart
    app.saveCart()
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
      cartCouponDiscount: '0.00',
      cartQuoteError: ''
    })
    clearTimeout(this._cartQuoteTimer)
    if (summary.count) {
      this._cartQuoteTimer = setTimeout(() => this._loadBestCartSummary(quoteVersion), 80)
    }
  },

  async _loadBestCartSummary(quoteVersion) {
    const summary = await app.getBestCartSummary()
    if (quoteVersion !== this._cartQuoteVersion || summary.count !== app.globalData.cartCount) return
    this.setData({ cartTotal: summary.total, cartCouponDiscount: summary.couponDiscount, cartQuoteError: summary.errorMessage || '' })
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
    wx.navigateTo({ url: `/subpkg-supplies/supplies-detail/index?id=${id}` })
  },

  // 加入购物车（不跳转）
  onAddToCart(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.products.find(p => String(p.id) === String(id))
    if (!product) return
    const current = (app.globalData.cart || []).find(item => String(item.id) === String(id))
    const stock = Number(product.stock)
    if (Number.isFinite(stock) && (stock <= 0 || Number(current?.qty || 0) >= stock)) {
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

  // 跳转购物车
  goCart() {
    wx.navigateTo({ url: '/subpkg-supplies/supplies-cart/index' })
  },

  goCheckout() {
    if (!this.data.cartCount) return
    wx.navigateTo({ url: '/subpkg-supplies/supplies-checkout/index' })
  },

  goCoupons() {
    wx.navigateTo({ url: '/subpkg-supplies/marketing-coupons/index' })
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
