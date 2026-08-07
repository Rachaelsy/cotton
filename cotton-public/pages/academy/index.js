Page({
  data: {
    points: 320,
    courses: [
      { id: 'growth', level: 1, type: '图文', title: '棉花全生育期认识', duration: '8分钟', done: true },
      { id: 'seed', level: 1, type: '视频', title: '播种机调试与下种', duration: '18分钟' },
      { id: 'seedling', level: 1, type: '图文', title: '苗期管理关键点', duration: '10分钟', done: true },
      { id: 'scout', level: 1, type: '视频', title: '第一次田间巡查', duration: '12分钟' },
      { id: 'water', level: 2, type: '视频', title: '花铃期精准灌溉', duration: '20分钟', locked: true },
      { id: 'pest', level: 2, type: '图文', title: '棉铃虫综合防控', duration: '12分钟', locked: true }
    ]
  },
  onShow() {
    const unlocked = !!wx.getStorageSync('academy_level_2_unlocked')
    const courses = this.data.courses.map(item => item.level === 2 ? { ...item, locked: !unlocked } : item)
    this.setData({ courses, level2Unlocked: unlocked })
  },
  openCourse(e) {
    if (e.currentTarget.dataset.locked) return wx.showToast({ title: '通过初级考试后解锁', icon: 'none' })
    wx.navigateTo({ url: `/pages/academy/course?id=${e.currentTarget.dataset.id}` })
  },
  openExam() { wx.navigateTo({ url: '/pages/academy/exam' }) }
})
