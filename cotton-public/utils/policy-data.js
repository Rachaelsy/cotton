const policies = [
  {
    id: 'target-price-guide',
    isFeatured: true, coverImage: '/images/cotton-seedling-inspection-v1.jpg',
    level: '国家', category: '目标价格', status: '申报提醒', statusTone: 'warning',
    title: '棉花目标价格补贴申报指南（示例）',
    summary: '帮助棉农了解申报对象、登记流程、面积核验和常见材料，具体执行以当地正式通知为准。',
    issuer: '示例：农业主管部门', publishDate: '2026-08-05', deadline: '以当地通知为准',
    region: '新疆棉花种植区域', documentNo: '示例文件 · 待接入正式文号',
    applicable: ['依法开展棉花种植的经营主体', '完成种植面积登记与核验的农户', '符合当地年度实施细则的申请人'],
    materials: ['本人有效身份证明', '土地承包或合法经营证明', '棉花种植面积登记材料', '本人银行卡或指定结算账户'],
    steps: ['关注县级正式申报通知', '按要求完成种植面积登记', '配合乡镇和村级核验公示', '核对补贴信息及结算账户'],
    paragraphs: [
      '本页面用于展示政策服务产品形态。正式运营时，应由内容管理员录入政策原文、文号、发布单位、生效时间和官方来源链接。',
      '不同县市的申报时间、核验方式和材料可能不同，用户需要以所在地政府及农业主管部门发布的正式文件为准。'
    ]
  },
  {
    id: 'machine-subsidy',
    coverImage: '/images/course-scouting-v2.webp',
    level: '自治区', category: '农机补贴', status: '办理指南', statusTone: 'green',
    title: '棉花生产农机购置与应用补贴办理提醒（示例）',
    summary: '梳理采棉机、播种机和植保设备补贴查询、申请、核验与兑付的基本步骤。',
    issuer: '示例：自治区农业农村主管部门', publishDate: '2026-08-02', deadline: '分批办理',
    region: '新疆维吾尔自治区', documentNo: '示例文件 · 待接入正式文号',
    applicable: ['从事农业生产的个人和经营组织', '购置列入当期补贴范围的农业机械'],
    materials: ['申请人身份证明', '购机发票及机具信息', '银行卡信息', '当地要求的其他核验材料'],
    steps: ['查询补贴机具目录', '购置符合要求的机具', '通过当地渠道提交申请', '完成机具核验并等待兑付'],
    paragraphs: ['补贴范围、补贴额度和办理批次可能调整，购买设备前应先查询当期正式补贴目录。']
  },
  {
    id: 'cotton-insurance',
    level: '地区', category: '农业保险', status: '政策解读', statusTone: 'blue',
    title: '棉花政策性农业保险参保与理赔事项说明（示例）',
    summary: '集中说明参保对象、保障范围、灾后报案、现场查勘和理赔材料。',
    issuer: '示例：地区农业保险服务部门', publishDate: '2026-07-28', deadline: '按承保周期办理',
    region: '喀什地区', documentNo: '示例文件 · 待接入正式文号',
    applicable: ['当地棉花种植农户', '符合承保机构和地方政策规定的经营主体'],
    materials: ['投保凭证', '身份证明', '受灾地块及损失照片', '承保机构要求的查勘材料'],
    steps: ['确认投保地块与面积', '发生灾害后及时报案', '保护现场并配合查勘', '提交材料并跟踪理赔进度'],
    paragraphs: ['保险责任、免赔条件和赔付标准以正式保险条款及当地政策为准。']
  },
  {
    id: 'county-seed-guide',
    level: '县级', category: '品种推广', status: '长期有效', statusTone: 'neutral',
    title: '县域棉花主推品种与良种应用指引（示例）',
    summary: '按积温、土壤、水源和机采条件介绍县域品种选择的基本原则。',
    issuer: '示例：县农业技术推广部门', publishDate: '2026-07-20', deadline: '长期参考',
    region: '示例县域', documentNo: '示例文件 · 待接入正式文号',
    applicable: ['计划更新棉花品种的种植户', '需要开展品种对比试验的合作社'],
    materials: ['地块基本信息', '土壤与水源条件', '往年品种和产量记录'],
    steps: ['查看当地主推品种目录', '核对地块积温和生育期', '比较抗逆性和机采适应性', '咨询当地农技人员后确定'],
    paragraphs: ['品种选择应结合审定区域、当地积温、盐碱程度和生产管理能力，不应只依据单一产量指标。']
  },
  {
    id: 'water-saving',
    level: '自治区', category: '绿色生产', status: '政策解读', statusTone: 'green',
    title: '棉田节水增效与绿色生产支持方向（示例）',
    summary: '介绍高效节水、水肥一体化和农业投入品减量等支持方向。',
    issuer: '示例：自治区相关主管部门', publishDate: '2026-07-15', deadline: '以项目通知为准',
    region: '新疆维吾尔自治区', documentNo: '示例文件 · 待接入正式文号',
    applicable: ['实施高效节水改造的经营主体', '开展绿色生产示范的合作社和农户'],
    materials: ['项目申请材料', '地块与灌溉设施资料', '投资或建设方案'],
    steps: ['关注当地项目申报', '核对支持范围和建设标准', '准备项目资料', '接受项目验收与绩效评价'],
    paragraphs: ['具体支持方式可能包括项目建设、技术服务或示范推广，应以正式项目指南为准。']
  },
  {
    id: 'industry-chain-update', contentType: 'industry', level: '行业资讯', category: '产业', status: '产业观察', statusTone: 'green',
    isFeatured: true, coverImage: '/images/cotton-seedling-inspection-v1.jpg',
    title: '喀什棉花产业链生产服务观察（示例）',
    summary: '关注从种植管理、采收到加工流通的产业协同与服务变化。',
    issuer: '示例：平台资讯编辑部', publishDate: '2026-08-09', deadline: '', region: '喀什地区', documentNo: '',
    paragraphs: ['本栏目用于汇集棉花产业发展信息。正式内容应注明来源、发布时间，并区分事实信息与分析判断。']
  },
  {
    id: 'industry-machine-season', contentType: 'industry', level: '行业资讯', category: '农机', status: '农机动态', statusTone: 'blue',
    title: '采棉季农机检修与服务信息提示（示例）',
    summary: '整理采棉机、打包设备和运输衔接的季前检查重点。',
    issuer: '示例：农机服务信息', publishDate: '2026-08-08', deadline: '', region: '喀什地区', documentNo: '',
    paragraphs: ['设备作业前应由专业人员完成检查，具体维护要求以设备说明书和服务机构意见为准。']
  },
  {
    id: 'industry-market-brief', contentType: 'industry', level: '行业资讯', category: '市场', status: '市场简讯', statusTone: 'warning',
    title: '棉花市场信息阅读要点（示例）',
    summary: '帮助农户区分现货价格、期货价格和加工企业报价等不同市场口径。',
    issuer: '示例：市场信息整理', publishDate: '2026-08-07', deadline: '', region: '全国', documentNo: '',
    paragraphs: ['市场信息具有时效性，本栏目不构成交易建议，实际价格以交易双方确认和权威渠道发布为准。']
  },
  {
    id: 'industry-inputs-safety', contentType: 'industry', level: '行业资讯', category: '农资', status: '农资提示', statusTone: 'green',
    title: '棉田农资选购与安全使用提示（示例）',
    summary: '介绍种子、肥料和植保产品选购时需要核对的登记信息、使用说明与保存要求。',
    issuer: '示例：农业生产服务信息', publishDate: '2026-08-08', deadline: '', region: '喀什地区', documentNo: '',
    paragraphs: ['农资产品应通过正规渠道购买，使用前核对标签、登记信息和适用范围，并严格按照产品说明和农技人员指导操作。']
  },
  {
    id: 'industry-weather-watch', contentType: 'industry', level: '行业资讯', category: '气象', status: '气象关注', statusTone: 'neutral',
    coverImage: '/images/course-water-v2.webp',
    title: '高温天气对棉田管理的影响提示（示例）',
    summary: '关注阶段性高温对蕾铃期水肥管理和田间作业安排的影响。',
    issuer: '示例：农业气象信息', publishDate: '2026-08-06', deadline: '', region: '新疆棉区', documentNo: '',
    paragraphs: ['气象资讯用于趋势参考，短临预警和作业安排请以当地气象部门最新信息为准。']
  }
]

function getPolicy(id) {
  return policies.find(item => item.id === id) || policies[0]
}

module.exports = { policies, getPolicy }
