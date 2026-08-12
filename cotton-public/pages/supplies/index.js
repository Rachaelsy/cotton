const CATEGORIES = [
  {
    id: 'seed', icon: '种', name: '种子', sub: '品种与质量',
    intro: '棉花种子决定生育期、抗逆性和机采适应性。选种时应以审定区域和当地农业部门主推目录为基础，结合地块积温、水源与盐碱程度判断。',
    types: ['早熟品种', '中早熟品种', '机采适用品种', '抗逆性品种'],
    checks: ['查看品种审定编号和适宜种植区域', '核对生产经营许可证、检疫和质量信息', '结合生育期、株型和机采模式选择', '保留包装、标签、批次和购买凭证'],
    labels: ['品种名称', '审定编号', '纯度净度', '发芽率', '生产批次'],
    caution: '不要仅依据产量宣传选种；跨区域引种、来源不明散装种或标签不完整的种子风险较高。'
  },
  {
    id: 'fertilizer', icon: '肥', name: '肥料', sub: '养分与水肥',
    intro: '棉田施肥应依据土壤检测、目标产量和生育阶段制定方案，关注氮、磷、钾及中微量元素的平衡，避免只看单一含量。',
    types: ['复合肥料', '水溶性肥料', '叶面肥料', '中微量元素肥'],
    checks: ['查看肥料登记、执行标准和养分标识', '核对适用作物、施用方式和生产日期', '滴灌施肥关注溶解性及设备兼容性', '按测土结果和农技方案确定产品与用量'],
    labels: ['总养分', '养分配比', '登记信息', '执行标准', '使用方法'],
    caution: '不同产品浓度和使用方式差异较大，不应套用其他产品用量；避免与不相容投入品随意混配。'
  },
  {
    id: 'pesticide', icon: '药', name: '农药', sub: '登记与安全',
    intro: '农药应根据防治对象、发生程度和棉花生育期选择，优先采用综合防控措施，并严格遵守标签规定的适用范围和安全要求。',
    types: ['杀虫剂', '杀菌剂', '除草剂', '植物生长调节剂'],
    checks: ['核对农药登记证号和棉花适用范围', '确认防治对象、剂型、有效成分及含量', '关注使用方法、安全间隔和中毒急救信息', '通过正规渠道采购并保存完整包装'],
    labels: ['登记证号', '有效成分', '防治对象', '使用方法', '安全间隔'],
    caution: '农药不是普通商品。不得使用禁限用产品或超范围、超剂量用药；施药时应做好人员防护并避免漂移污染。'
  },
  {
    id: 'film', icon: '膜', name: '地膜', sub: '规格与回收',
    intro: '棉田地膜用于保墒增温和抑草，选择时需匹配播种机膜幅、厚度、拉伸性能及当地回收要求，兼顾作业效果与残膜治理。',
    types: ['常规聚乙烯地膜', '加厚高强度地膜', '可回收专用地膜', '合规降解地膜'],
    checks: ['查看产品标准、厚度、宽度和净质量', '确认膜幅与铺膜播种机匹配', '比较拉伸负荷、耐候性和回收性能', '了解当地地膜使用与残膜回收规定'],
    labels: ['执行标准', '公称厚度', '宽度长度', '净质量', '生产日期'],
    caution: '过薄或质量不合格地膜易破碎并增加回收难度。所谓降解产品也应核对标准和适用条件，不能替代规范回收管理。'
  }
]

Page({
  data: {
    statusBarHeight: 20,
    categories: CATEGORIES,
    activeId: CATEGORIES[0].id,
    current: CATEGORIES[0]
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },
  selectCategory(e) {
    const activeId = e.currentTarget.dataset.id
    const current = CATEGORIES.find(item => item.id === activeId) || CATEGORIES[0]
    this.setData({ activeId, current })
  },
  back() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  }
})
