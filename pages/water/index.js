const auth = require('../../utils/auth')

function formatMu(value) {
  const number = Number(value || 0)
  return number.toFixed(number >= 100 || number % 1 === 0 ? 0 : 1)
}

function buildModel(plot) {
  const area = Number(plot && plot.area || 0)
  const score = Number(plot && plot.health_score || 86)
  const moisture = Math.max(28, Math.min(76, Math.round(score * 0.58 - (plot && plot.status === 'attention' ? 12 : 0))))
  const dry = moisture < 50
  const waterPerMu = dry ? 40 : 30
  const total = Math.round(area * waterPerMu)
  return {
    moisture,
    days: dry ? 3 : 1,
    state: dry ? '偏干' : '适宜',
    stateClass: dry ? 'warn' : 'ok',
    waterPerMu,
    total,
    advice: `${plot.name || '当前地块'}当前土壤含水率 ${moisture}%，${dry ? '低于棉花蕾期适宜范围（55~70%）' : '处于棉花当前生育期适宜范围'}。建议${dry ? '今日下午14:00~18:00进行滴灌' : '保持当前灌溉节奏'}，每亩灌水量 ${waterPerMu} 方，总用水量约 ${total || '--'} 方。灌后检查排水沟，避免局部积水。`,
    plans: [
      { icon: '💧', name: dry ? '蕾期补水' : '常规滴灌', meta: `${plot.name || '当前地块'} · ${dry ? '今日14:00~18:00' : '3天后'}`, status: dry ? '建议今日执行' : '已计划', cls: dry ? 'warn' : 'plan', value: `${waterPerMu}方/亩`, sub: `共${total || '--'}方` },
      { icon: '💧', name: '花铃期灌水', meta: `${plot.name || '当前地块'} · 7月10日`, status: '已计划', cls: 'plan', value: '50方/亩', sub: `共${Math.round(area * 50) || '--'}方` },
      { icon: '✅', name: '苗期滴灌', meta: `${plot.name || '当前地块'} · 已完成`, status: '已完成', cls: 'done', value: '25方/亩', sub: `共${Math.round(area * 25) || '--'}方` }
    ],
    bars: [
      { label: '5/27', height: 0 }, { label: '5/28', height: dry ? 35 : 55 },
      { label: '5/29', height: 0 }, { label: '5/30', height: 0 },
      { label: '5/31', height: 0 }, { label: '6/1', height: dry ? 0 : 45 },
      { label: '今日', height: dry ? 72 : 0 }
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
    const suffix = plot && plot.id ? `?plotId=${plot.id}&type=灌溉` : '?type=灌溉'
    wx.navigateTo({ url: `/pages/records/index${suffix}` })
  },

  onReminder() {
    wx.showToast({ title: '灌水提醒已开启', icon: 'none' })
  }
})
