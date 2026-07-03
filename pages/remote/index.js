const i18n = require('../../utils/i18n')

function pageCopy(lang = i18n.getLanguage()) {
  if (lang === 'ug') {
    return {
      scoreUnit: 'نومۇر',
      title: 'AI سۈنئىي ھەمراھ تەھلىلى',
      subtitle: 'كۆپ سپېكتر + NDVI سانلىق مەلۇماتىغا ئاساسەن تەھلىل',
      ndvi: 'NDVI ئۆسۈش',
      drought: 'قۇرغاقچىلىق خەۋپى',
      pest: 'كېسەل-زىيانداش خەۋپى',
      ask: 'سوئال بارمۇ؟',
      askAi: 'كىچىك پاختا AI دىن سوراڭ ›'
    }
  }
  return {
    scoreUnit: '分',
    title: 'AI 遥感分析',
    subtitle: '基于多光谱+NDVI数据实时分析',
    ndvi: 'NDVI长势',
    drought: '旱情风险',
    pest: '病虫风险',
    ask: '有疑问？',
    askAi: '问问小棉 AI ›'
  }
}

function localizedData(lang = i18n.getLanguage()) {
  if (lang === 'ug') {
    return {
      selField: '3-يەر · ئاساسلىق ئېتىز',
      fields: ['1-يەر', '2-يەر', '3-يەر · ئاساسلىق ئېتىز', '4-يەر', '5-يەر'],
      analysis: {
        score: 86, scoreLabel: 'ياخشى',
        ndvi: 0.67, ndviLabel: 'نورمال', ndviColor: '#4CAF50',
        drought: 'تۆۋەن خەۋپ', droughtColor: '#4CAF50',
        pest: 'ئوتتۇرا خەۋپ', pestColor: '#FF9800',
        updateTime: '2 سائەت بۇرۇن · ئۇچقۇچىسىز ئۈسكۈنە سانلىقى'
      },
      recs: [
        { icon:'💧', bg:'#E3F2FD', name:'سۇغىرىش تەۋسىيەسى', priority:'نورمال', isAttention:false, priorityColor:'#4CAF50', desc:'ھازىر تۇپراق نەملىكى يېتەرلىك، 3 كۈندىن كېيىن سۇغىرىشنى تولۇقلاشنى ئويلىشىڭ، 70% سۇ تۇتۇش نىسبىتىنى ساقلاڭ.' },
        { icon:'🌿', bg:'#E8F5E9', name:'ئۆسۈش تەھلىلى', priority:'ياخشى', isAttention:false, priorityColor:'#4CAF50', desc:'3-يەرنىڭ NDVI قىممىتى 0.67، ئومۇمىي ئۆسۈش ياخشى، ئالدىنقى ھەپتىدىن 5.2% ئاشقان. ھازىرقى باشقۇرۇشنى داۋاملاشتۇرۇڭ.' },
        { icon:'⚠️', bg:'#FFF3E6', name:'كېسەل-زىيانداش خەۋپى', priority:'دىققەت', isAttention:true, priorityColor:'#FF9800', desc:'شەرقىي جەنۇب بۇلۇڭىدا شىرى توپلىنىش ئالامىتى بايقالدى، يېقىندا ئېتىزدا تەكشۈرۈپ ۋاقتىدا ئالدىنى ئېلىڭ.' }
      ]
    }
  }
  return {
    selField: '3号地·主力田',
    fields: ['1号地', '2号地', '3号地·主力田', '4号地', '5号地'],
    analysis: {
      score: 86, scoreLabel: '良好',
      ndvi: 0.67, ndviLabel: '正常', ndviColor: '#4CAF50',
      drought: '低风险', droughtColor: '#4CAF50',
      pest: '中风险', pestColor: '#FF9800',
      updateTime: '2小时前 · 无人机数据'
    },
    recs: [
      { icon:'💧', bg:'#E3F2FD', name:'灌溉建议', priority:'正常', isAttention:false, priorityColor:'#4CAF50', desc:'当前土壤水分充足，3天后可以考虑补充灌溉，保持70%持水量。' },
      { icon:'🌿', bg:'#E8F5E9', name:'长势分析', priority:'良好', isAttention:false, priorityColor:'#4CAF50', desc:'3号地NDVI值0.67，整体长势良好，较上周提升5.2%，建议继续维持当前管理策略。' },
      { icon:'⚠️', bg:'#FFF3E6', name:'病虫害风险', priority:'关注', isAttention:true, priorityColor:'#FF9800', desc:'东南角区域检测到潜在蚜虫聚集特征，建议近期到田间实地查看并及时防治。' }
    ]
  }
}

Page({
  data: {
    statusBarHeight: 20,
    lang: 'zh',
    copy: pageCopy('zh'),
    ...localizedData('zh')
  },
  onLoad(options = {}) {
    const info = wx.getSystemInfoSync()
    const lang = i18n.getLanguage()
    const data = localizedData(lang)
    let plotName = options.plotName || ''
    try { plotName = decodeURIComponent(plotName) } catch (error) {}
    const fields = plotName && !data.fields.includes(plotName)
      ? [plotName, ...data.fields]
      : data.fields
    this.setData({
      ...data,
      lang,
      copy: pageCopy(lang),
      statusBarHeight: info.statusBarHeight || 20,
      fields,
      selField: plotName || data.selField
    })
  },
  onShow() {
    const lang = i18n.getLanguage()
    if (lang === this.data.lang) return
    const data = localizedData(lang)
    this.setData({ ...data, lang, copy: pageCopy(lang) })
  },
  onBack() { wx.navigateBack() },
  onSelField(e) { this.setData({ selField: e.currentTarget.dataset.f }) },
  onAsk() {
    wx.navigateTo({ url: '/pages/ai/index' })
  }
})
