const auth = require('../../utils/auth')
const { getSeries, getSeriesLessons, getLevel } = require('../../utils/academy-data')

const progressStore = require('../../utils/academy-progress')

function readProgress() {
  return progressStore.percentages()
}

Page({
  data: { navTop: 24, series: {}, level: {}, lessons: [], completed: 0, loading: true },

  onLoad(options) {
    let navTop = 24
    try { navTop = wx.getSystemInfoSync().statusBarHeight || 24 } catch (error) {}
    this.seriesId = String(options.id || '')
    const series = getSeries(this.seriesId)
    this.setData({ navTop, series, level: getLevel(series.level) })
  },

  onShow() {
    this.loadSeries()
  },

  canOpenProtectedCourse() {
    if ((this.data.series.level || 'basic') === 'basic' || auth.isLoggedIn()) return true
    this.promptLogin()
    return false
  },

  promptLogin() {
    if (this.accessPromptOpen) return
    this.accessPromptOpen = true
    wx.showModal({
      title: '登录后学习',
      content: '该系列属于中级或高级课程，登录后即可查看目录并播放视频。',
      confirmText: '去登录',
      complete: result => {
        this.accessPromptOpen = false
        if (result.confirm) wx.navigateTo({ url: '/pages/login/index' })
      }
    })
  },

  async loadSeries() {
    this.setData({ loading: true, error: '' })
    try {
      await progressStore.sync()
      const result = await auth.request('GET', `/api/miniapp-academy/series/${encodeURIComponent(this.seriesId)}`)
      if (!result || result.code !== 200 || !result.data) throw new Error(result && result.code === 404 ? '该系列已下架或不存在' : '课程目录加载失败，请重试')
      const remote = result.data
      const local = this.data.series || {}
      const series = {
        ...local, ...remote,
        cover: /^(https:\/\/|\/uploads\/)/.test(String(remote.cover || '')) ? remote.cover : '/images/cotton-seedling-inspection-v1.jpg'
      }
      this.setData({ series, level: getLevel(series.level) })
      this.quizResults = {}
      if (auth.isLoggedIn()) {
        const results = await auth.request('GET', '/api/miniapp-academy/quiz-results')
        if (results.code === 200) (results.data || []).forEach(q => { this.quizResults[q.course_key] = q })
      }
      this.renderLessons(Array.isArray(remote.lessons) ? remote.lessons : [])
    } catch (error) {
      if (error && error.statusCode === 401) {
        this.setData({ error: '中级和高级课程需登录后学习', lessons: [] })
        this.promptLogin()
      } else this.setData({ error: error.message || '课程目录加载失败，请重试', lessons: [] })
    } finally { this.setData({ loading: false }) }
  },

  renderLessons(rows) {
    const progress = readProgress()
    const lastViewedId = progressStore.lastViewed(this.seriesId)
    const lessons = rows.map((item, index) => {
      if (item.rawType === 'quiz') {
        const result = (this.quizResults || {})[item.id]
        return { ...item, progress: 0, completed: Boolean(result && result.passed), lastViewed: item.id === lastViewedId, duration: item.duration + (result ? ` · 最高 ${result.score} 分 · ${result.passed?'已通过':'已作答'}` : ' · 待测验') }
      }
      const percent = Math.max(0, Math.min(100, Number(progress[item.id] || 0)))
      return { ...item, lessonNo: Number(item.lessonNo || index + 1), progress: percent, completed: percent >= 100, lastViewed: item.id === lastViewedId }
    })
    this.setData({ lessons, completed: lessons.filter(item => item.completed).length })
  },

  navigateContent(id) {
    const item = this.data.lessons.find(row => row.id === id)
    wx.navigateTo({ url: `/pages/academy/${item && item.rawType === 'quiz' ? 'quiz' : 'course'}?id=${encodeURIComponent(id)}` })
  },
  toggleIntro() { this.setData({ introExpanded: !this.data.introExpanded }) },

  openLesson(event) {
    const id = event.currentTarget.dataset.id
    if (!this.canOpenProtectedCourse()) return
    if (id) this.navigateContent(id)
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.redirectTo({ url: `/pages/academy/index?level=${this.data.series.level || 'basic'}` })
  },

  onShareAppMessage() {
    return { title: `${this.data.series.title || '系列课程'}｜优棉学堂`, path: `/pages/academy/series?id=${this.seriesId}` }
  }
})
