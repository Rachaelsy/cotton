const auth = require('../../utils/auth')
const { buildWeatherFromApi } = require('../../utils/weather')

Page({
  data: {
    userName: '棉农朋友',
    weatherPreview: {
      locationLabel: '正在定位',
      weather: { temp: '--', desc: '天气加载中', icon: '⛅', high: '--', low: '--', wind: '--' },
      tipText: '正在获取当前位置天气与农事建议'
    },
    news: [
      { id: 1, tag: '政策解读', title: '棉花生产支持政策要点，一文读懂', source: '农业资讯中心', image: '/images/cotton-seedling-inspection-v1.jpg' },
      { id: 2, tag: '农技指导', title: '高温天气来临，花铃期水肥管理这样做', source: '农技专家组', image: '/images/course-water-v2.webp' }
    ]
  },

  onShow() {
    const user = auth.getUser && auth.getUser()
    if (user) this.setData({ userName: user.real_name || user.phone || '棉农朋友' })
    this.loadLocationWeather()
  },

  getCurrentLocation() {
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

  buildWeatherPreview(payload) {
    const location = payload && payload.location ? payload.location : {}
    const locationName = location.name || '当前位置'
    const model = buildWeatherFromApi({ name: locationName, area: 0 }, payload.weather, {
      fieldCount: 0,
      selectedIndex: 0
    })
    const weather = model.weather || {}
    let tipText = '天气平稳，适合巡田并查看苗情。'
    if (model.alert && (model.alert.summary || model.alert.sub)) {
      tipText = model.alert.summary || model.alert.sub
    } else if (Number(weather.windLevel || 0) >= 5) {
      tipText = '风力偏大，喷药和无人机作业建议暂缓。'
    } else if (Number(weather.rain || 0) > 0) {
      tipText = '近期有降水，喷药施肥请合理安排时间。'
    } else if (Number(weather.high) >= 32) {
      tipText = '午后温度较高，请及时关注棉田墒情。'
    }
    return {
      locationLabel: location.name ? `${location.name} · 当前位置` : '当前位置',
      weather: {
        temp: weather.temp,
        desc: weather.desc || '实时天气',
        icon: weather.icon || '⛅',
        high: weather.high,
        low: weather.low,
        wind: weather.wind || '--'
      },
      tipText
    }
  },

  async loadLocationWeather() {
    try {
      const position = await this.getCurrentLocation()
      const lat = encodeURIComponent(position.latitude)
      const lng = encodeURIComponent(position.longitude)
      const res = await auth.request('GET', `/api/weather/location?lat=${lat}&lng=${lng}`)
      if (res.code !== 200 || !(res.data && res.data.weather)) throw new Error(res.msg || '天气加载失败')
      this.setData({ weatherPreview: this.buildWeatherPreview(res.data) })
    } catch (error) {
      this.setData({
        weatherPreview: {
          locationLabel: '喀什地区',
          weather: { temp: '--', desc: '点击查看天气', icon: '⛅', high: '--', low: '--', wind: '--' },
          tipText: '打开定位权限后，可查看当前位置天气与农事建议。'
        }
      })
    }
  },

  openModule(e) {
    const key = e.currentTarget.dataset.key
    const routes = {
      fields: '/pages/fields/index', pest: '/pages/pest/index', weather: '/pages/weather/index',
      expert: '/pages/expert/index', records: '/pages/records/index',
      academy: '/pages/academy/index', policy: '/pages/policy/index',
      finance: '/pages/finance/index'
    }
    if (routes[key]) wx.navigateTo({ url: routes[key] })
  },

  openNews() { wx.navigateTo({ url: '/pages/news/index' }) },
  openProduction(e) {
    const type = e.currentTarget.dataset.type || 'machine'
    const routes = {
      machine: '/pages/machinery/index',
      supplies: '/pages/supplies/index',
      processing: '/pages/production/index'
    }
    wx.navigateTo({ url: routes[type] || routes.machine })
  },
  openPolicy(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: id ? `/pages/policy/detail?id=${id}` : '/pages/policy/index' })
  },
  openAi() { wx.switchTab({ url: '/pages/ai/index' }) }
})
