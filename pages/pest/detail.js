const app = getApp()
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    copy: i18n.getPageCopy('pestDetail'),
    severityTipText: '',
    fromRecognize: false,
    recognition: null,
    pest: i18n.getPageCopy('pestDetail').pest,
    severityLevels: i18n.getPageCopy('pestDetail').severityLevels
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync();
    this.applyLanguage()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() });

    const fromRecognize = options.from === 'recognize';
    const recognition = fromRecognize ? (app.globalData.pestRecognitionResult || null) : null
    this.setData({ fromRecognize, recognition });

    // 实际项目中根据 options.id 从后端或本地数据库查询详情
    // 当前使用静态数据演示
    const id = options.id;
    console.log('pest detail id:', id);
    if (fromRecognize && recognition) {
      this.setData({
        pest: {
          ...this.data.pest,
          icon: '🤖',
          name: this.textCopy.aiResultTitle || 'AI result',
          type: this.textCopy.aiResultType || 'AI diagnosis',
          desc: recognition.reply
        }
      })
    }
  },

  onShow() {
    this.applyLanguage()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.textCopy = i18n.getCopy('pestDetail', lang)
    const pest = this.textCopy.pest
    this.setData({
      copy: i18n.getPageCopy('pestDetail', lang),
      pest,
      severityLevels: this.textCopy.severityLevels,
      severityTipText: this.textCopy.severityTip(pest.severity, pest.treatDays)
    })
  },

  onBuyProduct(e) {
    const name = e.currentTarget.dataset.name;
    wx.showToast({ title: this.textCopy.addedCart(name), icon: 'success', duration: 2000 });
  },

  onShare() {
    wx.showToast({ title: this.textCopy.shareDeveloping, icon: 'none' });
  },

  onBack() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    return {
      title: this.textCopy.shareTitle(this.data.pest.name),
      path: `/pages/pest/detail?id=1`
    };
  }
});
