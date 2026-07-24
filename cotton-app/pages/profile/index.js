// pages/profile/index.js — 个人资料编辑（含头像上传）
const app  = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')

Page({
  data: {
    statusBarHeight: 20,
    common: i18n.getPageCopy('common'),
    copy: i18n.getPageCopy('profile'),
    saving: false,
    uploading: false,
    avatarUrl: '',
    pendingAvatarPath: '',   // 本地临时路径（待保存）
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
    this.applyLanguage()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this._fillForm()
  },

  onShow() {
    this.applyLanguage()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.textCopy = i18n.getCopy('profile', lang)
    this.setData({
      common: i18n.getPageCopy('common', lang),
      copy: i18n.getPageCopy('profile', lang)
    })
  },

  _fillForm() {
    const user = auth.getUser() || app.globalData.user || {}
    const name = user.real_name || ''
    const avatarUrl = user.avatar_url
      ? (user.avatar_url.startsWith('http') ? user.avatar_url : auth.BASE_URL + user.avatar_url)
      : ''
    this.setData({
      avatarUrl,
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
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/my/index' })
  },

  // ── 头像选择 & 上传 ───────────────────────
  onChooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const path = res.tempFiles[0].tempFilePath
        this.setData({ avatarUrl: path, pendingAvatarPath: path })
      }
    })
  },

  // 上传头像到服务器，返回存储路径
  _uploadAvatar() {
    const path = this.data.pendingAvatarPath
    if (!path) return Promise.resolve(null)
    this.setData({ uploading: true })
    const done = (url) => { this.setData({ uploading: false }); return url }
    return new Promise((resolve) => {
      wx.uploadFile({
        url:      auth.BASE_URL + '/api/upload',
        filePath: path,
        name:     'image',
        header:   { Authorization: auth.getToken() ? `Bearer ${auth.getToken()}` : '' },
        success:  (res) => {
          try {
            const data = JSON.parse(res.data)
            resolve(done(data.code === 200 ? data.data.url : null))
          } catch { resolve(done(null)) }
        },
        fail: () => resolve(done(null))
      })
    })
  },

  // ── 表单输入 ──────────────────────────────
  onNameInput(e)     { this.setData({ 'form.real_name': e.detail.value }) },
  onLocationInput(e) { this.setData({ 'form.location':  e.detail.value }) },
  onLandSizeInput(e) { this.setData({ 'form.land_size': e.detail.value }) },

  // ── 保存 ─────────────────────────────────
  async onSave() {
    if (this.data.saving || this.data.uploading) return
    const { real_name, location, land_size } = this.data.form
    if (!real_name.trim()) {
      wx.showToast({ title: this.textCopy.nameRequired, icon: 'none' }); return
    }
    this.setData({ saving: true })
    try {
      // 先上传头像（如果有新选择的图片）
      const avatarPath = await this._uploadAvatar()

      const body = {
        real_name: real_name.trim(),
        location:  location.trim(),
        land_size: parseFloat(land_size) || 0
      }
      if (avatarPath) body.avatar_url = avatarPath

      const res = await auth.request('PUT', '/api/auth/profile', body)
      if (res.code === 200) {
        const user = auth.getUser() || {}
        const updated = {
          ...user,
          real_name:  real_name.trim(),
          location:   location.trim(),
          land_size:  parseFloat(land_size) || 0,
          avatar_url: avatarPath || user.avatar_url || null
        }
        app.globalData.user = updated
        auth.saveUser(updated)          // 必须用 auth.saveUser，key 是 'cotton_user'
        this.setData({ pendingAvatarPath: '' })
        wx.showToast({ title: this.textCopy.saveSuccess, icon: 'success' })
        setTimeout(() => {
          if (getCurrentPages().length > 1) wx.navigateBack()
          else wx.switchTab({ url: '/pages/my/index' })
        }, 1200)
      } else {
        wx.showToast({ title: res.msg || this.textCopy.saveFail, icon: 'none' })
      }
    } catch {
      wx.showToast({ title: this.textCopy.networkFail, icon: 'none' })
    }
    this.setData({ saving: false })
  }
})
