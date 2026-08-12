const auth = require('../../utils/auth')
const { policies: demoPolicies } = require('../../utils/policy-data')

const CHANNELS = {
  policy: {
    name: '政策中心',
    sections: ['国家', '自治区', '地区', '县级'],
    defaultSection: '地区'
  },
  industry: {
    name: '行业资讯',
    sections: ['产业', '农机', '农资', '市场', '气象'],
    defaultSection: '产业'
  }
}

const PRIMARY_TABS = [
  { id: 'policy', name: '政策中心' },
  { id: 'industry', name: '行业资讯' }
]

function coverUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('/images/')) return url
  if (url.startsWith('/')) return `${auth.BASE_URL}${url}`
  return ''
}

function normalize(item) {
  const contentType = item.contentType === 'industry' ? 'industry' : 'policy'
  return {
    ...item,
    contentType,
    section: item.section || (contentType === 'industry' ? item.category : item.level),
    publishDate: String(item.publishDate || '').slice(0, 10),
    isFeatured: item.isFeatured === true || item.isFeatured === 1,
    coverImage: coverUrl(item.coverImage)
  }
}

Page({
  data: {
    statusBarHeight: 20,
    primaryTabs: PRIMARY_TABS,
    activeType: 'policy',
    activeTypeName: CHANNELS.policy.name,
    sections: CHANNELS.policy.sections,
    activeSection: CHANNELS.policy.defaultSection,
    articles: [],
    visible: [],
    loading: true,
    demoMode: false
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.loadArticles()
  },
  async loadArticles() {
    this.setData({ loading: true })
    try {
      const res = await auth.request('GET', '/api/policies')
      if (res.code !== 200) throw new Error(res.msg)
      this.applyArticles((res.data || []).map(normalize), false)
    } catch (_) {
      this.applyArticles(demoPolicies.map(normalize), true)
    }
  },
  applyArticles(articles, demoMode) {
    this.setData({ articles, demoMode, loading: false }, () => this.filter())
  },
  selectType(e) {
    const activeType = e.currentTarget.dataset.id
    const channel = CHANNELS[activeType] || CHANNELS.policy
    this.setData({
      activeType,
      activeTypeName: channel.name,
      sections: channel.sections,
      activeSection: channel.defaultSection
    }, () => this.filter())
  },
  selectSection(e) {
    this.setData({ activeSection: e.currentTarget.dataset.section }, () => this.filter())
  },
  filter() {
    const visible = this.data.articles.filter(item => {
      return item.contentType === this.data.activeType &&
        item.section === this.data.activeSection
    })
    this.setData({ visible })
  },
  openDetail(e) {
    wx.navigateTo({ url: `/pages/policy/detail?id=${e.currentTarget.dataset.id}` })
  },
  back() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  }
})
