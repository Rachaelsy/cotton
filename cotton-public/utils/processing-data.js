// 加工环节说明属于页面固定知识；加工厂主体、坐标及联系方式由后端数据库统一管理。
const SERVICE_CONCEPTS = [
  {
    id: 'ginning', icon: '轧', title: '轧花', subtitle: '从籽棉到皮棉',
    description: '籽棉经过入场检验、清理、轧工和打包形成皮棉。重点关注批次管理、回潮率、含杂率和加工质量。',
    points: ['籽棉接收与称重', '清理、轧工与打包', '加工批次与凭证留存']
  },
  {
    id: 'testing', icon: '检', title: '检测', subtitle: '让质量信息可核验',
    description: '在接收、加工和交付环节记录质量指标，为分级、结算和仓储提供依据。具体检测项目以机构能力和现行标准为准。',
    points: ['回潮率与含杂率', '衣分和加工质量', '批次留样与结果记录']
  },
  {
    id: 'storage', icon: '仓', title: '仓储', subtitle: '分区分批安全保管',
    description: '皮棉按批次、等级和状态分区存放，做好防火、防潮、通风、盘点及出入库记录，减少混批和质量风险。',
    points: ['分区码放与批次标识', '防火防潮与日常巡检', '入库、盘点和出库记录']
  }
]

module.exports = { SERVICE_CONCEPTS }
