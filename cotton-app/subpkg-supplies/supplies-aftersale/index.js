// pages/supplies-aftersale/index.js — 售后申请页
const app  = getApp()
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')
const i18n = require('../../utils/i18n')

const TYPES   = ['退货退款', '仅退款', '换货']
const REASONS = [
  '不喜欢/不想要', '商品质量问题', '发错货/漏发',
  '规格/尺寸不符', '物流破损/压坏', '未收到货', '其他'
]
const COPY = {
  zh: { title:'申请售后',type:'售后类型',reason:'售后原因',specific:'具体原因',specificPh:'请描述您的具体原因',description:'问题描述',optional:'（选填）',descPh:'简单描述问题，方便商家快速处理（10–200字）',upload:'上传凭证',uploadOptional:'（选填，最多6张）',uploadTip:'建议上传商品问题、快递面单、破损照片',uploadImage:'上传图片',submitting:'提交中...',submit:'提交申请',maxImages:'最多上传6张',missingOrder:'订单信息缺失',successTitle:'申请已提交',successContent:'售后申请已提交，商家将在48小时内处理，请耐心等待。',know:'知道了',submitFail:'提交失败',network:'网络异常，请重试',types:['退货退款','仅退款','换货'],reasons:REASONS },
  ug: { title:'سېتىشتىن كېيىنكى ئىلتىماس',type:'ئىلتىماس تۈرى',reason:'ئىلتىماس سەۋەبى',specific:'تەپسىلىي سەۋەب',specificPh:'تەپسىلىي سەۋەبنى يېزىڭ',description:'مەسىلە چۈشەندۈرۈشى',optional:'(ئىختىيارى)',descPh:'ساتقۇچى بىر تەرەپ قىلىشى ئۈچۈن مەسىلىنى چۈشەندۈرۈڭ',upload:'ئىسپات رەسىمى',uploadOptional:'(ئىختىيارى، ئەڭ كۆپ 6)',uploadTip:'مال، تېز يوللانما ياكى بۇزۇلغان يەرنىڭ رەسىمىنى يوللاڭ',uploadImage:'رەسىم يوللاش',submitting:'يوللىنىۋاتىدۇ...',submit:'ئىلتىماس يوللاش',maxImages:'ئەڭ كۆپ 6 رەسىم',missingOrder:'زاكاز ئۇچۇرى كەم',successTitle:'ئىلتىماس يوللاندى',successContent:'ساتقۇچى 48 سائەت ئىچىدە بىر تەرەپ قىلىدۇ.',know:'بىلدىم',submitFail:'يوللاش مەغلۇپ',network:'تور نورمال ئەمەس، قايتا سىناڭ',types:['مال قايتۇرۇپ پۇل ئېلىش','پەقەت پۇل قايتۇرۇش','مال ئالماشتۇرۇش'],reasons:['ياقتۇرمىدىم','مال سۈپىتى مەسىلىسى','خاتا ياكى كەم ئەۋەتىلدى','ئۆلچىمى ماس ئەمەس','توشۇشتا بۇزۇلدى','مالنى ئالمىدىم','باشقا'] }
}

function options(values, labels) { return values.map((value, index) => ({ value, label: labels[index] || value })) }

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    copy: COPY.zh,
    types: options(TYPES, COPY.zh.types),
    reasons: options(REASONS, COPY.zh.reasons),
    orderId: null,

    aftersaleType: '',
    reason:        '',
    otherReason:   '',
    description:   '',
    images:        [],

    canSubmit:  false,
    submitting: false
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      orderId: options.order_id || null
    })
  },

  onShow() {
    const lang = i18n.getLanguage()
    const copy = COPY[lang] || COPY.zh
    this.setData({ copy, types: options(TYPES, copy.types), reasons: options(REASONS, copy.reasons) })
  },

  onSelectType(e) {
    this.setData({ aftersaleType: e.currentTarget.dataset.type })
    this._checkCanSubmit()
  },

  onSelectReason(e) {
    const reason = e.currentTarget.dataset.reason
    // 切换原因时清空"其他"输入
    this.setData({ reason, otherReason: '' })
    this._checkCanSubmit()
  },

  onOtherReasonInput(e) {
    this.setData({ otherReason: e.detail.value })
    this._checkCanSubmit()
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  _checkCanSubmit() {
    const { aftersaleType, reason, otherReason } = this.data
    const reasonOk = !!reason && (reason !== '其他' || otherReason.trim().length > 0)
    this.setData({ canSubmit: !!aftersaleType && reasonOk })
  },

  onChooseImage() {
    const { images } = this.data
    const remain = 6 - images.length
    if (remain <= 0) {
      wx.showToast({ title: this.data.copy.maxImages, icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newPaths = res.tempFiles.map(f => f.tempFilePath)
        this.setData({ images: [...images, ...newPaths].slice(0, 6) })
      }
    })
  },

  onRemoveImage(e) {
    const idx = e.currentTarget.dataset.index
    const images = this.data.images.filter((_, i) => i !== idx)
    this.setData({ images })
  },

  async onSubmit() {
    const { canSubmit, submitting, orderId, aftersaleType, reason, otherReason, description, images } = this.data
    if (!canSubmit || submitting) return
    if (!orderId) { wx.showToast({ title: this.data.copy.missingOrder, icon: 'none' }); return }
    this.setData({ submitting: true })
    try {
      // 上传图片，收集服务器URL
      const imageUrls = []
      for (const filePath of images) {
        await new Promise(resolve => {
          wx.uploadFile({
            url: auth.BASE_URL + '/api/upload',
            filePath,
            name: 'file',
            header: { Authorization: auth.getToken() ? `Bearer ${auth.getToken()}` : '' },
            success(r) {
              try {
                const d = JSON.parse(r.data)
                if (d.code === 200) imageUrls.push(d.data.url)
              } catch {}
              resolve()
            },
            fail() { resolve() }
          })
        })
      }

      const res = await auth.request('POST', `/api/orders/${orderId}/aftersale`, {
        aftersale_type: aftersaleType,
        reason,
        other_reason:  otherReason,
        description,
        images: imageUrls
      })
      if (res.code === 200) {
        wx.showModal({
          title: this.data.copy.successTitle,
          content: this.data.copy.successContent,
          showCancel: false,
          confirmText: this.data.copy.know,
          success: () => wx.navigateBack()
        })
      } else {
        wx.showToast({ title: res.msg || this.data.copy.submitFail, icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: this.data.copy.network, icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  onBack() {
    wx.navigateBack()
  }
})
