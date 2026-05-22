Page({
  data: {
    statusBarHeight: 20,
    loans: [
      {
        id: 1,
        name: '棉花种植贷',
        bank: '中国农业银行',
        rate: '3.85',
        maxAmount: '30万',
        maxMonths: '36',
        speed: '极速放款1小时',
        tags: ['秒审批', '棉花专用', '气球还', '政府贴息'],
        preAmount: '¥20万',
        highlight: true
      },
      {
        id: 2,
        name: '农资采购贷',
        bank: '中国邮政储蓄银行',
        rate: '4.35',
        maxAmount: '20万',
        maxMonths: '24',
        speed: '放款1天',
        tags: ['农资专用', '免抵押'],
        preAmount: '',
        highlight: false
      },
      {
        id: 3,
        name: '春耕助农贷',
        bank: '喀什农商行',
        rate: '3.65',
        maxAmount: '50万',
        maxMonths: '60',
        speed: '放款3天',
        tags: ['大额贷款', '政府贴息'],
        preAmount: '',
        highlight: false
      }
    ]
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onBack() {
    wx.navigateBack()
  },

  onApply(e) {
    wx.showModal({
      title: '贷款申请',
      content: '功能完善中，请咨询客服400-888-6666',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  onQuickAction(e) {
    const name = e.currentTarget.dataset.name
    wx.showToast({ title: `${name}功能开发中`, icon: 'none' })
  }
})
