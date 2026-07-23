// pages/index/index.js — 首页
const app = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')
const { buildWeatherFromApi } = require('../../utils/weather')

const MODULES = [
  { id: 1, key: 'fields', icon: '🗺', bg: '#E8F5E9', action: 'fields' },
  { id: 2, key: 'weather', icon: '⛅', bg: '#E3F2FD', action: 'weather' },
  { id: 3, key: 'water', icon: '💧', bg: '#E1F5FE', newTag: true, action: 'water' },
  { id: 4, key: 'fert', icon: '🌿', bg: '#F1F8E9', newTag: true, action: 'fert' },
  { id: 5, key: 'records', icon: '📝', bg: '#EDE7F6', action: 'records' },
  { id: 6, key: 'machine', icon: '🚜', bg: '#E0F7FA', action: 'machine' },
  { id: 7, key: 'supplies', icon: '🌾', bg: '#FFF3E0', action: 'supplies' },
  { id: 8, key: 'expert', icon: '🎓', bg: '#EFEBE9', action: 'expert' },
  { id: 9, key: 'pest', icon: '🔬', bg: '#FCE4EC', action: 'pest' },
  { id: 10, key: 'trade', icon: '💰', bg: '#FFEBEE', action: 'trade' },
  { id: 11, key: 'loans', icon: '🏦', bg: '#E0F2F1', action: 'loans' },
  { id: 12, key: 'insurance', icon: '🛡', bg: '#E8EAF6', action: 'insurance' },
  { id: 13, key: 'knowledge', icon: '▤', bg: '#E4F3F8', newTag: true, action: 'knowledge' }
]
const DEVELOPING_MODULES = ['trade', 'loans', 'insurance']

function buildModules(lang = i18n.getLanguage()) {
  const copy = i18n.getCopy('modules', lang)
  return MODULES.map(item => ({ ...item, name: copy[item.key] || item.key }))
}

