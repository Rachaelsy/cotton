// pages/index/index.js — 首页
const app  = getApp()
const auth = require('../../utils/auth')
const { buildWeatherForPlot, buildWeatherFromApi } = require('../../utils/weather')

Page({
  data: {
    statusBarHeight: 20,
    isLoggedIn: false,
    name: '游客',
    location: '新疆 · 棉花种植管理平台',
    today: '',
    weatherPreview: {
      locationLabel: '喀什地区 · 全部地块',
      weather: { temp: 0, desc: '晴转多云', icon: '🌤', high: 0, low: 0, wind: '西北风3级' },
      tipText: '登录后会根据你的地块自动生成天气建议。'
    },
    plotStats: { count: 0, area: '0', attention: 0 },
    modules: [
      { id: 1,  name: '地块管理',   icon: '🗺',  bg: '#E8F5E9', action: 'fields' },
      { id: 2,  name: '遥感监测',   icon: '🛰',  bg: '#E3F2FD', newTag: true, action: 'remote' },
      { id: 3,  name: '病虫害识别', icon: '🔬',  bg: '#FCE4EC', action: 'pest' },
      { id: 4,  name: '地块气象',   icon: '⛅',  bg: '#E3F2FD', action: 'weather' },
      { id: 5,  name: '农事记录',   icon: '📝',  bg: '#EDE7F6', action: 'records' },
      { id: 6,  name: '农机租赁',   icon: '🚜',  bg: '#E0F7FA', action: 'machine' },
      { id: 7,  name: '农资供应',   icon: '🌾',  bg: '#FFF3E0', action: 'supplies' },
      { id: 8,  name: '棉花交易',   icon: '💰',  bg: '#FFEBEE', action: 'trade' },
      { id: 9,  name: '农业贷款',   icon: '🏦',  bg: '#E0F2F1', action: 'loans' },
      { id: 10, name: '农业保险',   icon: '🛡',  bg: '#E8EAF6', action: 'insurance' },
      { id: 11, name: '专家讲堂',   icon: '🎓',  bg: '#EFEBE9', action: 'expert' }
    ]
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this._setToday()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this._refreshUser()
    this._loadPlotStats()
  },

  _refreshUser() {
    const user = auth.getUser() || app.globalData.user
    const loggedIn = auth.isLoggedIn() && !!user
    if (loggedIn && user) {
      this.setData({
        isLoggedIn: true,
        name: user.real_name || user.phone || '棉农',
        location: user.location ? `喀什 · ${user.location}` : '喀什 · 疏附县棉田主'
      })
    } else {
      this.setData({ isLoggedIn: false, name: '游客', location: '新疆 · 棉花种植管理平台' })
    }
  },

  async _loadPlotStats() {
    if (!auth.isLoggedIn()) {
      this.setData({ plotStats: { count: 0, area: '0', attention: 0 } })
      this.setData({ weatherPreview: this._buildWeatherPreview(null) })
      return
    }
    try {
      const res = await auth.request('GET', '/api/plots')
      if (res.code !== 200 || !Array.isArray(res.data)) return
      const area = res.data.reduce((sum, plot) => sum + Number(plot.area || 0), 0)
      const weatherPreview = await this._loadWeatherPreview(res.data)
      this.setData({
        plotStats: {
          count: res.data.length,
          area: area.toFixed(area >= 100 ? 0 : 1),
          attention: res.data.filter(plot => plot.status === 'attention').length
        },
        weatherPreview
      })
    } catch (error) {}
  },

  async _loadWeatherPreview(plots) {
    const firstPlot = Array.isArray(plots) && plots.length ? plots[0] : null
    if (firstPlot && auth.isLoggedIn()) {
      try {
        const res = await auth.request('GET', `/api/weather/plot/${firstPlot.id}`)
        if (res.code === 200 && res.data && res.data.weather) {
          const model = buildWeatherFromApi(res.data.plot || firstPlot, res.data.weather, {
            fieldCount: plots.length,
            selectedIndex: 0
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
        }
      } catch (error) {}
    }

    return this._buildWeatherPreview(plots)
  },

  _buildWeatherPreview(plots) {
    const plot = Array.isArray(plots) && plots.length ? plots[0] : {
      id: 0,
      name: '全部地块',
      area: 0,
      coordinates: [],
      sow_date: null,
      irrigation: '滴灌',
      soil_type: '壤土',
      planting_status: '已播种',
      note: ''
    }
    const model = buildWeatherForPlot(plot, {
      fieldCount: Array.isArray(plots) ? plots.length : 0,
      selectedIndex: 0
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

  onGoLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  _setToday() {
    const d = new Date()
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    this.setData({
      today: `${d.getMonth() + 1}月${d.getDate()}日 ${week[d.getDay()]}`
    })
  },

  onModule(e) {
    const action = e.currentTarget.dataset.action
    if (action === 'supplies') {
      wx.navigateTo({ url: '/subpkg-supplies/supplies/index' })
    } else if (action === 'fields') {
      wx.navigateTo({ url: '/pages/fields/index' })
    } else if (action === 'weather') {
      wx.navigateTo({ url: '/pages/weather/index' })
    } else if (action === 'records') {
      wx.navigateTo({ url: '/pages/records/index' })
    } else if (action === 'machine') {
      wx.navigateTo({ url: '/pages/machine/index' })
    } else {
      wx.showToast({ title: '正在开发中，敬请期待', icon: 'none', duration: 2000 })
    }
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
        // 压缩图片（质量 50%，减小上传体积）
        wx.compressImage({
          src: tempFilePath,
          quality: 50,
          success: (compRes) => {
            app.globalData.pendingPhoto = { tempFilePath: compRes.tempFilePath }
            wx.switchTab({ url: '/pages/ai/index' })
          },
          fail: () => {
            // 压缩失败则用原图
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
      success(res) {
        wx.showToast({ title: res.tapIndex === 0 ? '已切换为中文' : 'تىل ئۆزگەرتىلدى', icon: 'none' })
      }
    })
  },

  onNotification() {
    wx.showToast({ title: '暂无新通知', icon: 'none' })
  }
})
