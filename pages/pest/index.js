const app = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    copy: i18n.getPageCopy('pest'),
    commonCountText: '',
    pests: i18n.getPageCopy('pest').pests,
    filter: i18n.getPageCopy('pest').filters[0],
    filters: i18n.getPageCopy('pest').filters,
    filteredPests: []
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.applyLanguage()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() });
    this._applyFilter(this.data.filters[0]);
  },

  onShow() {
    this.applyLanguage()
    this._applyFilter(this.data.filters[0])
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.textCopy = i18n.getCopy('pest', lang)
    this.setData({
      copy: i18n.getPageCopy('pest', lang),
      pests: this.textCopy.pests,
      filters: this.textCopy.filters,
      commonCountText: this.textCopy.commonCount(this.textCopy.pests.length)
    })
  },

  _applyFilter(filter) {
    const all = this.data.pests;
    const result = filter === this.data.filters[0] ? all : all.filter(p => p.type === filter);
    this.setData({ filteredPests: result, filter });
  },

  onFilterTap(e) {
    const val = e.currentTarget.dataset.val;
    this._applyFilter(val);
  },

  onTakePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath;
        this._doRecognize(filePath);
      },
      fail: () => {
        wx.showToast({ title: this.textCopy.photoCancel, icon: 'none' });
      }
    });
  },

  onChooseAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath;
        this._doRecognize(filePath);
      },
      fail: () => {
        wx.showToast({ title: this.textCopy.albumCancel, icon: 'none' });
      }
    });
  },

  _doRecognize(filePath) {
    wx.showLoading({ title: this.textCopy.recognizing, mask: true });
    wx.uploadFile({
      url: auth.BASE_URL + '/api/ai/photo',
      filePath,
      name: 'photo',
      header: { Authorization: auth.getToken() ? `Bearer ${auth.getToken()}` : '' },
      success: (res) => {
        wx.hideLoading()
        try {
          const data = JSON.parse(res.data || '{}')
          if (data.code !== 200 || !(data.data && data.data.reply)) {
            wx.showToast({ title: data.msg || this.textCopy.recognizeFail || '识别失败', icon: 'none' })
            return
          }
          app.globalData.pestRecognitionResult = {
            image: filePath,
            reply: data.data.reply,
            time: Date.now()
          }
          wx.navigateTo({ url: '/pages/pest/detail?id=ai&from=recognize' })
        } catch (error) {
          wx.showToast({ title: this.textCopy.parseFail || '识别结果解析失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: this.textCopy.uploadFail || '图片上传失败', icon: 'none' })
      }
    })
  },

  onHistory() {
    wx.showToast({ title: this.textCopy.noHistory, icon: 'none' });
  },

  onPestTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/pest/detail?id=${id}` });
  },

  onBack() {
    wx.navigateBack();
  }
});
