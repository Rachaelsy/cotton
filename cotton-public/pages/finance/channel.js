const auth = require('../../utils/auth')
const { getModule, getModuleArticles } = require('../../utils/finance-data')

function getReadStorageKey() {
  const user = auth.getUser && auth.getUser()
  const identity = user && (user.id || user.phone)
  return `cotton_finance_read_${identity || 'guest'}`
}

Page({
  data: { module: {}, articles: [], statusBarHeight: 20 },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.moduleKey = options.key || 'loan'
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.applyContent()
  },

  onShow() { this.applyContent() },

  applyContent() {
    const module = getModule(this.moduleKey)
    const readIds = wx.getStorageSync(getReadStorageKey()) || []
    const readSet = new Set(Array.isArray(readIds) ? readIds : [])
    this.setData({
      module,
      articles: getModuleArticles(this.moduleKey).map(item => ({ ...item, hasRead: readSet.has(item.id) }))
    })
  },

  back() { wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/finance/index' }) }) },
  openArticle(event) { wx.navigateTo({ url: `/pages/finance/detail?id=${event.currentTarget.dataset.id}` }) },
  openPolicyCenter() { wx.navigateTo({ url: '/pages/policy/channel?type=policy' }) },
  showBoundary() { wx.showModal({ title: '服务边界', content: this.data.module.notice, showCancel: false, confirmText: '我知道了' }) },
  onShareAppMessage() { return { title: `优棉金融 · ${this.data.module.title || ''}`, path: `/pages/finance/channel?key=${this.moduleKey}` } }
})
