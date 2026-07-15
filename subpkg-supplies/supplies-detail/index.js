// pages/supplies-detail/index.js — 商品详情页
const app = getApp()

const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const COPY = {
  zh: { piece:'件',buyerMark:'买',monthly:'月销',score:'分',ship48:'48h发货',deliverTo:'送至',address:'新疆喀什地区疏附县',express:'快递 ¥0',service:'服务',return7:'7天退换',tenfold:'假一赔十',genuine:'正品保证',store:'店铺',verifiedMerchant:'认证商家',reviews:'买家评价',all:'全部',reviewUnit:'条',reviewCount:'共',noReviewText:'该用户没有填写评价',reply:'商家回复：',noReviews:'暂无评价，快来抢首评吧',intro:'商品介绍',spec:'规格',category:'分类',unit:'单位',stock:'库存',direct:'正品直供 · 品质保证',customerService:'客服',quality:'质量保证',favorite:'收藏',addCart:'加入购物车',buy:'购买',genuineDesc:'所有商品均来自认证农资企业，假一赔十',returnDesc:'收货后7天内，商品无质量问题可申请退换',transport:'运输保障',transportDesc:'运输途中损坏，凭照片全额赔偿',compliance:'合规认证',complianceDesc:'农药、化肥等均持有合法登记证书',know:'我知道了',contact:'联系客服',contactSub:'微信扫码或搜索添加客服',wechat:'客服微信号',copyWechat:'复制微信号',copyTip:'复制后打开微信，搜索并粘贴即可添加',loading:'商品加载中...',favOn:'已收藏',favOff:'已取消收藏',cartAdded:'已加入购物车',noWechat:'该商家暂未设置客服微信',wechatCopied:'微信号已复制',reviewToast:'条评价' },
  ug: { piece:'دانە',buyerMark:'ئ',monthly:'ئايلىق سېتىش',score:'نومۇر',ship48:'48 سائەتتە ئەۋەتىش',deliverTo:'يەتكۈزۈش',address:'شىنجاڭ قەشقەر كونا شەھەر ناھىيەسى',express:'تېز يوللانما ¥0',service:'مۇلازىمەت',return7:'7 كۈندە قايتۇرۇش',tenfold:'ساختا بولسا تۆلەم',genuine:'ھەقىقىي مال كاپالىتى',store:'دۇكان',verifiedMerchant:'دەلىللەنگەن ساتقۇچى',reviews:'سېتىۋالغۇچى باھاسى',all:'ھەممىسى',reviewUnit:'باھا',reviewCount:'جەمئىي',noReviewText:'بۇ ئىشلەتكۈچى باھا يازمىغان',reply:'ساتقۇچى جاۋابى: ',noReviews:'باھا يوق، تۇنجى باھانى سىز بېرىڭ',intro:'مال تونۇشتۇرۇشى',spec:'ئۆلچەم',category:'تۈر',unit:'بىرلىك',stock:'ئامبار',direct:'ھەقىقىي مال · سۈپەت كاپالىتى',customerService:'مۇلازىمەت',quality:'سۈپەت كاپالىتى',favorite:'ساقلاش',addCart:'ھارۋىغا قوشۇش',buy:'سېتىۋېلىش',genuineDesc:'بارلىق مال دەلىللەنگەن دېھقانچىلىق كارخانىلىرىدىن كېلىدۇ',returnDesc:'تاپشۇرۇۋالغاندىن كېيىن 7 كۈن ئىچىدە قايتۇرغىلى بولىدۇ',transport:'توشۇش كاپالىتى',transportDesc:'توشۇشتا بۇزۇلسا رەسىم بىلەن تۆلەم بېرىلىدۇ',compliance:'قانۇنلۇق دەلىل',complianceDesc:'دېھقانچىلىق دورىسى ۋە ئوغۇتتا قانۇنلۇق تىزىملاش گۇۋاھنامىسى بار',know:'بىلدىم',contact:'مۇلازىمەت بىلەن ئالاقە',contactSub:'ۋېيشىندا ئىزدەپ مۇلازىمەتچىنى قوشۇڭ',wechat:'مۇلازىمەت ۋېيشىنى',copyWechat:'ۋېيشىننى كۆچۈرۈش',copyTip:'كۆچۈرۈپ ۋېيشىندا ئىزدەپ قوشۇڭ',loading:'مال يۈكلىنىۋاتىدۇ...',favOn:'ساقلاندى',favOff:'ساقلاش بىكار قىلىندى',cartAdded:'ھارۋىغا قوشۇلدى',noWechat:'ساتقۇچى مۇلازىمەت ۋېيشىنىنى تەڭشىمىگەن',wechatCopied:'ۋېيشىن كۆچۈرۈلدى',reviewToast:'باھا' }
}

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
    ,copy: COPY.zh
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const product = app.globalData.selectedProduct
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      product,
      copy: COPY[i18n.getLanguage()] || COPY.zh,
      cartCount: app.globalData.cartCount,
      favorited: product ? app.isFavorited(product.id) : false
    })
    if (product?.merchant_id) this._loadReviews(product.merchant_id)
  },

  onShow() {
    const lang = i18n.getLanguage()
    this.setData({ cartCount: app.globalData.cartCount, copy: COPY[lang] || COPY.zh })
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
    wx.showToast({ title: next ? this.data.copy.favOn : this.data.copy.favOff, icon: 'none', duration: 1200 })
  },

  onAddToCart() {
    const p = this.data.product
    if (!p) return
    app.addToCart(p)
    this.setData({ cartCount: app.globalData.cartCount })
    wx.showToast({ title: this.data.copy.cartAdded, icon: 'success' })
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
    const storeName = encodeURIComponent(p.store || p.company_name || this.data.copy.store)
    wx.navigateTo({
      url: `/subpkg-supplies/supplies-store/index?merchant_id=${p.merchant_id}&store_name=${storeName}`
    })
  },

  onCustomerService() {
    const p = this.data.product
    if (!p) return
    if (!p.merchant_wechat) {
      wx.showToast({ title: this.data.copy.noWechat, icon: 'none' })
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
      success: () => wx.showToast({ title: this.data.copy.wechatCopied, icon: 'success' })
    })
  },

  onShowReviews() {
    wx.showToast({ title: `${this.data.copy.reviewCount} ${this.data.reviewTotal} ${this.data.copy.reviewToast}`, icon: 'none' })
  },

  onQualityGuarantee() {
    this.setData({ showQualityPopup: true })
  },

  onCloseQualityPopup() {
    this.setData({ showQualityPopup: false })
  }
})
