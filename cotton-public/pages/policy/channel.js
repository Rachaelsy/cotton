const auth = require('../../utils/auth')
const { policies: demoPolicies } = require('../../utils/policy-data')

const CONFIG = {
  policy: { title: '政策中心', sections: ['全部', '国家', '自治区', '地区', '县级'], empty: '暂未找到相关政策' },
  industry: { title: '行业资讯', sections: ['全部', '产业', '农机', '农资', '市场', '气象'], empty: '暂未找到相关行业资讯' }
}

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
    type: '',
    title: '政策资讯',
    sections: ['全部'],
    activeSection: '全部',
    keyword: '',
    all: [],
    visible: [],
    loading: true,
    demoMode: false,
    emptyText: '暂未找到相关资讯'
  },
  onLoad(options) {
    const info = wx.getSystemInfoSync()
    const type = CONFIG[options.type] ? options.type : ''
    const config = CONFIG[type] || { title: '全部资讯', sections: ['全部'], empty: '暂未找到相关资讯' }
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      type,
      title: config.title,
      sections: config.sections,
      activeSection: options.section && config.sections.includes(options.section) ? options.section : '全部',
      keyword: decodeURIComponent(options.q || ''),
      emptyText: config.empty
    })
    this.load()
  },
  async load() {
    this.setData({ loading: true })
    try {
      const query = this.data.type ? `?type=${this.data.type}` : ''
      const res = await auth.request('GET', `/api/policies${query}`)
      if (res.code !== 200) throw new Error(res.msg)
      this.apply((res.data || []).map(normalize), false)
    } catch (_) {
      this.apply(demoPolicies.map(normalize), true)
    }
  },
  apply(list, demoMode) {
    const scoped = this.data.type ? list.filter(item => item.contentType === this.data.type) : list
    this.setData({ all: scoped, demoMode, loading: false }, () => this.filter())
  },
  selectSection(e) {
    this.setData({ activeSection: e.currentTarget.dataset.value }, () => this.filter())
  },
  onInput(e) {
    this.setData({ keyword: e.detail.value }, () => this.filter())
  },
  clear() {
    this.setData({ keyword: '' }, () => this.filter())
  },
  filter() {
    const q = this.data.keyword.trim().toLowerCase()
    const section = this.data.activeSection
    const visible = this.data.all.filter(item => {
      const inSection = section === '全部' || item.section === section
      const searchable = `${item.title}${item.summary || ''}${item.issuer || ''}${item.region || ''}`.toLowerCase()
      return inSection && (!q || searchable.includes(q))
    })
    this.setData({ visible })
  },
  openDetail(e) {
    wx.navigateTo({ url: `/pages/policy/detail?id=${e.currentTarget.dataset.id}` })
  },
  back() {
    wx.navigateBack({ fail: () => wx.navigateTo({ url: '/pages/policy/index' }) })
  }
})
