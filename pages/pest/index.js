const i18n = require('../../utils/i18n')

Page({
  data: {
    statusBarHeight: 20,
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
    this.setData({ statusBarHeight: sysInfo.statusBarHeight || 20 });
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
    // 模拟识别延迟，实际应调用后端接口
    setTimeout(() => {
      wx.hideLoading();
      wx.navigateTo({ url: '/pages/pest/detail?id=1&from=recognize' });
    }, 1500);
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
