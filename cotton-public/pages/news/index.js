Page({
  data: {
    tabs: ['推荐', '政策', '农技', '市场', '气象'], active: '推荐',
    articles: [
      { id: 1, category: '政策', tag: '政策解读', title: '棉花目标价格政策重点内容和申报时间说明', source: '农业农村资讯', image: '/images/cotton-seedling-inspection-v1.jpg' },
      { id: 2, category: '农技', tag: '农技指导', title: '高温花铃期如何做好水肥协同管理', source: '优棉农技中心', image: '/images/course-water-v2.webp' },
      { id: 3, category: '农技', tag: '病虫监测', title: '棉铃虫进入关键期，怎样判断防治指标', source: '植保技术中心', image: '/images/course-scouting-v2.webp' },
      { id: 4, category: '气象', tag: '气象服务', title: '未来一周高温少雨，棉田管理注意这些事项', source: '农业气象服务', image: '/images/course-water-v2.webp' },
      { id: 5, category: '市场', tag: '产业动态', title: '新疆棉花产业提质增效的新进展', source: '棉花产业观察', image: '/images/course-scouting-v2.webp' }
    ], visible: []
  },
  onLoad() { this.filter() },
  chooseTab(e) { this.setData({ active: e.currentTarget.dataset.name }, () => this.filter()) },
  filter() { const { active, articles } = this.data; this.setData({ visible: active === '推荐' ? articles : articles.filter(x => x.category === active) }) },
  openArticle(e) { wx.showToast({ title: `资讯详情将在内容后台接入（${e.currentTarget.dataset.id}）`, icon: 'none' }) },
  back() { wx.navigateBack() }
})
