const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    user: null,
    applyment: {
      payment_enabled: false,
      sub_mchid: '',
      state_label: '未提交',
      message: ''
    },
    showPayModal: false,
    payForm: {
      sub_mchid: '',
      business_code: '',
      contact_name: '',
      contact_mobile: '',
      contact_email: '',
      service_phone: ''
    },
    paySubmitting: false,
    showPwdModal: false,
    pwdForm: { oldPwd: '', newPwd: '', confirmPwd: '' },
    pwdVisible: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    if (!auth.requireLogin()) return
    const user = auth.getUser() || getApp().globalData.user
    this.setData({ user })
    this.loadApplyment()
  },

  onEditStore() {
    wx.showToast({ title: '店铺信息编辑开发中', icon: 'none' })
  },

  async loadApplyment() {
    try {
      const res = await auth.request('GET', '/api/wechat-applyment/mine')
      if (res.code !== 200) return
      const d = res.data || {}
      const draft = d.draft || {}
      const contact = draft.contact || {}
      const business = draft.business || {}
      this.setData({
        applyment: d,
        payForm: {
          sub_mchid: d.sub_mchid || '',
          business_code: d.business_code || draft.business_code || '',
          contact_name: contact.name || contact.contact_name || '',
          contact_mobile: contact.mobile || contact.mobile_phone || '',
          contact_email: contact.email || contact.contact_email || '',
          service_phone: business.service_phone || contact.mobile || contact.mobile_phone || ''
        }
      })
    } catch (e) {}
  },

  openPayModal() {
    this.setData({ showPayModal: true })
  },

  closePayModal() {
    this.setData({ showPayModal: false })
  },

  onPayInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`payForm.${field}`]: e.detail.value })
  },

  async savePayDraft() {
    if (this.data.paySubmitting) return
    const form = this.data.payForm
    if (!form.contact_name.trim()) return wx.showToast({ title: '请填写联系人姓名', icon: 'none' })
    if (!/^1\d{10}$/.test(form.contact_mobile.trim())) return wx.showToast({ title: '请填写正确手机号', icon: 'none' })
    this.setData({ paySubmitting: true })
    try {
      const res = await auth.request('POST', '/api/wechat-applyment/draft', {
        business_code: form.business_code.trim(),
        contact: {
          name: form.contact_name.trim(),
          mobile: form.contact_mobile.trim(),
          email: form.contact_email.trim()
        },
        business: {
          service_phone: form.service_phone.trim() || form.contact_mobile.trim()
        }
      })
      if (res.code === 200) {
        wx.showToast({ title: '已保存', icon: 'success' })
        await this.loadApplyment()
      } else {
        wx.showToast({ title: res.msg || '保存失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ paySubmitting: false })
    }
  },

  async bindSubMchid() {
    if (this.data.paySubmitting) return
    const subMchid = this.data.payForm.sub_mchid.trim()
    if (!/^\d{8,32}$/.test(subMchid)) return wx.showToast({ title: '请输入正确子商户号', icon: 'none' })
    this.setData({ paySubmitting: true })
    try {
      const res = await auth.request('POST', '/api/wechat-applyment/sub-mchid', { sub_mchid: subMchid })
      if (res.code === 200) {
        wx.showToast({ title: '已绑定', icon: 'success' })
        await this.loadApplyment()
      } else {
        wx.showToast({ title: res.msg || '绑定失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '绑定失败', icon: 'none' })
    } finally {
      this.setData({ paySubmitting: false })
    }
  },

  async submitApplyment() {
    if (this.data.paySubmitting) return
    this.setData({ paySubmitting: true })
    try {
      const res = await auth.request('POST', '/api/wechat-applyment/submit')
      if (res.code === 200) {
        wx.showToast({ title: '已提交微信审核', icon: 'success' })
        await this.loadApplyment()
      } else {
        wx.showModal({
          title: '提交失败',
          content: res.msg || '微信支付入驻申请提交失败',
          showCancel: false
        })
      }
    } catch {
      wx.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      this.setData({ paySubmitting: false })
    }
  },

  async syncApplyment() {
    if (this.data.paySubmitting) return
    this.setData({ paySubmitting: true })
    try {
      const res = await auth.request('POST', '/api/wechat-applyment/sync')
      if (res.code === 200) {
        wx.showToast({ title: '已同步', icon: 'success' })
        await this.loadApplyment()
      } else {
        wx.showToast({ title: res.msg || '同步失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '同步失败', icon: 'none' })
    } finally {
      this.setData({ paySubmitting: false })
    }
  },

  onChangePwd() {
    this.setData({ showPwdModal: true, pwdForm: { oldPwd: '', newPwd: '', confirmPwd: '' } })
  },

  closePwdModal() { this.setData({ showPwdModal: false }) },

  onPwdInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`pwdForm.${field}`]: e.detail.value })
  },

  async onSubmitPwd() {
    const { oldPwd, newPwd, confirmPwd } = this.data.pwdForm
    if (!oldPwd) return wx.showToast({ title: '请输入原密码', icon: 'none' })
    if (newPwd.length < 6) return wx.showToast({ title: '新密码不能少于6位', icon: 'none' })
    if (newPwd !== confirmPwd) return wx.showToast({ title: '两次密码不一致', icon: 'none' })
    try {
      const res = await auth.request('POST', '/api/auth/change-password', { oldPassword: oldPwd, newPassword: newPwd })
      if (res.code === 200) {
        wx.showToast({ title: '密码修改成功', icon: 'success' })
        this.setData({ showPwdModal: false })
      } else {
        wx.showToast({ title: res.msg || '修改失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '修改失败，请稍后重试', icon: 'none' })
    }
  },

  onAbout() {
    wx.showModal({
      title: '棉花智能体商户版 v1.0.0',
      content: '专为新疆农资商户打造的智能经营管理平台\n\n联系我们：support@cotton.app',
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
      success: (res) => {
        if (res.confirm) {
          getApp().globalData.user = null
          auth.logout()
        }
      }
    })
  }
})
