const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    user: null,
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
  },

  onEditStore() {
    wx.showToast({ title: '店铺信息编辑开发中', icon: 'none' })
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
