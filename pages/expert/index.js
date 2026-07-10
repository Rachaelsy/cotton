const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')

function normalizeCourse(item = {}) {
  const isPaid = item.isPaid || (item.priceType === 'paid' && Number(item.price) > 0)
  return {
    ...item,
    id: item.id,
    type: item.type || 'video',
    typeLabel: item.typeLabel || (item.type === 'article' ? '图文课' : item.type === 'qa' ? '问答课' : '视频课'),
    icon: item.icon || (item.type === 'article' ? '📖' : item.type === 'qa' ? '💬' : '▶️'),
    title: item.title || '专家课程',
    subtitle: item.subtitle || '',
    teacher: item.teacher || item.expertName || '平台专家',
    titleName: item.titleName || '',
    org: item.org || '',
    categoryKey: item.categoryKey || item.category_key || 'planting',
    category: item.category || item.category_name || '种植技术',
    intro: item.intro || item.subtitle || '',
    duration: item.duration || '',
    students: item.students || 0,
    coverUrl: item.coverUrl || item.cover_url || '',
    videoUrl: item.videoUrl || item.video_url || '',
    isPaid,
    tag: item.tag || (isPaid ? `¥${Number(item.price || 0).toFixed(2)}` : '免费')
  }
}

function fallbackState(lang = i18n.getLanguage(), activeCategoryKey = 'all') {
  const copy = i18n.getPageCopy('expert', lang)
  const allCourses = (copy.courses || []).map(normalizeCourse)
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

function filterCourses(courses, key) {
  return key === 'all' ? courses : courses.filter(course => course.categoryKey === key)
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    lang: 'zh',
    loading: false,
    loadError: '',
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
    this.loadRemoteContents()
  },

  onShow() {
    this.applyLanguage()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    const fallback = fallbackState(lang, this.data.activeCategoryKey)
    const hasRemote = this._remoteCourses && this._remoteCourses.length
    this.setData({
      lang,
      copy: fallback.copy,
      ...(hasRemote
        ? {
          allCourses: this._remoteCourses,
          featured: this._remoteCourses.slice(0, 2),
          filteredCourses: filterCourses(this._remoteCourses, this.data.activeCategoryKey),
          categories: this._remoteCategories || fallback.categories,
          experts: this._remoteExperts || fallback.experts
        }
        : fallback)
    })
  },

  async loadRemoteContents() {
    this.setData({ loading: true, loadError: '' })
    try {
      const res = await auth.request('GET', '/api/expert')
      if (res.code !== 200) throw new Error(res.msg || '加载失败')
      const data = res.data || {}
      const courses = (data.contents || []).map(normalizeCourse)
      if (!courses.length) throw new Error('暂无上架内容')
      this._remoteCourses = courses
      this._remoteCategories = data.categories || this.data.categories
      this._remoteExperts = (data.experts || []).map(item => ({
        ...item,
        avatar: item.avatar || '👨‍🌾',
        tags: item.tags || [],
        online: item.online !== false
      }))
      this.setData({
        loading: false,
        allCourses: courses,
        featured: courses.slice(0, 2),
        filteredCourses: filterCourses(courses, this.data.activeCategoryKey),
        categories: this._remoteCategories,
        experts: this._remoteExperts
      })
    } catch (error) {
      this.setData({ loading: false, loadError: error.message || '专家讲堂加载失败' })
    }
  },

  onCategoryTap(e) {
    const activeCategoryKey = e.currentTarget.dataset.key || 'all'
    this.setData({
      activeCategoryKey,
      filteredCourses: filterCourses(this.data.allCourses, activeCategoryKey)
    })
  },

  onCourseTap(e) {
    wx.navigateTo({ url: `/pages/expert/detail?id=${e.currentTarget.dataset.id}` })
  },

  onExpertTap(e) {
    const id = e.currentTarget.dataset.id
    const expert = (this.data.experts || []).find(item => String(item.id) === String(id))
    if (expert) wx.setStorageSync('expert_selected_profile', expert)
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
