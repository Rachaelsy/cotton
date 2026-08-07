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

const KASHGAR_CENTER = { latitude: 39.47, longitude: 75.99 }

function getCurrentLocation() {
  return new Promise(resolve => {
    wx.getLocation({
      type: 'gcj02',
      success: result => resolve({
        center: { latitude: Number(result.latitude), longitude: Number(result.longitude) },
        fallback: false
      }),
      fail: () => resolve({ center: KASHGAR_CENTER, fallback: true })
    })
  })
}

function numberFromText(value) {
  const matched = String(value == null ? '' : value).match(/-?\d+(?:\.\d+)?/)
  return matched ? Number(matched[0]) : null
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    loading: true,
    common: i18n.getPageCopy('common'),
    copy: i18n.getPageCopy('weatherPage'),
    loadError: '',
    weatherDataError: '',
    hasWeatherData: false,
    apiNotice: '',
    fields: [],
    fieldCount: 0,
    selectedFieldIndex: 0,
    selectedFieldLabel: i18n.t('weatherPage', 'allFields'),
    selectedSourceLabel: i18n.t('weatherPage', 'currentLocation'),
    showLocationPicker: false,
    pickerTop: 112,
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
    warningAvailable: true,
    weatherStatistics: null,
    statsTruthText: '',
    showAlertDetail: false,
    alertDetail: null,
    summary: '',
    tipText: '',
    forecastSummary: '',
    forecastDays: [],
    weatherHighlights: [],
    updatedAt: ''
  },

  onLoad(options = {}) {
    const info = wx.getSystemInfoSync()
    this.queryPlotId = Number(options.plotId) || null
    this.queryPlotName = decodeText(options.plotName || '')
    this.applyLanguage()
    const screenWidth = Number(info.windowWidth || info.screenWidth || 375)
    const pickerTop = (info.statusBarHeight || 20) + Math.round(180 * screenWidth / 750)
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      pickerTop
    })
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
    this.setData({ loading: true, loadError: '', weatherDataError: '', apiNotice: '', showLocationPicker: false })
    try {
      const [location, plots] = await Promise.all([getCurrentLocation(), this.loadPlots()])
      this.locationFallback = location.fallback
      const locationItem = {
        id: 0,
        name: location.fallback ? this.textCopy.kashgarReference : this.textCopy.currentLocation,
        area: 0,
        coordinates: [],
        _kind: 'location',
        center: location.center
      }
      const sources = [locationItem, ...plots]
      const selectedIndex = this.resolveSelectedIndex(sources)
      this.plotList = sources
      await this.applySelectedPlot(selectedIndex, sources)
    } catch (error) {
      this.setData({
        loadError: error.message || this.textCopy.loadError,
        loading: false
      })
    }
  },

  async loadPlots() {
    if (!auth.isLoggedIn()) return []

    try {
      const res = await auth.request('GET', '/api/plots')
      if (res.code === 200 && Array.isArray(res.data)) return res.data
      return []
    } catch (error) {
      console.warn('[weather-plots]', error.message || error)
      return []
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
    if (plot && plot._kind === 'location') return plot.name
    const name = plot && plot.name ? plot.name : this.textCopy.unnamedField
    const area = Number(plot && plot.area ? plot.area : 0)
    return area > 0 ? `${name} · ${formatArea(area)}${this.data.common.mu}` : name
  },

  buildWeatherUnavailableModel(plot, selectedIndex, fieldCount, reason) {
    const selectedFieldLabel = this.formatFieldLabel(plot)
    const empty = this.textCopy.weatherDataEmpty
    const desc = reason || this.textCopy.weatherDataEmptyDesc
    return {
      selectedFieldLabel,
      fieldCount,
      selectedIndex,
      sourceInfo: {
        type: 'unavailable',
        label: empty,
        desc
      },
      locationLabel: plot && plot.name ? plot.name : this.textCopy.currentField,
      regionLabel: this.textCopy.currentField,
      weather: {
        temp: '--',
        desc: empty,
        icon: '⚠️',
        high: '--',
        low: '--',
        wind: '--',
        windLevel: '--',
        humidity: '--',
        groundTemp: '--',
        groundTempLabel: this.textCopy.groundTemp,
        rain: '--',
        uv: '--',
        pressure: '--',
        visibility: '--',
        visibilityText: '--'
      },
      hourly: [],
      forecast: [],
      advices: [],
      alert: null,
      warningAvailable: false,
      weatherStatistics: null,
      statsTruthText: '',
      summary: desc,
      tipText: this.textCopy.weatherDataEmptyDesc
    }
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
    let weatherDataError = ''
    let result
    try {
      result = await this.loadWeatherModel(plot, safeIndex, plots.length)
    } catch (error) {
      weatherDataError = error.message || this.textCopy.loadError
      result = {
        model: this.buildWeatherUnavailableModel(plot, safeIndex, plots.length, weatherDataError),
        apiNotice: ''
      }
    }
    const weatherModel = result.model || result

    const forecastDays = this.decorateForecast(weatherModel.forecast || [])
    this.setData({
      loading: false,
      loadError: '',
      weatherDataError,
      hasWeatherData: !weatherDataError,
      apiNotice: result.apiNotice || '',
      fields: plots.map((item, itemIndex) => ({
        id: item.id,
        label: this.formatFieldLabel(item),
        selected: itemIndex === safeIndex
      })),
      fieldCount: plots.length,
      selectedFieldIndex: safeIndex,
      selectedFieldLabel: weatherModel.selectedFieldLabel,
      selectedSourceLabel: this.formatFieldLabel(plot),
      sourceInfo: weatherModel.sourceInfo,
      locationLabel: weatherModel.locationLabel,
      regionLabel: weatherModel.regionLabel,
      weather: weatherModel.weather,
      hourly: weatherModel.hourly || [],
      forecast: weatherModel.forecast || [],
      forecastDays,
      forecastSummary: this.buildForecastSummary(weatherModel, forecastDays),
      weatherHighlights: this.buildWeatherHighlights(weatherModel, forecastDays),
      updatedAt: this.formatUpdatedAt(),
      advices: weatherModel.advices,
      alert: weatherModel.alert,
      warningAvailable: weatherModel.warningAvailable !== false,
      weatherStatistics: weatherModel.weatherStatistics || null,
      statsTruthText: weatherModel.weatherStatistics
        ? this.textCopy.statsTruth(weatherModel.weatherStatistics.observationHours)
        : '',
      showAlertDetail: false,
      alertDetail: null,
      showLocationPicker: false,
      summary: weatherModel.summary,
      tipText: weatherModel.tipText
    })
  },

  async loadWeatherModel(plot, selectedIndex, fieldCount) {
    if (plot && plot._kind === 'location') {
      const center = plot.center || KASHGAR_CENTER
      let res
      try {
        res = await auth.request(
          'GET',
          `/api/weather/location?lat=${encodeURIComponent(center.latitude)}&lng=${encodeURIComponent(center.longitude)}`
        )
      } catch (error) {
        throw new Error(this.textCopy.realApiFail(error.message))
      }
      if (res.code === 200 && res.data && res.data.weather) {
        const locationName = res.data.location && res.data.location.name
          ? res.data.location.name
          : plot.name
        const locationPlot = { ...plot, name: locationName }
        const model = buildWeatherFromApi(locationPlot, res.data.weather, { fieldCount, selectedIndex })
        model.selectedFieldLabel = locationName
        model.locationLabel = `${locationName} · ${this.textCopy.locationForecast}`
        return {
          model,
          apiNotice: this.locationFallback ? this.textCopy.locationFallbackNotice : ''
        }
      }
      throw new Error(this.textCopy.realApiError(res.msg || res.code))
    }

    if (!auth.isLoggedIn()) throw new Error(this.textCopy.noLoginNotice)

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
        model: buildWeatherFromApi(
          res.data.plot || plot,
          { ...res.data.weather, statistics: res.data.statistics || null },
          { fieldCount, selectedIndex }
        ),
        apiNotice: ''
      }
    }

    throw new Error(this.textCopy.realApiError(res.msg || res.code))
  },

  decorateForecast(forecast) {
    const items = Array.isArray(forecast) ? forecast.slice(0, 7) : []
    const values = items.reduce((all, item) => {
      const low = Number(item.low)
      const high = Number(item.high)
      if (Number.isFinite(low)) all.push(low)
      if (Number.isFinite(high)) all.push(high)
      return all
    }, [])
    const min = values.length ? Math.min(...values) : 0
    const max = values.length ? Math.max(...values) : min + 1
    const range = Math.max(max - min, 1)
    return items.map((item, index) => {
      const low = Number(item.low)
      const high = Number(item.high)
      const left = Number.isFinite(low) ? 8 + ((low - min) / range) * 40 : 8
      const width = Number.isFinite(low) && Number.isFinite(high)
        ? Math.max(22, ((high - low) / range) * 48)
        : 30
      return {
        ...item,
        isToday: index === 0,
        barStyle: `left:${Math.round(left)}%;width:${Math.min(78, Math.round(width))}%`
      }
    })
  },

  buildForecastSummary(model, days) {
    if (!days.length) return this.textCopy.weatherDataEmptyDesc
    const highs = days.map(item => Number(item.high)).filter(Number.isFinite)
    const lows = days.map(item => Number(item.low)).filter(Number.isFinite)
    const max = highs.length ? Math.max(...highs) : '--'
    const min = lows.length ? Math.min(...lows) : '--'
    const alertText = model.alert ? model.alert.title : this.textCopy.noSevereWeather
    return this.textCopy.forecastSummary(days.length, min, max, alertText)
  },

  buildWeatherHighlights(model, days) {
    const weather = model.weather || {}
    const hourly = Array.isArray(model.hourly) ? model.hourly : []
    const rainValues = hourly
      .map(item => numberFromText(item.rainText))
      .filter(Number.isFinite)
    const rainMax = rainValues.length ? Math.max(...rainValues) : Number(weather.rain || 0)
    const windLevel = numberFromText(weather.windLevel) || numberFromText(weather.wind) || 0
    const forecastHighs = days.map(item => Number(item.high)).filter(Number.isFinite)
    const high = forecastHighs.length ? Math.max(...forecastHighs) : Number(weather.high)

    return [
      {
        icon: '🌧',
        label: this.textCopy.rainRisk,
        value: rainMax > 0 ? this.textCopy.rainExpected : this.textCopy.lowRisk,
        tone: rainMax > 0 ? 'amber' : 'green'
      },
      {
        icon: '💨',
        label: this.textCopy.windRisk,
        value: windLevel >= 4 ? this.textCopy.notForSpraying : this.textCopy.sprayWindow,
        tone: windLevel >= 4 ? 'amber' : 'green'
      },
      {
        icon: '🌡',
        label: this.textCopy.heatRisk,
        value: high >= 35 ? this.textCopy.avoidNoon : this.textCopy.temperatureStable,
        tone: high >= 35 ? 'red' : 'blue'
      }
    ]
  },

  formatUpdatedAt() {
    const now = new Date()
    const pad = value => String(value).padStart(2, '0')
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`
  },

  onToggleLocationPicker() {
    this.setData({ showLocationPicker: !this.data.showLocationPicker })
  },

  onCloseLocationPicker() {
    this.setData({ showLocationPicker: false })
  },

  onChooseWeatherSource(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index)) return
    if (index === this.data.selectedFieldIndex) {
      this.setData({ showLocationPicker: false })
      return
    }
    this.setData({ loading: true, loadError: '', weatherDataError: '', apiNotice: '', showLocationPicker: false })
    this.applySelectedPlot(index).catch(error => {
      this.setData({
        loading: false,
        loadError: error.message || this.textCopy.loadError,
        apiNotice: '',
        showLocationPicker: false
      })
    })
  },

  onSelField(e) {
    this.onChooseWeatherSource(e)
  },

  onRetry() {
    this.loadWeatherPage()
  },

  buildSafeDetail() {
    if (!this.data.warningAvailable) {
      return {
        icon: '⚠️', title: this.textCopy.warningUnavailable, level: '',
        sub: this.textCopy.warningUnavailableDesc, agency: 'QWeather',
        impactTime: this.textCopy.today,
        impactArea: this.data.selectedFieldLabel || this.textCopy.currentField,
        actions: [this.textCopy.warningUnavailableDesc]
      }
    }
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
