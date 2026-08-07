const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')

const COPY = {
  zh: { title:'水管理',selectPlot:'选择地块',moisture:'土壤含水率',lastWater:'距上次灌水',soilState:'墒情状态',loading:'加载中…',advice:'灌水建议',analysis:'分析 · 当前地块',currentMoisture:'当前含水率',target:'目标范围',rain3:'近3日降水',index:'墒情指数',dry:'干旱 0%',fit:'适宜 55~70%',wet:'饱和 100%',record:'记录灌水',reminder:'设置提醒',plan:'灌水计划',history:'近7天用水记录',tips:'棉花滴灌要点',tip1:'苗期少灌，蕾期控水',tip1d:'苗期保持土壤相对含水量60%，蕾期适当控水促根系下扎。',tip2:'花铃期重灌，保障产量',tip2d:'花铃期需水量最大，每次灌水50~60方/亩，间隔7~10天。',tip3:'打顶后控水，促早熟',tip3d:'打顶后15天逐步停水，有助棉铃集中成熟。',noPlot:'暂无地块',unnamed:'未命名地块',mu:'亩',loadFail:'加载失败',reminderOn:'灌水提醒已开启' },
  ug: { title:'سۇ باشقۇرۇش',selectPlot:'يەر تاللاڭ',moisture:'تۇپراق نەملىكى',lastWater:'ئالدىنقى سۇغىرىش',soilState:'نەملىك ھالىتى',loading:'يۈكلىنىۋاتىدۇ…',advice:'سۇغىرىش تەۋسىيەسى',analysis:'تەھلىل · ھازىرقى يەر',currentMoisture:'ھازىرقى نەملىك',target:'نىشان دائىرىسى',rain3:'3 كۈنلۈك يامغۇر',index:'نەملىك كۆرسەتكۈچى',dry:'قۇرغاق 0%',fit:'مۇۋاپىق 55~70%',wet:'تويۇنغان 100%',record:'سۇغىرىشنى خاتىرىلەش',reminder:'ئەسكەرتىش',plan:'سۇغىرىش پىلانى',history:'7 كۈنلۈك سۇ خاتىرىسى',tips:'پاختا تامچە سۇغىرىش نۇقتىلىرى',tip1:'مايسا مەزگىلى ئاز، غۇنچە مەزگىلى كونترول',tip1d:'مايسا مەزگىلى تۇپراق نەملىكىنى 60% ئەتراپىدا ساقلاپ، غۇنچە مەزگىلى يىلتىزنى چوڭقۇرلاشتۇرۇش ئۈچۈن سۇنى كونترول قىلىڭ.',tip2:'گۈل-كۆسەك مەزگىلى يېتەرلىك سۇغىرىش',tip2d:'بۇ مەزگىلدە سۇ ئېھتىياجى ئەڭ يۇقىرى؛ ھەر قېتىم مو بېشىغا 50~60 كۇب مېتىر، 7~10 كۈن ئارىلىق.',tip3:'ئۇچىنى ئۈزگەندىن كېيىن سۇنى كونترول قىلىش',tip3d:'ئۇچىنى ئۈزگەندىن 15 كۈن كېيىن سۇنى تەدرىجىي توختىتىپ، كۆسەكنىڭ پىشىشىنى تېزلىتىڭ.',noPlot:'يەر يوق',unnamed:'نامسىز يەر',mu:'مو',loadFail:'يۈكلەش مەغلۇپ',reminderOn:'سۇغىرىش ئەسكەرتىشى ئېچىلدى' }
}
const T = (lang, zh, ug) => lang === 'ug' ? ug : zh

function formatMu(value) {
  const number = Number(value || 0)
  return number.toFixed(number >= 100 || number % 1 === 0 ? 0 : 1)
}

