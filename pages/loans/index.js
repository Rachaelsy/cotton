const i18n = require('../../utils/i18n')

function copyFor(lang = i18n.getLanguage()) {
  if (lang === 'ug') {
    return {
      title: 'دېھقانچىلىق قەرزى',
      subtitle: 'AGRICULTURAL LOANS',
      creditLabel: 'بېرىلگەن ئىناۋەت سوممىسى',
      creditTip: 'ئىشلەتكىلى بولىدىغان سومما، ئېلىپ قايتۇرۇشقا بولىدۇ',
      scoreLabel: 'ئىناۋەت نومۇرى',
      scoreRank: 'ياخشى',
      sectionTitle: 'تەۋسىيە قەرز مەھسۇلاتلىرى',
      more: 'تېخىمۇ كۆپ ›',
      preCredit: 'ئالدىن ئىناۋەت ',
      annualRate: 'يىللىق ئۆسۈم',
      maxAmount: 'ئەڭ يۇقىرى سومما',
      monthUnit: 'ئاي',
      maxTerm: 'ئەڭ ئۇزۇن مۇددەت',
      guarantee: 'كاپالەت: ئىناۋەت / رەنىلىك',
      apply: 'ئىلتىماس',
      footerTip: 'قەرزنىڭ خەۋپى بار، ئېلىشتا ئېھتىيات قىلىڭ',
      applyTitle: 'قەرز ئىلتىماسى',
      applyContent: 'ئىقتىدار تاماملىنىۋاتىدۇ، خېرىدار مۇلازىمىتى 400-888-6666 بىلەن ئالاقىلىشىڭ',
      ok: 'بىلدىم',
      developing: name => `${name} ئىقتىدارى تەرەققىياتتا`
    }
  }
  return {
    title: '农业贷款',
    subtitle: 'AGRICULTURAL LOANS',
    creditLabel: '已有授信额度',
    creditTip: '可用额度，随借随还',
    scoreLabel: '信用分',
    scoreRank: '优质',
    sectionTitle: '推荐贷款产品',
    more: '更多 ›',
    preCredit: '预授信',
    annualRate: '年化利率',
    maxAmount: '最高额度',
    monthUnit: '月',
    maxTerm: '最长期限',
    guarantee: '担保方式：信用/抵押',
    apply: '申请',
    footerTip: '贷款有风险，借款需谨慎',
    applyTitle: '贷款申请',
    applyContent: '功能完善中，请咨询客服400-888-6666',
    ok: '知道了',
    developing: name => `${name}功能开发中`
  }
}

function dataFor(lang = i18n.getLanguage()) {
  if (lang === 'ug') {
    return {
      quickActions: [
        { icon: '📋', bg: '#E0F7FA', name: 'قەرزلىرىم' },
        { icon: '📅', bg: '#E8F5E9', name: 'قايتۇرۇش پىلانى' },
        { icon: '🧾', bg: '#FFF8E1', name: 'ھېسابات تارىخى' },
        { icon: '💬', bg: '#FCE4EC', name: 'ياردەم مەركىزى' }
      ],
      loans: [
        { id: 1, name: 'پاختا تېرىش قەرزى', bank: 'جۇڭگو دېھقانچىلىق بانكىسى', rate: '3.85', maxAmount: '300 مىڭ', maxMonths: '36', speed: '1 سائەتتە تېز پۇل چۈشۈش', tags: ['تېز تەستىق', 'پاختا مەخسۇس', 'ھۆكۈمەت ئۆسۈم ياردىمى'], preAmount: '¥200 مىڭ', highlight: true },
        { id: 2, name: 'دېھقانچىلىق ماتېرىيال قەرزى', bank: 'جۇڭگو پوچتا ئامانەت بانكىسى', rate: '4.35', maxAmount: '200 مىڭ', maxMonths: '24', speed: '1 كۈندە پۇل چۈشۈش', tags: ['ماتېرىيال مەخسۇس', 'رەنە يوق'], preAmount: '', highlight: false },
        { id: 3, name: 'باھار تېرىقچىلىق ياردەم قەرزى', bank: 'قەشقەر يېزا سودا بانكىسى', rate: '3.65', maxAmount: '500 مىڭ', maxMonths: '60', speed: '3 كۈندە پۇل چۈشۈش', tags: ['چوڭ سومما', 'ھۆكۈمەت ئۆسۈم ياردىمى'], preAmount: '', highlight: false }
      ]
    }
  }
  return {
    quickActions: [
      { icon: '📋', bg: '#E0F7FA', name: '我的贷款' },
      { icon: '📅', bg: '#E8F5E9', name: '还款计划' },
      { icon: '🧾', bg: '#FFF8E1', name: '账单历史' },
      { icon: '💬', bg: '#FCE4EC', name: '帮助中心' }
    ],
    loans: [
      { id: 1, name: '棉花种植贷', bank: '中国农业银行', rate: '3.85', maxAmount: '30万', maxMonths: '36', speed: '极速放款1小时', tags: ['秒审批', '棉花专用', '政府贴息'], preAmount: '¥20万', highlight: true },
      { id: 2, name: '农资采购贷', bank: '中国邮政储蓄银行', rate: '4.35', maxAmount: '20万', maxMonths: '24', speed: '放款1天', tags: ['农资专用', '免抵押'], preAmount: '', highlight: false },
      { id: 3, name: '春耕助农贷', bank: '喀什农商行', rate: '3.65', maxAmount: '50万', maxMonths: '60', speed: '放款3天', tags: ['大额贷款', '政府贴息'], preAmount: '', highlight: false }
    ]
  }
}

Page({
  data: {
    statusBarHeight: 20,
    lang: 'zh',
    copy: copyFor('zh'),
    ...dataFor('zh')
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.applyLanguage()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    this.applyLanguage()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.setData({ lang, copy: copyFor(lang), ...dataFor(lang) })
  },

  onBack() {
    wx.navigateBack()
  },

  onApply() {
    wx.showModal({
      title: this.data.copy.applyTitle,
      content: this.data.copy.applyContent,
      showCancel: false,
      confirmText: this.data.copy.ok
    })
  },

  onQuickAction(e) {
    const name = e.currentTarget.dataset.name
    wx.showToast({ title: this.data.copy.developing(name), icon: 'none' })
  }
})
