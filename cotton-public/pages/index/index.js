const auth = require('../../utils/auth')

Page({
  data: {
    userName: '棉农朋友',
    news: [
      { id: 1, tag: '政策解读', title: '棉花生产支持政策要点，一文读懂', source: '农业资讯中心', image: '/images/cotton-seedling-inspection-v1.jpg' },
      { id: 2, tag: '农技指导', title: '高温天气来临，花铃期水肥管理这样做', source: '农技专家组', image: '/images/course-water-v2.webp' }
    ]
  },

  onShow() {
    const user = auth.getUser && auth.getUser()
    if (user) this.setData({ userName: user.real_name || user.phone || '棉农朋友' })
  },

  openModule(e) {
    const key = e.currentTarget.dataset.key
    const routes = {
      fields: '/pages/fields/index', pest: '/pages/pest/index', weather: '/pages/weather/index',
      expert: '/pages/expert/index', records: '/pages/records/index'
    }
    if (key === 'academy') return wx.switchTab({ url: '/pages/academy/index' })
    if (routes[key]) wx.navigateTo({ url: routes[key] })
  },

  openNews() { wx.navigateTo({ url: '/pages/news/index' }) },
  openPolicy(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: id ? `/pages/policy/detail?id=${id}` : '/pages/policy/index' })
  },
  openAi() { wx.navigateTo({ url: '/pages/ai/index' }) }
})
