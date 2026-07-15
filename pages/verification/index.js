const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')

const COPY = {
  zh: {
    title: '实名认证', intro: '用于保障订单、补贴和金融服务安全。证件资料仅用于平台审核。',
    name: '真实姓名', namePh: '请输入身份证上的姓名', id: '身份证号码', idPh: '请输入18位身份证号码',
    front: '身份证人像面', back: '身份证国徽面', upload: '点击上传', replace: '重新上传',
    submit: '提交审核', submitting: '正在提交…', pending: '资料正在审核', pendingSub: '管理员审核完成后会更新状态，请稍后回来查看。',
    approved: '实名认证已通过', approvedSub: '身份资料已核验，可以继续使用完整农户功能。',
    rejected: '实名认证未通过', retry: '修改资料并重新提交', home: '进入棉花平台',
    needImages: '请上传身份证正反面照片', uploadFail: '证件图片上传失败', loadFail: '状态加载失败', submitFail: '提交失败'
  },
  ug: {
    title: 'ھەقىقىي ئىسىم دەلىللەش', intro: 'زاكاز، ياردەم پۇلى ۋە پۇل مۇئامىلە بىخەتەرلىكى ئۈچۈن. گۇۋاھنامە پەقەت سۇپا تەكشۈرۈشىگە ئىشلىتىلىدۇ.',
    name: 'ھەقىقىي ئىسىم', namePh: 'كىملىكتىكى ئىسىمنى كىرگۈزۈڭ', id: 'كىملىك نومۇرى', idPh: '18 خانىلىق كىملىك نومۇرى',
    front: 'كىملىك ئالدى', back: 'كىملىك ئارقىسى', upload: 'رەسىم يوللاش', replace: 'قايتا يوللاش',
    submit: 'تەكشۈرۈشكە يوللاش', submitting: 'يوللىنىۋاتىدۇ…', pending: 'ماتېرىيال تەكشۈرۈلۈۋاتىدۇ', pendingSub: 'باشقۇرغۇچى تەكشۈرگەندىن كېيىن ھالەت يېڭىلىنىدۇ.',
    approved: 'دەلىللەشتىن ئۆتتى', approvedSub: 'كىملىك ئۇچۇرى تەكشۈرۈلدى، تولۇق ئىقتىدارنى ئىشلىتەلەيسىز.',
    rejected: 'دەلىللەشتىن ئۆتمىدى', retry: 'تۈزىتىپ قايتا يوللاش', home: 'پاختا سۇپىسىغا كىرىش',
    needImages: 'كىملىكنىڭ ئالدى-ئارقا رەسىمىنى يوللاڭ', uploadFail: 'رەسىم يوللاش مەغلۇپ', loadFail: 'ھالەتنى يۈكلىيەلمىدى', submitFail: 'يوللاش مەغلۇپ بولدى'
  }
}

Page({
  data: {
    statusBarHeight: 20, copy: COPY.zh, status: 'loading', reason: '',
    realName: '', idNumber: '', frontPath: '', backPath: '', frontToken: '', backToken: '', submitting: false
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },
  onShow() {
    this.setData({ copy: COPY[i18n.getLanguage()] || COPY.zh })
    this.loadStatus()
  },
  async loadStatus() {
    try {
      const res = await auth.request('GET', '/api/verification')
      if (res.code !== 200) throw new Error(res.msg)
      const data = res.data || {}
      this.setData({ status: data.status || 'not_submitted', reason: data.reject_reason || '', realName: data.real_name || this.data.realName })
    } catch (error) {
      this.setData({ status: 'not_submitted' })
      wx.showToast({ title: error.message || this.data.copy.loadFail, icon: 'none' })
    }
  },
  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  chooseImage(e) {
    const side = e.currentTarget.dataset.side
    wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: result => this.uploadImage(side, result.tempFiles[0].tempFilePath) })
  },
  async uploadImage(side, filePath) {
    wx.showLoading({ title: this.data.copy.upload })
    try {
      const res = await auth.uploadFile('/api/verification/upload', filePath, 'image')
      if (res.code !== 200) throw new Error(res.msg)
      this.setData({ [`${side}Path`]: filePath, [`${side}Token`]: res.data.fileToken })
    } catch (error) {
      wx.showToast({ title: error.message || this.data.copy.uploadFail, icon: 'none' })
    } finally { wx.hideLoading() }
  },
  async submit() {
    if (!this.data.frontToken || !this.data.backToken) return wx.showToast({ title: this.data.copy.needImages, icon: 'none' })
    this.setData({ submitting: true })
    try {
      const res = await auth.request('POST', '/api/verification', {
        realName: this.data.realName, idNumber: this.data.idNumber,
        frontToken: this.data.frontToken, backToken: this.data.backToken
      })
      if (res.code !== 200) throw new Error(res.msg)
      wx.showToast({ title: res.msg, icon: 'success' })
      this.setData({ status: 'pending', idNumber: '' })
    } catch (error) { wx.showToast({ title: error.message || this.data.copy.submitFail, icon: 'none' }) }
    this.setData({ submitting: false })
  },
  retry() { this.setData({ status: 'not_submitted', frontPath: '', backPath: '', frontToken: '', backToken: '' }) },
  async enterPlatform() {
    await auth.verify()
    const user = auth.getUser() || {}
    wx.reLaunch({ url: user.onboarding_completed ? '/pages/index/index' : '/pages/onboarding/index' })
  },
  back() { wx.navigateBack() }
})
