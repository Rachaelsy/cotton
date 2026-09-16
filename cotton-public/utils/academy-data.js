const LEVELS = [
  { key: 'basic', name: '初级课程', shortName: '初级', eyebrow: '基础入门', description: '建立棉花生育期、播种、苗期管理和田间巡查的基础认知。', color: 'green' },
  { key: 'intermediate', name: '中级课程', shortName: '中级', eyebrow: '丰产管理', description: '系统学习水肥调控、株型管理和病虫害综合防控。', color: 'gold' },
  { key: 'advanced', name: '高级课程', shortName: '高级', eyebrow: '提质增效', description: '面向规模化生产，学习品质管理、数据分析和全周期决策。', color: 'blue' }
]

const COURSES = [
  {
    id: 'cotton-growth-cycle', level: 'basic', order: 1, type: '视频', title: '认识棉花全生育期', duration: '1分08秒', minutes: 1,
    teacher: '平台农技组', role: '棉花栽培课程', cover: '/images/cotton-seedling-inspection-v1.jpg',
    summary: '从播种出苗、苗期、蕾期、花铃期到吐絮收获，认识不同生育阶段的田间表现与管理目标。',
    objectives: ['识别棉花主要生育阶段', '理解各阶段的核心管理目标', '建立全周期田间观察框架'],
    chapters: [['生育期划分与观察方法', '04:20'], ['苗期到蕾期的形态变化', '05:10'], ['花铃期到吐絮期管理重点', '06:30']]
  },
  {
    id: 'seed-selection-preparation', level: 'basic', order: 2, type: '视频', title: '品种选择与播前准备', duration: '58秒', minutes: 1,
    teacher: '平台农技组', role: '种植基础课程', cover: '/images/course-scouting-v2.webp',
    summary: '围绕生育期、纤维品质、抗逆性和机采适应性，讲解品种信息核对与播前准备。',
    objectives: ['读懂品种审定与试验指标', '核对种子标签和批次信息', '完成播前物资与地块检查'],
    chapters: [['品种选择的四个维度', '07:00'], ['种子标签与质量信息', '06:20'], ['播前检查清单', '07:40']]
  },
  {
    id: 'precision-sowing', level: 'basic', order: 3, type: '视频', title: '精量播种与播后检查', duration: '1分12秒', minutes: 1,
    teacher: '平台农技组', role: '农机农艺课程', cover: '/images/course-water-v2.webp',
    summary: '讲解播种机检查、株行距设置、播深控制、铺膜铺管以及播后质量核查。',
    objectives: ['掌握播种机作业前检查项目', '理解播深和株行距控制原则', '识别漏播、重播和覆土异常'],
    chapters: [['机具与种子准备', '06:50'], ['播深、株距与行距', '09:10'], ['播后质量抽查', '08:00']]
  },
  {
    id: 'seedling-management', level: 'basic', order: 4, type: '视频', title: '苗期管理关键点', duration: '1分03秒', minutes: 1,
    teacher: '平台农技组', role: '苗期管理课程', cover: '/images/cotton-seedling-inspection-v1.jpg',
    summary: '以全苗、齐苗、匀苗、壮苗为目标，介绍苗情调查、补苗判断和早期风险识别。',
    objectives: ['开展规范苗情调查', '区分缺苗、弱苗与旺苗', '识别低温、盐碱和早期虫害风险'],
    chapters: [['苗情调查方法', '06:00'], ['异常苗识别', '06:40'], ['苗期管理原则', '06:20']]
  },
  {
    id: 'field-scouting-basics', level: 'basic', order: 5, type: '视频', title: '第一次规范田间巡查', duration: '55秒', minutes: 1,
    teacher: '平台农技组', role: '田间调查课程', cover: '/images/course-scouting-v2.webp',
    summary: '使用固定路线和定点观察方法记录苗情、墒情、虫情及田间异常区域。',
    objectives: ['规划具有代表性的巡田路线', '规范观察棉株和田间分布', '用照片与记录保留现场依据'],
    chapters: [['巡田路线怎么走', '04:30'], ['每个样点看什么', '05:10'], ['如何形成巡田记录', '04:20']]
  },
  {
    id: 'basic-field-checklist', level: 'basic', order: 6, type: '图文', title: '棉田基础管理检查表', duration: '8分钟', minutes: 8,
    teacher: '平台农技组', role: '配套学习资料', cover: '/images/course-water-v2.webp',
    summary: '用一张检查表梳理播前、播种、出苗和苗期需要持续记录的关键事项。',
    objectives: ['建立基础生产档案', '掌握阶段性检查项目', '为后续水肥和植保管理保留数据'],
    chapters: [['播前检查', '约2分钟'], ['播种与出苗检查', '约3分钟'], ['苗期记录模板', '约3分钟']]
  },
  {
    id: 'irrigation-principles', level: 'intermediate', order: 1, type: '视频', title: '膜下滴灌与灌水判断', duration: '1分10秒', minutes: 1,
    teacher: '平台农技组', role: '水分管理课程', cover: '/images/course-water-v2.webp',
    summary: '结合生育阶段、土壤墒情和天气变化，讲解滴灌前的判断方法与田间核查要点。',
    objectives: ['理解不同生育期需水差异', '结合墒情和天气判断灌水窗口', '识别滴灌系统常见异常'],
    chapters: [['需水规律与观察指标', '08:20'], ['灌水窗口判断', '09:10'], ['滴灌运行检查', '08:30']]
  },
  {
    id: 'fertigation-management', level: 'intermediate', order: 2, type: '视频', title: '水肥一体化基础管理', duration: '1分06秒', minutes: 1,
    teacher: '平台农技组', role: '养分管理课程', cover: '/images/course-water-v2.webp',
    summary: '从土壤基础、作物长势和肥料标签出发，建立分阶段、可记录的水肥管理思路。',
    objectives: ['认识棉花主要养分需求', '理解随水施肥的基本流程', '避免无检测依据的过量投入'],
    chapters: [['养分需求与土壤基础', '09:00'], ['随水施肥流程', '10:20'], ['异常长势与调整原则', '08:40']]
  },
  {
    id: 'plant-architecture', level: 'intermediate', order: 3, type: '视频', title: '株型观察与化控判断', duration: '59秒', minutes: 1,
    teacher: '平台农技组', role: '群体管理课程', cover: '/images/cotton-seedling-inspection-v1.jpg',
    summary: '介绍株高、节间、果枝和群体封行程度的调查方法，帮助形成化控前的判断依据。',
    objectives: ['规范测量株高与节间', '判断群体长势和通风透光状况', '理解化控需要综合判断的原因'],
    chapters: [['株型调查指标', '07:30'], ['旺长与弱长的识别', '07:50'], ['化控前的综合判断', '07:40']]
  },
  {
    id: 'pest-monitoring', level: 'intermediate', order: 4, type: '视频', title: '棉田病虫害调查方法', duration: '1分15秒', minutes: 1,
    teacher: '平台农技组', role: '植保调查课程', cover: '/images/course-scouting-v2.webp',
    summary: '学习棉蚜、红蜘蛛、棉铃虫和常见病害的田间调查方法，先调查再判断是否需要处理。',
    objectives: ['区分虫害症状与非生物胁迫', '掌握多点取样和密度记录方法', '理解防治阈值与安全用药原则'],
    chapters: [['症状与虫体观察', '08:10'], ['取样和密度记录', '08:30'], ['防治决策基本原则', '08:20']]
  },
  {
    id: 'flower-boll-management', level: 'intermediate', order: 5, type: '视频', title: '花铃期综合管理', duration: '1分09秒', minutes: 1,
    teacher: '平台农技组', role: '关键生育期课程', cover: '/images/cotton-seedling-inspection-v1.jpg',
    summary: '围绕蕾铃保持、群体协调、水肥衔接和病虫害巡查，梳理花铃期田间管理逻辑。',
    objectives: ['认识花铃期产量形成特点', '协调水肥、株型和蕾铃关系', '建立高温及病虫害巡查清单'],
    chapters: [['花铃期生长特点', '09:20'], ['水肥与株型协调', '11:10'], ['蕾铃与风险巡查', '09:30']]
  },
  {
    id: 'midlevel-record-template', level: 'intermediate', order: 6, type: '图文', title: '水肥与植保记录规范', duration: '10分钟', minutes: 10,
    teacher: '平台农技组', role: '配套学习资料', cover: '/images/course-scouting-v2.webp',
    summary: '学习记录作业时间、地块、投入品、用量、天气和效果，为生产复盘提供可靠数据。',
    objectives: ['掌握农事记录必要字段', '形成投入品使用台账', '用作业前后照片辅助复盘'],
    chapters: [['记录哪些数据', '约3分钟'], ['投入品台账示例', '约4分钟'], ['作业效果复查', '约3分钟']]
  },
  {
    id: 'yield-diagnosis', level: 'advanced', order: 1, type: '视频', title: '棉田产量构成与诊断', duration: '1分18秒', minutes: 1,
    teacher: '平台农技组', role: '生产诊断课程', cover: '/images/cotton-seedling-inspection-v1.jpg',
    summary: '从亩株数、单株结铃、铃重和衣分等指标认识产量构成，学习定位限制因素。',
    objectives: ['理解棉花产量构成关系', '开展田间测产抽样', '区分群体、结铃和铃重限制因素'],
    chapters: [['产量构成指标', '10:10'], ['田间测产方法', '11:20'], ['限制因素诊断', '10:30']]
  },
  {
    id: 'fiber-quality', level: 'advanced', order: 2, type: '视频', title: '纤维品质形成与管理', duration: '1分04秒', minutes: 1,
    teacher: '平台农技组', role: '品质管理课程', cover: '/images/course-scouting-v2.webp',
    summary: '认识纤维长度、强度、马克隆值和整齐度，理解品种、环境及田间管理对品质的影响。',
    objectives: ['读懂主要纤维品质指标', '理解品质形成的关键时期', '减少采收和储运环节污染'],
    chapters: [['品质指标怎么读', '08:30'], ['田间管理与品质形成', '09:40'], ['采收储运质量控制', '08:50']]
  },
  {
    id: 'defoliation-harvest', level: 'advanced', order: 3, type: '视频', title: '脱叶催熟与机采衔接', duration: '1分11秒', minutes: 1,
    teacher: '平台农技组', role: '采收管理课程', cover: '/images/course-water-v2.webp',
    summary: '结合吐絮程度、天气条件和机采要求，介绍脱叶前调查、作业核查与采收衔接。',
    objectives: ['开展脱叶前田间调查', '理解天气和植株状态的影响', '掌握机采前质量检查项目'],
    chapters: [['脱叶前成熟度调查', '09:00'], ['天气与作业条件', '09:20'], ['机采前检查', '10:40']]
  },
  {
    id: 'digital-field-data', level: 'advanced', order: 4, type: '视频', title: '用地块数据复盘生产', duration: '57秒', minutes: 1,
    teacher: '平台农技组', role: '数字农业课程', cover: '/images/course-scouting-v2.webp',
    summary: '把天气、灌溉、施肥、植保和产量记录放到同一时间轴上，查找管理效果与异常原因。',
    objectives: ['建立完整地块时间轴', '比较投入与作物表现', '形成下一年度改进清单'],
    chapters: [['整理地块数据', '07:30'], ['建立对比维度', '08:10'], ['完成年度复盘', '08:20']]
  },
  {
    id: 'weather-risk-decision', level: 'advanced', order: 5, type: '视频', title: '气象风险与作业决策', duration: '1分07秒', minutes: 1,
    teacher: '平台农技组', role: '风险管理课程', cover: '/images/course-water-v2.webp',
    summary: '学习把高温、大风、降水和强对流预报转化为灌溉、植保、无人机及采收作业安排。',
    objectives: ['读懂常用农业气象指标', '识别不同作业的天气边界', '建立预报更新与现场复核习惯'],
    chapters: [['农业气象信息解读', '08:40'], ['作业窗口判断', '09:10'], ['风险复核与调整', '08:10']]
  },
  {
    id: 'annual-review-template', level: 'advanced', order: 6, type: '图文', title: '棉花生产年度复盘模板', duration: '12分钟', minutes: 12,
    teacher: '平台农技组', role: '配套学习资料', cover: '/images/cotton-seedling-inspection-v1.jpg',
    summary: '从品种、播期、投入、关键作业、灾害、产量和品质七个方面完成年度生产复盘。',
    objectives: ['形成年度投入产出总览', '识别关键管理得失', '制定下一年度改进目标'],
    chapters: [['数据准备', '约4分钟'], ['问题与成效分析', '约4分钟'], ['下一年度行动计划', '约4分钟']]
  }
]

