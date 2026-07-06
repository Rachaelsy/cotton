const INTENTS = [
  {
    key: 'weather',
    icon: '🌦',
    title: '地块气象',
    titleUg: 'يەر ھاۋارايى',
    desc: '查看地块实时天气、预警和农事气象建议',
    descUg: 'يەرنىڭ ھاۋارايى، ئاگاھلاندۇرۇش ۋە دېھقانچىلىق تەۋسىيەسىنى كۆرۈش',
    url: '/pages/weather/index',
    method: 'navigateTo',
    keywords: ['天气', '气象', '预报', '温度', '地温', '下雨', '打药吗', '风力', 'weather'],
    ugKeywords: ['ھاۋارايى', 'يامغۇر', 'تېمپېراتۇرا', 'شامال']
  },
  {
    key: 'plots',
    icon: '🌱',
    title: '地块管理',
    titleUg: 'يەر باشقۇرۇش',
    desc: '查看、选择和维护自己的棉田地块',
    descUg: 'پاختا ئېتىزلىرىنى كۆرۈش ۋە باشقۇرۇش',
    url: '/pages/fields/index',
    method: 'navigateTo',
    keywords: ['地块', '土地', '棉田', '我的地', '边界', '坐标', '长势', '看长势', '苗情', '遥感', '长得怎么样'],
    ugKeywords: ['يەر', 'پاختا ئېتىزى', 'چېگرا', 'ئۆسۈش', 'كۆچەت']
  },
  {
    key: 'pest',
    icon: '🐛',
    title: '病虫害识别',
    titleUg: 'كېسەل-زىيانداش تونۇش',
    desc: '拍照识别棉蚜、红蜘蛛、棉铃虫等问题',
    descUg: 'رەسىم ئارقىلىق كېسەل ۋە زىيانداشنى تونۇش',
    url: '/pages/pest/index',
    method: 'navigateTo',
    keywords: ['病虫害', '虫', '棉蚜', '红蜘蛛', '棉铃虫', '拍照', '识别', '叶子', '生病'],
    ugKeywords: ['كېسەل', 'زىيانداش', 'شىرە', 'قىزىل ئۆمۈچۈك', 'رەسىم']
  },
  {
    key: 'supplies',
    icon: '🧪',
    title: '农资供应',
    titleUg: 'دېھقانچىلىق ماتېرىياللىرى',
    desc: '购买农药、化肥、种子和农膜等农资',
    descUg: 'دورا، ئوغۇت، ئۇرۇق ۋە پەردە سېتىۋېلىش',
    url: '/subpkg-supplies/supplies/index',
    method: 'navigateTo',
    keywords: ['买农药', '农药', '农资', '买药', '化肥', '肥料', '种子', '地膜', '购物'],
    ugKeywords: ['دورا', 'ئوغۇت', 'ئۇرۇق', 'سېتىۋال']
  },
  {
    key: 'trade',
    icon: '💰',
    title: '棉花交易',
    titleUg: 'پاختا سودىسى',
    desc: '查看收购价并发布卖棉需求',
    descUg: 'سېتىۋېلىش باھاسىنى كۆرۈش ۋە پاختا سېتىش',
    url: '/pages/trade/index',
    method: 'navigateTo',
    keywords: ['卖棉', '卖棉花', '棉花交易', '收购价', '价格', '行情', '卖 cotton'],
    ugKeywords: ['پاختا سات', 'باھا', 'سودا']
  },
  {
    key: 'machine',
    icon: '🚜',
    title: '农机租赁',
    titleUg: 'ماشىنا ئىجارە',
    desc: '查找附近农机并预约作业',
    descUg: 'يېقىن ئەتراپتىكى ماشىنىنى تېپىپ زاكاز قىلىش',
    url: '/pages/machine/index',
    method: 'navigateTo',
    keywords: ['农机', '拖拉机', '采棉机', '打药机', '租机器', '找机器', '机械'],
    ugKeywords: ['ماشىنا', 'تراكتور', 'ئىجارە']
  },
  {
    key: 'records',
    icon: '📒',
    title: '农事记录',
    titleUg: 'دېھقانچىلىق خاتىرىسى',
    desc: '记录和查看浇水、施肥、打药等农事',
    descUg: 'سۇغىرىش، ئوغۇتلاش ۋە دورا پۈركۈش خاتىرىسى',
    url: '/pages/records/index',
    method: 'navigateTo',
    keywords: ['农事记录', '记录', '打卡', '记一下', '浇水记录', '打药记录'],
    ugKeywords: ['خاتىرە', 'دېھقانچىلىق خاتىرىسى']
  },
  {
    key: 'loans',
    icon: '🏦',
    title: '农业贷款',
    titleUg: 'دېھقانچىلىق قەرزى',
    desc: '查看农业贷款和资金服务',
    descUg: 'دېھقانچىلىق قەرزى ۋە مەبلەغ مۇلازىمىتى',
    url: '/pages/loans/index',
    method: 'navigateTo',
    keywords: ['贷款', '借钱', '资金', '银行', '融资'],
    ugKeywords: ['قەرز', 'بانكا', 'مەبلەغ']
  },
  {
    key: 'insurance',
    icon: '🛡',
    title: '农业保险',
    titleUg: 'دېھقانچىلىق سۇغۇرتىسى',
    desc: '查看棉田保险和理赔服务',
    descUg: 'پاختا ئېتىزى سۇغۇرتىسى ۋە تۆلەم مۇلازىمىتى',
    url: '/pages/insurance/index',
    method: 'navigateTo',
    keywords: ['保险', '理赔', '受灾', '赔付'],
    ugKeywords: ['سۇغۇرتا', 'تۆلەم']
  },
  {
    key: 'expert',
    icon: '👨‍🌾',
    title: '专家讲堂',
    titleUg: 'مۇتەخەسسىس دەرسى',
    desc: '查看专家问答、课程和咨询入口',
    descUg: 'مۇتەخەسسىس جاۋابى، دەرس ۋە مەسلىھەتنى كۆرۈش',
    url: '/pages/expert/index',
    method: 'navigateTo',
    keywords: ['专家', '农技师', '讲堂', '课程', '问专家', '咨询'],
    ugKeywords: ['مۇتەخەسسىس', 'مەسلىھەت', 'دەرس']
  },
  {
    key: 'water',
    icon: '💧',
    title: '水管理',
    titleUg: 'سۇ باشقۇرۇش',
    desc: '查看灌水计划和墒情建议',
    descUg: 'سۇغىرىش پىلانى ۋە نەملىك تەۋسىيەسى',
    url: '/pages/water/index',
    method: 'navigateTo',
    keywords: ['水管理', '浇水', '灌水', '滴灌', '墒情', '缺水'],
    ugKeywords: ['سۇغىرىش', 'سۇ', 'نەملىك']
  },
  {
    key: 'fert',
    icon: '🌿',
    title: '肥管理',
    titleUg: 'ئوغۇت باشقۇرۇش',
    desc: '查看施肥和营养管理建议',
    descUg: 'ئوغۇتلاش ۋە ئوزۇق باشقۇرۇش تەۋسىيەسى',
    url: '/pages/fert/index',
    method: 'navigateTo',
    keywords: ['肥管理', '施肥', '追肥', '缺肥', '营养', '氮肥', '钾肥'],
    ugKeywords: ['ئوغۇت', 'ئوزۇق']
  }
]

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '')
}

function toJump(intent, lang = 'zh') {
  const useUg = lang === 'ug'
  return {
    key: intent.key,
    icon: intent.icon,
    title: useUg ? intent.titleUg : intent.title,
    desc: useUg ? intent.descUg : intent.desc,
    url: intent.url,
    method: intent.method,
    autoOpen: true
  }
}

function detectAiIntent(input, lang = 'zh') {
  const text = normalizeText(input)
  if (!text) return null
  const matched = INTENTS.find(intent => {
    const words = [...intent.keywords, ...intent.ugKeywords]
    return words.some(word => text.includes(normalizeText(word)))
  })
  if (!matched) return null
  return {
    key: matched.key,
    jump: toJump(matched, lang)
  }
}

function buildIntentReply(intent, lang = 'zh') {
  if (!(intent && intent.jump)) return ''
  if (lang === 'ug') {
    return `${intent.jump.title} بېتىنى ئاچىمەن. ئەگەر ئېچىلماي قالسا، تۆۋەندىكى كارتا ئارقىلىق كىرىڭ.`
  }
  return `我这就打开「${intent.jump.title}」。如果没有自动进入，点下面的入口也能进。`
}

module.exports = {
  INTENTS,
  detectAiIntent,
  buildIntentReply
}
