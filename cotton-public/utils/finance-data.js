const categories = [
  { key: 'loan', title: '种植贷', icon: '贷', short: '申请条件与材料', tone: 'green', articleId: 'planting-loan-guide' },
  { key: 'insurance', title: '保险科普', icon: '保', short: '保障范围与理赔', tone: 'blue', articleId: 'cotton-insurance-basics' },
  { key: 'insurance-guide', title: '投保指引', icon: '指', short: '投保前后怎么做', tone: 'cyan', articleId: 'insurance-application-guide' },
  { key: 'futures', title: '期货基础', icon: '期', short: '术语、合约与风险', tone: 'purple', articleId: 'futures-first-lesson' },
  { key: 'market', title: '行情简讯', icon: '讯', short: '学会看价格信息', tone: 'orange', articleId: 'market-brief-reading' },
  { key: 'policy', title: '政策解读', icon: '政', short: '金融支农政策', tone: 'gold', articleId: 'finance-policy-guide' }
]

const marketBriefs = [
  { label: '现货观察', title: '报价不能只看一个数字', text: '对比棉花等级、交货地点、含税方式和结算周期，才是同口径价格。' },
  { label: '期货观察', title: '分清合约月份与主力合约', text: '不同月份合约价格并不相同，连续图也不是可直接成交的单一合约。' },
  { label: '风险课堂', title: '基差连接现货与期货', text: '基差会随地区、品质、交割成本和市场供需变化，不代表固定利润。' }
]

