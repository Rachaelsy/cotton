const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')

function buildDetail(options = {}, lang = i18n.getLanguage()) {
  const copy = i18n.getPageCopy('expert', lang)
  const courses = copy.courses || []
  const experts = copy.experts || []
  const expertId = Number(options.expertId || 0)
  const courseId = Number(options.id || 1)
  const course = courses.find(item => item.id === courseId) || courses[0] || {}
  const expert = expertId
    ? (experts.find(item => item.id === expertId) || experts[0] || {})
    : (experts.find(item => item.id === course.expertId) || experts[0] || {})
  return { copy, course, expert, isExpertOnly: !!expertId }
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    lang: 'zh',
    copy: i18n.getPageCopy('expert'),
    course: {},
    expert: {},
    isExpertOnly: false,
    optionsCache: {}
  },

  onLoad(options = {}) {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      optionsCache: options
    })
    this.applyLanguage()
  },

  onShow() {
    this.applyLanguage()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.setData({ lang, ...buildDetail(this.data.optionsCache, lang) })
  },

  onAsk() {
    wx.navigateTo({ url: '/pages/ai/index' })
  },

  onPlay() {
    wx.showToast({ title: this.data.copy.videoPending, icon: 'none' })
  },

  onBack() {
    wx.navigateBack()
  },

  onShareAppMessage() {
    return { title: this.data.isExpertOnly ? this.data.expert.name : this.data.course.title, path: '/pages/expert/index' }
  }
})
