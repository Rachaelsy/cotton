// pages/login/index.js — 登录 / 注册页
const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    step: 'login',
    role: 'farmer',
    roleLabel: '🌾 农户',
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
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    // 预取 wx.login code，有效期 5 分钟
    wx.login({ success: r => { this._wxLoginCode = r.code }, fail: () => {} })
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
      wx.showToast({ title: '已取消登录', icon: 'none' })
      return
    }
    const phoneCode = e.detail.code
    let loginCode = this._wxLoginCode
    if (!loginCode) {
      const r = await new Promise(resolve => wx.login({ success: resolve, fail: () => resolve({}) }))
      loginCode = r.code
    }
    if (!loginCode) {
      this._toast('微信登录失败，请重试')
      return
    }
    this.setData({ wxLoading: true })
    try {
      const res = await auth.wxLogin(loginCode, phoneCode)
      if (res.code === 200) {
        getApp().globalData.user = res.data
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 })
        setTimeout(() => wx.navigateBack(), 1000)
      } else if (res.code === 503) {
        wx.showModal({
          title: '提示', content: '微信登录功能需配置 AppID，请使用手机号登录',
          showCancel: false, confirmText: '好的'
        })
      } else {
        this._toast(res.msg || '登录失败')
      }
    } catch { this._toast('登录失败，请检查网络') }
    this.setData({ wxLoading: false })
  },

  // ── 登录 ─────────────────────────────────

  async onLogin() {
    const { loginPhone, loginPwd } = this.data
    if (!/^1\d{10}$/.test(loginPhone)) return this._toast('请输入正确的手机号')
    if (!loginPwd || loginPwd.length < 6)  return this._toast('密码不能少于6位')

    this.setData({ loginLoading: true })
    try {
      const res = await auth.login(loginPhone, loginPwd)
      if (res.code === 200) {
        getApp().globalData.user = res.data
        const target = res.data.role === 'merchant' ? '/pages/merchant/index' : '/pages/index/index'
        wx.reLaunch({ url: target })
      } else {
        this._toast(res.msg || '登录失败')
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

    if (!/^1\d{10}$/.test(regPhone))   return this._toast('请输入正确的手机号')
    if (!regPwd || regPwd.length < 6)  return this._toast('密码不能少于6位')
    if (regPwd !== regPwdConfirm)      return this._toast('两次密码输入不一致')
    if (!regRealName.trim())           return this._toast('请填写姓名')
    if (!regLocation.trim())           return this._toast('请填写所在地区')

    const form = {
      role: 'farmer',
      phone:     regPhone,
      password:  regPwd,
      real_name: regRealName.trim(),
      location:  regLocation.trim(),
      land_size: parseFloat(regLandSize) || 0,
      crop_type: regCropType || '棉花'
    }

    this.setData({ regLoading: true })
    try {
      const res = await auth.register(form)
      if (res.code === 200) {
        getApp().globalData.user = res.data
        wx.showToast({ title: '注册成功', icon: 'success', duration: 1200 })
        setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 1200)
      } else {
        this._toast(res.msg || '注册失败')
      }
    } catch { /* 已在 auth.js 弹提示 */ }
    this.setData({ regLoading: false })
  },

  // ── 内部工具 ─────────────────────────────

  _toast(title) {
    wx.showToast({ title, icon: 'none', duration: 2000 })
  }
})
