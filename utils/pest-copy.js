const PEST_COPY = {
  zh: {
    index: {
      title: '病虫害识别',
      recognize: '拍照识别',
      recognizeSub: '拍一张棉花叶片、茎秆或虫体照片，AI 会结合视觉模型给出病虫害判断与处理建议。',
      cameraAction: '立即拍照',
      album: '相册选择',
      albumSub: '从手机里选择已有图片',
      history: '识别历史',
      historyCount: count => `最近 ${count} 次识别记录`,
      noHistoryShort: '还没有识别记录',
      recentTitle: '最近识别',
      recentSub: '点击即可再次查看诊断结果',
      historyBadge: '识别记录',
      albumBadge: '本地图片',
      library: '常见病虫害',
      commonCount: count => `${count} 种高频问题`,
      filters: ['全部', '虫害', '病害', '生理性'],
      categoryLabels: {
        pest: '虫害',
        disease: '病害',
        physiological: '生理性',
        unknown: '待确认'
      },
      severityLabels: {
        light: '轻度',
        medium: '中度',
        severe: '重度',
        unknown: '待确认'
      },
      pests: [
        { id: 1, n: '棉蚜', icon: '🐛', bg: 'c2', type: '虫害', hot: true },
        { id: 2, n: '棉铃虫', icon: '🦋', bg: 'c3', type: '虫害', hot: false },
        { id: 3, n: '红蜘蛛', icon: '🕷', bg: 'c1', type: '虫害', hot: false },
        { id: 4, n: '枯萎病', icon: '🍂', bg: 'c4', type: '病害', hot: true },
        { id: 5, n: '黄萎病', icon: '🌿', bg: 'c5', type: '病害', hot: false },
        { id: 6, n: '蕾铃脱落', icon: '🌾', bg: 'c6', type: '生理性', hot: false },
        { id: 7, n: '缺素症', icon: '🧪', bg: 'c2', type: '生理性', hot: false },
        { id: 8, n: '日灼病', icon: '☀', bg: 'c3', type: '病害', hot: false }
      ],
      viewGuide: '查看防治要点',
      pendingTitle: '待进一步确认',
      pendingCategory: '待确认',
      pendingSeverity: '待确认',
      photoCancel: '已取消拍照',
      albumCancel: '已取消选择',
      recognizing: '正在扫描图片...',
      recognizeFail: '识别失败，请重试',
      parseFail: '识别结果解析失败，请重试',
      uploadFail: '图片上传失败，请检查网络',
      noHistory: '暂无历史记录'
    },
    detail: {
      cycle: '天内处理',
      severity: '严重程度',
      severityTip: (level, days) => `当前为${level}，建议在 ${days} 天内处理`,
      pendingSeverityValue: '待确认',
      pendingSeverityTip: '当前图片还不足以判断严重程度，建议补拍叶背、虫体或病斑近景。',
      pendingTreatDays: '-',
      pendingSummary: '已完成图片分析，请结合更多田间症状继续确认。',
      pendingConfidence: '低',
      descTitle: '问题概述',
      symptomTitle: '可见症状',
      evidenceTitle: '判断依据',
      warningTitle: '用药提醒',
      confidenceLabel: '可信度：',
      actionPrefix: '建议',
      treatmentTitle: '处理建议',
      productTitle: '建议药剂 / 处理用品',
      noProductName: '建议结合当地植保方案选药',
      noProductUsage: '具体剂量请按标签和当地农技意见执行',
      buy: '去购买',
      addedCart: name => `已加入购物车：${name}`,
      shareDeveloping: '分享功能开发中',
      shareTitle: name => `病虫害识别结果：${name}`,
      aiResultTitle: 'AI识别结果',
      aiResultType: '智能诊断',
      aiResultTip: '识别结果仅作辅助判断，实际用药前建议结合田间症状并咨询当地农技人员。',
      resultSummaryTitle: '诊断概览',
      resultSummarySub: '以下结果基于当前上传图片生成，请结合田间实况判断。',
      metricType: '问题类型',
      metricSeverity: '严重程度',
      metricConfidence: '可信度',
      categoryLabels: {
        pest: '虫害',
        disease: '病害',
        physiological: '生理性',
        unknown: '待确认'
      },
      severityLabels: {
        light: '轻度',
        medium: '中度',
        severe: '重度',
        unknown: '待确认'
      },
      confidenceLabels: {
        high: '高',
        medium: '中',
        low: '低'
      },
      severityLevels: [
        { label: '轻度', value: 'light' },
        { label: '中度', value: 'medium' },
        { label: '重度', value: 'severe' }
      ],
      pest: {
        name: '棉蚜',
        icon: '🐛',
        type: '虫害',
        severity: '中度',
        severityKey: 'medium',
        severityColor: '#FF9800',
        treatDays: 3,
        desc: '棉蚜会聚集在棉株叶背、嫩梢和花蕾附近吸食汁液，容易造成叶片卷曲、发黄和长势变弱。',
        treatments: [
          { n: '化学防治', d: '可在虫量明显上升时，选择对口药剂重点喷施叶背和嫩梢。' },
          { n: '物理防治', d: '田间悬挂黄板，结合人工巡查，尽量在虫口初期控制。' },
          { n: '农业防治', d: '避免偏施氮肥，保持通风透光，及时清理杂草和重病残株。' }
        ],
        products: [
          { name: '10%吡虫啉可湿性粉剂 500g', price: 45, icon: '🧴' },
          { name: '3%啶虫脒乳油 500ml', price: 38, icon: '🧴' }
        ]
      }
    },
    result: {
      scanningTitle: 'AI 正在扫描病虫害图片',
      scanningSub: '识别叶片症状、匹配病虫害特征、生成处理建议',
      scanningSteps: ['识别叶片与虫体', '比对病虫害特征', '生成诊断结论', '整理农事建议'],
      modeLabel: '模式',
      modeValue: '视觉识别',
      modelLabel: '模型',
      statusDone: '已完成',
      statusActive: '进行中',
      statusPending: '等待中',
      scanningHint: '请稍等几秒，不要关闭页面',
      scanFail: '病虫害识别失败',
      retry: '重新识别',
      backList: '返回识别页'
    }
  },
  ug: {
    index: {
      title: 'كېسەل-زىيانداش تونۇش',
      recognize: 'رەسىم ئارقىلىق تونۇش',
      recognizeSub: 'پاختا يوپۇرمىقى، غولى ياكى زىيانداشنىڭ سۈرىتىنى تارتىڭ، AI كۆرۈش مودېلى ئاساسىدا دىئاگنوز ۋە بىر تەرەپ قىلىش تەكلىپى بېرىدۇ.',
      cameraAction: 'ھازىر رەسىم تارتىش',
      album: 'ئالبومدىن تاللاش',
      albumSub: 'تېلېفوندىكى بار رەسىمنى تاللاش',
      history: 'تونۇش تارىخى',
      historyCount: count => `يېقىنقى ${count} قېتىملىق تونۇش`,
      noHistoryShort: 'تېخى خاتىرە يوق',
      recentTitle: 'يېقىنقى تونۇش',
      recentSub: 'چېكىپ قايتا كۆرۈپ نەتىجىنى ئوقۇڭ',
      historyBadge: 'تونۇش خاتىرىسى',
      albumBadge: 'يەرلىك رەسىم',
      library: 'كۆپ ئۇچرايدىغان كېسەل-زىيانداشلار',
      commonCount: count => `${count} خىل يۇقىرى چاستوتىلىق مەسىلە`,
      filters: ['ھەممىسى', 'زىيانداش', 'كېسەل', 'فىزىئولوگىيىلىك'],
      categoryLabels: {
        pest: 'زىيانداش',
        disease: 'كېسەل',
        physiological: 'فىزىئولوگىيىلىك',
        unknown: 'تېخى جەزملەشمەيدۇ'
      },
      severityLabels: {
        light: 'يېنىك',
        medium: 'ئوتتۇرا',
        severe: 'ئېغىر',
        unknown: 'تېخى جەزملەشمەيدۇ'
      },
      pests: [
        { id: 1, n: 'پاختا شىرىسى', icon: '🐛', bg: 'c2', type: 'زىيانداش', hot: true },
        { id: 2, n: 'پاختا قۇرتى', icon: '🦋', bg: 'c3', type: 'زىيانداش', hot: false },
        { id: 3, n: 'قىزىل ئۆمۈچۈك', icon: '🕷', bg: 'c1', type: 'زىيانداش', hot: false },
        { id: 4, n: 'سۆلىش كېسىلى', icon: '🍂', bg: 'c4', type: 'كېسەل', hot: true },
        { id: 5, n: 'سېرىق سۆلىش', icon: '🌿', bg: 'c5', type: 'كېسەل', hot: false },
        { id: 6, n: 'غۇنچە-كۆسەك چۈشۈش', icon: '🌾', bg: 'c6', type: 'فىزىئولوگىيىلىك', hot: false },
        { id: 7, n: 'ئوزۇقلۇق كەمچىلىك', icon: '🧪', bg: 'c2', type: 'فىزىئولوگىيىلىك', hot: false },
        { id: 8, n: 'كۈن كۆيۈك كېسىلى', icon: '☀', bg: 'c3', type: 'كېسەل', hot: false }
      ],
      viewGuide: 'ئالدىنى ئېلىش نۇقتىسىنى كۆرۈش',
      pendingTitle: 'يەنىمۇ بىر قېتىم جەزملەش كېرەك',
      pendingCategory: 'تېخى جەزملەشمەيدۇ',
      pendingSeverity: 'تېخى جەزملەشمەيدۇ',
      photoCancel: 'رەسىم تارتىش بىكار قىلىندى',
      albumCancel: 'تاللاش بىكار قىلىندى',
      recognizing: 'رەسىم سىكاننېرلىنىۋاتىدۇ...',
      recognizeFail: 'تونۇش مەغلۇپ بولدى، قايتا سىناڭ',
      parseFail: 'نەتىجىنى يېشىش مەغلۇپ بولدى، قايتا سىناڭ',
      uploadFail: 'رەسىم يوللاش مەغلۇپ بولدى، تورنى تەكشۈرۈڭ',
      noHistory: 'تارىخ يوق'
    },
    detail: {
      cycle: 'كۈن ئىچىدە بىر تەرەپ قىلىش',
      severity: 'ئېغىرلىق دەرىجىسى',
      severityTip: (level, days) => `ھازىرقى دەرىجە ${level}، ${days} كۈن ئىچىدە بىر تەرەپ قىلىش تەۋسىيە قىلىنىدۇ`,
      pendingSeverityValue: 'تېخى جەزملەشمەيدۇ',
      pendingSeverityTip: 'ھازىرقى رەسىم ئېغىرلىقنى بەلگىلەشكە يەتمەيدۇ، يوپۇرماق ئارقىسى ياكى كېسەل قىسمىنى يېقىن سۈرىتىنى قايتا تارتىڭ.',
      pendingTreatDays: '-',
      pendingSummary: 'رەسىم تەھلىلى تاماملاندى، تېخىمۇ كۆپ ئالامەتلەر بىلەن يەنە بىر قېتىم جەزملەشتۈرۈڭ.',
      pendingConfidence: 'تۆۋەن',
      descTitle: 'مەسىلە قىسقىچە بايانى',
      symptomTitle: 'كۆرۈنگەن ئالامەتلەر',
      evidenceTitle: 'ھۆكۈم ئاساسى',
      warningTitle: 'دورا ئىشلىتىش ئەسكەرتىشى',
      confidenceLabel: 'ئىشەنچ دەرىجىسى: ',
      actionPrefix: 'تەۋسىيە',
      treatmentTitle: 'بىر تەرەپ قىلىش تەكلىپى',
      productTitle: 'تەۋسىيە قىلىنغان دورا / بىر تەرەپ قىلىش بۇيۇمى',
      noProductName: 'يەرلىك ئۆسۈملۈك قوغداش لايىھىسى بىلەن دورا تاللاڭ',
      noProductUsage: 'مىقدارنى ماركا ۋە يەرلىك تېخنىكلارنىڭ پىكرى بويىچە بېكىتىڭ',
      buy: 'سېتىۋېلىش',
      addedCart: name => `سېۋەتكە قوشۇلدى: ${name}`,
      shareDeveloping: 'ھەمبەھىرلەش ئىقتىدارى تەرەققىياتتا',
      shareTitle: name => `كېسەل-زىيانداش تونۇش نەتىجىسى: ${name}`,
      aiResultTitle: 'AI تونۇش نەتىجىسى',
      aiResultType: 'ئەقلىي دىئاگنوز',
      aiResultTip: 'تونۇش نەتىجىسى پەقەت ياردەمچى ھۆكۈم، دورا ئىشلىتىشتىن بۇرۇن يەرلىك تېخنىكلارنىڭ پىكرىنى قوشۇپ باھالاڭ.',
      resultSummaryTitle: 'دىئاگنوز قىسقىچە',
      resultSummarySub: 'تۆۋەندىكى نەتىجە ھازىرقى يوللانغان رەسىمگە ئاساسەن ھاسىل قىلىندى.',
      metricType: 'مەسىلە تىپى',
      metricSeverity: 'ئېغىرلىقى',
      metricConfidence: 'ئىشەنچ دەرىجىسى',
      categoryLabels: {
        pest: 'زىيانداش',
        disease: 'كېسەل',
        physiological: 'فىزىئولوگىيىلىك',
        unknown: 'تېخى جەزملەشمەيدۇ'
      },
      severityLabels: {
        light: 'يېنىك',
        medium: 'ئوتتۇرا',
        severe: 'ئېغىر',
        unknown: 'تېخى جەزملەشمەيدۇ'
      },
      confidenceLabels: {
        high: 'يۇقىرى',
        medium: 'ئوتتۇرا',
        low: 'تۆۋەن'
      },
      severityLevels: [
        { label: 'يېنىك', value: 'light' },
        { label: 'ئوتتۇرا', value: 'medium' },
        { label: 'ئېغىر', value: 'severe' }
      ],
      pest: {
        name: 'پاختا شىرىسى',
        icon: '🐛',
        type: 'زىيانداش',
        severity: 'ئوتتۇرا',
        severityKey: 'medium',
        severityColor: '#FF9800',
        treatDays: 3,
        desc: 'پاختا شىرىسى يوپۇرماقنىڭ ئارقا يۈزى، يېڭى شاخ ۋە غۇنچە ئەتراپىدا توپلىنىپ شىرە سۈمۈرۈپ، يوپۇرماقنى بۈكۈپ سارغايتىدۇ.',
        treatments: [
          { n: 'خىمىيەۋى ئالدىنى ئېلىش', d: 'زىيانداش سانى ئاشقاندا، يەرلىك لايىھە بويىچە ماس دورىنى يوپۇرماق ئارقىسىغا قارىتىپ پۈركۈڭ.' },
          { n: 'فىزىكىلىق ئالدىنى ئېلىش', d: 'سېرىق تاختا ئورنىتىپ، قاناتلىق شىرەنى تۇتۇڭ، دەسلەپكى باسقۇچتا قولدا كۆزىتىڭ.' },
          { n: 'دېھقانچىلىق ئالدىنى ئېلىش', d: 'ئازوتنى ھەددىدىن زىيادە بەرمەڭ، شامال ئۆتۈش ۋە يورۇقلۇقنى ياخشىلاڭ، ئوت-چۆپنى تازىلاڭ.' }
        ],
        products: [
          { name: '10%吡虫啉可湿性粉剂 500g', price: 45, icon: '🧴' },
          { name: '3%啶虫脒乳油 500ml', price: 38, icon: '🧴' }
        ]
      }
    },
    result: {
      scanningTitle: 'AI كېسەل-زىيانداش رەسىمىنى سىكاننېرلاۋاتىدۇ',
      scanningSub: 'يوپۇرماق ئالامىتىنى تونۇۋاتىدۇ، كېسەل-زىيانداش ئالاھىدىلىكىنى سېلىشتۇرۇۋاتىدۇ، بىر تەرەپ قىلىش تەكلىپىنى ھاسىل قىلىۋاتىدۇ',
      scanningSteps: ['يوپۇرماق ۋە زىيانداشنى تونۇش', 'كېسەل-زىيانداش ئالاھىدىلىكىنى سېلىشتۇرۇش', 'دىئاگنوز چىقىرىش', 'دېھقانچىلىق تەكلىپىنى تولۇقلاش'],
      modeLabel: 'ھالەت',
      modeValue: 'كۆرۈش تونۇشى',
      modelLabel: 'مودېل',
      statusDone: 'تاماملاندى',
      statusActive: 'ئىجرا بولۇۋاتىدۇ',
      statusPending: 'كۈتۈۋاتىدۇ',
      scanningHint: 'بىر نەچچە سېكۇنت ساقلاڭ، بەتنى ياپماڭ',
      scanFail: 'كېسەل-زىيانداش تونۇش مەغلۇپ بولدى',
      retry: 'قايتا تونۇش',
      backList: 'تونۇش بېتىگە قايتىش'
    }
  }
}

function getPestCopy(section, lang) {
  const code = lang === 'ug' ? 'ug' : 'zh'
  return PEST_COPY[code][section]
}

module.exports = {
  getPestCopy
}
