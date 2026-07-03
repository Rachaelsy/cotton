// pages/index/index.js — 首页
const app = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const { buildWeatherFromApi } = require('../../utils/weather')

const MODULES = [
  { id: 1, key: 'fields', icon: '🗺', bg: '#E8F5E9', action: 'fields' },
  { id: 2, key: 'pest', icon: '🔬', bg: '#FCE4EC', action: 'pest' },
  { id: 3, key: 'weather', icon: '⛅', bg: '#E3F2FD', action: 'weather' },
  { id: 4, key: 'water', icon: '💧', bg: '#E1F5FE', newTag: true, action: 'water' },
  { id: 5, key: 'fert', icon: '🌿', bg: '#F1F8E9', newTag: true, action: 'fert' },
  { id: 6, key: 'records', icon: '📝', bg: '#EDE7F6', action: 'records' },
  { id: 7, key: 'machine', icon: '🚜', bg: '#E0F7FA', action: 'machine' },
  { id: 8, key: 'supplies', icon: '🌾', bg: '#FFF3E0', action: 'supplies' },
  { id: 9, key: 'trade', icon: '💰', bg: '#FFEBEE', action: 'trade' },
  { id: 10, key: 'loans', icon: '🏦', bg: '#E0F2F1', action: 'loans' },
  { id: 11, key: 'insurance', icon: '🛡', bg: '#E8EAF6', action: 'insurance' },
  { id: 12, key: 'expert', icon: '🎓', bg: '#EFEBE9', action: 'expert' }
]

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
    lang: 'zh',
    common: i18n.getCopy('common'),
    copy: i18n.getCopy('home'),
    isLoggedIn: false,
    name: '游客',
    location: '新疆 · 棉花种植管理平台',
    today: '',
    weatherPreview: {
      locationLabel: '全部地块',
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
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
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
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    const copy = i18n.getCopy('home', lang)
    this.setData({
      lang,
      common: i18n.getCopy('common', lang),
      copy,
      modules: buildModules(lang),
      weatherPreview: this._buildWeatherUnavailable(this.data.isLoggedIn ? copy.weatherLoadFail : copy.weatherLoginTip, lang),
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
        homePlotLabel: this.data.copy.allFields,
        weatherPreview: this._buildWeatherUnavailable(this.data.copy.weatherLoginTip)
      })
      return
    }

    try {
      const res = await auth.request('GET', '/api/plots')
      if (res.code !== 200 || !Array.isArray(res.data)) {
        this.setData({ weatherPreview: this._buildWeatherUnavailable(res.msg || this.data.copy.weatherLoadFail) })
        return
      }
      const plots = res.data
      const area = plots.reduce((sum, plot) => sum + Number(plot.area || 0), 0)
      const selected = this._resolveHomePlot(plots)
      const selectedIndex = selected ? plots.findIndex(plot => Number(plot.id) === Number(selected.id)) + 1 : 0
      const weatherPreview = await this._loadWeatherPreview(plots, selected)

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
        homePlotLabel: selected ? this._plotLabel(selected) : this.data.copy.allFields,
        weatherPreview
      })
    } catch (error) {
      this.setData({ weatherPreview: this._buildWeatherUnavailable(error.message || this.data.copy.weatherLoadFail) })
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

  async _loadWeatherPreview(plots, selectedPlot) {
    const targetPlot = selectedPlot || (Array.isArray(plots) && plots.length ? plots[0] : null)
    if (!targetPlot) return this._buildWeatherUnavailable(this.data.copy.weatherNoPlot)

    let res
    try {
      res = await auth.request('GET', `/api/weather/plot/${targetPlot.id}`)
    } catch (error) {
      return this._buildWeatherUnavailable(error.message || this.data.copy.weatherLoadFail)
    }

    if (res.code !== 200 || !(res.data && res.data.weather)) {
      return this._buildWeatherUnavailable(res.msg || this.data.copy.weatherLoadFail)
    }

    const model = buildWeatherFromApi(res.data.plot || targetPlot, res.data.weather, {
      fieldCount: plots.length,
      selectedIndex: plots.findIndex(plot => Number(plot.id) === Number(targetPlot.id))
    })
    return {
      locationLabel: model.locationLabel,
      weather: {
        temp: model.weather.temp,
        desc: model.weather.desc,
        icon: model.weather.icon,
        high: model.weather.high,
        low: model.weather.low,
        wind: model.weather.wind
      },
      tipText: model.tipText
    }
  },

  _buildWeatherUnavailable(reason, lang = this.data.lang) {
    const copy = i18n.getCopy('home', lang)
    return {
      locationLabel: copy.allFields,
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

  async onHomePlotChange(e) {
    const index = Number(e.detail.value)
    const plot = index > 0 ? this.data.homePlots[index - 1] : null
    if (plot && plot.id) wx.setStorageSync('home_plot_id', plot.id)
    else wx.removeStorageSync('home_plot_id')
    this.setData({
      homePlotIndex: index,
      homePlot: plot,
      homePlotLabel: plot ? this._plotLabel(plot) : this.data.copy.allFields
    })
    const weatherPreview = await this._loadWeatherPreview(this.data.homePlots, plot || this._resolveHomePlot(this.data.homePlots))
    this.setData({ weatherPreview })
  },

  _buildPlotPageUrl(path) {
    const plot = this.data.homePlot
    if (!plot || !plot.id) return path
    return `${path}?plotId=${plot.id}&plotName=${encodeURIComponent(plot.name || '')}`
  },

  onModule(e) {
    const action = e.currentTarget.dataset.action
    const routes = {
      fields: '/pages/fields/index',
      pest: '/pages/pest/index',
      weather: '/pages/weather/index',
      water: this._buildPlotPageUrl('/pages/water/index'),
      fert: this._buildPlotPageUrl('/pages/fert/index'),
      records: '/pages/records/index',
      machine: '/pages/machine/index',
      trade: '/pages/trade/index',
      loans: '/pages/loans/index',
      insurance: '/pages/insurance/index',
      expert: '/pages/expert/index'
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
            app.globalData.pendingPhoto = { tempFilePath: compRes.tempFilePath }
            wx.switchTab({ url: '/pages/ai/index' })
          },
          fail: () => {
            app.globalData.pendingPhoto = { tempFilePath }
            wx.switchTab({ url: '/pages/ai/index' })
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
  }
})
