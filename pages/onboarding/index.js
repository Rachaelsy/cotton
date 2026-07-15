const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')

const COPY = {
  zh: {
    title: '开始使用棉花平台', subtitle: '完成三个简单设置，后续使用会更顺手。',
    language: '选择常用语言', languageSub: '所有农户功能都会使用所选语言', chinese: '中文', uyghur: '维吾尔语',
    location: '开启实时定位', locationSub: '用于当前位置天气、附近农机和地块描绘', locate: '获取当前位置', located: '定位已开启',
    plot: '建立第一块棉田', plotSub: '沿边界行走或在地图上描点，获得地块级气象服务', createPlot: '创建第一块地',
    enter: '暂时跳过，进入首页', saving: '正在保存…', locationFail: '定位未开启，可稍后在系统设置中授权', saveFail: '引导状态保存失败'
  },
  ug: {
    title: 'پاختا سۇپىسىنى ئىشلىتىش', subtitle: 'ئۈچ ئاددىي تەڭشەكنى تاماملاڭ.',
    language: 'دائىم ئىشلىتىدىغان تىل', languageSub: 'دېھقانلار ئىقتىدارى تاللانغان تىلدا كۆرسىتىلىدۇ', chinese: '中文', uyghur: 'ئۇيغۇرچە',
    location: 'نەق مەيدان ئورنىنى ئېچىش', locationSub: 'ھاۋارايى، يېقىن ماشىنا ۋە يەر سىزىش ئۈچۈن', locate: 'ھازىرقى ئورۇننى ئېلىش', located: 'ئورۇن ئېچىلدى',
    plot: 'بىرىنچى پاختا يېرىنى قۇرۇش', plotSub: 'چېگرا بويىچە مېڭىڭ ياكى خەرىتىدە چېكىت قويۇڭ', createPlot: 'بىرىنچى يەرنى قۇرۇش',
    enter: 'ھازىرچە ئاتلاپ باش بەتكە كىرىش', saving: 'ساقلىنىۋاتىدۇ…', locationFail: 'ئورۇن ھوقۇقى ئېچىلمىدى، كېيىن تەڭشەكتىن ئاچالايسىز', saveFail: 'يېتەكچى ھالىتىنى ساقلىغىلى بولمىدى'
  }
}

Page({
  data: { statusBarHeight: 20, lang: 'zh', copy: COPY.zh, located: false, saving: false },
  onLoad() {
    const lang = i18n.getLanguage()
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, lang, copy: COPY[lang] || COPY.zh })
  },
  selectLanguage(e) {
    const lang = e.currentTarget.dataset.lang === 'ug' ? 'ug' : 'zh'
    i18n.setLanguage(lang)
    this.setData({ lang, copy: COPY[lang] })
  },
  locate() {
    wx.getLocation({
      type: 'gcj02', isHighAccuracy: true,
      success: () => this.setData({ located: true }),
      fail: () => wx.showToast({ title: this.data.copy.locationFail, icon: 'none' })
    })
  },
  async complete(target) {
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      const res = await auth.request('PATCH', '/api/verification/onboarding', {})
      if (res.code !== 200) throw new Error(res.msg)
      await auth.verify()
      wx.reLaunch({ url: target })
    } catch (error) {
      wx.showToast({ title: error.message || this.data.copy.saveFail, icon: 'none' })
      this.setData({ saving: false })
    }
  },
  createPlot() { this.complete('/pages/fields/draw') },
  enterHome() { this.complete('/pages/index/index') }
})
