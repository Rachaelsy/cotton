Page({
  data: {
    statusBarHeight: 20,
    viewMode: 0, // 0=列表 1=日历
    typeFilter: '全部',
    types: ['全部', '播种', '施肥', '打药', '灌溉', '采收'],
    records: [
      { id:1, type:'打药', icon:'🧪', bg:'#FCE4EC', field:'5号地', detail:'10%吡虫啉1500倍液，防治棉蚜，喷洒叶片背面', worker:'艾力 农技员', date:'4月21日 10:30', amount:'亩用100ml' },
      { id:2, type:'施肥', icon:'🌿', bg:'#E8F5E9', field:'3号地', detail:'追施氮磷钾复合肥，每亩15公斤，结合滴灌', worker:'本人', date:'4月20日 08:00', amount:'亩施15kg' },
      { id:3, type:'灌溉', icon:'💧', bg:'#E3F2FD', field:'全部地块', detail:'春灌，每亩灌水量30立方米，滴灌系统运行6小时', worker:'本人', date:'4月18日 07:30', amount:'每亩30m³' },
      { id:4, type:'播种', icon:'🌱', bg:'#E8F5E9', field:'2号地', detail:'新陆早57号，膜下滴灌播种，株距9.5cm，行距10cm', worker:'本人', date:'4月15日 09:00', amount:'亩用量3kg' },
      { id:5, type:'施肥', icon:'🌿', bg:'#E8F5E9', field:'1号地', detail:'基施有机肥+复合肥，机械深施', worker:'本人', date:'4月10日 14:00', amount:'亩施50kg' }
    ]
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },
  onBack() { wx.navigateBack() },
  onViewMode(e) { this.setData({ viewMode: e.currentTarget.dataset.m }) },
  onTypeFilter(e) { this.setData({ typeFilter: e.currentTarget.dataset.t }) },
  onAddRecord() { wx.showToast({ title: '记录添加功能开发中', icon: 'none' }) },
  get filteredRecords() {
    if (this.data.typeFilter === '全部') return this.data.records
    return this.data.records.filter(r => r.type === this.data.typeFilter)
  }
})
