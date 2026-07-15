// subpkg-supplies/supplies-review/index.js — 买家评价
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')
const i18n = require('../../utils/i18n')
const COPY = {
  zh: { title:'买家评价',success:'评价成功！',thanks:'感谢您的反馈，您的评价将帮助更多买家',backOrder:'返回订单',order:'评价订单',overall:'整体评分',hints:['点击星星评分','非常差','较差','一般','满意','非常满意'],content:'评价内容（选填）',placeholder:'说说商品质量、发货速度、商家服务...',anonymous:'匿名评价（商家可见真实姓名，公开展示为“匿名用户”）',submitting:'提交中...',submit:'提交评价',chooseRating:'请先选择星级',submitFail:'提交失败',network:'网络异常，请重试' },
  ug: { title:'سېتىۋالغۇچى باھاسى',success:'باھا مۇۋەپپەقىيەتلىك!',thanks:'پىكرىڭىز باشقا سېتىۋالغۇچىلارغا ياردەم بېرىدۇ',backOrder:'زاكازغا قايتىش',order:'زاكازنى باھالاش',overall:'ئومۇمىي باھا',hints:['يۇلتۇزنى چېكىپ باھالاڭ','بەك ناچار','ناچار','ئادەتتىكى','رازى','بەك رازى'],content:'باھا مەزمۇنى (ئىختىيارى)',placeholder:'مال سۈپىتى، ئەۋەتىش سۈرئىتى ۋە مۇلازىمەتنى يېزىڭ...',anonymous:'نامسىز باھالاش',submitting:'يوللىنىۋاتىدۇ...',submit:'باھا يوللاش',chooseRating:'ئالدى بىلەن يۇلتۇز تاللاڭ',submitFail:'يوللاش مەغلۇپ',network:'تور نورمال ئەمەس، قايتا سىناڭ' }
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    orderId: null,
    orderNo: '',
    items: [],
    rating: 0,
    content: '',
    isAnonymous: false,
    submitting: false,
    submitted: false
    ,copy: COPY.zh, ratingHint: COPY.zh.hints[0]
  },

  onShow() {
    const lang = i18n.getLanguage()
    const copy = COPY[lang] || COPY.zh
    this.setData({ copy, ratingHint: copy.hints[this.data.rating] || copy.hints[0] })
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      orderId:  options.order_id || null,
      orderNo:  options.order_no  || '',
      items:    options.items ? JSON.parse(decodeURIComponent(options.items)) : []
    })
  },

  onStarTap(e) {
    const rating = parseInt(e.currentTarget.dataset.val)
    this.setData({ rating, ratingHint: this.data.copy.hints[rating] || this.data.copy.hints[0] })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  onAnonymousChange(e) {
    this.setData({ isAnonymous: e.detail.value })
  },

  async onSubmit() {
    if (!this.data.rating) {
      wx.showToast({ title: this.data.copy.chooseRating, icon: 'none' }); return
    }
    if (this.data.submitting) return
    this.setData({ submitting: true })
    try {
      const res = await auth.request('POST', `/api/orders/${this.data.orderId}/review`, {
        rating:       this.data.rating,
        content:      this.data.content.trim(),
        is_anonymous: this.data.isAnonymous
      })
      if (res.code === 200) {
        this.setData({ submitted: true })
      } else {
        wx.showToast({ title: res.msg || this.data.copy.submitFail, icon: 'none' })
      }
    } catch {
      wx.showToast({ title: this.data.copy.network, icon: 'none' })
    }
    this.setData({ submitting: false })
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/my/index' })
  },

  onDone() {
    wx.navigateBack()
  }
})