function buildModel(plot, lang = i18n.getLanguage()) {
  const area = Number(plot && plot.area || 0)
  const score = Number(plot && plot.health_score || 86)
  const moisture = Math.max(28, Math.min(76, Math.round(score * 0.58 - (plot && plot.status === 'attention' ? 12 : 0))))
  const dry = moisture < 50
  const waterPerMu = dry ? 40 : 30
  const total = Math.round(area * waterPerMu)
  return {
    moisture,
    days: dry ? 3 : 1,
    state: dry ? T(lang,'偏干','قۇرغاقراق') : T(lang,'适宜','مۇۋاپىق'),
    stateClass: dry ? 'warn' : 'ok',
    waterPerMu,
    total,
    advice: lang === 'ug'
      ? `${plot.name || 'ھازىرقى يەر'} تۇپراق نەملىكى ${moisture}%. ${dry ? 'پاختا غۇنچە مەزگىلىنىڭ مۇۋاپىق دائىرىسىدىن تۆۋەن' : 'ھازىرقى ئۆسۈش مەزگىلىگە مۇۋاپىق'}. ${dry ? 'بۈگۈن 14:00~18:00 ئارىلىقىدا تامچە سۇغىرىڭ' : 'ھازىرقى سۇغىرىش رېتىمىنى ساقلاڭ'}؛ مو بېشىغا ${waterPerMu} كۇب مېتىر، جەمئىي تەخمىنەن ${total || '--'} كۇب مېتىر. سۇغارغاندىن كېيىن ئېرىقنى تەكشۈرۈڭ.`
      : `${plot.name || '当前地块'}当前土壤含水率 ${moisture}%，${dry ? '低于棉花蕾期适宜范围（55~70%）' : '处于棉花当前生育期适宜范围'}。建议${dry ? '今日下午14:00~18:00进行滴灌' : '保持当前灌溉节奏'}，每亩灌水量 ${waterPerMu} 方，总用水量约 ${total || '--'} 方。灌后检查排水沟，避免局部积水。`,
    plans: [
      { icon: '💧', name: dry ? T(lang,'蕾期补水','غۇنچە مەزگىلى سۇ تولۇقلاش') : T(lang,'常规滴灌','ئادەتتىكى تامچە سۇغىرىش'), meta: `${plot.name || T(lang,'当前地块','ھازىرقى يەر')} · ${dry ? '14:00~18:00' : T(lang,'3天后','3 كۈندىن كېيىن')}`, status: dry ? T(lang,'建议今日执行','بۈگۈن ئىجرا قىلىڭ') : T(lang,'已计划','پىلانلاندى'), cls: dry ? 'warn' : 'plan', value: `${waterPerMu}${T(lang,'方/亩','كۇب مېتىر/مو')}`, sub: `${T(lang,'共','جەمئىي ')}${total || '--'}` },
      { icon: '💧', name: T(lang,'花铃期灌水','گۈل-كۆسەك مەزگىلى سۇغىرىش'), meta: `${plot.name || T(lang,'当前地块','ھازىرقى يەر')} · 7/10`, status: T(lang,'已计划','پىلانلاندى'), cls: 'plan', value: `50${T(lang,'方/亩','كۇب مېتىر/مو')}`, sub: `${T(lang,'共','جەمئىي ')}${Math.round(area * 50) || '--'}` },
      { icon: '✅', name: T(lang,'苗期滴灌','مايسا مەزگىلى تامچە سۇغىرىش'), meta: `${plot.name || T(lang,'当前地块','ھازىرقى يەر')} · ${T(lang,'已完成','تاماملاندى')}`, status: T(lang,'已完成','تاماملاندى'), cls: 'done', value: `25${T(lang,'方/亩','كۇب مېتىر/مو')}`, sub: `${T(lang,'共','جەمئىي ')}${Math.round(area * 25) || '--'}` }
    ],
    bars: [
      { label: '5/27', height: 0 }, { label: '5/28', height: dry ? 35 : 55 },
      { label: '5/29', height: 0 }, { label: '5/30', height: 0 },
      { label: '5/31', height: 0 }, { label: '6/1', height: dry ? 0 : 45 },
      { label: T(lang,'今日','بۈگۈن'), height: dry ? 72 : 0 }
    ]
  }
}

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: COPY[i18n.getLanguage()],
    loading: true,
    plots: [],
    plotOptions: ['暂无地块'],
    plotIndex: 0,
    plot: {},
    model: buildModel({})
  },

  onLoad(options = {}) {
    const info = wx.getSystemInfoSync()
    this.initialPlotId = Number(options.plotId || 0)
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.loadPlots()
  },

  onShow() {
    const lang = i18n.getLanguage()
    if (lang !== this.data.lang) {
      this.setData({ lang, copy: COPY[lang], model: buildModel(this.data.plot, lang) })
      this.loadPlots()
    }
  },

  async loadPlots() {
    this.setData({ loading: true })
    try {
      const res = await auth.request('GET', '/api/plots')
      const plots = res.code === 200 && Array.isArray(res.data) ? res.data : []
      const selectedIndex = Math.max(0, plots.findIndex(plot => Number(plot.id) === this.initialPlotId))
      const plot = plots[selectedIndex] || {}
      this.setData({
        loading: false,
        plots,
        plotOptions: plots.length ? plots.map(item => `${item.name || this.data.copy.unnamed} · ${formatMu(item.area)}${this.data.copy.mu}`) : [this.data.copy.noPlot],
        plotIndex: selectedIndex,
        plot,
        model: buildModel(plot, this.data.lang)
      })
    } catch (error) {
      this.setData({ loading: false, plots: [], plotOptions: [this.data.copy.loadFail] })
      wx.showToast({ title: error.message || this.data.copy.loadFail, icon: 'none' })
    }
  },

  onPlotChange(e) {
    const index = Number(e.detail.value)
    const plot = this.data.plots[index] || {}
    this.setData({ plotIndex: index, plot, model: buildModel(plot, this.data.lang) })
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  },

  onRecord() {
    const plot = this.data.plot
    const suffix = plot && plot.id ? `?plotId=${plot.id}&type=灌溉` : '?type=灌溉'
    wx.navigateTo({ url: `/pages/records/index${suffix}` })
  },

  onReminder() {
    wx.showToast({ title: this.data.copy.reminderOn, icon: 'none' })
  }
})
