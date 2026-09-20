const auth = require('../../utils/auth')

const LEVEL_NAMES = { basic: '初级', intermediate: '中级', advanced: '高级' }
function durationText(seconds) {
  const value = Number(seconds || 0)
  if (value < 60) return `${Math.round(value)}秒`
  const hours = Math.floor(value / 3600), minutes = Math.floor(value % 3600 / 60)
  return hours ? `${hours}小时${minutes ? `${minutes}分钟` : ''}` : `${minutes}分钟`
}
function dateText(value) {
  if (!value) return ''
  const date = new Date(value)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

Page({
  data: {
    statusBarHeight: 24, loading: true, error: '', loggedOut: false, activeTab: 'all', showPoints: false,
    summary: { totalPoints: 0, completedCount: 0, watchedText: '0分钟' },
    series: [], visibleSeries: [], pointRecords: [], recent: null
  },
  onLoad() { try { this.setData({ statusBarHeight: wx.getSystemInfoSync().statusBarHeight || 24 }) } catch (_) {} },
  onShow() {
    if (!auth.isLoggedIn()) return this.setData({ loading: false, loggedOut: true, series: [], visibleSeries: [] })
    this.load()
  },
  async load() {
    this.setData({ loading: true, error: '', loggedOut: false })
    try {
      const result = await auth.request('GET', '/api/miniapp-academy/learning')
      if (!result || result.code !== 200) throw new Error(result && result.msg || '学习记录加载失败')
      const source = result.data || {}
      const series = (source.series || []).map(item => ({
        ...item, cover: item.cover || '/images/cotton-seedling-inspection-v1.jpg', levelName: LEVEL_NAMES[item.level] || '课程',
        status: item.totalCount > 0 && item.completedCount >= item.totalCount ? 'completed' : 'studying',
        statusText: item.totalCount > 0 && item.completedCount >= item.totalCount ? '已完成' : '继续学习', updatedText: dateText(item.updatedAt)
      }))
      const pointRecords = (source.pointRecords || []).map(item => ({ ...item, levelName: LEVEL_NAMES[item.level] || '课程', timeText: dateText(item.created_at) }))
      const recentGroup = series.find(item => item.status === 'studying') || series[0] || null
      const recent = recentGroup && recentGroup.currentCourse
        ? { ...recentGroup.currentCourse, seriesTitle: recentGroup.title, cover: recentGroup.currentCourse.cover || recentGroup.cover }
        : null
      this.setData({ loading: false, series, pointRecords, recent, summary: { ...source.summary, watchedText: durationText(source.summary && source.summary.watchedSeconds) } })
      this.filterSeries(this.data.activeTab)
    } catch (error) { this.setData({ loading: false, error: error.message || '学习记录加载失败' }) }
  },
  filterSeries(tab) { this.setData({ activeTab: tab, visibleSeries: tab === 'all' ? this.data.series : this.data.series.filter(item => item.status === tab) }) },
  switchTab(event) { this.filterSeries(event.currentTarget.dataset.tab) },
  openRecent() { if (this.data.recent) wx.navigateTo({ url: `/pages/academy/course?id=${encodeURIComponent(this.data.recent.id)}` }) },
  openSeries(event) { wx.navigateTo({ url: `/pages/academy/series?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }) },
  openPoints() { this.setData({ showPoints: true }) },
  closePoints() { this.setData({ showPoints: false }) },
  openAcademy() { wx.navigateTo({ url: '/pages/academy/index' }) },
  login() { wx.navigateTo({ url: '/pages/login/index' }) },
  back() { if (getCurrentPages().length > 1) wx.navigateBack(); else wx.switchTab({ url: '/pages/my/index' }) }
})
