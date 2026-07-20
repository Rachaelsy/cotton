// pages/login/index.js — 登录 / 注册页
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')

Page({
  data: {
    statusBarHeight: 20,
    copy: i18n.getPageCopy('login'),
    step: 'login',
    role: 'farmer',
    roleLabel: i18n.t('login', 'roleLabel'),
    wxLoading: false,

    // 登录表单
    loginPhone: '',
    loginPwd: '',
    loginPwdVisible: false,
    loginLoading: false,

    // 注册表单 - 公共字段
    regPhone: '',
    regPwd: '',
    regPwdConfirm: '',
    regPwdVisible: false,
    regRealName: '',
    regLoading: false,

    // 注册 - 农户专属
    regLocation: '',
    regLandSize: '',
    regCropType: '棉花',

  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.applyLanguage()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    // 预取 wx.login code，有效期 5 分钟
    wx.login({ success: r => { this._wxLoginCode = r.code }, fail: () => {} })
  },

  onShow() {
    this.applyLanguage()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.textCopy = i18n.getCopy('login', lang)
    this.setData({
      copy: i18n.getPageCopy('login', lang),
      roleLabel: this.textCopy.roleLabel
    })
  },

  // 返回上一步（login ↔ register 之间）
  goBack() {
    const { step } = this.data
    if (step === 'register') {
      this.setData({ step: 'login', regPhone: '', regPwd: '', regPwdConfirm: '', regRealName: '' })
    }
  },

  // 切换到注册/登录
  goRegister() { this.setData({ step: 'register' }) },
  goLogin()    { this.setData({ step: 'login' }) },

  // ── 通用表单输入 ──────────────────────────

  onInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({ [field]: e.detail.value })
  },

  toggleLoginPwd()  { this.setData({ loginPwdVisible: !this.data.loginPwdVisible }) },
  toggleRegPwd()    { this.setData({ regPwdVisible:   !this.data.regPwdVisible   }) },

  // ── 微信一键登录 ──────────────────────────

  async onWxPhoneLogin(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: this.textCopy.cancelLogin, icon: 'none' })
      return
    }
    const phoneCode = e.detail.code
    let loginCode = this._wxLoginCode
    if (!loginCode) {
      const r = await new Promise(resolve => wx.login({ success: resolve, fail: () => resolve({}) }))
      loginCode = r.code
    }
    if (!loginCode) {
      this._toast(this.textCopy.wxFail)
      return
    }
    this.setData({ wxLoading: true })
    try {
      const res = await auth.wxLogin(loginCode, phoneCode)
      if (res.code === 200) {
        if (!auth.isFarmerUser(res.data)) {
          this._showWebOnlyAccount()
          return
        }
        getApp().globalData.user = res.data
        wx.showToast({ title: this.textCopy.loginSuccess, icon: 'success', duration: 1000 })
        setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 1000)
      } else if (res.code === 503) {
        wx.showModal({
          title: i18n.getCopy('common').tip, content: this.textCopy.wxNeedConfig,
          showCancel: false, confirmText: this.textCopy.ok
        })
      } else {
        this._toast(res.msg || this.textCopy.loginFail)
      }
    } catch { this._toast(this.textCopy.loginNetworkFail) }
    this.setData({ wxLoading: false })
  },

  // ── 登录 ─────────────────────────────────

  async onLogin() {
    const { loginPhone, loginPwd } = this.data
    if (!/^1\d{10}$/.test(loginPhone)) return this._toast(this.textCopy.phoneInvalid)
    if (!loginPwd || loginPwd.length < 6)  return this._toast(this.textCopy.pwdInvalid)

    this.setData({ loginLoading: true })
    try {
      const res = await auth.login(loginPhone, loginPwd)
      if (res.code === 200) {
        if (!auth.isFarmerUser(res.data)) {
          this._showWebOnlyAccount()
          return
        }
        getApp().globalData.user = res.data
        wx.reLaunch({ url: '/pages/index/index' })
      } else {
        this._toast(res.msg || this.textCopy.loginFail)
      }
    } catch { /* 已在 auth.js 弹提示 */ }
    this.setData({ loginLoading: false })
  },

  // ── 注册 ─────────────────────────────────

  async onRegister() {
    const {
      regPhone, regPwd, regPwdConfirm, regRealName,
      regLocation, regLandSize, regCropType
    } = this.data

    if (!/^1\d{10}$/.test(regPhone))   return this._toast(this.textCopy.phoneInvalid)
    if (!regPwd || regPwd.length < 6)  return this._toast(this.textCopy.pwdInvalid)
    if (regPwd !== regPwdConfirm)      return this._toast(this.textCopy.pwdNotMatch)
    if (!regRealName.trim())           return this._toast(this.textCopy.nameRequired)
    if (!regLocation.trim())           return this._toast(this.textCopy.locationRequired)

    const form = {
      role: 'farmer',
      phone:     regPhone,
      password:  regPwd,
      real_name: regRealName.trim(),
      location:  regLocation.trim(),
      land_size: parseFloat(regLandSize) || 0,
    }

    this.setData({ regLoading: true })
    try {
      const res = await auth.register(form)
      if (res.code === 200) {
        getApp().globalData.user = res.data
        wx.showToast({ title: this.textCopy.registerSuccess, icon: 'success', duration: 1200 })
        setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 1200)
      } else {
        this._toast(res.msg || this.textCopy.registerFail)
      }
    } catch { /* 已在 auth.js 弹提示 */ }
    this.setData({ regLoading: false })
  },

  // ── 内部工具 ─────────────────────────────

  _toast(title) {
    wx.showToast({ title, icon: 'none', duration: 2000 })
  },

  _showWebOnlyAccount() {
    auth.clearToken()
    getApp().globalData.user = null
    wx.showModal({
      title: this.textCopy.webOnlyTitle || '请使用网页后台',
      content: this.textCopy.webOnlyContent || '商户、农机手和管理员账号请在网页端登录管理后台，小程序仅供农户使用。',
      showCancel: false,
      confirmText: this.textCopy.ok || '知道了'
    })
  }
})
