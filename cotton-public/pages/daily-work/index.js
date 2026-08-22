const auth = require('../../utils/auth')

function loadWechatSI() {
  if (typeof requirePlugin !== 'function') return null
  try { return requirePlugin('WechatSI') } catch { return null }
}

const WechatSI = loadWechatSI()

function localDate(date = new Date()) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function displayDate(value) {
  const date = new Date(`${value}T00:00:00`)
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`
}

function buildFarmWorkSpeech(groups, dateLabel) {
  const priorityNames = { important: '重要任务', urgent: '紧急任务' }
  const sections = (groups || []).map(group => {
    const tasks = (group.items || []).map(item => {
      const parts = [item.timeLabel, item.title, item.content, priorityNames[item.priority]].filter(Boolean)
      return parts.join('，')
    }).filter(Boolean)
    if (!tasks.length) return ''
    return `${group.plotName || '未命名地块'}。${tasks.join('。')}`
  }).filter(Boolean)
  return sections.length ? `${dateLabel}农事安排。${sections.join('。')}。` : ''
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleRight: 16,
    date: '',
    dateLabel: '',
    groups: [],
    plotCount: 0,
    taskCount: 0,
    urgentCount: 0,
    loading: true,
    needsLogin: false,
    error: '',
    speaking: false,
    generating: false
  },

  onLoad() {
    const system = wx.getSystemInfoSync()
    const capsule = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect()
    const date = localDate()
    this.setData({
      statusBarHeight: system.statusBarHeight || 20,
      capsuleRight: capsule && capsule.width ? system.windowWidth - capsule.left + 10 : 16,
      date,
      dateLabel: displayDate(date)
    })
  },

  onShow() { this.loadTasks() },

  async loadTasks() {
    const date = this.data.date || localDate()
    this.setData({ loading: true, error: '', needsLogin: false })
    if (!(auth.getToken && auth.getToken())) {
      this.setData({ loading: false, groups: [], needsLogin: true, plotCount: 0, taskCount: 0, urgentCount: 0 })
      return
    }
    try {
      const valid = await auth.verify()
      if (!valid) {
        this.setData({ loading: false, groups: [], needsLogin: true, plotCount: 0, taskCount: 0, urgentCount: 0 })
        return
      }
      const result = await auth.request('GET', `/api/plot-daily-work?date=${encodeURIComponent(date)}`)
      const priorityNames = { normal: '日常', important: '重要', urgent: '紧急' }
      const groups = result.code === 200 && Array.isArray(result.data) ? result.data.map(group => ({
        ...group,
        meta: [group.area ? `${group.area}亩` : '', group.variety, group.growthStage].filter(Boolean).join(' · '),
        items: (group.items || []).map((item, index) => ({
          ...item,
          number: index + 1,
          priorityLabel: priorityNames[item.priority] || '日常'
        }))
      })) : []
      const tasks = groups.flatMap(group => group.items || [])
      this.setData({
        groups,
        plotCount: groups.length,
        taskCount: tasks.length,
        urgentCount: tasks.filter(item => item.priority === 'urgent' || item.priority === 'important').length,
        loading: false,
        needsLogin: false
      })
    } catch (error) {
      this.setData({ loading: false, groups: [], error: '今日农事加载失败，请稍后重试', plotCount: 0, taskCount: 0, urgentCount: 0 })
    }
  },

  onDateChange(event) {
    const date = event.detail.value
    this.setData({ date, dateLabel: displayDate(date) })
    this.loadTasks()
  },

  backToday() {
    const date = localDate()
    this.setData({ date, dateLabel: displayDate(date) })
    this.loadTasks()
  },

  goLogin() { wx.navigateTo({ url: '/pages/login/index' }) },
  goBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) }) },

  async toggleSpeech() {
    if (this.data.speaking) {
      if (this.audio) this.audio.stop()
      this.setData({ speaking: false })
      return
    }
    if (this.data.generating) return
    if (!(auth.getToken && auth.getToken())) return wx.showToast({ title: '登录后使用智能播报', icon: 'none' })
    if (!(WechatSI && typeof WechatSI.textToSpeech === 'function')) return wx.showToast({ title: '语音播报暂不可用', icon: 'none' })
    const content = buildFarmWorkSpeech(this.data.groups, this.data.dateLabel).replace(/\s+/g, ' ').trim().slice(0, 500)
    if (!content) return wx.showToast({ title: '当前日期暂无可播报农事', icon: 'none' })
    this.setData({ generating: true })
    WechatSI.textToSpeech({
      lang: 'zh_CN',
      tts: true,
      content,
      success: result => {
        this.setData({ generating: false })
        const src = result && (result.filename || result.fileName)
        if (!src) return this.setData({ speaking: false })
        if (!this.audio) {
          this.audio = wx.createInnerAudioContext()
          this.audio.onEnded(() => this.setData({ speaking: false }))
          this.audio.onError(() => this.setData({ speaking: false }))
        }
        this.audio.stop()
        this.audio.src = src
        this.setData({ speaking: true })
        this.audio.play()
      },
      fail: () => {
        this.setData({ speaking: false, generating: false })
        wx.showToast({ title: '语音生成失败，请稍后重试', icon: 'none' })
      }
    })
  },

  onUnload() {
    if (this.audio) this.audio.destroy()
    this.audio = null
  }
})