const articles = [
  {
    id: 'planting-loan-guide', category: 'loan', categoryName: '种植贷', badge: '融资科普', readMinutes: 6,
    title: '申请棉花种植贷款前，先算清这四笔账',
    summary: '从资金用途、还款来源、融资成本和风险缓冲四个方面，判断贷款是否适合自己的生产计划。',
    heroPoints: ['只通过持牌金融机构咨询', '不向个人账户缴纳手续费', '以正式合同和实际审批结果为准'],
    sections: [
      { title: '种植贷通常解决什么问题', paragraphs: ['种植贷通常用于购买种子、农资、支付机耕机采费用等真实农业生产支出。不同机构会结合种植面积、经营记录、征信、担保方式和还款能力独立审批。'], bullets: ['贷款额度不是补贴，也不是收入', '获批额度、利率和期限因人而异', '任何平台都不能承诺“百分百放款”'] },
      { title: '申请前要算清四笔账', paragraphs: ['第一笔是完整种植成本，第二笔是已有自有资金，第三笔是预计销售回款时间，第四笔是遇到减产或价格波动时的缓冲资金。'], bullets: ['总融资成本：利息及合同约定费用', '现金流：用款时间与回款时间是否匹配', '压力测试：减产、延迟回款时能否还款'] },
      { title: '识别常见融资风险', paragraphs: ['凡是要求先向个人账户转账、索要短信验证码、远程控制手机，或宣称无条件高额度放款的，应立即停止操作并通过机构官方电话核验。'], bullets: ['不出租、出借银行卡和账户', '不替陌生人收款或转账', '不在非官方页面填写身份证和银行卡信息'] }
    ],
    checklist: ['身份证明与实名手机号', '土地承包、流转或合法经营证明', '种植面积、成本预算和农事记录', '银行卡及近期开支、回款资料', '机构要求的其他真实材料'],
    channels: ['当地银行或正规涉农金融机构官方网点', '当地农业农村部门公布的正规融资服务渠道', '机构官方网站、官方 App 或官方客服电话'],
    risk: '贷款需要偿还本金和利息。请根据真实还款能力决策，平台不提供贷款撮合、担保或代办服务。'
  },
  {
    id: 'cotton-insurance-basics', category: 'insurance', categoryName: '保险科普', badge: '保障知识', readMinutes: 5,
    title: '棉花保险保什么：先读懂责任、保额和免赔',
    summary: '用通俗语言认识保障对象、保险责任、保险金额、免赔约定和赔付计算。',
    heroPoints: ['保险不等于保产量或保收入', '保障范围以正式条款为准', '受灾后应及时报案并保留现场'],
    sections: [
      { title: '先看五个核心要素', paragraphs: ['投保前应逐项确认投保地块、种植面积、保险期间、保险责任和保险金额。宣传材料只能帮助理解，最终权利义务以保险单和条款为准。'], bullets: ['保险责任：哪些灾害或损失属于保障范围', '责任免除：哪些情况不承担赔偿责任', '免赔约定：达到什么条件后进入赔付计算'] },
      { title: '保险金额不等于最终赔款', paragraphs: ['最终赔款通常还会受到受损程度、有效保险面积、生育阶段、免赔约定和查勘结果影响。不要把保险金额直接理解为一定能够拿到的赔款。'] },
      { title: '出险后为什么要保护现场', paragraphs: ['及时报案、拍摄带时间和位置的信息、保留受损作物，并配合查勘，有助于保险机构核实损失。未获同意前不宜大面积翻耕或销毁受损作物。'] }
    ],
    checklist: ['核对投保人姓名和联系方式', '核对地块位置、面积与作物品种', '阅读保险责任、责任免除和免赔条款', '确认保险期间和保费承担方式', '保存保单、缴费凭证与服务电话'],
    channels: ['承保机构官方服务网点或客服电话', '村委会、乡镇农业服务机构公布的承保通知', '当地农业农村、财政等部门的政策性农业保险通知'],
    risk: '不同地区、年度和保险产品的条款可能不同。本页仅作一般性科普，不替代保险合同和承保机构说明。'
  },
  {
    id: 'insurance-application-guide', category: 'insurance-guide', categoryName: '投保指引', badge: '办事指引', readMinutes: 4,
    title: '从核对地块到灾后报案：棉花投保流程图',
    summary: '按“投保前—签单时—保障期—出险后”四个阶段整理关键动作。',
    heroPoints: ['先核对承保机构身份', '保单信息有误及时更正', '报案、查勘、理赔全程留存凭证'],
    sections: [
      { title: '投保前', paragraphs: ['关注当地当年度承保通知，确认参保对象、承保区域、截止时间、保费分担和承保机构。'], bullets: ['准备身份和土地经营资料', '核实地块边界及实际种植面积', '询问保险责任和报案时限'] },
      { title: '签单与保障期间', paragraphs: ['拿到保单后逐项核对姓名、证件号、地块、面积和保险期间；发现错误应通过官方渠道申请更正。保障期内保存保单和服务电话。'] },
      { title: '出险与理赔', paragraphs: ['发现灾害后按照保单约定及时报案，说明时间、地点、灾害和受损面积；配合现场查勘并核对查勘记录。'], bullets: ['拍摄受灾全景、近景和地块标识', '不要夸大损失或重复报案', '对处理结果有疑问先向承保机构申请复核'] }
    ],
    checklist: ['当年度正式承保通知', '本人身份和地块经营资料', '准确的地块与面积信息', '保单及缴费凭证', '出险照片、报案号和查勘记录'],
    channels: ['保单载明的报案电话与服务网点', '当地公布的政策性农业保险承保机构', '对服务有争议时，通过监管部门公布的消费者投诉渠道咨询'],
    risk: '不要通过来源不明的二维码缴费，不向个人账户支付保费。投保、报案和理赔要求以当地正式通知和保险合同为准。'
  },
  {
    id: 'futures-first-lesson', category: 'futures', categoryName: '期货基础', badge: '入门必读', readMinutes: 7,
    title: '棉花期货入门：合约、保证金、涨跌和交割',
    summary: '认识期货合约的基本结构以及杠杆交易可能带来的高风险。',
    heroPoints: ['期货不是现货报价单', '保证金交易会放大盈亏', '不鼓励不具备能力的农户直接交易'],
    sections: [
      { title: '什么是期货合约', paragraphs: ['期货合约约定在未来特定时间，按照标准化的质量、数量和交割规则处理标的。棉花期货与当地即时收购价有关联，但两者受到交货地点、品质、时间和成本等不同因素影响。'] },
      { title: '为什么保证金会放大风险', paragraphs: ['期货通常只需缴纳合约价值的一部分作为保证金。价格小幅变动就可能带来相对较大的盈亏，保证金不足还可能需要追加资金或被强制平仓。'], bullets: ['不要把生产生活必需资金用于高风险交易', '不轻信“老师带单”“稳赚策略”和代客理财', '开户前完成适当性评估并充分理解规则'] },
      { title: '套期保值也需要专业能力', paragraphs: ['套期保值的目标是管理价格风险，不是确保额外盈利。数量、月份或方向不匹配，都可能形成新的风险；实际操作应由具备制度、人员和风控能力的经营主体审慎开展。'] }
    ],
    checklist: ['理解合约单位、报价单位和最小变动价位', '理解保证金、每日结算和强制平仓', '理解合约月份、最后交易日和交割规则', '评估自身风险承受能力', '只通过依法设立的期货经营机构了解业务'],
    channels: ['中国证监会及其投资者保护知识栏目', '期货交易所官方网站的投资者教育栏目', '依法设立的期货公司官方网站与营业场所'],
    risk: '期货及衍生品风险较高，可能造成本金损失。本平台不提供开户、荐单、行情喊单、交易或收益预测。'
  },
  {
    id: 'market-brief-reading', category: 'market', categoryName: '行情简讯', badge: '读数方法', readMinutes: 5,
    title: '看懂棉花行情简讯：现货、期货与基差怎么看',
    summary: '建立统一比较口径，避免把不同品质、地区或日期的价格直接相比。',
    heroPoints: ['先确认数据时间和来源', '再确认品质、地区与计价单位', '行情信息不等于买卖建议'],
    sections: [
      { title: '现货报价先看口径', paragraphs: ['阅读现货信息时，应同时查看棉花等级、长度、强力、马克隆值、交货地点、是否含税以及付款方式。同样的数字可能对应完全不同的货物和条件。'] },
      { title: '期货价格要对应具体合约', paragraphs: ['期货代码通常包含品种和合约月份。主力合约会随成交活跃度变化，历史连续图也经过拼接处理，不能脱离具体合约和时间理解。'] },
      { title: '用基差理解两类价格', paragraphs: ['基差通常用于描述特定现货价格与某一期货合约价格之间的差异。运输、仓储、品质、时间和区域供需都会影响基差。'], bullets: ['记录信息发布日期和采集时点', '只比较相同单位和相近品质的报价', '重大经营决策应交叉核验多个权威来源'] }
    ],
    checklist: ['日期和具体时点', '发布机构与原始来源', '品级、地区、单位和含税口径', '对应的期货合约月份', '是否注明仅供参考或存在延迟'],
    channels: ['国家及地方权威棉花市场信息发布渠道', '期货交易所官方网站公开行情', '农业农村主管部门和正规行业机构信息渠道'],
    risk: '本模块当前展示的是行情阅读科普，不提供实时价格。延迟或不完整信息不能作为签约、买卖或投资依据。'
  },
  {
    id: 'finance-policy-guide', category: 'policy', categoryName: '政策解读', badge: '政策课堂', readMinutes: 5,
    title: '金融支农政策怎么看：贴息、担保与保险补贴',
    summary: '分清政策支持、机构审批和个人责任，避免把政策宣传误解为无条件获批。',
    heroPoints: ['政策支持不等于自动获批', '认准文号、发布单位和适用地区', '办理以当年度正式通知为准'],
    sections: [
      { title: '贴息政策', paragraphs: ['贴息通常是对符合条件的贷款利息给予一定支持，可能采取先付后补、按期核算等方式。是否享受、支持比例和期限均以正式政策为准。'] },
      { title: '农业信贷担保', paragraphs: ['担保可以帮助符合条件的农业经营主体改善增信条件，但不等于免审核、免担保费或免还款。贷款机构仍会独立评估经营和还款能力。'] },
      { title: '农业保险保费补贴', paragraphs: ['保费补贴是对符合政策范围的农业保险保费进行分担，不代表所有风险均能赔付。实际保障取决于保险条款、保险期间和查勘定损。'], bullets: ['核验政策名称、文号和发布机关', '核验适用地区、对象和申报期限', '通过政府或机构官方渠道办理'] }
    ],
    checklist: ['政策原文和有效文号', '发布单位与发布日期', '适用地区和支持对象', '办理期限、材料与受理部门', '是否明确资金上限或停止条件'],
    channels: ['国家及当地政府官方网站', '当地农业农村、财政、金融管理等部门', '政策明确指定的正规经办机构'],
    risk: '政策会随年度和地区调整。转述、截图和短视频不能替代正式文件，请在办理前核验最新原文。'
  }
]

