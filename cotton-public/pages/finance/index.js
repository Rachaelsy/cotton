const auth = require('../../utils/auth')
const { categories, marketBriefs, articles, getArticlesByCategory } = require('../../utils/finance-data')

function getReadStorageKey() {
  const user = auth.getUser && auth.getUser()
  const identity = user && (user.id || user.phone)
  return `cotton_finance_read_${identity || 'guest'}`
}

Page({
  data: {
    categories,
    marketBriefs,
    tabs: [{ key: 'all', title: '全部' }].concat(categories.map(item => ({ key: item.key, title: item.title }))),
    activeCategory: 'all',
    visibleArticles: articles,
    readCount: 0,
    totalCount: articles.length
  },

  onShow() {
    const readIds = wx.getStorageSync(getReadStorageKey()) || []
    const readSet = new Set(Array.isArray(readIds) ? readIds : [])
    this.setData({
      readCount: articles.filter(item => readSet.has(item.id)).length,
      visibleArticles: getArticlesByCategory(this.data.activeCategory).map(item => ({
        ...item,
        hasRead: readSet.has(item.id)
      }))
    })
  },

  back() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },

  showBoundary() {
    wx.showModal({
      title: '服务边界说明',
      content: '棉花金融只提供公益科普和官方入口指引，不提供贷款申请、保险投保、期货开户、交易撮合、荐单或收益承诺。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  chooseCategory(e) {
    const category = e.currentTarget.dataset.key
    this.setData({ activeCategory: category })
    this.onShow()
  },

  openCategory(e) {
    const category = e.currentTarget.dataset.key
    this.setData({ activeCategory: category })
    this.onShow()
    wx.pageScrollTo({ selector: '#finance-articles', duration: 260 })
  },

  openArticle(e) {
    wx.navigateTo({ url: `/pages/finance/detail?id=${e.currentTarget.dataset.id}` })
  },

  openPolicyCenter() {
    wx.navigateTo({ url: '/pages/policy/index' })
  }
})
