Page({
  data: {
    statusBarHeight: 20,
    pests: [
      { id: 1, n: '棉蚜',   icon: '🐛', bg: 'c2', type: '虫害', hot: true  },
      { id: 2, n: '棉铃虫', icon: '🦋', bg: 'c3', type: '虫害', hot: false },
      { id: 3, n: '红蜘蛛', icon: '🕷', bg: 'c1', type: '虫害', hot: false },
      { id: 4, n: '枯萎病', icon: '🍂', bg: 'c4', type: '病害', hot: true  },
      { id: 5, n: '黄萎病', icon: '🌿', bg: 'c5', type: '病害', hot: false },
      { id: 6, n: '蕾铃脱落', icon: '🌸', bg: 'c6', type: '生理性', hot: false },
      { id: 7, n: '缺素症', icon: '🔬', bg: 'c2', type: '生理性', hot: false },
      { id: 8, n: '日灼病', icon: '☀️', bg: 'c3', type: '病害', hot: false }
    ],
    filter: '全部',
    filters: ['全部', '虫害', '病害', '生理性'],
    filteredPests: []
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight || 20 });
    this._applyFilter('全部');
  },

  _applyFilter(filter) {
    const all = this.data.pests;
    const result = filter === '全部' ? all : all.filter(p => p.type === filter);
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
        wx.showToast({ title: '拍照取消', icon: 'none' });
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
        wx.showToast({ title: '选择取消', icon: 'none' });
      }
    });
  },

  _doRecognize(filePath) {
    wx.showLoading({ title: 'AI 识别中…', mask: true });
    // 模拟识别延迟，实际应调用后端接口
    setTimeout(() => {
      wx.hideLoading();
      wx.navigateTo({ url: '/pages/pest/detail?id=1&from=recognize' });
    }, 1500);
  },

  onHistory() {
    wx.showToast({ title: '暂无历史记录', icon: 'none' });
  },

  onPestTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/pest/detail?id=${id}` });
  },

  onBack() {
    wx.navigateBack();
  }
});
