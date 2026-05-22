Page({
  data: {
    statusBarHeight: 20,
    fromRecognize: false,
    pest: {
      name: '棉蚜',
      icon: '🐛',
      type: '虫害',
      severity: '中度',
      severityColor: '#FF9800',
      treatDays: 3,
      desc: '棉蚜是棉花生产中最主要的害虫之一，以若蚜和成蚜群集于棉株叶片背面、嫩茎、花苞等处，吸食植物汁液，导致棉株生长受阻，叶片卷曲变黄。',
      treatments: [
        {
          n: '化学防治',
          d: '用10%吡虫啉可湿性粉剂1500倍液或3%啶虫脒乳油2000倍液喷雾，重点喷叶片背面和嫩梢，7天后复查。'
        },
        {
          n: '物理防治',
          d: '设置黄板诱杀有翅蚜，每亩放置30-40块。保护利用天敌（草蛉、瓢虫、蚜茧蜂），减少化学农药用量。'
        },
        {
          n: '农业防治',
          d: '合理密植，增强通风透光，避免氮肥过多，选用抗蚜品种，彻底清除田间杂草。'
        }
      ],
      products: [
        { name: '10%吡虫啉可湿性粉剂 500g', price: 45, icon: '🧪' },
        { name: '3%啶虫脒乳油 500ml',        price: 38, icon: '🧪' }
      ]
    },
    severityLevels: [
      { label: '轻度', value: '轻度' },
      { label: '中度', value: '中度' },
      { label: '重度', value: '重度' }
    ]
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight || 20 });

    const fromRecognize = options.from === 'recognize';
    this.setData({ fromRecognize });

    // 实际项目中根据 options.id 从后端或本地数据库查询详情
    // 当前使用静态数据演示
    const id = options.id;
    console.log('pest detail id:', id);
  },

  onBuyProduct(e) {
    const name = e.currentTarget.dataset.name;
    wx.showToast({ title: `已加入购物车：${name}`, icon: 'success', duration: 2000 });
  },

  onShare() {
    wx.showToast({ title: '分享功能开发中', icon: 'none' });
  },

  onBack() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    return {
      title: `棉花病虫害：${this.data.pest.name} 防治指南`,
      path: `/pages/pest/detail?id=1`
    };
  }
});
