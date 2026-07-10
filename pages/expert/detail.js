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
    category: item.category || item.category_name || '种植技术',
    intro: item.intro || '',
    content: item.content || '',
    duration: item.duration || '',
    teacher: item.teacher || item.expertName || '平台专家',
    titleName: item.titleName || '',
    org: item.org || '',
    coverUrl: item.coverUrl || item.cover_url || '',
    videoUrl: item.videoUrl || item.video_url || '',
    price: Number(item.price || 0),
    isPaid,
    tag: item.tag || (isPaid ? `¥${Number(item.price || 0).toFixed(2)}` : '免费'),
    points: item.points || [],
    quiz: Array.isArray(item.quiz) ? item.quiz : [],
    aiPrompt: item.aiPrompt || ''
  }
}

function buildFallbackDetail(options = {}, lang = i18n.getLanguage()) {
  const copy = i18n.getPageCopy('expert', lang)
  const courses = copy.courses || []
  const experts = copy.experts || []
  const expertId = Number(options.expertId || 0)
  const courseId = Number(options.id || 1)
  const course = normalizeCourse(courses.find(item => item.id === courseId) || courses[0] || {})
  const expert = expertId
    ? (experts.find(item => item.id === expertId) || experts[0] || {})
    : (experts.find(item => item.id === course.expertId) || experts[0] || {})
  return { copy, course, expert, isExpertOnly: !!expertId }
}

function buildQuizState(quiz = []) {
  return quiz.map((item, idx) => ({
    ...item,
    id: idx,
    selected: -1,
    done: false,
    correct: false
  }))
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
    loading: false,
    loadError: '',
    quizItems: [],
    optionsCache: {}
  },

  onLoad(options = {}) {
    const sysInfo = wx.getSystemInfoSync()
    if (options.expertId) {
      this._selectedExpert = wx.getStorageSync('expert_selected_profile') || null
      wx.removeStorageSync('expert_selected_profile')
    }
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      optionsCache: options
    })
    this.applyLanguage()
    if (!options.expertId) this.loadRemoteDetail(options.id)
  },

  onShow() {
    this.applyLanguage()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    const fallback = buildFallbackDetail(this.data.optionsCache, lang)
    const expertOnlyState = this._selectedExpert
      ? {
        copy: fallback.copy,
        course: fallback.course,
        expert: {
          name: this._selectedExpert.name,
          titleName: this._selectedExpert.titleName || '',
          org: this._selectedExpert.org || '',
          avatar: this._selectedExpert.avatar || '👨‍🌾',
          tags: this._selectedExpert.tags || [],
          bio: this._selectedExpert.bio || ''
        },
        isExpertOnly: true
      }
      : fallback
    this.setData({
      lang,
      copy: fallback.copy,
      ...(this._remoteCourse
        ? { course: this._remoteCourse, expert: this._remoteExpert, isExpertOnly: false }
        : expertOnlyState),
      quizItems: this._remoteCourse ? this.data.quizItems : buildQuizState(fallback.course.quiz || [])
    })
  },

  async loadRemoteDetail(id) {
    if (!id) return
    this.setData({ loading: true, loadError: '' })
    try {
      const res = await auth.request('GET', `/api/expert/${id}`)
      if (res.code !== 200) throw new Error(res.msg || '加载失败')
      const data = res.data || {}
      const course = normalizeCourse(data.content || {})
      const expert = {
        name: course.teacher,
        titleName: course.titleName,
        org: course.org,
        avatar: course.expertAvatar || data.expert?.avatar || '👨‍🌾',
        tags: course.tags || data.expert?.tags || [],
        bio: course.intro
      }
      this._remoteCourse = course
      this._remoteExpert = expert
      this.setData({
        loading: false,
        course,
        expert,
        isExpertOnly: false,
        quizItems: buildQuizState(course.quiz || [])
      })
    } catch (error) {
      this.setData({ loading: false, loadError: error.message || '课程加载失败' })
    }
  },

  onOptionTap(e) {
    const qid = Number(e.currentTarget.dataset.qid)
    const oid = Number(e.currentTarget.dataset.oid)
    const quizItems = this.data.quizItems.map(item => {
      if (item.id !== qid || item.done) return item
      return {
        ...item,
        selected: oid,
        done: true,
        correct: oid === Number(item.answer || 0)
      }
    })
    this.setData({ quizItems })
  },

  onAsk() {
    const course = this.data.course || {}
    const prompt = course.aiPrompt ||
      `我正在学习专家讲堂课程《${course.title || ''}》。请作为棉花种植培训教练，围绕这节课用简单问答训练我，先问我一个问题，再根据我的回答继续讲解。`
    wx.setStorageSync('ai_training_prompt', prompt)
    wx.navigateTo({ url: '/pages/ai/index?from=expert' })
  },

  onPlay() {
    const course = this.data.course || {}
    if (course.isPaid) {
      wx.showToast({ title: '付费课程支付开通后可观看', icon: 'none' })
      return
    }
    if (!course.videoUrl) {
      wx.showToast({ title: this.data.copy.videoPending, icon: 'none' })
    }
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.navigateTo({ url: '/pages/expert/index' })
  },

  onShareAppMessage() {
    return { title: this.data.isExpertOnly ? this.data.expert.name : this.data.course.title, path: '/pages/expert/index' }
  }
})
