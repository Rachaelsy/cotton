window.COTTON_SITE_DATA = {
  company: {
    name: '棉知农业服务',
    shortName: '棉知农业',
    phone: '',
    hours: '需求表单全天可填写',
    address: '服务覆盖新疆主要棉区',
    serviceAreas: ['北疆棉区', '南疆棉区', '东疆棉区']
  },

  productCategories: [
    { id: 'all', name: '全部品类' },
    { id: 'seed', name: '棉花种子' },
    { id: 'fertilizer', name: '肥料营养' },
    { id: 'pesticide', name: '植保产品' },
    { id: 'film', name: '农膜材料' },
    { id: 'irrigation', name: '滴灌材料' }
  ],

  products: [
    {
      id: 'early-maturity-cotton-seed',
      name: '机采棉品种选型服务',
      category: 'seed',
      categoryName: '棉花种子',
      visual: 'seed',
      badge: '审定信息核验',
      summary: '根据种植区域、积温、播期与机采方式核对审定品种信息，形成候选品种清单。',
      highlights: ['审定区域', '生育期', '机采性状'],
      service: '提供品种选择、播前准备与合理密植建议。',
      specs: [
        ['产品形态', '包衣棉种'],
        ['建议区域', '新疆早熟棉区'],
        ['核验资料', '审定编号、生产经营许可证'],
        ['批次要求', '标签、发芽率与检验信息']
      ],
      sections: [
        {
          title: '产品定位',
          body: '平台按经营品类展示选型服务，不把通用品类名称当作具体商品。实际供货时必须展示品种名称、审定编号、生产经营许可证、检验结果和批次标签。'
        },
        {
          title: '选种建议',
          body: '选种不能只看单一产量指标。建议同时比较生育期、抗逆性、株型、结铃集中度和当地连续多年示范表现，并根据计划播期保留安全成熟期。'
        }
      ]
    },
    {
      id: 'balanced-cotton-fertilizer',
      name: '棉田基肥配套与测土选型',
      category: 'fertilizer',
      categoryName: '肥料营养',
      visual: 'fertilizer',
      badge: '测土后选型',
      summary: '结合土壤检测、前茬、目标产量和滴灌追肥计划，核对复合肥养分与执行标准。',
      highlights: ['土壤检测', '养分标识', '执行标准'],
      service: '结合地块土壤检测和目标产量提供施肥方案。',
      specs: [
        ['产品形态', '颗粒复合肥'],
        ['适用阶段', '播前基肥'],
        ['供货信息', '以实际库存与批次标签为准'],
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
      name: '苗期滴灌水溶肥选型',
      category: 'fertilizer',
      categoryName: '肥料营养',
      visual: 'nutrition',
      badge: '滴灌适用',
      summary: '面向苗期根系建立和稳健生长的水溶营养方案，适配常见滴灌系统。',
      highlights: ['溶解性核验', '混配检查', '滴灌适配'],
      service: '提供溶解测试、施用节奏和设备冲洗提醒。',
      specs: [
        ['产品形态', '水溶性粉剂'],
        ['适用阶段', '苗期至蕾期前'],
        ['供货信息', '以实际成分与批次标签为准'],
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
      name: '棉田绿色防控产品选型',
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
        ['选型依据', '登记作物、防治对象与当地预警'],
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
      name: '棉田地膜规格选型',
      category: 'film',
      categoryName: '农膜材料',
      visual: 'film',
      badge: '地膜覆盖',
      summary: '适配棉田机械铺膜作业，兼顾铺展性、耐候性和田间覆盖完整度。',
      highlights: ['合规厚度', '机械适配', '残膜回收'],
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
      name: '棉田滴灌带规格选型',
      category: 'irrigation',
      categoryName: '滴灌材料',
      visual: 'irrigation',
      badge: '水肥一体化',
      summary: '根据地块长度、轮灌分区、工作压力和铺设机具核对流量、壁厚与滴头间距。',
      highlights: ['流量核算', '压力匹配', '铺设适配'],
      service: '提供地块分区、工作压力与过滤配置建议。',
      specs: [
        ['产品结构', '按真实供货规格核对'],
        ['常用场景', '棉田水肥一体化'],
        ['工作参数', '按地块方案确认'],
        ['批次要求', '壁厚、流量、间距与检测信息']
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
      name: '滴灌首部过滤系统选型',
      category: 'irrigation',
      categoryName: '滴灌材料',
      visual: 'irrigation',
      badge: '系统配套',
      summary: '依据水源、水质、设计流量与滴头流道核对过滤、施肥和压力监测组件。',
      highlights: ['水质核验', '流量匹配', '维护方案'],
      service: '支持现场接口核对、安装指导和季前检查。',
      specs: [
        ['组件范围', '过滤、压力监测、施肥与连接组件'],
        ['适用水源', '需根据水质检测选型'],
        ['接口规格', '按现有主管确认'],
        ['供货要求', '按设计流量与接口清单核对']
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
      name: '花铃期营养诊断与产品选型',
      category: 'fertilizer',
      categoryName: '肥料营养',
      visual: 'nutrition',
      badge: '花铃期',
      summary: '先区分水分、盐分、根系、病虫害与缺素表现，再按检测和真实标签选择营养产品。',
      highlights: ['按需补充', '滴灌叶喷可选', '避免过量'],
      service: '协助区分缺素、盐害、根系和病害等相似症状。',
      specs: [
        ['产品范围', '符合登记或标准的营养产品'],
        ['适用阶段', '蕾期至花铃期'],
        ['使用方式', '以实际标签为准'],
        ['供货要求', '核对成分、标准、批次与标签']
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

  machineryCategories: [
    { id: 'all', name: '全部服务' },
    { id: 'land', name: '耕整地' },
    { id: 'planting', name: '播种铺膜' },
    { id: 'protection', name: '植保作业' },
    { id: 'harvest', name: '采收作业' },
    { id: 'transport', name: '田间转运' }
  ],

  machinery: [
    {
      id: 'precision-land-preparation',
      name: '棉田耕整地作业服务',
      category: 'land',
      categoryName: '耕整地',
      image: '/assets/business-machinery-v1.jpg',
      imagePosition: '32% center',
      badge: '播前准备',
      stage: '播种前',
      billing: '按亩或按班次核定',
      summary: '围绕残茬处理、土地平整、耕深和墒情条件匹配拖拉机及配套农具，为后续精量播种建立一致作业基础。',
      highlights: ['地块核验', '农具匹配', '作业留痕'],
      service: '根据地块面积、土壤条件、前茬和计划播期确认机具组合、作业窗口与计费口径。',
      specs: [
        ['服务阶段', '秋翻、春耕及播前整地'],
        ['需求信息', '地块位置、面积、土壤与前茬情况'],
        ['履约方式', '区域农机手接单后确认作业窗口'],
        ['质量关注', '耕深、平整度、漏耕与重复作业']
      ],
      sections: [
        {
          title: '服务内容',
          body: '平台展示可组织的耕整地能力，具体拖拉机功率、农具类型和作业遍数由农机手结合地块条件确认，不以页面内容替代现场勘查。'
        },
        {
          title: '履约边界',
          body: '雨雪、土壤过湿、道路通行和跨区域调运都会影响作业时间。接单前需确认地块入口、预计工期和异常天气下的改期方式。'
        }
      ]
    },
    {
      id: 'precision-seeding-mulching',
      name: '精量播种与铺膜作业',
      category: 'planting',
      categoryName: '播种铺膜',
      image: '/assets/business-machinery-v1.jpg',
      imagePosition: '21% center',
      badge: '关键农时',
      stage: '播种期',
      billing: '按亩核定',
      summary: '围绕品种、种植模式、行距、株距和滴灌带配置匹配播种铺膜机组，减少漏播、重播和膜面质量问题。',
      highlights: ['参数复核', '精量播种', '铺膜滴灌协同'],
      service: '接单前核对种子、地膜、滴灌带、地块条件和目标株数，作业中记录关键参数与异常地段。',
      specs: [
        ['服务阶段', '适播期内集中作业'],
        ['需求信息', '地块面积、种植模式、材料规格与计划播期'],
        ['配套材料', '种子、地膜和滴灌带由双方确认'],
        ['质量关注', '播深、株距、覆土、压膜与滴灌带位置']
      ],
      sections: [
        {
          title: '作业准备',
          body: '播种前应完成机具调试和小段试播，核对下种量、播深、覆土、膜边压实与滴灌带位置，再进入连续作业。'
        },
        {
          title: '过程协同',
          body: '平台把农资选型与农机作业信息关联起来，方便在同一需求中核对材料规格、到货时间和农机作业窗口。'
        }
      ]
    },
    {
      id: 'drone-plant-protection',
      name: '植保无人机飞防服务',
      category: 'protection',
      categoryName: '植保作业',
      image: '/assets/business-drone-service-v1.jpg',
      imagePosition: '42% center',
      badge: '适期作业',
      stage: '苗期至花铃期',
      billing: '按亩与作业方案核定',
      summary: '根据防治对象、登记标签、天气和田间障碍物确认飞防窗口，记录作业面积、时间和药液信息。',
      highlights: ['标签核验', '航线规划', '作业记录'],
      service: '支持作业需求登记、区域农机手匹配、地块边界确认和作业结果反馈。',
      specs: [
        ['服务阶段', '按监测结果和防治窗口安排'],
        ['需求信息', '地块边界、作物阶段、防治对象与药液方案'],
        ['作业限制', '大风、高温、降雨及敏感区域需调整或停止'],
        ['质量关注', '漏喷、重喷、飘移风险与作业记录完整性']
      ],
      sections: [
        {
          title: '先判断再作业',
          body: '飞防需求应基于田间监测和防治指标，农药品种、剂量和安全间隔期必须遵循正式标签与属地技术要求。'
        },
        {
          title: '可追溯记录',
          body: '服务过程可记录地块、日期、作业面积和使用方案，为后续田间观察、售后沟通和生产复盘提供依据。'
        }
      ]
    },
    {
      id: 'field-management-machinery',
      name: '中耕与田间管理机具服务',
      category: 'protection',
      categoryName: '植保作业',
      image: '/assets/business-drone-service-v1.jpg',
      imagePosition: '72% center',
      badge: '田间管理',
      stage: '苗期至蕾期',
      billing: '按亩或作业项目核定',
      summary: '根据行距、苗情、土壤条件和管理目标匹配中耕、封土等田间机具，降低压苗和伤根风险。',
      highlights: ['行距匹配', '苗情确认', '作业验收'],
      service: '由农户提供种植模式和地块信息，农机手确认机具通过性、作业深度和适宜窗口。',
      specs: [
        ['服务阶段', '苗期至蕾期适宜窗口'],
        ['需求信息', '种植行距、苗情、墒情与地块障碍'],
        ['履约方式', '作业前确认参数，完成后双方验收'],
        ['质量关注', '伤苗、压苗、漏作与作业深度']
      ],
      sections: [
        {
          title: '机具适配',
          body: '同一类田间作业会因行距、地块平整度和棉株长势产生不同要求，接单前需要确认机具宽度和作业部件配置。'
        },
        {
          title: '异常处理',
          body: '遇到大面积缺苗、土壤板结、田间积水或机具无法安全通过时，应暂停作业并重新确认处理方案。'
        }
      ]
    },
    {
      id: 'cotton-picker-service',
      name: '机采棉采收服务',
      category: 'harvest',
      categoryName: '采收作业',
      image: '/assets/business-machinery-v1.jpg',
      imagePosition: '78% center',
      badge: '采收季',
      stage: '吐絮至采收期',
      billing: '按亩及地块条件核定',
      summary: '围绕脱叶催熟效果、吐絮率、含水率、地块通行和交售安排匹配采棉机及采收窗口。',
      highlights: ['采前评估', '机具调度', '质量反馈'],
      service: '结合地块位置、面积、采收条件和预计交售时间组织区域机具，并记录订单与作业状态。',
      specs: [
        ['服务阶段', '达到机采条件后的集中采收'],
        ['需求信息', '地块位置、面积、品种、脱叶与吐絮情况'],
        ['履约方式', '按区域农时和机具路线协同排期'],
        ['质量关注', '采净率、含杂、落地棉与地块损失']
      ],
      sections: [
        {
          title: '采前评估',
          body: '正式排期前需要确认脱叶、吐絮、棉株含水和地面通行条件。未达到机采要求时，应根据天气和田间情况调整日期。'
        },
        {
          title: '订单履约',
          body: '农机租赁业务支持预约、定金或全款支付、接单、作业进度、尾款、评价和售后等环节，实际支付能力以农机手微信特约商户状态为准。'
        }
      ]
    },
    {
      id: 'field-transport-support',
      name: '棉包田间转运与配套服务',
      category: 'transport',
      categoryName: '田间转运',
      image: '/assets/business-machinery-v1.jpg',
      imagePosition: '55% center',
      badge: '采后衔接',
      stage: '采收后',
      billing: '按距离、工作量与车辆核定',
      summary: '衔接采棉机、田间堆放点和交售安排，提前核对道路、装卸空间、运输距离与安全要求。',
      highlights: ['路线核验', '采运协同', '交接记录'],
      service: '根据地块道路、棉包数量、运输距离和交售计划确认车辆、人员与作业顺序。',
      specs: [
        ['服务阶段', '采收同步或采后集中转运'],
        ['需求信息', '地块入口、棉包数量、目的地与道路条件'],
        ['履约方式', '按车辆、距离和作业量确认服务'],
        ['质量关注', '装卸安全、防火、污染与交接记录']
      ],
      sections: [
        {
          title: '采运协同',
          body: '转运安排应与采棉机路线和交售节奏衔接，避免田间长时间堆放影响后续作业或增加安全风险。'
        },
        {
          title: '安全要求',
          body: '车辆装载、田间通行、防火和交接应符合属地管理要求；不具备安全通行条件时不安排冒险作业。'
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
      source: '农业农村部棉花专家指导组、全国农业技术推广服务中心',
      sourceUrl: 'https://zzys.moa.gov.cn/gzjl/201904/t20190419_6296334.htm',
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
      source: '农业农村部《棉花前期生产技术指导意见》',
      sourceUrl: 'https://zzys.moa.gov.cn/gzjl/201904/t20190419_6296334.htm',
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
      source: '农业农村部棉花生产中后期管理技术指导意见',
      sourceUrl: 'https://zzys.moa.gov.cn/gzdt/202008/t20200828_6351070.htm',
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
      source: '全国农业技术推广服务中心《2025年棉花重大病虫害防控技术方案》',
      sourceUrl: 'https://www.natesc.org.cn/admin/UeditorUploadFiles/file/20250228/6387632541475976564699731.pdf',
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
      source: '农业农村部《2022年棉花中后期生产管理技术指导意见》',
      sourceUrl: 'https://zzys.moa.gov.cn/tzgg/202207/t20220718_6404939.htm',
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
      source: '新疆维吾尔自治区发展和改革委员会采收质量倡议',
      sourceUrl: 'https://xjdrc.xinjiang.gov.cn/xjfgw/c108299/202509/d3838b62dd2f43c2aec8c47523f7ba9b.shtml',
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

  activities: [
    {
      id: 'seedling-field-open-day',
      title: '棉花苗期田间开放日',
      status: '地块征集中',
      date: '根据苗期农时组织',
      location: '根据报名地块与农时确定',
      format: '田间公益服务',
      capacity: '按地块条件分组',
      image: '/assets/cotton-seedling-inspection-v1.jpg',
      summary: '在固定样点完成出苗整齐度、根系、叶色和滴灌运行检查，现场演示如何整理巡田记录。',
      description: '活动面向棉花种植户和农业从业者免费开放。参与者将按小组完成苗情调查，并把观察结果整理成可重复使用的田间检查清单。',
      agenda: ['签到与安全说明', '固定样点调查演示', '分组完成苗情记录', '集中交流与问题整理'],
      notice: '当前征集可开展固定样点调查的合作地块。确定组织单位、日期、安全条件和联系人后，平台再发布正式活动通知。'
    },
    {
      id: 'water-fertilizer-record-workshop',
      title: '滴灌水肥记录公益工作坊',
      status: '资料开放',
      date: '可随时提交学习需求',
      location: '线上图文与直播',
      format: '在线公益资源',
      capacity: '不限人数',
      image: '/assets/course-irrigation-decision-v1.webp',
      summary: '用一张简洁记录表串联灌前判断、首末端检查、施肥时段和灌后复盘。',
      description: '工作坊使用脱敏地块记录，演示如何减少无效字段，让每次灌水记录真正服务于下一轮管理决策。',
      agenda: ['灌水记录常见问题', '首末端压力与湿润深度', '记录模板实操', '在线问题交流'],
      notice: '登记需求后，平台根据农时和集中问题安排线上场次。涉及具体水肥量时，以属地规程、土壤条件和现场判断为准。'
    },
    {
      id: 'pest-scouting-volunteer-day',
      title: '病虫害识别与田间调查志愿服务',
      status: '需求征集中',
      date: '根据病虫发生期组织',
      location: '申请地块或线上协作',
      format: '志愿调查服务',
      capacity: '按问题区域分组',
      image: '/assets/course-scouting-v2.webp',
      summary: '学习规范拍摄、样点调查和问题描述，减少仅凭一张局部照片直接下结论。',
      description: '活动将组织志愿者协助种植户建立病虫害调查记录，重点训练症状分布、叶片正反面和近期管理史的完整表达。',
      agenda: ['常见症状辨识', '规范取样与拍照', '样点调查练习', '专家集中答疑'],
      notice: '现场服务需先核对病虫发生情况、地块许可、天气与人员安全；未确认前不发布具体集合信息。'
    },
    {
      id: 'harvest-quality-public-class',
      title: '机采前质量管理公开课',
      status: '课程筹备',
      date: '采收季前发布',
      location: '线上公开课',
      format: '在线公益资源',
      capacity: '不限人数',
      image: '/assets/course-cotton-products-v1.webp',
      summary: '围绕吐絮成熟、脱叶效果、田间异物控制和批次记录，梳理机采前的准备顺序。',
      description: '公开课从田间一致性出发，解释采收时机、异性纤维控制和地块批次记录之间的关系。',
      agenda: ['机采前成熟度评估', '田间异物控制', '作业与运输衔接', '质量追溯记录'],
      notice: '课程不提供具体药剂和剂量建议，脱叶催熟请遵循属地技术规程和产品标签。'
    }
  ],

  newsCategories: [
    { id: 'all', name: '全部资讯' },
    { id: 'policy', name: '农业政策' },
    { id: 'industry', name: '行业资讯' },
    { id: 'quality', name: '质量与标准' }
  ],

  news: [
    {
      id: 'cotton-target-price-2026-2028',
      title: '2026—2028年新疆棉花目标价格政策发布',
      category: 'policy',
      categoryName: '政策资讯',
      date: '2026-06-26',
      image: '/assets/cotton-field-sky.png',
      summary: '国家发展改革委、财政部明确，2026—2028年新疆棉花目标价格为每吨18600元，固定补贴产量为510万吨。',
      source: '新疆维吾尔自治区财政厅',
      sourceUrl: 'https://czt.xinjiang.gov.cn/xjczt/c115021/202606/fb2c15ac574e4bb588da8f6e8a73b9bb.shtml',
      content: [
        {
          title: '目标价格与补贴产量',
          paragraphs: ['经国务院同意，2026—2028年在新疆继续实施棉花目标价格政策。目标价格保持为每吨18600元，并以固定产量510万吨进行补贴。']
        },
        {
          title: '实施方向',
          bullets: ['保持合理种植规模并优化生产布局', '完善优质棉补贴机制', '规范资金管理与产量统计', '探索完善优质棉质量认定标准']
        },
        {
          title: '农户需要继续关注',
          paragraphs: ['国家通知明确总体政策，具体申报、交售、信息核验和补贴发放流程仍需以自治区及属地后续实施通知为准。']
        }
      ]
    },
    {
      id: 'national-cotton-variety-standard-2025',
      title: '国家级棉花品种审定标准完成2025年修订',
      category: 'policy',
      categoryName: '种业政策',
      date: '2025-12-12',
      image: '/assets/course-lifecycle-v1.webp',
      summary: '修订标准自2025年12月1日起实施，强化棉花品种抗病性、机收适应性、产量与DNA指纹差异要求。',
      source: '农业农村部种业管理司',
      sourceUrl: 'https://zys.moa.gov.cn/gzdt/202512/t20251212_6479674.htm',
      content: [
        {
          title: '提高抗病性要求',
          paragraphs: ['标准提高了枯萎病、黄萎病抗性相关要求，以回应连作条件下病害风险加重的问题。']
        },
        {
          title: '强化机收与产量指标',
          bullets: ['生育期和株型符合机收要求', '关注结铃吐絮与脱叶剂敏感度', '提高区域试验和生产试验增产点率要求', '明确不同纤维品质类型的产量指标']
        },
        {
          title: '选种时如何使用',
          paragraphs: ['审定标准是品种进入国家级审定的重要依据。具体到地块选种，还应核对审定适宜区域、品种说明、当地示范表现与实际播期。']
        }
      ]
    },
    {
      id: 'policy-source-verification',
      title: '涉农政策信息核验指南：从原文到属地实施',
      category: 'policy',
      categoryName: '政策阅读',
      date: '2026-07-28',
      image: '/assets/cotton-seedling-leaf-inspection-v1.jpg',
      summary: '用发布主体、文号、适用区域、执行期限和属地通知五项信息核验补贴与项目申报消息。',
      source: '中国政府网政策栏目与喀什优棉公共服务平台整理',
      sourceUrl: 'https://www.gov.cn/zhengce/',
      content: [
        {
          title: '先找到原始文件',
          paragraphs: ['优先查找中国政府网、部委网站、自治区政府网站或属地正式通知。转发截图只能作为线索，不能替代带有发布主体、日期和完整附件的原文。']
        },
        {
          title: '核对五项关键信息',
          bullets: ['发布主体与文件文号', '适用行政区域', '申报主体和条件', '执行或申报期限', '属地办理渠道和材料要求']
        },
        {
          title: '总体政策不等于办理细则',
          paragraphs: ['国家或自治区文件往往给出总体方向，具体信息采集、交售核验、申报材料和发放时间仍以属地实施通知为准。']
        }
      ]
    },
    {
      id: 'xinjiang-cotton-quality-chain-2026',
      title: '新疆推进棉花从种子到坯布全链条质量管控',
      category: 'quality',
      categoryName: '质量与标准',
      date: '2026-06-08',
      image: '/assets/course-cotton-products-v1.webp',
      summary: '新疆通过标准、计量、认证、检验检测和政策工具协同，推动种植、收购、加工、仓储与检验数据衔接。',
      source: '新疆维吾尔自治区市场监督管理局',
      sourceUrl: 'https://scjgj.xinjiang.gov.cn/xjaic/qjxx/202606/a8c08aa9bf4f46f4a9ecbfb0f0c30bb7.shtml',
      content: [
        {
          title: '全链条协同',
          paragraphs: ['官方信息显示，新疆正在推动种植、收购、加工、专业仓储和检验数据全流程衔接，并以统一品种、统一标准、统一管理稳定源头品质。']
        },
        {
          title: '质量基础设施',
          bullets: ['标准规范库', '计量参数库', '认证项目库', '检验检测机构库', '质量政策工具箱']
        },
        {
          title: '对生产端的意义',
          paragraphs: ['地块、品种、投入品、采收和交售记录越完整，越有利于批次追溯、质量问题定位和后续分级服务。']
        }
      ]
    },
    {
      id: 'xinjiang-cotton-digital-quality-2026',
      title: '数字化追溯助力新疆棉花质量提升',
      category: 'quality',
      categoryName: '质量与标准',
      date: '2026-06-09',
      image: '/assets/course-irrigation-decision-v1.webp',
      summary: '自治区市场监管部门发布棉花质量提升进展，强调质量补贴、数智溯源和闭环监管协同。',
      source: '新疆维吾尔自治区市场监督管理局',
      sourceUrl: 'https://scjgj.xinjiang.gov.cn/xjaic/qjxx/202606/c5cc602b1a644fd397bb9e06ad3c218c.shtml',
      content: [
        {
          title: '质量提升的三条路径',
          paragraphs: ['官方信息将相关工作概括为政策赋能、数字化转型和质量安全闭环监管，目标是推动棉花产业从产量优势走向质量优势。']
        },
        {
          title: '数字记录需要落到批次',
          bullets: ['地块与种植主体信息', '品种和关键投入品批次', '采收与交售时间', '加工、仓储和检验结果']
        }
      ]
    },
    {
      id: 'xinjiang-cotton-output-2025',
      title: '2025年新疆棉花总产首次突破600万吨',
      category: 'industry',
      categoryName: '行业资讯',
      date: '2026-01-08',
      image: '/assets/cotton-field-sky.png',
      summary: '新疆官方发布，2025年棉花生产继续向优势产区集中，并推进机械化、集约化和标准化生产。',
      source: '新疆维吾尔自治区人民政府',
      sourceUrl: 'https://www.xinjiang.gov.cn/xinjiang/gongzuodt/202601/957e6c61b1494f908704744001df38d0.shtml',
      content: [
        {
          title: '生产布局继续优化',
          paragraphs: ['官方信息显示，棉花生产进一步向优势主产县市区和兵团团场集中，并通过高产优质栽培技术路线提升生产组织水平。']
        },
        {
          title: '规模之外更关注质量',
          paragraphs: ['产量数据需要与品种结构、纤维品质、资源利用、机采质量和产业链消化能力一起理解，不能只把总产作为唯一评价指标。']
        }
      ]
    },
    {
      id: 'sustainable-cotton-development-2025',
      title: '新疆棉区持续推进节水节肥与可持续生产',
      category: 'industry',
      categoryName: '行业资讯',
      date: '2025-06-20',
      image: '/assets/knowledge-hero-v2.webp',
      summary: '新疆农业农村部门转载的行业信息显示，可持续棉花项目正在通过智慧化手段推动节水节肥和提质增效。',
      source: '新疆维吾尔自治区农业农村厅',
      sourceUrl: 'https://nynct.xinjiang.gov.cn/xjnynct/c113577/202506/7cace886da754556bf986dbdd0780dd7.shtml',
      content: [
        {
          title: '可持续生产关注什么',
          paragraphs: ['公开信息将科学种植、减少不必要的农药化肥投入、降低环境影响与保持产量品质联系起来。']
        },
        {
          title: '需要可核验的生产记录',
          bullets: ['水肥投入与灌溉记录', '病虫调查与防治依据', '投入品名称和批次', '采收、交售和质量信息']
        }
      ]
    },
    {
      id: 'kashgar-textile-project-2025',
      title: '喀什棉纺项目建设延伸新疆棉花产业链',
      category: 'industry',
      categoryName: '行业资讯',
      date: '2025-09-29',
      image: '/assets/course-cotton-products-v1.webp',
      summary: '新疆财政厅发布项目进展，喀什纺纱项目聚焦中高端纱线生产，进一步连接棉花原料与纺织加工。',
      source: '新疆维吾尔自治区财政厅',
      sourceUrl: 'https://czt.xinjiang.gov.cn/xjczt/c115018/202509/d8b66c3518e0446b8f72eddf44f70399.shtml',
      content: [
        {
          title: '项目定位',
          paragraphs: ['公开信息显示，项目面向中高端普梳、精梳纱生产，目标是提升新疆优质棉在本地的加工转化能力。']
        },
        {
          title: '产业链延伸的关注点',
          paragraphs: ['加工能力扩展也会提高对原棉稳定性、批次一致性、清洁度和可追溯信息的要求，生产端质量管理因此更加重要。']
        }
      ]
    }
  ]
}
