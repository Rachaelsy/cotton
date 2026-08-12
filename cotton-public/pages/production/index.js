const auth = require('../../utils/auth')
const { SERVICE_CONCEPTS } = require('../../utils/processing-data')

function imageUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return url.startsWith('/') ? `${auth.BASE_URL}${url}` : ''
}

function normalize(item) {
  return {
    ...item,
    shortName: item.shortName || item.name,
    statusText: item.verifiedAt ? '公开信息已核验' : '平台已发布',
    services: Array.isArray(item.services) ? item.services : [],
    imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls.map(imageUrl).filter(Boolean) : []
  }
}

function markersOf(factories) {
  return factories.map(item => ({
    id: Number(item.id), latitude: Number(item.latitude), longitude: Number(item.longitude), title: item.shortName,
    callout: { content: item.shortName, display: 'ALWAYS', color: '#173c2f', fontSize: 12, borderRadius: 6, bgColor: '#ffffff', padding: 6 }
  }))
}

function mapCenter(factories) {
  if (!factories.length) return { latitude: 39.47, longitude: 75.99 }
  const total = factories.reduce((result, item) => ({ latitude: result.latitude + Number(item.latitude), longitude: result.longitude + Number(item.longitude) }), { latitude: 0, longitude: 0 })
  return { latitude: total.latitude / factories.length, longitude: total.longitude / factories.length }
}

Page({
  data: {
    statusBarHeight: 20, concepts: SERVICE_CONCEPTS, areas: ['全部'], activeArea: '全部', activeView: 'list',
    allFactories: [], factories: [], markers: [], mapLatitude: 39.47, mapLongitude: 75.99, mapScale: 8,
    loading: true, errorText: ''
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.loadFactories()
  },
  async loadFactories() {
    this.setData({ loading: true, errorText: '' })
    try {
      const res = await auth.request('GET', '/api/processing-factories')
      if (res.code !== 200) throw new Error(res.msg || '加工厂信息加载失败')
      const allFactories = (res.data || []).map(normalize)
      this.setData({ allFactories, areas: ['全部', ...new Set(allFactories.map(item => item.county))], loading: false }, () => this.applyArea('全部'))
    } catch (error) {
      this.setData({ loading: false, allFactories: [], factories: [], markers: [], errorText: error.message || '加工厂信息加载失败' })
    }
  },
  applyArea(activeArea) {
    const factories = activeArea === '全部' ? this.data.allFactories : this.data.allFactories.filter(item => item.county === activeArea)
    const center = mapCenter(factories)
    this.setData({ activeArea, factories, markers: markersOf(factories), mapLatitude: center.latitude, mapLongitude: center.longitude, mapScale: factories.length === 1 ? 12 : factories.length ? 10 : 8 })
  },
  showConcept(e) {
    const item = this.data.concepts[e.currentTarget.dataset.index]
    wx.showModal({ title: item.title, content: `${item.description}\n\n${item.points.map((point, index) => `${index + 1}. ${point}`).join('\n')}`, showCancel: false, confirmText: '我知道了' })
  },
  switchView(e) { this.setData({ activeView: e.currentTarget.dataset.view }) },
  selectArea(e) { this.applyArea(e.currentTarget.dataset.area) },
  retry() { this.loadFactories() },
  openFactory(e) { const id = Number(e.currentTarget.dataset.id); if (id) wx.navigateTo({ url: `/pages/production/detail?id=${id}` }) },
  openMarker(e) { const id = Number((e.detail && e.detail.markerId) || e.markerId); if (id) wx.navigateTo({ url: `/pages/production/detail?id=${id}` }) },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) }) }
})
