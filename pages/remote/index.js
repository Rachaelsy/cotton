Page({
  data: {
    statusBarHeight: 20,
    selField: '3号地·主力田',
    fields: ['1号地', '2号地', '3号地·主力田', '4号地', '5号地'],
    analysis: {
      score: 86, scoreLabel: '良好',
      ndvi: 0.67, ndviLabel: '正常', ndviColor: '#4CAF50',
      drought: '低风险', droughtColor: '#4CAF50',
      pest: '中风险', pestColor: '#FF9800',
      updateTime: '2小时前 · 无人机数据'
    },
    recs: [
      { icon:'💧', bg:'#E3F2FD', name:'灌溉建议', priority:'正常', priorityColor:'#4CAF50', desc:'当前土壤水分充足，3天后可以考虑补充灌溉，保持70%持水量。' },
      { icon:'🌿', bg:'#E8F5E9', name:'长势分析', priority:'良好', priorityColor:'#4CAF50', desc:'3号地NDVI值0.67，整体长势良好，较上周提升5.2%，建议继续维持当前管理策略。' },
      { icon:'⚠️', bg:'#FFF3E6', name:'病虫害风险', priority:'关注', priorityColor:'#FF9800', desc:'东南角区域检测到潜在蚜虫聚集特征，建议近期到田间实地查看并及时防治。' }
    ]
  },
  onLoad(options = {}) {
    const info = wx.getSystemInfoSync()
    let plotName = options.plotName || ''
    try { plotName = decodeURIComponent(plotName) } catch (error) {}
    const fields = plotName && !this.data.fields.includes(plotName)
      ? [plotName, ...this.data.fields]
      : this.data.fields
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      fields,
      selField: plotName || this.data.selField
    })
  },
  onBack() { wx.navigateBack() },
  onSelField(e) { this.setData({ selField: e.currentTarget.dataset.f }) },
  onAsk() {
    wx.navigateTo({ url: '/pages/ai/index' })
  }
})
