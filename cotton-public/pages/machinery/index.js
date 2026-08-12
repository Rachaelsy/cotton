const WORK_TYPES = [
  {
    id: 'tillage', icon: '耕', name: '耕整地', season: '播前准备',
    intro: '改善耕层结构，完成深松、整地和残膜处理，为精量播种创造稳定的地表条件。',
    machines: ['大马力拖拉机', '深松机', '联合整地机', '残膜回收机'],
    points: ['根据土壤墒情选择作业时机', '检查耕深、平整度和地头转弯区域', '作业前确认地下管线和滴灌设施位置']
  },
  {
    id: 'planting', icon: '播', name: '播种铺膜', season: '春播阶段',
    intro: '一次完成精量播种、铺膜、铺设滴灌带等作业，重点保障播深一致和行距准确。',
    machines: ['精量播种机', '铺膜播种机', '北斗导航终端', '种肥同播装置'],
    points: ['作业前进行排种器和株距校准', '核对品种要求、播深和理论穴数', '及时检查地膜贴合和滴灌带位置']
  },
  {
    id: 'management', icon: '管', name: '田间管理', season: '生育期',
    intro: '覆盖中耕、植保、追肥和田间巡查等作业，强调精准、适时和减少作物损伤。',
    machines: ['中耕机', '自走式喷杆喷雾机', '植保无人机', '水肥施用设备'],
    points: ['根据苗情和天气安排作业窗口', '喷施作业注意风速、漂移和安全间隔', '进入地块前核对作物行距和机具轮距']
  },
  {
    id: 'harvest', icon: '收', name: '采收运输', season: '吐絮采收',
    intro: '完成脱叶后的机械采收、打包和田间转运，重点关注含杂率、损失率和安全衔接。',
    machines: ['箱式采棉机', '打包式采棉机', '棉包搬运设备', '田间运输车辆'],
    points: ['采收前确认脱叶催熟效果和籽棉水分', '检查摘锭、风机、消防和润滑系统', '提前规划棉包堆放及运输路线']
  }
]

const MODELS = [
  { icon: '拖', name: '轮式拖拉机', tag: '基础动力', desc: '为整地、播种、中耕和运输提供牵引动力，应根据机具幅宽、土壤条件和作业负荷匹配功率。', uses: '深松整地 · 播种牵引 · 中耕运输' },
  { icon: '播', name: '精量铺膜播种机', tag: '播种机械', desc: '用于精量排种、覆土、镇压、铺膜及滴灌带铺设，选型时重点关注行距、膜幅和排种器形式。', uses: '精量播种 · 铺膜 · 铺滴灌带' },
  { icon: '植', name: '喷杆植保机械', tag: '田管机械', desc: '用于大面积植保作业，重点比较离地间隙、喷幅、喷头配置和防漂移能力。', uses: '病虫防控 · 叶面喷施 · 化学调控' },
  { icon: '航', name: '植保无人机', tag: '精准作业', desc: '适合特定条件下的低容量施药与巡查，必须由合规人员操作并遵守空域、用药和气象要求。', uses: '飞防作业 · 农情巡查 · 局部处理' },
  { icon: '采', name: '采棉机', tag: '采收机械', desc: '分为箱式和机载打包等形式，选型应结合种植模式、地块规模、运输组织和维修保障能力。', uses: '籽棉采收 · 机载打包 · 棉包卸载' }
]

Page({
  data: {
    statusBarHeight: 20,
    activeView: 'work',
    workTypes: WORK_TYPES,
    models: MODELS,
    activeWork: WORK_TYPES[0].id,
    currentWork: WORK_TYPES[0]
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },
  selectView(e) {
    this.setData({ activeView: e.currentTarget.dataset.view })
  },
  selectWork(e) {
    const activeWork = e.currentTarget.dataset.id
    const currentWork = WORK_TYPES.find(item => item.id === activeWork) || WORK_TYPES[0]
    this.setData({ activeWork, currentWork })
  },
  back() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  }
})
