const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')

const DEFAULT_EXPERT = {
  id: 'platform',
  name: '平台专家',
  titleName: '棉花平台答疑',
  org: 'Cotton 棉花平台',
  avatar: '👨‍🌾',
  tags: ['平台答疑', '种植培训', '农事指导'],
  online: true
}

const QUICK_QUESTIONS = [
  '棉花叶片发黄怎么办？',
  '什么时候该滴水追肥？',
  '棉蚜和红蜘蛛怎么区分？',
  '打药后多久可以再浇水？'
]

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
    experts: [DEFAULT_EXPERT],
    featured: allCourses.slice(0, 2),
    allCourses,
    filteredCourses,
    quickQuestions: QUICK_QUESTIONS
  }
}

function filterCourses(courses, key) {
  return key === 'all' ? courses : courses.filter(course => course.categoryKey === key)
}

function toDisplayImage(url) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `${auth.BASE_URL}${url.startsWith('/') ? url : `/${url}`}`
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
    filteredCourses: [],
    quickQuestions: QUICK_QUESTIONS,
    myQuestions: [],
    showQuestionModal: false,
    questionSubmitting: false,
    uploadingQuestionImages: false,
    plots: [],
    plotOptions: ['不指定地块'],
    plotIndex: 0,
    questionImages: [],
    questionCategories: ['种植技术', '病虫害防治', '水肥管理', '农机作业', '政策咨询'],
    questionForm: {
      category: '种植技术',
      cropStage: '',
      plotId: null,
      question: ''
    }
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight()
    })
    this.applyLanguage()
    this.loadRemoteContents()
    this.loadMyQuestions()
    this.loadPlots()
  },

  onShow() {
    this.applyLanguage()
    this.loadMyQuestions()
    this.loadPlots()
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
          experts: this._remoteExperts || fallback.experts,
          quickQuestions: this._remoteQuickQuestions || QUICK_QUESTIONS
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
      this._remoteQuickQuestions = data.quickQuestions || QUICK_QUESTIONS
      this.setData({
        loading: false,
        allCourses: courses,
        featured: courses.slice(0, 2),
        filteredCourses: filterCourses(courses, this.data.activeCategoryKey),
        categories: this._remoteCategories,
        experts: this._remoteExperts.length ? this._remoteExperts : [DEFAULT_EXPERT],
        quickQuestions: this._remoteQuickQuestions
      })
    } catch (error) {
      this.setData({ loading: false, loadError: error.message || '专家讲堂加载失败' })
    }
  },

  async loadMyQuestions() {
    try {
      const res = await auth.request('GET', '/api/expert/my-questions')
      if (res.code === 200) {
        const myQuestions = (res.data || []).map(item => ({
          ...item,
          images: Array.isArray(item.images)
            ? item.images.map(url => ({ url, src: toDisplayImage(url) })).filter(image => image.src)
            : []
        }))
        this.setData({ myQuestions })
      }
    } catch (error) {
      this.setData({ myQuestions: [] })
    }
  },

  async loadPlots() {
    try {
      const res = await auth.request('GET', '/api/plots')
      const plots = res.code === 200 && Array.isArray(res.data) ? res.data : []
      const options = ['不指定地块'].concat(plots.map(item => `${item.name || '未命名地块'} · ${Number(item.area || 0).toFixed(1)}亩`))
      this.setData({ plots, plotOptions: options })
    } catch (error) {
      this.setData({ plots: [], plotOptions: ['地块加载失败'], plotIndex: 0, 'questionForm.plotId': null })
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
    this.setData({ showQuestionModal: true })
  },

  onAskExpertAi() {
    wx.navigateTo({ url: '/pages/ai/index?from=expert' })
  },

  closeQuestionModal() {
    this.setData({ showQuestionModal: false })
  },

  noop() {},

  onQuestionInput(e) {
    const field = e.currentTarget.dataset.field
    if (!field) return
    this.setData({ [`questionForm.${field}`]: e.detail.value })
  },

  onQuestionCategoryTap(e) {
    this.setData({ 'questionForm.category': e.currentTarget.dataset.category || '种植技术' })
  },

  onQuestionPlotChange(e) {
    const index = Number(e.detail.value || 0)
    const plot = index > 0 ? this.data.plots[index - 1] : null
    this.setData({
      plotIndex: index,
      'questionForm.plotId': plot ? plot.id : null
    })
  },

  async chooseQuestionImages() {
    if (this.data.uploadingQuestionImages) return
    const remain = Math.max(0, 3 - this.data.questionImages.length)
    if (!remain) {
      wx.showToast({ title: '最多上传3张图片', icon: 'none' })
      return
    }
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const files = res.tempFilePaths || []
        if (!files.length) return
        this.setData({ uploadingQuestionImages: true })
        wx.showLoading({ title: '上传中...', mask: true })
        try {
          const uploaded = []
          for (const filePath of files) {
            const result = await auth.uploadFile('/api/upload', filePath)
            if (result.code === 200 && result.data && result.data.url) {
              uploaded.push({ url: result.data.url, src: `${auth.BASE_URL}${result.data.url}` })
            }
          }
          if (!uploaded.length) throw new Error('图片上传失败')
          this.setData({ questionImages: this.data.questionImages.concat(uploaded).slice(0, 3) })
        } catch (error) {
          wx.showToast({ title: error.message || '图片上传失败', icon: 'none' })
        } finally {
          wx.hideLoading()
          this.setData({ uploadingQuestionImages: false })
        }
      }
    })
  },

  removeQuestionImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const images = this.data.questionImages.slice()
    if (index >= 0) images.splice(index, 1)
    this.setData({ questionImages: images })
  },

  previewQuestionImage(e) {
    const current = e.currentTarget.dataset.url
    wx.previewImage({ current, urls: this.data.questionImages.map(item => item.src || item.url) })
  },

  previewRecordImage(e) {
    const current = e.currentTarget.dataset.url
    if (current) wx.previewImage({ current, urls: [current] })
  },

  onQuickQuestion(e) {
    const question = e.currentTarget.dataset.question || ''
    this.setData({
      showQuestionModal: true,
      'questionForm.question': question
    })
  },

  async submitQuestion() {
    const form = this.data.questionForm || {}
    const question = String(form.question || '').trim()
    if (question.length < 5) {
      wx.showToast({ title: '问题再写具体一点', icon: 'none' })
      return
    }
    this.setData({ questionSubmitting: true })
    try {
      const res = await auth.request('POST', '/api/expert/questions', {
        category: form.category,
        cropStage: form.cropStage,
        plotId: form.plotId,
        question,
        images: this.data.questionImages.map(item => item.url || item)
      })
      if (res.code !== 200) throw new Error(res.msg || '提交失败')
      wx.showToast({ title: '已提交给专家', icon: 'success' })
      this.setData({
        showQuestionModal: false,
        plotIndex: 0,
        questionImages: [],
        questionForm: { category: form.category || '种植技术', cropStage: '', plotId: null, question: '' }
      })
      this.loadMyQuestions()
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ questionSubmitting: false })
    }
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  }
})
