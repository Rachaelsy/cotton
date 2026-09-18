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
      this.renderLessons(Array.isArray(remote.lessons) ? remote.lessons : [])
    } catch (error) {
      this.setData({ error: error.message || '课程目录加载失败，请重试', lessons: [] })
    } finally { this.setData({ loading: false }) }
  },

  renderLessons(rows) {
    const progress = readProgress()
    const lessons = rows.map((item, index) => {
      const percent = Math.max(0, Math.min(100, Number(progress[item.id] || 0)))
      return { ...item, lessonNo: Number(item.lessonNo || index + 1), progress: percent, completed: percent >= 90 }
    })
    const next = lessons.find(item => item.progress > 0 && !item.completed) || lessons.find(item => !item.completed) || lessons[0]
    this.setData({ lessons, completed: lessons.filter(item => item.completed).length, nextId: next && next.id, continueLabel: lessons.some(item => item.progress > 0) ? '继续学习' : '开始学习' })
  },

  startLearning() { if (this.data.nextId) wx.navigateTo({ url: `/pages/academy/course?id=${encodeURIComponent(this.data.nextId)}` }) },
  toggleIntro() { this.setData({ introExpanded: !this.data.introExpanded }) },

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