function formatMu(value) {
  const number = Number(value || 0)
  return number.toFixed(number >= 100 || number % 1 === 0 ? 0 : 1)
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    lang: 'zh',
    common: i18n.getCopy('common'),
    copy: i18n.getCopy('home'),
    tabCopy: i18n.getCopy('tab'),
    isLoggedIn: false,
    name: '游客',
    location: '新疆 · 棉花种植管理平台',
    today: '',
    weatherPreview: {
      locationLabel: '当前位置',
      weather: { temp: '--', desc: '', icon: '⚠️', high: '--', low: '--', wind: '--' },
      tipText: ''
    },
    plotStats: { count: 0, area: '0', attention: 0 },
    homePlots: [],
    homePlotOptions: ['全部地块'],
    homePlotIndex: 0,
    homePlot: null,
    homePlotLabel: '全部地块',
    modules: buildModules()
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })
    this.applyLanguage()
    this._setToday()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0, copy: i18n.getCopy('tab') })
    }
    this.applyLanguage()
    this._refreshUser()
    this._loadPlotStats()
    this._loadLocationWeatherPreview()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    const copy = i18n.getCopy('home', lang)
    this.setData({
      lang,
      common: i18n.getCopy('common', lang),
      copy,
      tabCopy: i18n.getCopy('tab', lang),
      modules: buildModules(lang),
      weatherPreview: this._buildWeatherUnavailable(copy.weatherLocating || copy.weatherLoadFail, lang),
      homePlotLabel: this.data.homePlot ? this._plotLabel(this.data.homePlot) : copy.allFields,
      homePlotOptions: this.data.homePlots.length
        ? [copy.allFields, ...this.data.homePlots.map(plot => this._plotLabel(plot))]
        : [copy.allFields]
    })
    this._setToday()
  },

  _refreshUser() {
    const user = auth.getUser() || app.globalData.user
    const loggedIn = auth.isLoggedIn() && !!user
    if (loggedIn && user) {
      this.setData({
        isLoggedIn: true,
        name: user.real_name || user.phone || (this.data.lang === 'ug' ? 'پاختىكار' : '棉农'),
        location: user.location ? `喀什 · ${user.location}` : this.data.copy.defaultLocation
      })
    } else {
      this.setData({ isLoggedIn: false, name: this.data.copy.guest, location: this.data.copy.platform })
    }
  },

  async _loadPlotStats() {
    if (!auth.isLoggedIn()) {
      this.setData({
        plotStats: { count: 0, area: '0', attention: 0 },
        homePlots: [],
        homePlotOptions: [this.data.copy.allFields],
        homePlotIndex: 0,
        homePlot: null,
        homePlotLabel: this.data.copy.allFields
      })
      return
    }

    try {
      const res = await auth.request('GET', '/api/plots')
      if (res.code !== 200 || !Array.isArray(res.data)) {
        this.setData({
          plotStats: { count: 0, area: '0', attention: 0 },
          homePlots: [],
          homePlotOptions: [this.data.copy.allFields],
          homePlotIndex: 0,
          homePlot: null,
          homePlotLabel: this.data.copy.allFields
        })
        return
      }
      const plots = res.data
      const area = plots.reduce((sum, plot) => sum + Number(plot.area || 0), 0)
      const selected = this._resolveHomePlot(plots)
      const selectedIndex = selected ? plots.findIndex(plot => Number(plot.id) === Number(selected.id)) + 1 : 0

      this.setData({
        plotStats: {
          count: plots.length,
          area: area.toFixed(area >= 100 ? 0 : 1),
          attention: plots.filter(plot => plot.status === 'attention').length
        },
        homePlots: plots,
        homePlotOptions: [this.data.copy.allFields, ...plots.map(plot => this._plotLabel(plot))],
        homePlotIndex: selectedIndex,
        homePlot: selected,
        homePlotLabel: selected ? this._plotLabel(selected) : this.data.copy.allFields
      })
    } catch (error) {
      this.setData({
        plotStats: { count: 0, area: '0', attention: 0 },
        homePlots: [],
        homePlotOptions: [this.data.copy.allFields],
        homePlotIndex: 0,
        homePlot: null,
        homePlotLabel: this.data.copy.allFields
      })
    }
  },

  _plotLabel(plot) {
    return `${plot.name || '未命名地块'} · ${formatMu(plot.area)}${this.data.common.mu || '亩'}`
  },

  _resolveHomePlot(plots) {
    if (!Array.isArray(plots) || !plots.length) return null
    const savedId = Number(wx.getStorageSync('home_plot_id') || 0)
    if (savedId) {
      const saved = plots.find(plot => Number(plot.id) === savedId)
      if (saved) return saved
    }
    return plots[0]
  },

  _getCurrentLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 4000,
        success: resolve,
        fail: reject
      })
    })
  },

  _formatLocationWeatherLabel(location) {
    const copy = this.data.copy || {}
    if (location && location.name) return `${location.name} · ${copy.currentWeatherLocation || '当前位置'}`
    return copy.currentWeatherLocation || '当前位置'
  },

  _buildHomeWeatherPreview(payload) {
    const location = payload && payload.location ? payload.location : null
    const locationName = location && location.name ? location.name : (this.data.copy.currentWeatherLocation || '当前位置')
    const model = buildWeatherFromApi({ name: locationName, area: 0 }, payload.weather, {
      fieldCount: 0,
      selectedIndex: 0
    })
    return {
      locationLabel: this._formatLocationWeatherLabel(location),
      weather: {
        temp: model.weather.temp,
        desc: model.weather.desc,
        icon: model.weather.icon,
        high: model.weather.high,
        low: model.weather.low,
        wind: model.weather.wind
      },
      tipText: this._homeWeatherTip(model)
    }
  },

  async _loadLocationWeatherPreview(options = {}) {
    const { showToast = false } = options
    const copy = this.data.copy || {}
    this.setData({ weatherPreview: this._buildWeatherUnavailable(copy.weatherLocating || copy.weatherLoadFail) })

    try {
      const position = await this._getCurrentLocation()
      const lat = encodeURIComponent(position.latitude)
      const lng = encodeURIComponent(position.longitude)
      const res = await auth.request('GET', `/api/weather/location?lat=${lat}&lng=${lng}`)
      if (res.code !== 200 || !(res.data && res.data.weather)) {
        throw new Error(res.msg || copy.weatherLoadFail)
      }
      this.setData({ weatherPreview: this._buildHomeWeatherPreview(res.data) })
    } catch (error) {
      const message = String(error && (error.errMsg || error.message) ? (error.errMsg || error.message) : '')
      const reason = /auth deny|auth denied|authorize|permission/i.test(message)
        ? (copy.weatherLocationDenied || copy.weatherLoadFail)
        : ((error && error.message) || copy.weatherLoadFail)
      this.setData({ weatherPreview: this._buildWeatherUnavailable(reason) })
      if (showToast) wx.showToast({ title: reason, icon: 'none' })
    }
  },

  _homeWeatherTip(model) {
    const weather = (model && model.weather) || {}
    if (model && model.alert && (model.alert.summary || model.alert.sub)) {
      return model.alert.summary || model.alert.sub
    }

    const high = Number(weather.high)
    const rain = Number(weather.rain || 0)
    const windLevel = Number(weather.windLevel || 0)
    let key = 'stable'

    if (windLevel >= 5) {
      key = 'wind'
    } else if (rain > 0) {
      key = 'rain'
    } else if (Number.isFinite(high) && high >= 32) {
      key = 'hot'
    }

    const tips = {
      zh: {
        stable: '天气平稳，适合巡田和滴灌。',
        wind: '风力偏大，喷药和无人机先缓一缓。',
        rain: '有降水影响，喷药施肥尽量提前。',
        hot: '午后高温，注意滴灌保墒。'
      },
      ug: {
        stable: 'ھاۋارايى مۇقىم، ئېتىز ئايلىنىش ۋە تامچە سۇغىرىشقا ماس.',
        wind: 'شامال كۈچلۈك، دورا پۈركۈش ۋە ئۇچقۇچىسىز ئۈسكۈنىنى كېچىكتۈرۈڭ.',
        rain: 'يامغۇر تەسىرى بار، دورا ۋە ئوغۇتلاشنى ئالدىن قىلىڭ.',
        hot: 'چۈشتىن كېيىن ئىسسىق، تامچە سۇغىرىپ نەملىك ساقلاڭ.'
      }
    }
    return (tips[this.data.lang] || tips.zh)[key]
  },

  _buildWeatherUnavailable(reason, lang = this.data.lang) {
    const copy = i18n.getCopy('home', lang)
    return {
      locationLabel: copy.currentWeatherLocation || '当前位置',
      weather: {
        temp: '--',
        desc: copy.weatherUnavailable,
        icon: '⚠️',
        high: '--',
        low: '--',
        wind: '--'
      },
      tipText: reason || copy.weatherLoadFail
    }
  },

  _setToday() {
    const d = new Date()
    const week = this.data.copy.week || i18n.getCopy('home').week
    if (this.data.lang === 'ug') {
      this.setData({ today: `${d.getMonth() + 1}-${d.getDate()} · ${week[d.getDay()]}` })
      return
    }
    this.setData({ today: `${d.getMonth() + 1}月${d.getDate()}日 ${week[d.getDay()]}` })
  },

  onHomePlotChange(e) {
    const index = Number(e.detail.value)
    const plot = index > 0 ? this.data.homePlots[index - 1] : null
    if (plot && plot.id) wx.setStorageSync('home_plot_id', plot.id)
    else wx.removeStorageSync('home_plot_id')
    this.setData({
      homePlotIndex: index,
      homePlot: plot,
      homePlotLabel: plot ? this._plotLabel(plot) : this.data.copy.allFields
    })
  },

  _buildPlotPageUrl(path) {
    const plot = this.data.homePlot
    if (!plot || !plot.id) return path
    return `${path}?plotId=${plot.id}&plotName=${encodeURIComponent(plot.name || '')}`
  },

  onModule(e) {
    const action = e.currentTarget.dataset.action
    if (DEVELOPING_MODULES.includes(action)) {
      wx.showToast({ title: this.data.common.developing, icon: 'none', duration: 2000 })
      return
    }
    const routes = {
      fields: '/pages/fields/index',
      pest: '/pages/pest/index',
      weather: '/pages/weather/index',
      water: this._buildPlotPageUrl('/pages/water/index'),
      fert: this._buildPlotPageUrl('/pages/fert/index'),
      records: '/pages/records/index',
      machine: '/pages/machine/index',
      expert: '/pages/expert/index',
      knowledge: '/pages/knowledge/index'
    }
    if (action === 'supplies') {
      wx.navigateTo({ url: '/subpkg-supplies/supplies/index' })
    } else if (routes[action]) {
      wx.navigateTo({ url: routes[action] })
    } else {
      wx.showToast({ title: this.data.common.developing, icon: 'none', duration: 2000 })
    }
  },

  onGoLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  onGoFields() {
    wx.navigateTo({ url: '/pages/fields/index' })
  },

  onRefreshWeatherLocation() {
    this._loadLocationWeatherPreview({ showToast: true })
  },

  onGoWeather() {
    wx.navigateTo({ url: '/pages/weather/index' })
  },

  onPhotoBanner() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        wx.compressImage({
          src: tempFilePath,
          quality: 50,
          success: (compRes) => {
            app.globalData.pendingPestPhoto = { tempFilePath: compRes.tempFilePath }
            wx.navigateTo({ url: '/pages/pest/result' })
          },
          fail: () => {
            app.globalData.pendingPestPhoto = { tempFilePath }
            wx.navigateTo({ url: '/pages/pest/result' })
          }
        })
      },
      fail: (err) => {
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({ title: '拍照失败，请重试', icon: 'none' })
        }
      }
    })
  },

  onLang() {
    wx.showActionSheet({
      itemList: ['中文', 'ئۇيغۇرچە'],
      success: (res) => {
        i18n.setLanguage(res.tapIndex === 0 ? 'zh' : 'ug')
        this.applyLanguage()
        this._refreshUser()
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
          this.getTabBar().setData({ copy: i18n.getCopy('tab') })
        }
        wx.showToast({ title: i18n.getCopy('common').languageChanged, icon: 'none' })
      }
    })
  },

  onNotification() {
    wx.showToast({ title: this.data.common.noNotification, icon: 'none' })
  },

  noop() {}
})
