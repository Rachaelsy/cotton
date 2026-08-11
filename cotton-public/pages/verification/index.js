const auth = require('../../utils/auth')

Page({
  data: { statusBarHeight: 20, status: 'loading', reason: '', realName: '', idNumber: '', frontPath: '', backPath: '', frontToken: '', backToken: '', consent: false, submitting: false },
  onLoad() { const info = wx.getSystemInfoSync(); this.setData({ statusBarHeight: info.statusBarHeight || 20 }) },
  onShow() { if (!auth.isLoggedIn()) return wx.redirectTo({ url: '/pages/login/index' }); this.loadStatus() },
  async loadStatus() {
    try { const res = await auth.request('GET', '/api/verification'); if (res.code !== 200) throw new Error(res.msg); const data = res.data || {}; this.setData({ status: data.status || 'not_submitted', reason: data.reject_reason || '', realName: data.real_name || this.data.realName }) }
    catch (error) { this.setData({ status: 'not_submitted' }); wx.showToast({ title: error.message || '认证状态加载失败', icon: 'none' }) }
  },
  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  onConsent(e) { this.setData({ consent: (e.detail.value || []).includes('agree') }) },
  chooseImage(e) { const side = e.currentTarget.dataset.side; wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: result => this.uploadImage(side, result.tempFiles[0].tempFilePath) }) },
  async uploadImage(side, filePath) {
    wx.showLoading({ title: '上传中' })
    try { const res = await auth.uploadFile('/api/verification/upload', filePath, 'image'); if (res.code !== 200) throw new Error(res.msg); this.setData({ [`${side}Path`]: filePath, [`${side}Token`]: res.data.fileToken }) }
    catch (error) { wx.showToast({ title: error.message || '证件图片上传失败', icon: 'none' }) }
    finally { wx.hideLoading() }
  },
  async submit() {
    const name = this.data.realName.trim(); const id = this.data.idNumber.trim().toUpperCase()
    if (name.length < 2) return wx.showToast({ title: '请填写真实姓名', icon: 'none' })
    if (!/^\d{17}[\dX]$/.test(id)) return wx.showToast({ title: '请填写有效的18位身份证号', icon: 'none' })
    if (!this.data.frontToken || !this.data.backToken) return wx.showToast({ title: '请上传身份证正反面照片', icon: 'none' })
    if (!this.data.consent) return wx.showToast({ title: '请先阅读并同意认证说明', icon: 'none' })
    this.setData({ submitting: true })
    try { const res = await auth.request('POST', '/api/verification', { realName: name, idNumber: id, frontToken: this.data.frontToken, backToken: this.data.backToken }); if (res.code !== 200) throw new Error(res.msg); this.setData({ status: 'pending', idNumber: '' }); wx.showToast({ title: '已提交审核', icon: 'success' }) }
    catch (error) { wx.showToast({ title: error.message || '提交失败', icon: 'none' }) }
    finally { this.setData({ submitting: false }) }
  },
  retry() { this.setData({ status: 'not_submitted', frontPath: '', backPath: '', frontToken: '', backToken: '', consent: false }) },
  back() { if (getCurrentPages().length > 1) wx.navigateBack(); else wx.switchTab({ url: '/pages/my/index' }) }
})
