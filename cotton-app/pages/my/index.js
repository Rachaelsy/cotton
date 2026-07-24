// pages/my/index.js — 我的
const app  = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    lang: 'zh',
    copy: i18n.getCopy('my'),
    common: i18n.getCopy('common'),
    tabCopy: i18n.getCopy('tab'),
    isLoggedIn: false,
    wxLoading: false,
    userInfo: { name: '--', tags: [], verified: false, landSize: 0 },
    userInitial: '?',
    orderCount: 0,
    favCount: 0,
    supportUnread: 0
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })
    this.applyLanguage()
    // 提前调用 wx.login 拿到 code，供微信登录使用
    this._refreshWxLoginCode()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2, copy: i18n.getCopy('tab') })
    }
    this.applyLanguage()
    this._refreshUser()
    this.setData({ favCount: (app.globalData.favorites || []).length })
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.setData({
      lang,
      copy: i18n.getCopy('my', lang),
      common: i18n.getCopy('common', lang),
      tabCopy: i18n.getCopy('tab', lang)
    })
  },

  // 刷新登录状态
  _refreshUser() {
    const user = auth.getUser() || app.globalData.user
    const loggedIn = auth.isLoggedIn() && !!user
    if (loggedIn && user) {
      const name = user.real_name || user.phone || '--'
      const tags = [this.data.copy.farmer, user.location ? `📍 ${user.location}` : this.data.copy.xinjiang]
      this.setData({
        isLoggedIn: true,
        userInfo: {
          name,
          tags: tags.filter(Boolean),
          verified: !!user.is_verified,
          landSize: user.land_size || 0
        },
        userInitial: name.charAt(0)
      })
      this._loadOrderCount()
      this._loadSupportUnread()
    } else {
      this.setData({ isLoggedIn: false, orderCount: 0, supportUnread: 0 })
      if (auth.hasGuestSession()) this._loadOrderCount()
    }
  },

  async _loadOrderCount() {
    try {
      const res = await auth.guestRequest('GET', '/api/orders/my')
      if (res.code === 200) {
        const active = (res.data || []).filter(o => o.status === 'pending_ship' || o.status === 'shipped')
        this.setData({ orderCount: active.length })
      }
    } catch { /* 忽略，不影响主界面 */ }
  },

  // 预先获取 wx.login code（在 onLoad 时调用，有效期 5 分钟）
  _refreshWxLoginCode() {
    wx.login({
      success: res => { this._wxLoginCode = res.code },
      fail: () => { this._wxLoginCode = null }
    })
  },

  // 微信一键登录（getPhoneNumber 返回 code）
  async onWxPhoneLogin(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: this.data.copy.cancelledLogin, icon: 'none' })
      return
    }
    const phoneCode = e.detail.code
    let loginCode = this._wxLoginCode

    // 若 loginCode 失效则重新获取
    if (!loginCode) {
      const loginRes = await new Promise(resolve => wx.login({ success: resolve, fail: () => resolve({}) }))
      loginCode = loginRes.code
    }
    if (!loginCode) {
      wx.showToast({ title: this.data.copy.loginFail, icon: 'none' })
      return
    }

    this.setData({ wxLoading: true })
    try {
      const res = await auth.wxLogin(loginCode, phoneCode)
      if (res.code === 200) {
        if (!auth.isFarmerUser(res.data)) {
          auth.clearToken()
          app.globalData.user = null
          wx.showModal({
            title: this.data.copy.webOnlyTitle || '请使用网页后台',
            content: this.data.copy.webOnlyContent || '商户、农机手和管理员账号请在网页端登录管理后台，小程序仅供农户使用。',
            showCancel: false,
            confirmText: this.data.copy.ok || '知道了'
          })
          this._refreshUser()
          return
        }
        wx.showToast({ title: this.data.copy.loginSuccess, icon: 'success' })
        this._refreshUser()
        this._refreshWxLoginCode()
      } else if (res.code === 503) {
        // 微信登录未配置，引导手机号登录
        wx.showModal({
          title: this.data.common.tip,
          content: this.data.copy.wxNotConfigured,
          showCancel: false,
          confirmText: this.data.copy.phoneLoginText,
          success: () => wx.navigateTo({ url: '/pages/login/index' })
        })
      } else {
        wx.showToast({ title: res.msg || this.data.copy.loginFail, icon: 'none' })
      }
    } catch {
      wx.showToast({ title: this.data.copy.loginFail, icon: 'none' })
    }
    this.setData({ wxLoading: false })
  },

  // 跳转手机号登录页
  onGoPhoneLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  onProfile() {
    if (!this.data.isLoggedIn) { wx.navigateTo({ url: '/pages/login/index' }); return }
    wx.navigateTo({ url: '/pages/profile/index' })
  },

  onSettings() {
    this.onLanguage()
  },

  onRealName() {
    if (!this.data.isLoggedIn) { wx.navigateTo({ url: '/pages/login/index' }); return }
    wx.navigateTo({ url: '/pages/verification/index' })
  },

  async _loadSupportUnread() {
    try {
      const res = await auth.request('GET', '/api/feedback/unread')
      if (res.code === 200) this.setData({ supportUnread: Number(res.data.total || 0) })
    } catch { /* 忽略，不影响主界面 */ }
  },

  onFavorites() {
    wx.navigateTo({ url: '/pages/favorites/index' })
  },

  onMyOrders() {
    if (!this.data.isLoggedIn && !auth.hasGuestSession()) {
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }
    wx.navigateTo({ url: '/subpkg-supplies/my-orders/index' })
  },

  onFeedback() {
    if (!this.data.isLoggedIn) { wx.navigateTo({ url: '/pages/login/index' }); return }
    wx.navigateTo({ url: '/pages/feedback/index' })
  },

  onAbout() {
    wx.showModal({
      title: this.data.copy.aboutTitle,
      content: this.data.copy.aboutContent,
      showCancel: false,
      confirmText: this.data.copy.ok
    })
  },

  onLanguage() {
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

  onLogout() {
    wx.showModal({
      title: this.data.copy.logoutTitle,
      content: this.data.copy.logoutContent,
      confirmText: this.data.copy.logoutConfirm,
      confirmColor: '#F5222D',
      success: res => {
        if (res.confirm) auth.logout()
      }
    })
  }
})
