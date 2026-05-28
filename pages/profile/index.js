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
      land_size: '',
      crop_type: ''
    },
    cropOptions: ['棉花', '小麦', '玉米', '水稻', '其他'],
    cropIndex: 0,
    initial: '?'
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this._fillForm()
  },

  _fillForm() {
    const user = auth.getUser() || app.globalData.user || {}
    const cropOptions = this.data.cropOptions
    const cropType = user.crop_type || '棉花'
    const cropIndex = cropOptions.indexOf(cropType) >= 0 ? cropOptions.indexOf(cropType) : 0
    const name = user.real_name || ''
    this.setData({
      form: {
        real_name: name,
        phone:     user.phone || '',
        location:  user.location || '',
        land_size: user.land_size != null ? String(user.land_size) : '',
        crop_type: cropOptions[cropIndex]
      },
      cropIndex,
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

  onCropChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({
      cropIndex: idx,
      'form.crop_type': this.data.cropOptions[idx]
    })
  },

  async onSave() {
    if (this.data.saving) return
    const { real_name, location, land_size, crop_type } = this.data.form
    if (!real_name.trim()) {
      wx.showToast({ title: '姓名不能为空', icon: 'none' }); return
    }
    this.setData({ saving: true })
    try {
      const res = await auth.request('PUT', '/api/auth/profile', {
        real_name: real_name.trim(),
        location: location.trim(),
        land_size: parseFloat(land_size) || 0,
        crop_type
      })
      if (res.code === 200) {
        // 更新本地缓存
        const user = auth.getUser() || {}
        const updated = { ...user, real_name: real_name.trim(), location: location.trim(), land_size: parseFloat(land_size) || 0, crop_type }
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
