// pages/profile/index.js — 个人资料编辑
const app  = getApp()
const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    saving: false,
    form: {
      real_name: '',
      phone: '',
      location: '',
      land_size: ''
    },
    initial: '?'
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this._fillForm()
  },

  _fillForm() {
    const user = auth.getUser() || app.globalData.user || {}
    const name = user.real_name || ''
    this.setData({
      form: {
        real_name: name,
        phone:     user.phone || '',
        location:  user.location || '',
        land_size: user.land_size != null ? String(user.land_size) : ''
      },
      initial: name.charAt(0) || '?'
    })
  },

  onBack() {
    wx.navigateBack()
  },

  onNameInput(e) {
    this.setData({ 'form.real_name': e.detail.value })
  },

  onLocationInput(e) {
    this.setData({ 'form.location': e.detail.value })
  },

  onLandSizeInput(e) {
    this.setData({ 'form.land_size': e.detail.value })
  },

  async onSave() {
    if (this.data.saving) return
    const { real_name, location, land_size } = this.data.form
    if (!real_name.trim()) {
      wx.showToast({ title: '姓名不能为空', icon: 'none' }); return
    }
    this.setData({ saving: true })
    try {
      const res = await auth.request('PUT', '/api/auth/profile', {
        real_name: real_name.trim(),
        location:  location.trim(),
        land_size: parseFloat(land_size) || 0
      })
      if (res.code === 200) {
        const user = auth.getUser() || {}
        const updated = { ...user, real_name: real_name.trim(), location: location.trim(), land_size: parseFloat(land_size) || 0 }
        app.globalData.user = updated
        try { wx.setStorageSync('user', updated) } catch {}
        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1200)
      } else {
        wx.showToast({ title: res.msg || '保存失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
    }
    this.setData({ saving: false })
  }
})
