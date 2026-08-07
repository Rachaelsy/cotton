const auth = require('../../utils/auth')
const pad = n => String(n).padStart(2, '0')

Page({
  data: { month: '', label: '', days: [], records: [], selectedRecords: [], selectedDate: '' },
  onLoad() {
    const now = new Date()
    this.setData({ month: `${now.getFullYear()}-${pad(now.getMonth() + 1)}` }, () => this.load())
  },
  async load() {
    if (!auth.isLoggedIn()) {
      wx.showModal({ title: '需要登录', content: '登录后可以查看自己的农事日历。', success: r => r.confirm && wx.navigateTo({ url: '/pages/login/index' }) })
      return this.build([])
    }
    try {
      const res = await auth.request('GET', `/api/farm-records?month=${this.data.month}`)
      this.build(res.code === 200 ? (res.data.records || res.data || []) : [])
    } catch { this.build([]); wx.showToast({ title: '记录加载失败', icon: 'none' }) }
  },
  build(records) {
    const [year, month] = this.data.month.split('-').map(Number)
    const first = new Date(year, month - 1, 1).getDay()
    const count = new Date(year, month, 0).getDate()
    const dates = new Set(records.map(x => String(x.record_date || x.date || '').slice(0, 10)))
    const days = []
    for (let i = 0; i < first; i++) days.push({ empty: true, key: `e${i}` })
    for (let day = 1; day <= count; day++) {
      const date = `${year}-${pad(month)}-${pad(day)}`
      days.push({ day, date, has: dates.has(date), key: date })
    }
    this.setData({ records, days, label: `${year}年${month}月`, selectedRecords: [], selectedDate: '' })
  },
  changeMonth(step) {
    const [year, month] = this.data.month.split('-').map(Number)
    const date = new Date(year, month - 1 + step, 1)
    this.setData({ month: `${date.getFullYear()}-${pad(date.getMonth() + 1)}` }, () => this.load())
  },
  prev() { this.changeMonth(-1) }, next() { this.changeMonth(1) },
  choose(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    const selectedRecords = this.data.records.filter(x => String(x.record_date || x.date || '').slice(0, 10) === date)
    this.setData({ selectedDate: date, selectedRecords })
  },
  back() { wx.navigateBack() }
})
