const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')

const COPY = {
  zh: {
    title: '肥管理', selectPlot: '选择地块', growthStage: '当前生育期', seasonCount: '本季已施肥',
    nutritionState: '营养状态', loading: '加载中…', soilNutrition: '土壤营养状态', advice: '施肥建议',
    analysis: '分析 · 基于地块种植信息', record: '记录施肥', buy: '购买农资', plan: '施肥计划',
    tips: '棉花施肥要点', tip1: '重施基肥，少量多次追肥', tip1d: '基肥占全季施肥量约 40%，追肥随水分多次施入。',
    tip2: '氮磷钾均衡，补充微量元素', tip2d: '棉花对硼、锌需求较高，缺素时应结合检测补充。',
    tip3: '打顶后控制氮肥', tip3d: '减少氮肥并补充钾肥，促进棉铃充实。', noPlot: '暂无地块', unnamed: '未命名地块',
    mu: '亩', loadFail: '加载失败', reminderOn: '施肥提醒已开启'
  },
  ug: {
    title: 'ئوغۇت باشقۇرۇش', selectPlot: 'يەر تاللاش', growthStage: 'ھازىرقى ئۆسۈش باسقۇچى', seasonCount: 'بۇ پەسىلدىكى ئوغۇتلاش',
    nutritionState: 'ئوزۇقلۇق ھالىتى', loading: 'يۈكلىنىۋاتىدۇ…', soilNutrition: 'تۇپراق ئوزۇقلۇق ھالىتى', advice: 'ئوغۇتلاش تەۋسىيەسى',
    analysis: 'تەھلىل · يەر تېرىش ئۇچۇرىغا ئاساسەن', record: 'ئوغۇتلاشنى خاتىرىلەش', buy: 'دېھقانچىلىق ماتېرىيالى سېتىۋېلىش', plan: 'ئوغۇتلاش پىلانى',
    tips: 'پاختا ئوغۇتلاش نۇقتىلىرى', tip1: 'ئاساسىي ئوغۇتنى يېتەرلىك، ئۈستى ئوغۇتنى ئاز-ئازدىن بېرىڭ', tip1d: 'ئاساسىي ئوغۇت پۈتۈن پەسىل مىقدارىنىڭ تەخمىنەن 40%، ئۈستى ئوغۇتنى سۇ بىلەن بۆلۈپ بېرىڭ.',
    tip2: 'ئازوت، فوسفور، كالىينى تەڭپۇڭلاشتۇرۇڭ', tip2d: 'پاختىنىڭ بور ۋە سىنىك ئېھتىياجى يۇقىرى، تەكشۈرۈش نەتىجىسىگە ئاساسەن تولۇقلاڭ.',
    tip3: 'ئۇچىنى ئۈزگەندىن كېيىن ئازوتنى كونترول قىلىڭ', tip3d: 'ئازوتنى ئازايتىپ كالىينى تولۇقلاپ، كۆسەكنىڭ تولۇشىنى ئىلگىرى سۈرۈڭ.', noPlot: 'يەر يوق', unnamed: 'نامسىز يەر',
    mu: 'مو', loadFail: 'يۈكلەش مەغلۇپ', reminderOn: 'ئوغۇتلاش ئەسكەرتىشى ئېچىلدى'
  }
}

function formatMu(value) {
  const number = Number(value || 0)
  return number.toFixed(number >= 100 || number % 1 === 0 ? 0 : 1)
}

function buildModel(plot, lang = i18n.getLanguage()) {
  const area = Number(plot && plot.area || 0)
  const score = Number(plot && plot.health_score || 86)
  const attention = plot && plot.status === 'attention'
  const p = attention ? 38 : Math.max(45, Math.min(72, Math.round(score * 0.62)))
  return i18n.localizeDeep({
    stage: plot && plot.planting_status === '计划播种' ? '播前' : '蕾期',
    count: attention ? 3 : 5,
    state: p < 45 ? '偏低' : '中等',
    stateClass: p < 45 ? 'warn' : 'ok',
    nutrients: [
      { name: '氮 N', value: attention ? 58 : 62, state: '正常', cls: 'ok' },
      { name: '磷 P', value: p, state: p < 45 ? '偏低' : '正常', cls: p < 45 ? 'warn' : 'ok' },
      { name: '钾 K', value: attention ? 66 : 75, state: '正常', cls: 'ok' },
      { name: '有机质', value: attention ? 42 : 48, state: '偏低', cls: 'warn' }
    ],
    advice: `${plot.name || '当前地块'}当前处于蕾期，磷素${p < 45 ? '偏低' : '基本正常'}。建议本次随水追施磷酸二铵 5kg/亩，同时追施硝酸钾 3kg/亩补充钾素。全程配合滴灌随水施肥，预计投入约 ¥${Math.round(area * 680) || '--'} 元。`,
    products: [
      { icon: '🌾', name: '磷酸二铵（18-46-0）', meta: '补磷 · 蕾期推荐 · 5kg/亩', price: '¥600/袋', unit: '50kg装' },
      { icon: '💎', name: '硝酸钾（13-0-46）', meta: '补钾 · 随水滴施 · 3kg/亩', price: '¥420/袋', unit: '25kg装' }
    ],
    plans: [
      { icon: '⚡', name: '蕾期追肥', meta: `${plot.name || '当前地块'} · 随水施 · 今日建议`, status: '建议今日执行', cls: 'warn', value: '磷铵+硝钾', sub: '8kg/亩' },
      { icon: '🌸', name: '花铃期追肥', meta: `${plot.name || '当前地块'} · 7月15日`, status: '已计划', cls: 'plan', value: '尿素+钾肥', sub: '12kg/亩' },
      { icon: '✅', name: '基肥（底肥）', meta: `${plot.name || '当前地块'} · 已完成`, status: '已完成', cls: 'done', value: '复合肥', sub: '30kg/亩' }
    ]
  }, lang)
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
    const suffix = plot && plot.id ? `?plotId=${plot.id}&type=施肥` : '?type=施肥'
    wx.navigateTo({ url: `/pages/records/index${suffix}` })
  },

  onBuy() {
    wx.navigateTo({ url: '/subpkg-supplies/supplies/index' })
  },

  onReminder() {
    wx.showToast({ title: this.data.copy.reminderOn, icon: 'none' })
  }
})
