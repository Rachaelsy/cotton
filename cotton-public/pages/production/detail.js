const auth = require('../../utils/auth')

function imageUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return url.startsWith('/') ? `${auth.BASE_URL}${url}` : ''
}

function displayDate(value) { return value ? String(value).slice(0, 10) : '未标注' }

function normalize(item) {
  return {
    ...item,
    shortName: item.shortName || item.name,
    statusText: item.verifiedAt ? '公开信息已核验' : '平台已发布',
    capacityText: item.annualCapacityTons == null ? '未公开' : `${Number(item.annualCapacityTons).toLocaleString()} 吨/年`,
    managerText: item.managerName || '未公开', contactText: item.contactPhone || '未公开',
    verifiedAtText: displayDate(item.verifiedAt), services: Array.isArray(item.services) ? item.services : [],
    imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls.map(imageUrl).filter(Boolean) : []
  }
}

function markerOf(factory) {
  return [{ id: Number(factory.id), latitude: Number(factory.latitude), longitude: Number(factory.longitude), title: factory.shortName,
    callout: { content: factory.shortName, display: 'ALWAYS', color: '#173c2f', fontSize: 12, borderRadius: 6, bgColor: '#ffffff', padding: 6 } }]
}

Page({
  data: { statusBarHeight: 20, factory: null, markers: [], loading: true, errorText: '' },
  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.factoryId = Number(options.id)
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.loadFactory()
  },
  async loadFactory() {
    if (!this.factoryId) { this.setData({ loading: false, errorText: '加工厂信息不存在' }); return }
    this.setData({ loading: true, errorText: '' })
    try {
      const res = await auth.request('GET', `/api/processing-factories/${this.factoryId}`)
      if (res.code !== 200) throw new Error(res.msg || '加工厂详情加载失败')
      const factory = normalize(res.data)
      this.setData({ factory, markers: markerOf(factory), loading: false })
    } catch (error) { this.setData({ loading: false, factory: null, markers: [], errorText: error.message || '加工厂详情加载失败' }) }
  },
  retry() { this.loadFactory() },
  previewImage(e) { const current = e.currentTarget.dataset.src; wx.previewImage({ current, urls: this.data.factory.imageUrls }) },
  openLocation() {
    const factory = this.data.factory
    if (!factory) return
    wx.openLocation({ latitude: Number(factory.latitude), longitude: Number(factory.longitude), name: factory.name, address: factory.address, scale: 15, fail: () => wx.showToast({ title: '暂时无法打开地图导航', icon: 'none' }) })
  },
  callFactory() {
    const phone = this.data.factory && this.data.factory.contactPhone
    if (!phone) { wx.showToast({ title: '暂未公开联系电话', icon: 'none' }); return }
    wx.makePhoneCall({ phoneNumber: phone })
  },
  back() { wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/production/index' }) }) }
})
