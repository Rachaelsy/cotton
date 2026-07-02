const auth = require('../../utils/auth')
const { buildWeatherForPlot, buildWeatherFromApi } = require('../../utils/weather')

function decodeText(value) {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch (error) {
    return value
  }
}

function formatArea(area) {
  const value = Number(area || 0)
  return value.toFixed(value % 1 === 0 ? 0 : 1)
}

Page({
  data: {
    statusBarHeight: 20,
    loading: true,
    loadError: '',
    fields: [],
    fieldCount: 0,
    selectedFieldIndex: 0,
    selectedFieldLabel: '全部地块',
    sourceInfo: {
      type: 'simulated',
      label: '模拟数据',
      desc: '天气接口不可用或未选择有效地块时，由本地模型按地块生成，仅供参考。'
    },
    locationLabel: '喀什地区',
    regionLabel: '喀什地区',
    weather: {
      temp: 0,
      desc: '晴转多云',
      icon: '🌤',
      high: 0,
      low: 0,
      wind: '西北风3级',
      windLevel: 0,
      humidity: 0,
      groundTemp: 0,
      groundTempLabel: '地温',
      rain: 0,
      uv: 0,
      pressure: 0,
      visibility: 0,
      visibilityText: '--'
    },
    hourly: [],
    forecast: [],
    advices: [],
    alert: null,
    showAlertDetail: false,
    alertDetail: null,
    summary: '',
    tipText: ''
  },

  onLoad(options = {}) {
    const info = wx.getSystemInfoSync()
    this.queryPlotId = Number(options.plotId) || null
    this.queryPlotName = decodeText(options.plotName || '')
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.loadWeatherPage()
  },

  async loadWeatherPage() {
    this.setData({ loading: true, loadError: '' })
    try {
      const plots = await this.loadPlots()
      const selectedIndex = this.resolveSelectedIndex(plots)
      this.plotList = plots
      await this.applySelectedPlot(selectedIndex, plots)
    } catch (error) {
      this.setData({
        loadError: error.message || '天气数据加载失败',
        loading: false
      })
    }
  },

  async loadPlots() {
    if (!auth.isLoggedIn()) {
      return [this.buildVirtualPlot()]
    }

    try {
      const res = await auth.request('GET', '/api/plots')
      if (res.code === 200 && Array.isArray(res.data) && res.data.length) {
        return res.data
      }
    } catch (error) {
      return [this.buildVirtualPlot()]
    }

    return [this.buildVirtualPlot()]
  },

  buildVirtualPlot() {
    return {
      id: this.queryPlotId || 0,
      name: this.queryPlotName || '全部地块',
      area: 0,
      coordinates: [],
      sow_date: null,
      irrigation: '滴灌',
      soil_type: '壤土',
      planting_status: '已播种',
      note: ''
    }
  },

  formatFieldLabel(plot) {
    const name = plot && plot.name ? plot.name : '未命名地块'
    const area = Number(plot && plot.area ? plot.area : 0)
    return area > 0 ? `${name} · ${formatArea(area)}亩` : name
  },

  resolveSelectedIndex(plots) {
    if (!Array.isArray(plots) || !plots.length) return 0

    if (this.queryPlotId) {
      const byId = plots.findIndex(plot => Number(plot.id) === this.queryPlotId)
      if (byId >= 0) return byId
    }

    if (this.queryPlotName) {
      const byName = plots.findIndex(plot => String(plot.name || '') === this.queryPlotName)
      if (byName >= 0) return byName
    }

    return 0
  },

  async applySelectedPlot(index, plots = this.plotList || []) {
    const safeIndex = Math.max(0, Math.min(index, Math.max(plots.length - 1, 0)))
    const plot = plots[safeIndex] || this.buildVirtualPlot()
    const weatherModel = await this.loadWeatherModel(plot, safeIndex, plots.length)

    this.setData({
      loading: false,
      loadError: '',
      fields: plots.map((item, itemIndex) => ({
        id: item.id,
        label: this.formatFieldLabel(item),
        selected: itemIndex === safeIndex
      })),
      fieldCount: plots.length,
      selectedFieldIndex: safeIndex,
      selectedFieldLabel: weatherModel.selectedFieldLabel,
      sourceInfo: weatherModel.sourceInfo || {
        type: 'simulated',
        label: '模拟数据',
        desc: '天气接口不可用或未选择有效地块时，由本地模型按地块生成，仅供参考。'
      },
      locationLabel: weatherModel.locationLabel,
      regionLabel: weatherModel.regionLabel,
      weather: weatherModel.weather,
      hourly: weatherModel.hourly || [],
      forecast: weatherModel.forecast,
      advices: weatherModel.advices,
      alert: weatherModel.alert,
      showAlertDetail: false,
      alertDetail: null,
      summary: weatherModel.summary,
      tipText: weatherModel.tipText
    })
  },

  async loadWeatherModel(plot, selectedIndex, fieldCount) {
    if (auth.isLoggedIn() && plot && Number(plot.id) > 0) {
      try {
        const res = await auth.request('GET', `/api/weather/plot/${plot.id}`)
        if (res.code === 200 && res.data && res.data.weather) {
          return buildWeatherFromApi(res.data.plot || plot, res.data.weather, {
            fieldCount,
            selectedIndex
          })
        }
      } catch (error) {}
    }

    return buildWeatherForPlot(plot, {
      fieldCount,
      selectedIndex
    })
  },

  onSelField(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index)) return
    this.applySelectedPlot(index)
  },

  onRetry() {
    this.loadWeatherPage()
  },

  buildSafeDetail() {
    return {
      icon: '✅',
      title: '今日作业提示',
      level: '正常',
      sub: this.data.summary || '当前暂无灾害性天气预警。',
      agency: '棉管家气象助手',
      impactTime: '今日',
      impactArea: this.data.selectedFieldLabel || '当前地块',
      actions: [
        '当前暂无大风、强降雨、高温等灾害性预警',
        '可按页面农事建议安排巡田、滴灌和轻作业',
        '喷药和无人机作业前再次确认风力与降水概率'
      ]
    }
  },

  onAlertTap() {
    this.setData({
      showAlertDetail: true,
      alertDetail: this.data.alert || this.buildSafeDetail()
    })
  },

  onCloseAlert() {
    this.setData({ showAlertDetail: false, alertDetail: null })
  },

  onSourceTap() {
    const source = this.data.sourceInfo || {}
    wx.showToast({
      title: source.desc || source.label || '天气数据来源',
      icon: 'none',
      duration: 2600
    })
  },

  noop() {},

  onBack() {
    wx.navigateBack()
  }
})
