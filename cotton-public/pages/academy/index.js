const { LEVELS, SERIES, COURSES } = require('../../utils/academy-data')
const auth = require('../../utils/auth')

const PROGRESS_KEY = 'academy_course_progress'

function readProgress() {
  const value = wx.getStorageSync(PROGRESS_KEY)
  return value && typeof value === 'object' ? value : {}
}

function durationText(seconds) {
  const minutes = Math.max(1, Math.ceil(Number(seconds || 0) / 60))
  return `${minutes}分钟`
}

Page({
  data: { navTop: 24, levels: LEVELS, activeLevel: 'basic', series: [], loading: true },

  onLoad(options) {
    let navTop = 24
    try { navTop = wx.getSystemInfoSync().statusBarHeight || 24 } catch (error) {}
    const activeLevel = LEVELS.some(item => item.key === options.level) ? options.level : 'basic'
    this.allSeries = this.buildSeries(SERIES, COURSES)
    this.setData({ navTop, activeLevel })
  },

  onShow() {
    this.render(this.data.activeLevel)
    this.loadSeries()
  },

  buildSeries(seriesRows, lessonRows) {
    const progress = readProgress()
    return seriesRows.map(series => {
      const lessons = lessonRows.filter(item => item.seriesKey === series.id)
      const completed = lessons.filter(item => Number(progress[item.id] || 0) >= 100).length
      const totalProgress = lessons.reduce((sum, item) => sum + Math.min(100, Number(progress[item.id] || 0)), 0)
      const lessonCount = Number(series.lessonCount || lessons.length)
      const totalSeconds = Number(series.totalSeconds || lessons.reduce((sum, item) => sum + Number(item.durationSeconds || item.minutes * 60 || 60), 0))
      return {
        ...series,
        cover: /^(https:\/\/|\/uploads\/|\/images\/)/.test(String(series.cover || '')) ? series.cover : '/images/cotton-seedling-inspection-v1.jpg',
        lessons, lessonCount, completed,
        progress: lessons.length ? Math.round(totalProgress / lessons.length) : 0,
        durationText: durationText(totalSeconds)
      }
    })
  },

  async loadSeries() {
    try {
      const [seriesResult, lessonsResult] = await Promise.all([
        auth.request('GET', '/api/miniapp-academy/series'),
        auth.request('GET', '/api/miniapp-academy/courses')
      ])
      const seriesRows = seriesResult && seriesResult.code === 200 && Array.isArray(seriesResult.data) ? seriesResult.data : []
      const lessonRows = lessonsResult && lessonsResult.code === 200 && Array.isArray(lessonsResult.data) ? lessonsResult.data : []
      if (seriesRows.length) {
        const localSeries = new Map(SERIES.map(item => [item.id, item]))
        const mergedSeries = seriesRows.map(item => {
          const fallback = localSeries.get(item.id) || {}
          const remoteCover = String(item.cover || '')
          return {
            ...fallback,
            ...item,
            cover: /^(https:\/\/|\/uploads\/|\/images\/)/.test(remoteCover) ? remoteCover : fallback.cover
          }
        })
        this.allSeries = this.buildSeries(mergedSeries, lessonRows)
      }
    } catch (error) {
      console.warn('[academy-series-list]', error && error.message || error)
    }
    this.render(this.data.activeLevel)
  },

  render(level) {
    this.setData({ activeLevel: level, series: (this.allSeries || []).filter(item => item.level === level), loading: false })
  },

  switchLevel(event) {
    const level = event.currentTarget.dataset.key
    if (LEVELS.some(item => item.key === level)) this.render(level)
  },

  openSeries(event) {
    const id = event.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: `/pages/academy/series?id=${encodeURIComponent(id)}` })
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    return { title: '优棉学堂｜棉花种植系列课程', path: '/pages/academy/index' }
  }
})
