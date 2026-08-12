const PROCESSING = {
  name: '加工服务',
  icon: '加',
  intro: '衔接籽棉交售、轧花加工、仓储与运输等产后服务信息',
  items: [
    { icon: '轧', title: '轧花加工', desc: '了解加工服务范围、质量要求和交接流程' },
    { icon: '仓', title: '仓储服务', desc: '查看储存条件、防潮防火和出入库事项' },
    { icon: '运', title: '运输衔接', desc: '了解装卸、运输预约和交接信息要求' }
  ],
  tips: ['交售前确认水分、杂质和质量要求', '留存称重、交接和结算凭证', '选择具备相应条件的加工与运输服务方']
}

Page({
  data: {
    statusBarHeight: 20,
    service: PROCESSING
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },
  openItem(e) {
    const item = this.data.service.items[e.currentTarget.dataset.index]
    wx.showModal({
      title: item.title,
      content: `${item.desc}\n\n具体服务机构与预约信息将在完成资质核验后接入。`,
      showCancel: false,
      confirmText: '我知道了'
    })
  },
  back() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  }
})
