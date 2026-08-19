const auth = require('../../utils/auth')
const { buildWeatherFromApi } = require('../../utils/weather')

function loadWechatSI() {
  if (typeof requirePlugin !== 'function') return null
  try { return requirePlugin('WechatSI') } catch { return null }
}

const WechatSI = loadWechatSI()

function localDate(date = new Date()) {
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

Page({
  data: {
    heroTop: 64,
    userName: '棉农朋友',
    weatherPreview: {
      locationLabel: '正在定位',
      weather: { temp: '--', desc: '天气加载中', icon: '⛅', high: '--', low: '--', wind: '--' },
      tipText: '正在获取当前位置天气与农事建议'
    },
    todoDate: '',
    todos: [],
    todosLoading: true,
    todosError: '',
    todoScrollable: false,
    todoSpeaking: false,
    news: [],
    newsLoading: true
  },

  onLoad() {
    let heroTop = 64
    try {
      const info = wx.getSystemInfoSync()
      const capsule = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect()
      heroTop = capsule && capsule.bottom
        ? capsule.bottom + 12
        : (info.statusBarHeight || 20) + 48
    } catch (error) {
      heroTop = 64
    }
    this.setData({ heroTop })
  },

  onShow() {
    const user = auth.getUser && auth.getUser()
    if (user) this.setData({ userName: user.real_name || user.phone || '棉农朋友' })
    this.loadLocationWeather()
    this.loadTodayTodos()
    this.loadHomeNews()
  },

  async loadTodayTodos() {
    const date = localDate()
    const priorityNames = { normal: '日常', important: '重要', urgent: '紧急' }
    try {
      const res = await auth.request('GET', `/api/daily-todos?date=${encodeURIComponent(date)}`)
      const rows = res.code === 200 && Array.isArray(res.data) ? res.data : []
      const todos = rows.map((item, index) => ({
        ...item,
        order: index + 1,
        priorityLabel: priorityNames[item.priority] || '日常',
        displayText: item.voiceText || [item.timeLabel, item.title, item.content].filter(Boolean).join('，')
      }))
      const estimatedHeight = todos.reduce((total, item) => {
        const titleLines = Math.max(1, Math.ceil(Array.from(String(item.title || '')).length / 17))
        const textLines = Math.max(1, Math.ceil(Array.from(String(item.displayText || '')).length / 22))
        return total + 38 + titleLines * 36 + textLines * 35 + (item.timeLabel ? 34 : 0)
      }, 0)
      this.setData({
        todoDate: date,
        todos,
        todosError: '',
        todoScrollable: estimatedHeight > 310,
        todosLoading: false
      })
    } catch (error) {
      this.setData({ todoDate: date, todos: [], todosError: '今日待办加载失败', todoScrollable: false, todosLoading: false })
    }
  },

  toggleTodoSpeech() {
    if (this.data.todoSpeaking) {
      this.stopTodoSpeech()
      return
    }
    if (!this.data.todos.length) {
      return wx.showToast({
        title: this.data.todosError ? '待办加载失败，请稍后重试' : '今天暂时没有可播报的待办',
        icon: 'none'
      })
    }
    if (!(WechatSI && typeof WechatSI.textToSpeech === 'function')) {
      return wx.showToast({ title: '语音播报插件暂不可用', icon: 'none' })
    }
    const content = this.data.todos
      .map((item, index) => `${index + 1}，${item.voiceText || [item.timeLabel, item.title, item.content].filter(Boolean).join('，')}`)
      .join('。')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500)
    if (!content) return
    this.setData({ todoSpeaking: true })
    WechatSI.textToSpeech({
      lang: 'zh_CN', tts: true, content: `今日待办。${content}`,
      success: res => {
        const src = res && (res.filename || res.fileName)
        if (!src) { this.setData({ todoSpeaking: false }); return }
        if (!this.todoAudio) {
          this.todoAudio = wx.createInnerAudioContext()
          this.todoAudio.onEnded(() => this.setData({ todoSpeaking: false }))
          this.todoAudio.onError(() => {
            this.setData({ todoSpeaking: false })
            wx.showToast({ title: '语音播放失败，请稍后重试', icon: 'none' })
          })
        }
        if (typeof wx.setInnerAudioOption === 'function') wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: false })
        this.todoAudio.stop()
        this.todoAudio.src = src
        this.todoAudio.play()
      },
      fail: () => {
        this.setData({ todoSpeaking: false })
        wx.showToast({ title: '语音生成失败，请稍后重试', icon: 'none' })
      }
    })
  },

  stopTodoSpeech() {
    if (this.todoAudio) this.todoAudio.stop()
    this.setData({ todoSpeaking: false })
  },

  async loadHomeNews() {
    try {
      const res = await auth.request('GET', '/api/policies?homepage=1')
      const rows = res.code === 200 && Array.isArray(res.data) ? res.data.slice(0, 5) : []
      const fallbacks = ['/images/cotton-seedling-inspection-v1.jpg', '/images/course-water-v2.webp', '/images/course-scouting-v2.webp']
      const financeKeys = { loan: 'loan', insurance: 'insurance', futures: 'futures', 'finance-policy': 'policy' }
      const news = rows.map((item, index) => ({
        id: item.id,
        contentType: item.contentType,
        section: item.section,
        targetUrl: item.contentType === 'finance'
          ? `/pages/finance/channel?key=${financeKeys[item.section] || 'loan'}`
          : `/pages/policy/detail?id=${item.id}`,
        tag: item.contentType === 'finance' ? '优棉金融' : item.contentType === 'home' ? (item.section === 'homepage' ? '首页专稿' : item.section) : item.contentType === 'industry' ? (item.section || '行业资讯') : (item.section || '政策资讯'),
        title: item.title,
        source: item.issuer || '喀什优棉公共服务平台',
        date: item.publishDate ? String(item.publishDate).slice(0, 10) : '',
        image: item.coverImage || fallbacks[index % fallbacks.length]
      }))
      this.setData({ news, newsLoading: false })
    } catch (error) {
      this.setData({ news: [], newsLoading: false })
    }
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

  openNews() { wx.navigateTo({ url: '/pages/policy/index' }) },
  openProduction(e) {
    const type = e.currentTarget.dataset.type || 'machine'
    const routes = {
      machine: '/pages/machinery/index',
      supplies: '/pages/supplies/index',
      processing: '/pages/production/index',
      varieties: '/pages/varieties/index'
    }
    wx.navigateTo({ url: routes[type] || routes.machine })
  },
  openPolicy(e) {
    const url = e.currentTarget.dataset.url
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: url || (id ? `/pages/policy/detail?id=${id}` : '/pages/policy/index') })
  },
  openAi() { wx.switchTab({ url: '/pages/ai/index' }) },
  onHide() { this.stopTodoSpeech() },
  onUnload() {
    if (this.todoAudio) this.todoAudio.destroy()
    this.todoAudio = null
  }
})