const sourceGuides = {
  loan: [
    { title: '国家金融监督管理总局：警惕虚假宣传诱导网络贷款', url: 'https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?docId=1217677&itemId=4100' }
  ],
  insurance: [
    { title: '国家行政法规库：《农业保险条例》', url: 'https://xzfg.moj.gov.cn/front/law/detail?LawID=1167' },
    { title: '国家金融监督管理总局：《农业保险承保理赔管理办法》', url: 'https://www.nfra.gov.cn/cn/view/pages/governmentDetail.html?docId=1039780&generaltype=1&itemId=861' }
  ],
  'insurance-guide': [
    { title: '国家行政法规库：《农业保险条例》', url: 'https://xzfg.moj.gov.cn/front/law/detail?LawID=1167' },
    { title: '财政部：推进农业保险精准投保理赔有关事项', url: 'https://jrs.mof.gov.cn/zhengcefabu/phjr/202412/t20241203_3948798.htm' }
  ],
  futures: [
    { title: '中国证监会：期货投资者教育与风险提示', url: 'https://www.csrc.gov.cn/tianjin/c105377/c1263609/content.shtml' },
    { title: '郑州商品交易所：棉花期货业务细则', url: 'https://www.czce.com.cn/cn/flfg/zcjywgz/pzxz/webinfo/2024/02/1708568084281851.htm' }
  ],
  market: [
    { title: '郑州商品交易所：棉花期货业务细则', url: 'https://www.czce.com.cn/cn/flfg/zcjywgz/pzxz/webinfo/2024/02/1708568084281851.htm' }
  ],
  policy: [
    { title: '中国政府网：政策文件与政务服务', url: 'https://www.gov.cn/' }
  ]
}

function getArticle(id) {
  return articles.find(item => item.id === id) || articles[0]
}

function getArticlesByCategory(category) {
  return category === 'all' ? articles : articles.filter(item => item.category === category)
}

module.exports = { categories, marketBriefs, articles, sourceGuides, getArticle, getArticlesByCategory }
