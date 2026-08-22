const auth = require('../../utils/auth')

const COURSE_IDS = ['growth', 'seed', 'seedling', 'scout', 'water', 'pest']

function learningSummary() {
  const completed = COURSE_IDS.filter(id => !!wx.getStorageSync(`course_done_${id}`)).length
  const rewards = { growth: 10, seed: 15, seedling: 15, scout: 15, water: 20, pest: 20 }
  const points = COURSE_IDS.reduce((sum, id) => sum + (wx.getStorageSync(`course_done_${id}`) ? rewards[id] : 0), 0)
  return { completed, points }
}

function collectedCount() {
  const keys = wx.getStorageInfoSync().keys || []
  return keys.filter(key => key.indexOf('policy_collected_') === 0 && wx.getStorageSync(key)).length
}

Page({
  data: {
    statusBarHeight: 20,
    loggedIn: false,
    user: null,
    initial: '棉',
    displayName: '棉农朋友',
    profileComplete: false,
    verificationText: '未登录',
    plotCount: '--',
    courseCount: 0,
    collectedCount: 0,
    points: 0
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.renderSession(auth.isLoggedIn(), auth.getUser())
  },

  onShow() {
    this.refreshPage()
  },

  async refreshPage() {
    const refreshId = (this._refreshId || 0) + 1
    this._refreshId = refreshId
    const hasLocalSession = auth.isLoggedIn()
    this.renderSession(hasLocalSession, hasLocalSession ? auth.getUser() : null)
    if (!hasLocalSession) return

    const verified = await auth.verify()
    if (refreshId !== this._refreshId) return

    // 网络暂时异常时 verify 会保留 Token；只有服务端明确拒绝后 Token 才会被清除。
    const loggedIn = verified || auth.isLoggedIn()
    this.renderSession(loggedIn, loggedIn ? auth.getUser() : null)
  },

  renderSession(loggedIn, user) {
    const displayName = user && (user.nickname || user.real_name) || '棉农朋友'
    const learning = learningSummary()
    this.setData({
      loggedIn,
      user,
      displayName,
      profileComplete: !!(user && user.nickname),
      initial: String(displayName).charAt(0) || '棉',
      verificationText: !loggedIn ? '登录后查看' : (user && (user.is_verified || user.verification_status === 'approved') ? '已认证' : '未认证'),
      courseCount: learning.completed,
      points: learning.points,
      collectedCount: collectedCount(),
      plotCount: loggedIn ? '...' : '--'
    })
    if (loggedIn) this.loadPlots()
  },

  async loadPlots() {
    try {
      const res = await auth.request('GET', '/api/plots')
      this.setData({ plotCount: res.code === 200 && Array.isArray(res.data) ? res.data.length : '--' })
    } catch {
      this.setData({ plotCount: '--' })
    }
  },

  login() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  openProfile() {
    wx.navigateTo({ url: '/pages/profile/index' })
  },

  openPage(event) {
    const key = event.currentTarget.dataset.key
    const protectedKeys = ['verification', 'fields']
    if (protectedKeys.includes(key) && !auth.isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => this.login(), 500)
      return
    }
    const routes = {
      verification: '/pages/verification/index',
      fields: '/pages/fields/index',
      learning: '/pages/learning/index',
      collection: '/pages/collection/index',
      settings: '/pages/settings/index',
      about: '/pages/about/index'
    }
    if (routes[key]) wx.navigateTo({ url: routes[key] })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后，本机课程和收藏记录仍会保留。',
      confirmColor: '#b64d43',
      success: result => result.confirm && auth.logout()
    })
  }
})
