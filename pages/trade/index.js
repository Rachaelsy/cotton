const i18n = require('../../utils/i18n')

function tradeCopy(lang = i18n.getLanguage()) {
  if (lang === 'ug') {
    return {
      title: 'پاختا سودىسى',
      seedCotton: 'چىگىتلىك پاختا',
      lintCotton: 'تالا پاختا',
      priceUnit: 'يۈەن/كىلوگىرام',
      vsYesterday: 'تۈنۈگۈنگە قارىغاندا',
      tabs: ['بۈگۈنكى بازار', 'رايون باھاسى', 'سودىلىرىم'],
      yuan: 'يۈەن',
      chart: '📊 باھا يۈزلىنىشى (7 كۈن)',
      today: 'بۈگۈن',
      done: 'تاماملاندى',
      progress: 'داۋاملىشىۋاتىدۇ',
      pending: 'ھېسابات كۈتۈۋاتىدۇ',
      publishTitle: 'سودا ئېلان قىلىش',
      publishContent: 'پاختا ئۇچۇرىنى تولدۇرۇڭ\nسورت: شىنلۇزاۋ 57\nمۆلچەر مەھسۇلات: تەخمىنەن 68 توننا\nدەرىجە: 1-دەرىجە\n\nئېلان قىلامسىز؟',
      publishConfirm: 'ئېلان قىلىش',
      publishSuccess: 'ئېلان قىلىندى، پاختا زاۋۇتىنىڭ جاۋابىنى كۈتۈڭ',
      developing: name => `${name} ئىقتىدارى تەرەققىياتتا`
    }
  }
  return {
    title: '棉花交易',
    seedCotton: '籽棉',
    lintCotton: '皮棉',
    priceUnit: '元/公斤',
    vsYesterday: '较昨日',
    tabs: ['今日行情', '地区报价', '我的交易'],
    yuan: '元',
    chart: '📊 价格走势图（7日）',
    today: '今日',
    done: '已完成',
    progress: '进行中',
    pending: '待结算',
    publishTitle: '发布交易',
    publishContent: '填写棉花信息\n品种：新陆早57号\n预计产量：约68吨\n等级：一级\n\n确认发布？',
    publishConfirm: '确认发布',
    publishSuccess: '发布成功，等待轧花厂响应',
    developing: name => `${name}功能开发中`
  }
}

function tradeData(lang = i18n.getLanguage()) {
  if (lang === 'ug') {
    return {
      regions: [
        { rank:1, name:'قەشقەر · كونا شەھەر', price:'6.85', change:'+0.05', up:true },
        { rank:2, name:'ئاقسۇ · ئونسۇ', price:'6.82', change:'+0.03', up:true },
        { rank:3, name:'بايىنغولىن · لوپنۇر', price:'6.78', change:'0.00', up:false },
        { rank:4, name:'تۇرپان · ئىدىقۇت', price:'6.75', change:'-0.02', up:false },
        { rank:5, name:'سانجى · ماناس', price:'6.72', change:'+0.01', up:true }
      ],
      quickActions: [
        { key:'publish', icon:'📢', bg:'#FFF3E0', name:'سودا ئېلان قىلىش' },
        { key:'factory', icon:'🏭', bg:'#E3F2FD', name:'پاختا زاۋۇتى خەرىتىسى' },
        { key:'orders', icon:'📋', bg:'#EDE7F6', name:'زاكازلىرىم' },
        { key:'trace', icon:'🔍', bg:'#E8F5E9', name:'مەنبە سۈرۈشتۈرۈش' }
      ],
      myTrades: [
        { statusClass: 'done', statusText: 'تاماملاندى', name: '5-يەر · چىگىتلىك پاختا سېتىش', meta: 'كونا شەھەر پاختىچىلار ھەمكارلىق كوپىراتىپى · 68 توننا · 1-دەرىجە', price: '¥23,800' },
        { statusClass: 'prog', statusText: 'داۋاملىشىۋاتىدۇ', name: '3-يەر · چىگىتلىك پاختا سېتىش', meta: 'كونا شەھەر 2-پاختا زاۋۇتى · مۆلچەر 120 توننا', price: 'ھېسابات كۈتۈۋاتىدۇ' }
      ]
    }
  }
  return {
    regions: [
      { rank:1, name:'喀什·疏附县', price:'6.85', change:'+0.05', up:true },
      { rank:2, name:'阿克苏·温宿县', price:'6.82', change:'+0.03', up:true },
      { rank:3, name:'巴州·尉犁县', price:'6.78', change:'0.00', up:false },
      { rank:4, name:'吐鲁番·高昌区', price:'6.75', change:'-0.02', up:false },
      { rank:5, name:'昌吉·玛纳斯县', price:'6.72', change:'+0.01', up:true }
    ],
      quickActions: [
        { key:'publish', icon:'📢', bg:'#FFF3E0', name:'发布交易' },
        { key:'factory', icon:'🏭', bg:'#E3F2FD', name:'轧花厂地图' },
        { key:'orders', icon:'📋', bg:'#EDE7F6', name:'我的订单' },
        { key:'trace', icon:'🔍', bg:'#E8F5E9', name:'溯源查询' }
      ],
      myTrades: [
        { statusClass: 'done', statusText: '已完成', name: '5号地·籽棉销售', meta: '疏附县棉农合作社 · 68吨 · 一级', price: '¥23,800' },
        { statusClass: 'prog', statusText: '进行中', name: '3号地·籽棉销售', meta: '疏附县第二轧花厂 · 预计120吨', price: '待结算' }
      ]
    }
  }

Page({
  data: {
    statusBarHeight: 20,
    lang: 'zh',
    copy: tradeCopy('zh'),
    priceTab: 0, // 0=籽棉 1=皮棉
    tradeTab: 0, // 0=今日行情 1=地区报价 2=我的交易
    ...tradeData('zh')
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.applyLanguage()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },
  onShow() { this.applyLanguage() },
  applyLanguage() {
    const lang = i18n.getLanguage()
    this.setData({ lang, copy: tradeCopy(lang), ...tradeData(lang) })
  },
  onBack() { wx.navigateBack() },
  onPriceTab(e) { this.setData({ priceTab: e.currentTarget.dataset.i }) },
  onTradeTab(e) { this.setData({ tradeTab: e.currentTarget.dataset.i }) },
  onQuickAction(e) {
    const { key, name } = e.currentTarget.dataset
    if (key === 'publish') {
      wx.showModal({
        title: this.data.copy.publishTitle,
        content: this.data.copy.publishContent,
        confirmText: this.data.copy.publishConfirm,
        success: (res) => {
          if (res.confirm) wx.showToast({ title: this.data.copy.publishSuccess, icon: 'success' })
        }
      })
    } else {
      wx.showToast({ title: this.data.copy.developing(name), icon: 'none' })
    }
  }
})
