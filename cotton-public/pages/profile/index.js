const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    nickname: '',
    saving: false
  },

  async onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    const valid = auth.isLoggedIn() ? await auth.verify() : false
    if (!valid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => wx.redirectTo({ url: '/pages/login/index' }), 500)
      return
    }
    const user = auth.getUser() || {}
    this.setData({ nickname: user.nickname || '' })
  },

  back() { wx.navigateBack() },

  onNicknameInput(event) {
    this.setData({ nickname: event.detail.value })
  },

  async save() {
    const nickname = String(this.data.nickname || '').trim()
    if (!nickname) return wx.showToast({ title: '请填写昵称', icon: 'none' })
    if (Array.from(nickname).length > 24) return wx.showToast({ title: '昵称不能超过24个字符', icon: 'none' })

    this.setData({ saving: true })
    try {
      const result = await auth.request('PUT', '/api/auth/public-profile', { nickname })
      if (!result || result.code !== 200) throw new Error(result && result.msg || '保存失败')
      const user = { ...(auth.getUser() || {}), ...(result.data || {}) }
      auth.saveUser(user)
      getApp().globalData.user = user
      this.setData({ nickname: user.nickname || nickname })
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 700)
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
