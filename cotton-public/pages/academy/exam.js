Page({
  data: {
    questions: [
      { id: 1, title: '棉花苗期管理的核心目标是什么？', options: ['追求株高增长最快', '全苗、齐苗、匀苗、壮苗', '尽量增加灌水次数'], answer: 1 },
      { id: 2, title: '田间巡查更推荐采用哪种路线？', options: ['只看田边', '随机看一株', '采用 S 形路线多点观察'], answer: 2 },
      { id: 3, title: '发现少量虫害后首先应该做什么？', options: ['立即全田喷药', '调查虫口密度与危害程度', '停止所有灌溉'], answer: 1 }
    ], selected: {}, submitted: false, score: 0, passed: false
  },
  choose(e) { if (this.data.submitted) return; this.setData({ [`selected.${e.currentTarget.dataset.q}`]: Number(e.currentTarget.dataset.i) }) },
  submit() {
    if (Object.keys(this.data.selected).length < this.data.questions.length) return wx.showToast({ title: '请先完成所有题目', icon: 'none' })
    const right = this.data.questions.filter(q => this.data.selected[q.id] === q.answer).length
    const score = Math.round(right / this.data.questions.length * 100), passed = score >= 80
    this.setData({ submitted: true, score, passed })
    if (passed) { wx.setStorageSync('academy_level_2_unlocked', true); wx.showToast({ title: '考试通过，获得50积分', icon: 'success' }) }
  },
  retry() { this.setData({ selected: {}, submitted: false, score: 0, passed: false }) },
  backAcademy() { wx.switchTab({ url: '/pages/academy/index' }) }
})
