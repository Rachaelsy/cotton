const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')
const { buildWeatherFromApi } = require('../../utils/weather')

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
    capsuleSafeRight: 0,
    loading: true,
    common: i18n.getPageCopy('common'),
    copy: i18n.getPageCopy('weatherPage'),
    loadError: '',
    apiNotice: '',
    fields: [],
    fieldCount: 0,
    selectedFieldIndex: 0,
    selectedFieldLabel: i18n.t('weatherPage', 'allFields'),
    sourceInfo: { type: 'real', label: '', desc: '' },
    locationLabel: i18n.localizeText('喀什地区'),
    regionLabel: i18n.localizeText('喀什地区'),
    weather: {
      temp: 0,
      desc: i18n.localizeText('晴转多云'),
      icon: '🌤',
      high: 0,
      low: 0,
      wind: i18n.localizeText('西北风3级'),
      windLevel: 0,
      humidity: 0,
      groundTemp: 0,
      groundTempLabel: i18n.t('weatherPage', 'groundTemp'),
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
    this.applyLanguage()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })
    this.loadWeatherPage()
  },

  onShow() {
    const previousLang = this.currentLang
    this.applyLanguage()
    if (previousLang && previousLang !== this.currentLang && this.plotList) {
      this.applySelectedPlot(this.data.selectedFieldIndex, this.plotList).catch(error => {
        this.setData({
          loading: false,
          loadError: error.message || this.textCopy.loadError,
          apiNotice: ''
        })
      })
    }
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.currentLang = lang
    this.textCopy = i18n.getCopy('weatherPage', lang)
    this.setData({
      common: i18n.getPageCopy('common', lang),
      copy: i18n.getPageCopy('weatherPage', lang)
    })
  },

  async loadWeatherPage() {
    this.setData({ loading: true, loadError: '', apiNotice: '' })
    try {
      const plots = await this.loadPlots()
      const selectedIndex = this.resolveSelectedIndex(plots)
      this.plotList = plots
      await this.applySelectedPlot(selectedIndex, plots)
    } catch (error) {
      this.setData({
        loadError: error.message || this.textCopy.loadError,
        loading: false
      })
    }
  },

  async loadPlots() {
    if (!auth.isLoggedIn()) {
      throw new Error(this.textCopy.noLoginNotice)
    }

    try {
      const res = await auth.request('GET', '/api/plots')
      if (res.code === 200 && Array.isArray(res.data) && res.data.length) {
        return res.data
      }
      throw new Error((res && res.msg) || this.textCopy.noPlotNotice)
    } catch (error) {
      throw new Error(error.message || this.textCopy.loadError)
    }
  },

  buildVirtualPlot() {
    return {
      id: this.queryPlotId || 0,
      name: this.queryPlotName || this.textCopy.allFields,
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
    const name = plot && plot.name ? plot.name : this.textCopy.unnamedField
    const area = Number(plot && plot.area ? plot.area : 0)
    return area > 0 ? `${name} · ${formatArea(area)}${this.data.common.mu}` : name
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
    const plot = plots[safeIndex]
    if (!plot) throw new Error(this.textCopy.noPlotNotice)
    const result = await this.loadWeatherModel(plot, safeIndex, plots.length)
    const weatherModel = result.model || result

    this.setData({
      loading: false,
      loadError: '',
      apiNotice: result.apiNotice || '',
      fields: plots.map((item, itemIndex) => ({
        id: item.id,
        label: this.formatFieldLabel(item),
        selected: itemIndex === safeIndex
      })),
      fieldCount: plots.length,
      selectedFieldIndex: safeIndex,
      selectedFieldLabel: weatherModel.selectedFieldLabel,
      sourceInfo: weatherModel.sourceInfo,
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
    if (!auth.isLoggedIn()) {
      throw new Error(this.textCopy.noLoginNotice)
    }

    if (!(plot && Number(plot.id) > 0)) {
      throw new Error(this.textCopy.noPlotNotice)
    }

    let res
    try {
      res = await auth.request('GET', `/api/weather/plot/${plot.id}`)
    } catch (error) {
      throw new Error(this.textCopy.realApiFail(error.message))
    }

    if (res.code === 200 && res.data && res.data.weather) {
      return {
        model: buildWeatherFromApi(res.data.plot || plot, res.data.weather, { fieldCount, selectedIndex }),
        apiNotice: ''
      }
    }

    throw new Error(this.textCopy.realApiError(res.msg || res.code))
  },

  onSelField(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index)) return
    this.setData({ loading: true, loadError: '', apiNotice: '' })
    this.applySelectedPlot(index).catch(error => {
      this.setData({
        loading: false,
        loadError: error.message || this.textCopy.loadError,
        apiNotice: ''
      })
    })
  },

  onRetry() {
    this.loadWeatherPage()
  },

  buildSafeDetail() {
    return {
      icon: '✅',
      title: this.textCopy.safeTitle,
      level: this.textCopy.normal,
      sub: this.data.summary || this.textCopy.noAlert,
      agency: this.textCopy.agency,
      impactTime: this.textCopy.today,
      impactArea: this.data.selectedFieldLabel || this.textCopy.currentField,
      actions: this.textCopy.safeActions
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
      title: this.data.apiNotice || source.desc || source.label || this.textCopy.dataSource,
      icon: 'none',
      duration: 2600
    })
  },

  noop() {},

  onBack() {
    wx.navigateBack()
  }
})
