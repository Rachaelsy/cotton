const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')
const { getPestCopy } = require('../../utils/pest-copy')

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    copy: getPestCopy('detail', i18n.getLanguage()),
    severityTipText: '',
    pest: getPestCopy('detail', i18n.getLanguage()).pest,
    severityLevels: getPestCopy('detail', i18n.getLanguage()).severityLevels
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.applyLanguage()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight()
    })
  },

  onShow() {
    this.applyLanguage()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.textCopy = getPestCopy('detail', lang)
    const pest = this.textCopy.pest
    this.setData({
      copy: this.textCopy,
      pest,
      severityLevels: this.textCopy.severityLevels,
      severityTipText: this.textCopy.severityTip(pest.severity, pest.treatDays)
    })
  },

  onBuyProduct(e) {
    wx.showToast({ title: this.textCopy.addedCart(e.currentTarget.dataset.name), icon: 'success', duration: 2000 })
  },

  onShare() {
    wx.showToast({ title: this.textCopy.shareDeveloping, icon: 'none' })
  },

  onBack() {
    wx.navigateBack()
  },

  onShareAppMessage() {
    return {
      title: this.textCopy.shareTitle(this.data.pest.name),
      path: '/pages/pest/index'
    }
  }
})
