const auth = require('../../utils/auth')
const { categories } = require('../../utils/finance-data')

function getReadStorageKey() {
  const user = auth.getUser && auth.getUser()
  const identity = user && (user.id || user.phone)
  return `cotton_finance_read_${identity || 'guest'}`
}

Page({
  data: {
    categories,
    statusBarHeight: 20,
    readCount: 0,
    totalCount: categories.length
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    const readIds = wx.getStorageSync(getReadStorageKey()) || []
    const readSet = new Set(Array.isArray(readIds) ? readIds : [])
    this.setData({ readCount: categories.filter(item => readSet.has(item.key)).length })
  },

  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) }) },
  openCategory(event) { wx.navigateTo({ url: `/pages/finance/channel?key=${event.currentTarget.dataset.key}` }) },
  showBoundary() {
    wx.showModal({
      title: '服务边界说明',
      content: '优棉金融只提供种植贷、棉花保险、期货基础和金融政策等知识科普与官方入口指引，不展示期货行情，不提供贷款申请、保险销售、期货开户、交易撮合、荐单或收益承诺。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },
  openPolicyCenter() { wx.navigateTo({ url: '/pages/policy/index' }) },
  onShareAppMessage() { return { title: '优棉金融 · 棉农金融知识公共服务', path: '/pages/finance/index' } }
})
