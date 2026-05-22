Page({
  data: {
    statusBarHeight: 20,
    priceTab: 0, // 0=籽棉 1=皮棉
    tradeTab: 0, // 0=今日行情 1=地区报价 2=我的交易
    regions: [
      { rank:1, name:'喀什·疏附县', price:'6.85', change:'+0.05', up:true },
      { rank:2, name:'阿克苏·温宿县', price:'6.82', change:'+0.03', up:true },
      { rank:3, name:'巴州·尉犁县', price:'6.78', change:'0.00', up:false },
      { rank:4, name:'吐鲁番·高昌区', price:'6.75', change:'-0.02', up:false },
      { rank:5, name:'昌吉·玛纳斯县', price:'6.72', change:'+0.01', up:true }
    ],
    quickActions: [
      { icon:'📢', bg:'#FFF3E0', name:'发布交易' },
      { icon:'🏭', bg:'#E3F2FD', name:'轧花厂地图' },
      { icon:'📋', bg:'#EDE7F6', name:'我的订单' },
      { icon:'🔍', bg:'#E8F5E9', name:'溯源查询' }
    ]
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },
  onBack() { wx.navigateBack() },
  onPriceTab(e) { this.setData({ priceTab: e.currentTarget.dataset.i }) },
  onTradeTab(e) { this.setData({ tradeTab: e.currentTarget.dataset.i }) },
  onQuickAction(e) {
    const name = e.currentTarget.dataset.name
    if (name === '发布交易') {
      wx.showModal({
        title: '发布交易',
        content: '填写棉花信息\n品种：新陆早57号\n预计产量：约68吨\n等级：一级\n\n确认发布？',
        confirmText: '确认发布',
        success: (res) => {
          if (res.confirm) wx.showToast({ title: '发布成功，等待轧花厂响应', icon: 'success' })
        }
      })
    } else {
      wx.showToast({ title: `${name}功能开发中`, icon: 'none' })
    }
  }
})
