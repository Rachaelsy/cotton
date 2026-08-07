const { policies } = require('../../utils/policy-data')

Page({
  data: {
    levels: ['全部', '国家', '自治区', '地区', '县级'],
    categories: ['全部', '目标价格', '农机补贴', '农业保险', '品种推广', '绿色生产'],
    activeLevel: '全部', activeCategory: '全部', keyword: '', visible: policies
  },

  onLevel(e) { this.setData({ activeLevel: e.currentTarget.dataset.value }, () => this.filter()) },
  onCategory(e) { this.setData({ activeCategory: e.currentTarget.dataset.value }, () => this.filter()) },
  onSearch(e) { this.setData({ keyword: e.detail.value }, () => this.filter()) },
  clearSearch() { this.setData({ keyword: '' }, () => this.filter()) },
  filter() {
    const { activeLevel, activeCategory, keyword } = this.data
    const query = String(keyword || '').trim().toLowerCase()
    this.setData({
      visible: policies.filter(item => {
        const levelMatch = activeLevel === '全部' || item.level === activeLevel
        const categoryMatch = activeCategory === '全部' || item.category === activeCategory
        const searchMatch = !query || `${item.title}${item.summary}${item.issuer}${item.region}`.toLowerCase().includes(query)
        return levelMatch && categoryMatch && searchMatch
      })
    })
  },
  openDetail(e) { wx.navigateTo({ url: `/pages/policy/detail?id=${e.currentTarget.dataset.id}` }) },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) }) }
})
