const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')

function buildState(lang = i18n.getLanguage(), activeCategoryKey = 'all') {
  const copy = i18n.getPageCopy('expert', lang)
  const allCourses = copy.courses || []
  const filteredCourses = activeCategoryKey === 'all'
    ? allCourses
    : allCourses.filter(course => course.categoryKey === activeCategoryKey)
  return {
    copy,
    categories: copy.categories || [],
    activeCategoryKey,
    experts: copy.experts || [],
    featured: allCourses.slice(0, 2),
    allCourses,
    filteredCourses
  }
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    lang: 'zh',
    copy: i18n.getPageCopy('expert'),
    categories: [],
    activeCategoryKey: 'all',
    experts: [],
    featured: [],
    allCourses: [],
    filteredCourses: []
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight()
    })
    this.applyLanguage()
  },

  onShow() {
    this.applyLanguage()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.setData({ lang, ...buildState(lang, this.data.activeCategoryKey) })
  },

  onCategoryTap(e) {
    const activeCategoryKey = e.currentTarget.dataset.key || 'all'
    this.setData(buildState(this.data.lang, activeCategoryKey))
  },

  onCourseTap(e) {
    wx.navigateTo({ url: `/pages/expert/detail?id=${e.currentTarget.dataset.id}` })
  },

  onExpertTap(e) {
    wx.navigateTo({ url: `/pages/expert/detail?expertId=${e.currentTarget.dataset.id}` })
  },

  onAskExpert() {
    wx.navigateTo({ url: '/pages/ai/index' })
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  }
})
