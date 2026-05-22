const app = getApp()
Page({
  data: {
    statusBarHeight: 20,
    editMode: false,
    selCount: 0,
    allSel: false,
    warnFields: [
      { id:1, name:'5号地', area:68, score:72, scoreCls:'warn', variety:'新陆早57号', irr:'滴灌', alert:'🐛 蚜虫中度', tag:'w', date:'4月21日 10:30', sel:false },
      { id:2, name:'7号地', area:52, score:65, scoreCls:'warn', variety:'新陆早57号', irr:'漫灌', alert:'🌿 长势偏弱', tag:'w', date:'4月20日 15:20', sel:false }
    ],
    okFields: [
      { id:3, name:'3号地·主力田', area:120, score:92, scoreCls:'excel', variety:'新陆早74号', irr:'滴灌', alert:'', tag:'g', date:'4月21日 08:15', sel:false },
      { id:4, name:'1号地', area:88, score:88, scoreCls:'good', variety:'新陆早74号', irr:'滴灌', alert:'', tag:'g', date:'4月20日 17:00', sel:false },
      { id:5, name:'2号地', area:75, score:85, scoreCls:'good', variety:'新陆早57号', irr:'滴灌', alert:'', tag:'g', date:'4月19日 09:30', sel:false },
      { id:6, name:'4号地', area:83, score:82, scoreCls:'good', variety:'新陆早74号', irr:'滴灌', alert:'', tag:'g', date:'4月18日 14:20', sel:false }
    ]
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },
  onBack() { wx.navigateBack() },
  onToggleEdit() {
    this.setData({ editMode: !this.data.editMode, selCount: 0, allSel: false })
    const all = this.data.warnFields.concat(this.data.okFields).map(f => ({...f, sel: false}))
    const wf = all.slice(0, this.data.warnFields.length)
    const of = all.slice(this.data.warnFields.length)
    this.setData({ warnFields: wf, okFields: of })
  },
  onToggleSel(e) {
    const { id, group } = e.currentTarget.dataset
    const key = group === 'warn' ? 'warnFields' : 'okFields'
    const list = this.data[key].map(f => f.id === id ? {...f, sel: !f.sel} : f)
    this.setData({ [key]: list })
    const cnt = [...this.data.warnFields, ...this.data.okFields].filter(f => f.sel).length
    this.setData({ selCount: cnt })
  },
  onSelAll() {
    const next = !this.data.allSel
    const wf = this.data.warnFields.map(f => ({...f, sel: next}))
    const of = this.data.okFields.map(f => ({...f, sel: next}))
    const cnt = next ? wf.length + of.length : 0
    this.setData({ allSel: next, warnFields: wf, okFields: of, selCount: cnt })
  },
  onDeleteSel() {
    if (!this.data.selCount) return
    wx.showModal({
      title: '删除地块',
      content: `确定删除选中的 ${this.data.selCount} 块地？`,
      confirmColor: '#F5222D',
      success: (res) => {
        if (res.confirm) {
          const wf = this.data.warnFields.filter(f => !f.sel)
          const of = this.data.okFields.filter(f => !f.sel)
          this.setData({ warnFields: wf, okFields: of, editMode: false, selCount: 0 })
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },
  onFieldDetail(e) {
    if (this.data.editMode) { this.onToggleSel(e); return }
    wx.showToast({ title: '地块详情开发中', icon: 'none' })
  },
  onAddField() {
    wx.navigateTo({ url: '/pages/fields/draw' })
  }
})
