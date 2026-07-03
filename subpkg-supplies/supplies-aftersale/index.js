// pages/supplies-aftersale/index.js — 售后申请页
const app  = getApp()
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')

const TYPES   = ['退货退款', '仅退款', '换货']
const REASONS = [
  '不喜欢/不想要', '商品质量问题', '发错货/漏发',
  '规格/尺寸不符', '物流破损/压坏', '未收到货', '其他'
]

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    types:   TYPES,
    reasons: REASONS,
    orderId: null,

    aftersaleType: '',
    reason:        '',
    otherReason:   '',
    description:   '',
    images:        [],

    canSubmit:  false,
    submitting: false
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      orderId: options.order_id || null
    })
  },

  onSelectType(e) {
    this.setData({ aftersaleType: e.currentTarget.dataset.type })
    this._checkCanSubmit()
  },

  onSelectReason(e) {
    const reason = e.currentTarget.dataset.reason
    // 切换原因时清空"其他"输入
    this.setData({ reason, otherReason: '' })
    this._checkCanSubmit()
  },

  onOtherReasonInput(e) {
    this.setData({ otherReason: e.detail.value })
    this._checkCanSubmit()
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  _checkCanSubmit() {
    const { aftersaleType, reason, otherReason } = this.data
    const reasonOk = !!reason && (reason !== '其他' || otherReason.trim().length > 0)
    this.setData({ canSubmit: !!aftersaleType && reasonOk })
  },

  onChooseImage() {
    const { images } = this.data
    const remain = 6 - images.length
    if (remain <= 0) {
      wx.showToast({ title: '最多上传6张', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newPaths = res.tempFiles.map(f => f.tempFilePath)
        this.setData({ images: [...images, ...newPaths].slice(0, 6) })
      }
    })
  },

  onRemoveImage(e) {
    const idx = e.currentTarget.dataset.index
    const images = this.data.images.filter((_, i) => i !== idx)
    this.setData({ images })
  },

  async onSubmit() {
    const { canSubmit, submitting, orderId, aftersaleType, reason, otherReason, description, images } = this.data
    if (!canSubmit || submitting) return
    if (!orderId) { wx.showToast({ title: '订单信息缺失', icon: 'none' }); return }
    this.setData({ submitting: true })
    try {
      // 上传图片，收集服务器URL
      const imageUrls = []
      for (const filePath of images) {
        await new Promise(resolve => {
          wx.uploadFile({
            url: auth.BASE_URL + '/api/upload',
            filePath,
            name: 'file',
            header: { Authorization: auth.getToken() ? `Bearer ${auth.getToken()}` : '' },
            success(r) {
              try {
                const d = JSON.parse(r.data)
                if (d.code === 200) imageUrls.push(d.data.url)
              } catch {}
              resolve()
            },
            fail() { resolve() }
          })
        })
      }

      const res = await auth.request('POST', `/api/orders/${orderId}/aftersale`, {
        aftersale_type: aftersaleType,
        reason,
        other_reason:  otherReason,
        description,
        images: imageUrls
      })
      if (res.code === 200) {
        wx.showModal({
          title: '申请已提交',
          content: '售后申请已提交，商家将在48小时内处理，请耐心等待。',
          showCancel: false,
          confirmText: '知道了',
          success: () => wx.navigateBack()
        })
      } else {
        wx.showToast({ title: res.msg || '提交失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  onBack() {
    wx.navigateBack()
  }
})
