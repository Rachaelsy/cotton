const auth = require('../../utils/auth')

const CATEGORIES = [
  { id: '耕整地', icon: '耕' },
  { id: '播种铺膜', icon: '播' },
  { id: '田间管理', icon: '管' },
  { id: '采收运输', icon: '收' }
]

function coverUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${auth.BASE_URL}${url}`
  return ''
}

function normalize(item) {
  return { ...item, coverUrl: coverUrl(item.coverUrl), features: Array.isArray(item.features) ? item.features : [] }
}

Page({
  data: {
    statusBarHeight: 20,
    categories: CATEGORIES,
    activeCategory: CATEGORIES[0].id,
    allProducts: [],
    products: [],
    loading: true,
    errorText: ''
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.loadProducts()
  },
  async loadProducts() {
    this.setData({ loading: true, errorText: '' })
    try {
      const res = await auth.request('GET', '/api/service-products?type=machinery')
      if (res.code !== 200) throw new Error(res.msg || '农机产品加载失败')
      this.setData({ allProducts: (res.data || []).map(normalize), loading: false }, () => this.filter())
    } catch (error) {
      this.setData({ allProducts: [], products: [], loading: false, errorText: error.message || '农机产品加载失败' })
    }
  },
  selectCategory(e) {
    this.setData({ activeCategory: e.currentTarget.dataset.id }, () => this.filter())
  },
  filter() {
    this.setData({ products: this.data.allProducts.filter(item => item.category === this.data.activeCategory) })
  },
  back() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  }
})
