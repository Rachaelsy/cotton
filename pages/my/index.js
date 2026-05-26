// pages/my/index.js — 我的
const app  = getApp()
const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    isLoggedIn: false,
    wxLoading: false,
    userInfo: { name: '--', tags: [], verified: false, landSize: 0 },
    userInitial: '?',
    orderCount: 0,
    favCount: 0
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    // 提前调用 wx.login 拿到 code，供微信登录使用
    this._refreshWxLoginCode()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this._refreshUser()
    this.setData({ favCount: (app.globalData.favorites || []).length })
  },

  // 刷新登录状态
  _refreshUser() {
    const user = auth.getUser() || app.globalData.user
    const loggedIn = auth.isLoggedIn() && !!user
    if (loggedIn && user) {
      const name = user.real_name || user.phone || '--'
      const tags = ['🌾 农户', user.location ? `📍 ${user.location}` : '📍 新疆']
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
    } else {
      this.setData({ isLoggedIn: false, orderCount: 0 })
    }
  },

  async _loadOrderCount() {
    try {
      const res = await auth.request('GET', '/api/orders/my')
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
      wx.showToast({ title: '已取消登录', icon: 'none' })
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
      wx.showToast({ title: '微信登录失败，请重试', icon: 'none' })
      return
    }

    this.setData({ wxLoading: true })
    try {
      const res = await auth.wxLogin(loginCode, phoneCode)
      if (res.code === 200) {
        wx.showToast({ title: '登录成功', icon: 'success' })
        this._refreshUser()
        this._refreshWxLoginCode()
      } else if (res.code === 503) {
        // 微信登录未配置，引导手机号登录
        wx.showModal({
          title: '提示',
          content: '微信登录功能需配置 AppID，请使用手机号登录',
          showCancel: false,
          confirmText: '手机号登录',
          success: () => wx.navigateTo({ url: '/pages/login/index' })
        })
      } else {
        wx.showToast({ title: res.msg || '登录失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '登录失败，请检查网络', icon: 'none' })
    }
    this.setData({ wxLoading: false })
  },

  // 跳转手机号登录页
  onGoPhoneLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  onProfile() {
    wx.showToast({ title: '个人资料编辑中', icon: 'none' })
  },

  onSettings() {
    wx.showToast({ title: '设置功能开发中', icon: 'none' })
  },

  onRealName() {
    if (!this.data.isLoggedIn) { wx.navigateTo({ url: '/pages/login/index' }); return }
    wx.showToast({ title: '已实名认证', icon: 'success' })
  },

  onFavorites() {
    wx.navigateTo({ url: '/pages/favorites/index' })
  },

  onMyOrders() {
    if (!this.data.isLoggedIn) { wx.navigateTo({ url: '/pages/login/index' }); return }
    wx.navigateTo({ url: '/pages/my-orders/index' })
  },

  onAbout() {
    wx.showModal({
      title: '棉管家 v1.2.0',
      content: '专为新疆棉农打造的智能农业管理平台\n\n联系我们：support@cotton.app',
      showCancel: false,
      confirmText: '好的'
    })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#F5222D',
      success: res => {
        if (res.confirm) auth.logout()
      }
    })
  }
})