const SERIES = [
  { id:'cotton-foundation', level:'basic', order:1, title:'棉花种植入门', summary:'从生育期认知开始，系统学习品种选择、播前准备、精量播种和苗期管理。', teacher:'平台农技组', cover:'/images/cotton-seedling-inspection-v1.jpg', lessonIds:['cotton-growth-cycle','seed-selection-preparation','precision-sowing','seedling-management'] },
  { id:'field-observation', level:'basic', order:2, title:'田间巡查与基础记录', summary:'掌握规范巡田路线、苗情墒情调查和基础生产记录方法。', teacher:'平台农技组', cover:'/images/course-scouting-v2.webp', lessonIds:['field-scouting-basics','basic-field-checklist'] },
  { id:'water-fertilizer', level:'intermediate', order:1, title:'水肥与群体调控', summary:'围绕膜下滴灌、水肥一体化和株型观察建立中期管理思路。', teacher:'平台农技组', cover:'/images/course-water-v2.webp', lessonIds:['irrigation-principles','fertigation-management','plant-architecture'] },
  { id:'flower-protection', level:'intermediate', order:2, title:'花铃期与植保管理', summary:'学习病虫害调查、花铃期综合管理及投入品作业记录。', teacher:'平台农技组', cover:'/images/cotton-seedling-inspection-v1.jpg', lessonIds:['pest-monitoring','flower-boll-management','midlevel-record-template'] },
  { id:'yield-quality', level:'advanced', order:1, title:'产量与品质诊断', summary:'从产量构成和纤维品质指标出发开展田间诊断。', teacher:'平台农技组', cover:'/images/course-scouting-v2.webp', lessonIds:['yield-diagnosis','fiber-quality'] },
  { id:'harvest-digital', level:'advanced', order:2, title:'采收与数字化复盘', summary:'衔接脱叶机采、气象风险、地块数据分析和年度复盘。', teacher:'平台农技组', cover:'/images/course-water-v2.webp', lessonIds:['defoliation-harvest','digital-field-data','weather-risk-decision','annual-review-template'] }
]

SERIES.forEach(series => series.lessonIds.forEach((id, index) => {
  const course = COURSES.find(item => item.id === id)
  if (course) Object.assign(course, { seriesKey: series.id, seriesTitle: series.title, lessonNo: index + 1 })
}))

const getLevel = key => LEVELS.find(item => item.key === key) || LEVELS[0]
const getCourse = id => COURSES.find(item => item.id === id) || COURSES[0]
const getSeries = id => SERIES.find(item => item.id === id) || SERIES[0]
const getSeriesLessons = id => {
  const series = getSeries(id)
  return series.lessonIds.map(courseId => getCourse(courseId)).filter(Boolean)
}

module.exports = { LEVELS, SERIES, COURSES, getLevel, getCourse, getSeries, getSeriesLessons }
