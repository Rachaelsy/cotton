const auth = require('../../utils/auth')

function formatMu(value) {
  const number = Number(value || 0)
  return number.toFixed(number >= 100 || number % 1 === 0 ? 0 : 1)
}

function buildModel(plot) {
  const area = Number(plot && plot.area || 0)
  const score = Number(plot && plot.health_score || 86)
  const attention = plot && plot.status === 'attention'
  const p = attention ? 38 : Math.max(45, Math.min(72, Math.round(score * 0.62)))
  return {
    stage: plot && plot.planting_status === '计划播种' ? '播前' : '蕾期',
    count: attention ? 3 : 5,
    state: p < 45 ? '偏低' : '中等',
    stateClass: p < 45 ? 'warn' : 'ok',
    nutrients: [
      { name: '氮 N', value: attention ? 58 : 62, state: '正常', cls: 'ok' },
      { name: '磷 P', value: p, state: p < 45 ? '偏低' : '正常', cls: p < 45 ? 'warn' : 'ok' },
      { name: '钾 K', value: attention ? 66 : 75, state: '正常', cls: 'ok' },
      { name: '有机质', value: attention ? 42 : 48, state: '偏低', cls: 'warn' }
    ],
    advice: `${plot.name || '当前地块'}当前处于蕾期，磷素${p < 45 ? '偏低' : '基本正常'}。建议本次随水追施磷酸二铵 5kg/亩，同时追施硝酸钾 3kg/亩补充钾素。全程配合滴灌随水施肥，预计投入约 ¥${Math.round(area * 680) || '--'} 元。`,
    products: [
      { icon: '🌾', name: '磷酸二铵（18-46-0）', meta: '补磷 · 蕾期推荐 · 5kg/亩', price: '¥600/袋', unit: '50kg装' },
      { icon: '💎', name: '硝酸钾（13-0-46）', meta: '补钾 · 随水滴施 · 3kg/亩', price: '¥420/袋', unit: '25kg装' }
    ],
    plans: [
      { icon: '⚡', name: '蕾期追肥', meta: `${plot.name || '当前地块'} · 随水施 · 今日建议`, status: '建议今日执行', cls: 'warn', value: '磷铵+硝钾', sub: '8kg/亩' },
      { icon: '🌸', name: '花铃期追肥', meta: `${plot.name || '当前地块'} · 7月15日`, status: '已计划', cls: 'plan', value: '尿素+钾肥', sub: '12kg/亩' },
      { icon: '✅', name: '基肥（底肥）', meta: `${plot.name || '当前地块'} · 已完成`, status: '已完成', cls: 'done', value: '复合肥', sub: '30kg/亩' }
    ]
  }
}

Page({
  data: {
    statusBarHeight: 20,
    loading: true,
    plots: [],
    plotOptions: ['暂无地块'],
    plotIndex: 0,
    plot: {},
    model: buildModel({})
  },

  onLoad(options = {}) {
    const info = wx.getSystemInfoSync()
    this.initialPlotId = Number(options.plotId || 0)
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.loadPlots()
  },

  async loadPlots() {
    this.setData({ loading: true })
    try {
      const res = await auth.request('GET', '/api/plots')
      const plots = res.code === 200 && Array.isArray(res.data) ? res.data : []
      const selectedIndex = Math.max(0, plots.findIndex(plot => Number(plot.id) === this.initialPlotId))
      const plot = plots[selectedIndex] || {}
      this.setData({
        loading: false,
        plots,
        plotOptions: plots.length ? plots.map(item => `${item.name || '未命名地块'} · ${formatMu(item.area)}亩`) : ['暂无地块'],
        plotIndex: selectedIndex,
        plot,
        model: buildModel(plot)
      })
    } catch (error) {
      this.setData({ loading: false, plots: [], plotOptions: ['加载失败'] })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  onPlotChange(e) {
    const index = Number(e.detail.value)
    const plot = this.data.plots[index] || {}
    this.setData({ plotIndex: index, plot, model: buildModel(plot) })
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  },

  onRecord() {
    const plot = this.data.plot
    const suffix = plot && plot.id ? `?plotId=${plot.id}&type=施肥` : '?type=施肥'
    wx.navigateTo({ url: `/pages/records/index${suffix}` })
  },

  onBuy() {
    wx.navigateTo({ url: '/subpkg-supplies/supplies/index' })
  },

  onReminder() {
    wx.showToast({ title: '施肥提醒已开启', icon: 'none' })
  }
})
