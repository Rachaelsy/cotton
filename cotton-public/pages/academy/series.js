const auth = require('../../utils/auth')
const { getSeries, getSeriesLessons, getLevel } = require('../../utils/academy-data')

const PROGRESS_KEY = 'academy_course_progress'

function readProgress() {
  const value = wx.getStorageSync(PROGRESS_KEY)
  return value && typeof value === 'object' ? value : {}
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
    this.renderLessons(getSeriesLessons(this.seriesId))
    this.loadSeries()
  },

  async loadSeries() {
    try {
      const result = await auth.request('GET', `/api/miniapp-academy/series/${encodeURIComponent(this.seriesId)}`)
      if (!result || result.code !== 200 || !result.data) return
      const remote = result.data
      const local = this.data.series || {}
      const series = {
        ...local, ...remote,
        cover: /^(https:\/\/|\/uploads\/)/.test(String(remote.cover || '')) ? remote.cover : local.cover
      }
      this.setData({ series, level: getLevel(series.level) })
      this.renderLessons(Array.isArray(remote.lessons) ? remote.lessons : [])
    } catch (error) {
      console.warn('[academy-series-detail]', error && error.message || error)
    } finally { this.setData({ loading: false }) }
  },

  renderLessons(rows) {
    const progress = readProgress()
    const lessons = rows.map((item, index) => {
      const percent = Math.max(0, Math.min(100, Number(progress[item.id] || 0)))
      return { ...item, lessonNo: Number(item.lessonNo || index + 1), progress: percent, completed: percent >= 100 }
    })
    this.setData({ lessons, completed: lessons.filter(item => item.completed).length, loading: false })
  },

  openLesson(event) {
    const id = event.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: `/pages/academy/course?id=${encodeURIComponent(id)}` })
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.redirectTo({ url: `/pages/academy/index?level=${this.data.series.level || 'basic'}` })
  },

  onShareAppMessage() {
    return { title: `${this.data.series.title || '系列课程'}｜优棉学堂`, path: `/pages/academy/series?id=${this.seriesId}` }
  }
})
