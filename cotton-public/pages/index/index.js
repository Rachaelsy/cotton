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
    plotWorkDate: '',
    plotWorkGroups: [],
    plotWorkLoading: true,
    plotWorkError: '',
    plotWorkNeedsLogin: false,
    plotWorkScrollable: false,
    plotWorkSpeaking: false,
    plotWorkGenerating: false,
    voiceBriefing: '',
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
    this.setData({ userName: '棉农朋友' })
    this.refreshGreeting()
    this.loadLocationWeather()
    this.loadPlotDailyWork()
    this.loadVoiceBriefing()
    this.loadHomeNews()
  },

  async refreshGreeting() {
    if (!(auth.getToken && auth.getToken())) return
    const valid = await auth.verify()
    if (!valid) return
    const user = auth.getUser && auth.getUser()
    if (!user) return
    this.setData({ userName: user.nickname || user.real_name || '棉农朋友' })
  },

  async loadPlotDailyWork() {
    const date = localDate()
    if (!(auth.getToken && auth.getToken())) {
      this.setData({ plotWorkDate: date, plotWorkGroups: [], plotWorkLoading: false, plotWorkError: '', plotWorkNeedsLogin: true, plotWorkScrollable: false })
      return
    }
    try {
      const valid = await auth.verify()
      if (!valid) {
        this.setData({ plotWorkDate: date, plotWorkGroups: [], plotWorkLoading: false, plotWorkError: '', plotWorkNeedsLogin: true, plotWorkScrollable: false })
        return
      }
      const res = await auth.request('GET', `/api/plot-daily-work?date=${encodeURIComponent(date)}`)
      const priorityNames = { normal: '日常', important: '重要', urgent: '紧急' }
      const groups = res.code === 200 && Array.isArray(res.data) ? res.data.map(group => ({
        ...group,
        meta: [group.area ? `${group.area}亩` : '', group.variety, group.growthStage].filter(Boolean).join(' · '),
        items: (group.items || []).map(item => ({ ...item, priorityLabel: priorityNames[item.priority] || '日常' }))
      })) : []
      const itemCount = groups.reduce((sum, group) => sum + group.items.length, 0)
      this.setData({
        plotWorkDate: date,
        plotWorkGroups: groups,
        plotWorkLoading: false,
        plotWorkError: '',
        plotWorkNeedsLogin: false,
        plotWorkScrollable: groups.length > 2 || itemCount > 4
      })
    } catch (error) {
      this.setData({ plotWorkDate: date, plotWorkGroups: [], plotWorkLoading: false, plotWorkError: '今日农事加载失败', plotWorkNeedsLogin: false, plotWorkScrollable: false })
    }
  },

  async loadVoiceBriefing() {
    if (!(auth.getToken && auth.getToken())) {
      this.setData({ voiceBriefing: '' })
      return
    }
    try {
      const date = localDate()
      const result = await auth.request('GET', `/api/voice-briefings/today?date=${encodeURIComponent(date)}`)
      this.setData({ voiceBriefing: result.code === 200 && result.data ? String(result.data.content || '') : '' })
    } catch (error) {
      this.setData({ voiceBriefing: '' })
    }
  },

  async togglePlotWorkSpeech() {
    if (this.data.plotWorkSpeaking) {
      this.stopPlotWorkSpeech()
      return
    }
    if (this.data.plotWorkGenerating) return
    if (!(auth.getToken && auth.getToken())) {
      return wx.showToast({ title: '登录后使用智能播报', icon: 'none' })
    }
    if (!(WechatSI && typeof WechatSI.textToSpeech === 'function')) {
      return wx.showToast({ title: '语音播报插件暂不可用', icon: 'none' })
    }
    const groups = this.data.plotWorkGroups || []
    let publishedBriefing = String(this.data.voiceBriefing || '').trim()
    this.setData({ plotWorkGenerating: true })
    wx.showLoading({ title: '生成智能播报', mask: true })
    try {
      const date = localDate()
      let currentLocation = {}
      try {
        const position = await this.getCurrentLocation()
        currentLocation = { latitude: position.latitude, longitude: position.longitude }
      } catch (error) {
        currentLocation = {}
      }
      const result = await auth.request('POST', '/api/voice-briefings/generate', { briefingDate: date, ...currentLocation })
      if (!result || result.code !== 200) throw new Error(result && result.msg || '智能播报生成失败')
      publishedBriefing = result.code === 200 && result.data ? String(result.data.content || '').trim() : ''
      if (publishedBriefing) this.setData({ voiceBriefing: publishedBriefing })
    } catch (error) {
      if (!publishedBriefing) {
        return wx.showToast({ title: error.message || '智能播报生成失败', icon: 'none' })
      }
      wx.showToast({ title: '已使用最近一次播报', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ plotWorkGenerating: false })
    }
    const content = (publishedBriefing || groups
      .flatMap(group => (group.items || []).map(item => `${group.plotName}，${[item.timeLabel, item.title, item.content].filter(Boolean).join('，')}`))
      .map((item, index) => `${index + 1}，${item}`)
      .join('。'))
      .replace(/\s+/g, ' ').trim().slice(0, 500)
    if (!content) return wx.showToast({ title: '暂无可播报内容', icon: 'none' })
    this.setData({ plotWorkSpeaking: true })
    WechatSI.textToSpeech({
      lang: 'zh_CN', tts: true, content: publishedBriefing ? content : `今日农事。${content}`,
      success: res => {
        const src = res && (res.filename || res.fileName)
        if (!src) { this.setData({ plotWorkSpeaking: false }); return }
        if (!this.plotWorkAudio) {
          this.plotWorkAudio = wx.createInnerAudioContext()
          this.plotWorkAudio.onEnded(() => this.setData({ plotWorkSpeaking: false }))
          this.plotWorkAudio.onError(() => {
            this.setData({ plotWorkSpeaking: false })
            wx.showToast({ title: '语音播放失败，请稍后重试', icon: 'none' })
          })
        }
        if (typeof wx.setInnerAudioOption === 'function') wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: false })
        this.plotWorkAudio.stop()
        this.plotWorkAudio.src = src
        this.plotWorkAudio.play()
      },
      fail: () => {
        this.setData({ plotWorkSpeaking: false })
        wx.showToast({ title: '语音生成失败，请稍后重试', icon: 'none' })
      }
    })
  },

  stopPlotWorkSpeech() {
    if (this.plotWorkAudio) this.plotWorkAudio.stop()
    this.setData({ plotWorkSpeaking: false })
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
    if (key === 'academy') {
      wx.showToast({ title: '正在开发中', icon: 'none' })
      return
    }
    const routes = {
      fields: '/pages/fields/index', pest: '/pages/pest/index', weather: '/pages/weather/index',
      expert: '/pages/expert/index', records: '/pages/records/index',
      policy: '/pages/policy/index', finance: '/pages/finance/index'
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
  openAllPlotWork() { wx.navigateTo({ url: '/pages/daily-work/index' }) },
  openAi() { wx.switchTab({ url: '/pages/ai/index' }) },
  onHide() { this.stopPlotWorkSpeech() },
  onUnload() {
    if (this.plotWorkAudio) this.plotWorkAudio.destroy()
    this.plotWorkAudio = null
  }
})
