window.COTTON_SITE_DATA = {
  company: {
    name: '棉知农业服务',
    shortName: '棉知农业',
    phone: '0991-0000000',
    hours: '周一至周六 09:30-19:30',
    address: '新疆乌鲁木齐市（演示地址）',
    serviceAreas: ['北疆棉区', '南疆棉区', '东疆棉区']
  },

  productCategories: [
    { id: 'all', name: '全部产品' },
    { id: 'seed', name: '棉花种子' },
    { id: 'fertilizer', name: '肥料营养' },
    { id: 'pesticide', name: '植保产品' },
    { id: 'film', name: '农膜材料' },
    { id: 'irrigation', name: '滴灌材料' }
  ],

  products: [
    {
      id: 'early-maturity-cotton-seed',
      name: '高密早熟棉种组合',
      category: 'seed',
      categoryName: '棉花种子',
      visual: 'seed',
      badge: '北疆适配',
      summary: '面向新疆早熟棉区的示范品种组合，兼顾集中成熟、整齐度与机采适应性。',
      highlights: ['早熟稳健', '株型紧凑', '适宜机采'],
      service: '提供品种选择、播前准备与合理密植建议。',
      specs: [
        ['产品形态', '包衣棉种'],
        ['建议区域', '新疆早熟棉区'],
        ['包装规格', '按实际批次咨询'],
        ['储存要求', '阴凉、干燥、避光']
      ],
      sections: [
        {
          title: '产品定位',
          body: '本组合用于第一版商品展示，重点表达公司可根据积温、土壤、播期和机采方式协助选择适宜品种。正式销售时应展示真实品种审定编号、生产经营许可证和批次信息。'
        },
        {
          title: '选种建议',
          body: '选种不能只看单一产量指标。建议同时比较生育期、抗逆性、株型、结铃集中度和当地连续多年示范表现，并根据计划播期保留安全成熟期。'
        }
      ]
    },
    {
      id: 'balanced-cotton-fertilizer',
      name: '棉田平衡型复合肥',
      category: 'fertilizer',
      categoryName: '肥料营养',
      visual: 'fertilizer',
      badge: '基肥推荐',
      summary: '用于棉田播前基肥和生育期养分衔接，强调氮磷钾配合与土壤检测。',
      highlights: ['养分均衡', '颗粒均匀', '测土建议'],
      service: '结合地块土壤检测和目标产量提供施肥方案。',
      specs: [
        ['产品形态', '颗粒复合肥'],
        ['适用阶段', '播前基肥'],
        ['包装规格', '40kg/袋（模拟）'],
        ['执行标准', '以正式产品标签为准']
      ],
      sections: [
        {
          title: '使用思路',
          body: '基肥投入应与土壤速效养分、前茬作物、秸秆还田和滴灌追肥计划统筹，避免前期氮肥过量造成旺长。'
        },
        {
          title: '服务说明',
          body: '网站只展示产品类别与服务能力，不提供线上交易。具体配方、用量和价格由服务人员根据地块信息确认。'
        }
      ]
    },
    {
      id: 'seedling-water-soluble-fertilizer',
      name: '苗期滴灌水溶肥',
      category: 'fertilizer',
      categoryName: '肥料营养',
      visual: 'nutrition',
      badge: '滴灌适用',
      summary: '面向苗期根系建立和稳健生长的水溶营养方案，适配常见滴灌系统。',
      highlights: ['溶解性好', '滴灌施用', '苗期管理'],
      service: '提供溶解测试、施用节奏和设备冲洗提醒。',
      specs: [
        ['产品形态', '水溶性粉剂'],
        ['适用阶段', '苗期至蕾期前'],
        ['包装规格', '10kg/袋（模拟）'],
        ['注意事项', '避免与不相容产品混配']
      ],
      sections: [
        {
          title: '管理目标',
          body: '苗期水肥管理以促根、稳长和建立合理群体为主。滴水量和追肥量应随土壤墒情、苗情及天气调整。'
        },
        {
          title: '使用提醒',
          body: '首次混配前应做小范围兼容性试验，施肥结束后使用清水冲洗管路，防止沉淀和堵塞。'
        }
      ]
    },
    {
      id: 'cotton-pest-green-control',
      name: '棉田绿色防控方案包',
      category: 'pesticide',
      categoryName: '植保产品',
      visual: 'pesticide',
      badge: '方案咨询',
      summary: '围绕监测、阈值判断与适期防治组织的植保产品组合，不替代现场诊断。',
      highlights: ['先监测后防治', '轮换用药', '规范施用'],
      service: '支持症状初筛、用药记录和安全间隔期提醒。',
      specs: [
        ['产品类型', '植保方案组合'],
        ['适用对象', '以正式标签登记为准'],
        ['包装规格', '按方案配置'],
        ['安全要求', '严格遵循农药标签']
      ],
      sections: [
        {
          title: '防控原则',
          body: '坚持农业防治、物理防治、生物防治与科学用药结合。达到防治指标后再选择登记作物和防治对象相符的产品。'
        },
        {
          title: '安全提示',
          body: '农药必须按标签使用，佩戴必要防护用品，遵守安全间隔期。网站内容不构成脱离标签的用药处方。'
        }
      ]
    },
    {
      id: 'weather-resistant-mulch-film',
      name: '高强耐候棉田农膜',
      category: 'film',
      categoryName: '农膜材料',
      visual: 'film',
      badge: '地膜覆盖',
      summary: '适配棉田机械铺膜作业，兼顾铺展性、耐候性和田间覆盖完整度。',
      highlights: ['铺展平整', '机械适配', '耐候稳定'],
      service: '根据播种机型、幅宽和种植模式协助确认规格。',
      specs: [
        ['产品材质', '聚乙烯农用薄膜'],
        ['适用作业', '棉田铺膜播种'],
        ['幅宽厚度', '按机型与合规标准选择'],
        ['回收要求', '按属地要求及时回收']
      ],
      sections: [
        {
          title: '规格选择',
          body: '农膜规格要与播种机具、行距配置和铺膜速度匹配，避免过度拉伸、边缘压土不足或接缝不严。'
        },
        {
          title: '生态责任',
          body: '使用后应按当地残膜回收要求及时清理和交售，降低农田残膜累积风险。'
        }
      ]
    },
    {
      id: 'labyrinth-drip-tape',
      name: '迷宫式滴灌带',
      category: 'irrigation',
      categoryName: '滴灌材料',
      visual: 'irrigation',
      badge: '水肥一体化',
      summary: '用于棉田滴灌铺设的常用管带，支持不同流量、壁厚和滴头间距组合。',
      highlights: ['出水均匀', '规格齐全', '铺设便捷'],
      service: '提供地块分区、工作压力与过滤配置建议。',
      specs: [
        ['产品结构', '迷宫流道滴灌带'],
        ['常用场景', '棉田水肥一体化'],
        ['工作参数', '按地块方案确认'],
        ['配套要求', '过滤、施肥与压力控制']
      ],
      sections: [
        {
          title: '系统匹配',
          body: '滴灌带不能单独决定灌水均匀度，还需与首部过滤、主管支管、地块高差、轮灌区长度和工作压力共同设计。'
        },
        {
          title: '运行维护',
          body: '首灌前检查接头和末端，运行期间观察压力与出水，按水质情况安排冲洗，降低堵塞风险。'
        }
      ]
    },
    {
      id: 'drip-filter-set',
      name: '滴灌首部过滤组件',
      category: 'irrigation',
      categoryName: '滴灌材料',
      visual: 'irrigation',
      badge: '系统配套',
      summary: '面向中小地块的过滤、施肥和压力监测组件，帮助提升滴灌系统稳定性。',
      highlights: ['过滤防堵', '压力监测', '便于维护'],
      service: '支持现场接口核对、安装指导和季前检查。',
      specs: [
        ['组件范围', '过滤器、压力表、连接件'],
        ['适用水源', '需根据水质检测选型'],
        ['接口规格', '按现有主管确认'],
        ['维护方式', '定期排污和清洗']
      ],
      sections: [
        {
          title: '选型依据',
          body: '过滤精度与流量应满足滴头流道和轮灌区需求。井水、渠水和沉淀池水的杂质类型不同，选型前建议完成水质与流量核查。'
        },
        {
          title: '季前检查',
          body: '开机前检查密封、压力表、排污口和施肥装置，确认无泄漏后再逐步升压。'
        }
      ]
    },
    {
      id: 'flower-boll-micronutrients',
      name: '花铃期微量元素组合',
      category: 'fertilizer',
      categoryName: '肥料营养',
      visual: 'nutrition',
      badge: '花铃期',
      summary: '结合长势和缺素表现使用的中微量元素补充方案，强调诊断后施用。',
      highlights: ['按需补充', '滴灌叶喷可选', '避免过量'],
      service: '协助区分缺素、盐害、根系和病害等相似症状。',
      specs: [
        ['产品形态', '水溶性营养组合'],
        ['适用阶段', '蕾期至花铃期'],
        ['使用方式', '以实际标签为准'],
        ['诊断要求', '建议结合叶片与土壤分析']
      ],
      sections: [
        {
          title: '按需补充',
          body: '中微量元素不是越多越好。出现叶色、叶形或生长异常时，应先排查水分、盐分、根系和病虫害因素。'
        },
        {
          title: '服务方式',
          body: '用户可提供地块位置、生育期、近期水肥记录和清晰照片，由服务人员整理检查顺序。'
        }
      ]
    }
  ],

  trainingCategories: [
    { id: 'all', name: '全部阶段' },
    { id: 'planting', name: '播种' },
    { id: 'seedling', name: '苗期管理' },
    { id: 'water', name: '水肥管理' },
    { id: 'pest', name: '病虫害防治' },
    { id: 'boll', name: '花铃期管理' },
    { id: 'harvest', name: '采收管理' }
  ],

  training: [
    {
      id: 'planting-field-checklist',
      title: '播种前，把这六项地块条件核对清楚',
      category: 'planting',
      categoryName: '播种',
      image: '/assets/course-lifecycle-v1.webp',
      readTime: '8 分钟',
      summary: '从积温、墒情、地温、整地、种子和机具六个方面建立播前检查清单。',
      lead: '播种质量决定群体起点。与其追求“越早越好”，不如让温度、墒情、种床和机具共同达到适播状态。',
      sections: [
        {
          title: '先判断是否进入适播窗口',
          paragraphs: [
            '连续观察土壤温度和短期天气趋势，避免一次升温就仓促开播。寒潮、大风和降水都会影响出苗速度与整齐度。',
            '不同地块的土质、覆膜方式和灌溉条件不同，播期应结合当地技术指导与品种生育期确定。'
          ]
        },
        {
          title: '播前六项检查',
          bullets: ['品种与计划密度匹配', '种子批次和发芽率信息完整', '种床平整、上虚下实', '土壤墒情适合播种', '铺膜与播种机具完成校准', '未来一周没有明显不利天气']
        },
        {
          title: '作业后及时复核',
          paragraphs: ['每个地块至少检查播深、穴距、覆土、膜面和压边情况，发现偏差立即调整机具，不要等整块作业结束后再处理。']
        }
      ],
      checklist: ['记录播种日期与品种批次', '抽查实际播深和穴距', '保留机具参数与作业人员信息']
    },
    {
      id: 'seedling-uniformity-management',
      title: '苗期管理：先看群体整齐度，再决定水肥',
      category: 'seedling',
      categoryName: '苗期管理',
      image: '/assets/course-seedling-v2.webp',
      readTime: '7 分钟',
      summary: '用缺苗、弱苗、叶色与根系四类观察，避免只凭地表干湿判断苗期滴水。',
      lead: '苗期的核心不是追求叶片快速变大，而是形成均匀、稳健、根系良好的群体。',
      sections: [
        {
          title: '按路线观察，而不是站在地头看',
          paragraphs: ['沿地块对角线或固定样点检查，记录缺苗断垄、大小苗差异、叶色和虫害。边行与中部要分别观察。']
        },
        {
          title: '四个判断顺序',
          bullets: ['先看出苗率和整齐度', '再看土壤根层水分', '检查根系颜色和新根数量', '最后结合天气决定滴水追肥']
        },
        {
          title: '避免过早旺长',
          paragraphs: ['苗期氮肥和水分过多可能形成地上部快长、根系下扎不足的群体。管理目标应是稳苗、促根和缩小大小苗差异。']
        }
      ],
      checklist: ['固定样点每周记录', '异常植株拔取看根', '比较滴头附近与远端苗情']
    },
    {
      id: 'drip-irrigation-decision',
      title: '棉田滴灌决策：把墒情、苗情和天气放在一起',
      category: 'water',
      categoryName: '水肥管理',
      image: '/assets/course-irrigation-decision-v1.webp',
      readTime: '10 分钟',
      summary: '建立“灌前判断—运行检查—灌后复盘”的水肥管理闭环。',
      lead: '滴灌不是按日历重复操作。每次灌水前，都要重新判断根层水分、作物需水和未来天气。',
      sections: [
        {
          title: '灌前判断',
          bullets: ['根层土壤水分是否接近管理下限', '棉株是否出现持续性缺水信号', '未来是否有高温大风或降水', '当前轮灌区压力和过滤系统是否正常']
        },
        {
          title: '运行中检查',
          paragraphs: ['记录首部压力、末端出水和施肥时间。发现局部弱水时先排查过滤、阀门、接头和堵塞，不要直接延长全田灌水。']
        },
        {
          title: '灌后复盘',
          paragraphs: ['灌后在代表性位置检查湿润深度与分布，结合下一次苗情变化调整轮灌时长。长期积累记录比单次经验更可靠。']
        }
      ],
      checklist: ['记录灌水起止时间', '检查首末端压力差', '灌后核对湿润深度']
    },
    {
      id: 'field-scouting-pest-management',
      title: '病虫害防治：先把田间调查做扎实',
      category: 'pest',
      categoryName: '病虫害防治',
      image: '/assets/course-scouting-v2.webp',
      readTime: '9 分钟',
      summary: '从症状分布、虫口密度和防治指标出发，减少凭单张照片直接用药。',
      lead: '相似症状可能来自病害、虫害、药害、缺素或根区问题。准确描述分布规律，是诊断的第一步。',
      sections: [
        {
          title: '先记录空间分布',
          paragraphs: ['异常是零星、成片、沿滴灌带、集中在地头，还是整块普遍发生？分布往往比单片叶子的外观更有诊断价值。']
        },
        {
          title: '规范取样',
          bullets: ['选择正常与异常植株对照', '拍摄整株、叶片正反面和根茎部', '记录近期水肥、用药和天气', '统计代表性样点的虫量或病株率']
        },
        {
          title: '达到指标再防治',
          paragraphs: ['优先使用农业、物理和生物措施。确需用药时，选择登记范围相符的产品并轮换作用机制，严格执行标签剂量和安全间隔期。']
        }
      ],
      checklist: ['照片包含远景和近景', '保留近期管理记录', '用药后按固定样点评估效果']
    },
    {
      id: 'flower-boll-balance',
      title: '花铃期管理：协调营养生长与生殖生长',
      category: 'boll',
      categoryName: '花铃期管理',
      image: '/assets/course-water-v2.webp',
      readTime: '8 分钟',
      summary: '通过株高、果枝、蕾铃和叶色综合判断，保持合理群体结构。',
      lead: '花铃期既要防止早衰，也要避免旺长。单看株高或叶色都不够，需要连续观察群体变化。',
      sections: [
        {
          title: '看变化趋势',
          paragraphs: ['同一批固定样点连续记录株高增长、果枝节位、蕾铃数量和脱落情况，判断群体是在稳健生长、偏旺还是转弱。']
        },
        {
          title: '水肥协同',
          bullets: ['高温期保障供水稳定', '根据长势安排氮肥节奏', '避免一次投入过量', '关注钾素与中微量元素的真实需求']
        },
        {
          title: '保持田间通风透光',
          paragraphs: ['群体过密、顶部生长过快会增加郁闭风险。调控措施应结合品种、密度和当地技术规程，避免机械套用。']
        }
      ],
      checklist: ['固定样株连续记录', '观察蕾铃脱落位置', '比较边行与中部群体差异']
    },
    {
      id: 'machine-harvest-preparation',
      title: '采收前准备：从田间一致性到机采衔接',
      category: 'harvest',
      categoryName: '采收管理',
      image: '/assets/course-cotton-products-v1.webp',
      readTime: '9 分钟',
      summary: '围绕吐絮成熟、田间清洁、脱叶催熟和机具协调安排采收。',
      lead: '机采质量不仅取决于采棉机。前期群体整齐度、脱叶效果、田间异物控制和作业时机都会影响最终品质。',
      sections: [
        {
          title: '评估成熟与一致性',
          paragraphs: ['分区域记录吐絮率、顶部棉铃成熟度和群体差异，避免只在地头观察后决定整块地作业。']
        },
        {
          title: '采前管理重点',
          bullets: ['清理地膜、滴灌带等潜在异物', '根据当地规程安排脱叶催熟', '提前沟通采棉机与运输车辆', '关注风、雨和空气湿度变化']
        },
        {
          title: '品质意识',
          paragraphs: ['从田间到堆放运输全过程控制异性纤维和污染，按批次保留地块、品种、采收日期等追溯信息。']
        }
      ],
      checklist: ['分区评估吐絮与脱叶效果', '清理田间异物', '确认机具和运输衔接']
    }
  ],

  newsCategories: [
    { id: 'all', name: '全部资讯' },
    { id: 'policy', name: '农业政策' },
    { id: 'industry', name: '行业资讯' },
    { id: 'company', name: '公司动态' }
  ],

  news: [
    {
      id: 'policy-reading-service',
      title: '农业政策信息如何读：先确认发布主体与适用范围',
      category: 'policy',
      categoryName: '农业政策',
      date: '2026-07-20',
      image: '/assets/cotton-field-sky.png',
      summary: '建立政策信息核验清单，避免将地区性、阶段性内容误解为普遍规则。',
      source: '棉知资料整理',
      content: [
        {
          title: '优先查阅权威来源',
          paragraphs: ['涉及补贴、保险、用水、农资监管和质量标准的信息，应优先核对政府部门官方网站、正式文件及属地通知。短视频和转发截图只能作为线索。']
        },
        {
          title: '确认四项关键信息',
          bullets: ['文件发布主体', '政策适用地区', '申报或执行时间', '对象、条件和材料要求']
        },
        {
          title: '本站说明',
          paragraphs: ['第一版资讯使用模拟内容展示页面结构，不作为政策申报依据。正式运营后将为每条政策标注原始链接、发布日期与适用区域。']
        }
      ]
    },
    {
      id: 'cotton-quality-traceability',
      title: '从地块记录到批次管理，棉花质量追溯正在前移',
      category: 'industry',
      categoryName: '行业资讯',
      date: '2026-07-18',
      image: '/assets/course-cotton-products-v1.webp',
      summary: '品种、用药、采收和交售记录，正在成为连接田间管理与品质评价的重要基础。',
      source: '棉知行业观察',
      content: [
        {
          title: '追溯从田间开始',
          paragraphs: ['地块位置、品种批次、播种日期、水肥与植保记录，可帮助解释不同批次在成熟度、杂质和纤维品质上的差异。']
        },
        {
          title: '记录要可执行',
          bullets: ['字段尽量少而明确', '在作业发生时记录', '关键投入品保留批次', '异常情况同时保存照片']
        },
        {
          title: '服务机会',
          paragraphs: ['农业服务企业可以把产品供应、技术指导与标准化记录结合起来，为农户提供更连续的生产支持。']
        }
      ]
    },
    {
      id: 'summer-field-service',
      title: '公司开展花铃期田间巡查与水肥记录服务',
      category: 'company',
      categoryName: '公司动态',
      date: '2026-07-16',
      image: '/assets/course-water-v2.webp',
      summary: '第一版示例动态：围绕固定样点、滴灌运行和蕾铃变化整理巡田记录。',
      source: '棉知农业服务',
      content: [
        {
          title: '服务内容',
          paragraphs: ['巡查从固定样点开始，记录群体长势、蕾铃、叶色、滴灌首末端和异常区域，并把观察结果整理成下一次管理前的核对清单。']
        },
        {
          title: '不替代属地技术指导',
          paragraphs: ['线上记录与远程沟通用于提高信息完整度。涉及农药使用、重大病害和灾害处置时，应结合现场专业人员意见。']
        }
      ]
    },
    {
      id: 'input-label-compliance',
      title: '购买农资时，标签上的这些信息不能忽略',
      category: 'industry',
      categoryName: '行业资讯',
      date: '2026-07-12',
      image: '/assets/cotton-seedling-inspection-v1.jpg',
      summary: '从登记、标准、有效期、批次和使用范围入手，提升投入品选择的可核验性。',
      source: '棉知行业观察',
      content: [
        {
          title: '购买前核对',
          bullets: ['产品名称与有效成分', '登记或执行标准信息', '生产日期和有效期', '生产企业与追溯批次', '适用作物和使用范围']
        },
        {
          title: '保存购买记录',
          paragraphs: ['保留发票、包装、批次和使用记录。出现质量争议或田间异常时，完整记录能帮助更快定位问题。']
        }
      ]
    },
    {
      id: 'training-content-launch',
      title: '棉花全生育期图文培训专区完成第一版上线',
      category: 'company',
      categoryName: '公司动态',
      date: '2026-07-08',
      image: '/assets/knowledge-hero-v2.webp',
      summary: '从播种到采收设置六个专题，公开提供可复用的观察方法和管理清单。',
      source: '棉知农业服务',
      content: [
        {
          title: '六个专题',
          paragraphs: ['首批内容覆盖播种、苗期管理、水肥管理、病虫害防治、花铃期管理和采收管理，并与互动学堂的评论、问答和 AI 助学能力衔接。']
        },
        {
          title: '持续更新',
          paragraphs: ['正式运营后，内容将按棉区、生育期和问题类型进一步细分，并补充来源、审核人与更新时间。']
        }
      ]
    },
    {
      id: 'water-saving-management',
      title: '棉田节水不只是减少灌次，更需要提高每次灌水质量',
      category: 'industry',
      categoryName: '行业资讯',
      date: '2026-07-03',
      image: '/assets/course-irrigation-decision-v1.webp',
      summary: '通过分区、压力、湿润深度和作物反馈评估灌水效果。',
      source: '棉知行业观察',
      content: [
        {
          title: '关注有效水',
          paragraphs: ['灌水是否进入主要根层、各轮灌区是否均匀、是否出现深层渗漏，比单纯统计灌水次数更能反映管理质量。']
        },
        {
          title: '可记录的指标',
          bullets: ['轮灌区起止时间', '首末端压力', '代表点湿润深度', '灌前灌后苗情', '过滤器排污情况']
        }
      ]
    }
  ]
}
