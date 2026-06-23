// pages/machine/index.js — 农机租赁列表（后端 API + 真实定位 + 地区筛选）
const app  = getApp()
const auth = require('../../utils/auth')

const CATEGORIES = ['全部', '打药机', '采棉机', '播种机', '旋耕机', '其他']
const SORTS = [
  { key: 'recommend', label: '推荐' },
  { key: 'distance',  label: '距离' },
  { key: 'price',     label: '价格' },
  { key: 'rating',    label: '评分' }
]

// 喀什地区各县市中心坐标（用于地区筛选 + 自动定位就近匹配）
const REGIONS = [
  { name: '喀什市',        lat: 39.4677, lng: 75.9938 },
  { name: '疏附县',        lat: 39.3800, lng: 75.8600 },
  { name: '疏勒县',        lat: 39.4080, lng: 76.0540 },
  { name: '英吉沙县',      lat: 38.9300, lng: 76.1750 },
  { name: '岳普湖县',      lat: 39.2360, lng: 76.7720 },
  { name: '伽师县',        lat: 39.4900, lng: 76.7240 },
  { name: '麦盖提县',      lat: 38.9070, lng: 77.6420 },
  { name: '莎车县',        lat: 38.4160, lng: 77.2400 },
  { name: '泽普县',        lat: 38.1900, lng: 77.2600 },
  { name: '叶城县',        lat: 37.8830, lng: 77.4160 },
  { name: '巴楚县',        lat: 39.7850, lng: 78.5490 },
  { name: '塔什库尔干',    lat: 37.7780, lng: 75.2300 }
]

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function nearestRegion(lat, lng) {
  let best = REGIONS[0], min = Infinity
  REGIONS.forEach(r => {
    const d = haversine(lat, lng, r.lat, r.lng)
    if (d < min) { min = d; best = r }
  })
  return best
}

Page({
  data: {
    statusBarHeight: 20,
    categories: CATEGORIES,
    sorts: SORTS,
    regions: REGIONS,
    catSel: '全部',
    sortSel: 'recommend',
    machines: [],
    loading: true,
    locName: '定位中…',
    locByGps: false,      // true=当前定位 false=手动选区
    showRegionPicker: false,
    lat: null,
    lng: null
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.autoLocate()
  },

  // 自动定位 → 就近匹配县名
  autoLocate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const near = nearestRegion(res.latitude, res.longitude)
        this.setData({
          lat: res.latitude, lng: res.longitude,
          locByGps: true, locName: `${near.name}附近`
        })
        this.loadMachines()
      },
      fail: () => {
        // 定位失败 → 默认用喀什市，提示可手动选
        const def = REGIONS[0]
        this.setData({
          lat: def.lat, lng: def.lng,
          locByGps: false, locName: def.name
        })
        this.loadMachines()
      }
    })
  },

  onOpenRegion() { this.setData({ showRegionPicker: true }) },
  onCloseRegion() { this.setData({ showRegionPicker: false }) },

  // 选择「使用当前定位」
  onUseGps() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const near = nearestRegion(res.latitude, res.longitude)
        this.setData({
          lat: res.latitude, lng: res.longitude,
          locByGps: true, locName: `${near.name}附近`,
          showRegionPicker: false
        })
        this.loadMachines()
      },
      fail: () => {
        wx.showModal({
          title: '需要定位权限',
          content: '开启定位后可显示您的当前位置并按距离查找。请在设置中允许位置权限。',
          confirmText: '去设置',
          success: (r) => { if (r.confirm) wx.openSetting() }
        })
      }
    })
  },

  // 手动选择某个地区
  onPickRegion(e) {
    const idx = Number(e.currentTarget.dataset.index)
    const r = REGIONS[idx]
    this.setData({
      lat: r.lat, lng: r.lng,
      locByGps: false, locName: r.name,
      showRegionPicker: false
    })
    this.loadMachines()
  },

  async loadMachines() {
    this.setData({ loading: true })
    const { lat, lng, catSel, sortSel } = this.data
    let qs = `?sort=${sortSel}`
    if (lat && lng) qs += `&lat=${lat}&lng=${lng}`
    if (catSel !== '全部') qs += `&category=${encodeURIComponent(catSel)}`
    try {
      const res = await auth.request('GET', '/api/machines' + qs)
      if (res.code === 200) {
        const machines = (res.data || []).map(m => ({
          ...m,
          priceText: Number(m.price).toFixed(m.price % 1 === 0 ? 0 : 1),
          statusText: m.status === 'busy' ? '紧俏' : '可预约',
          distText: m.distance_km != null ? `${m.distance_km}km` : '',
          ratingText: Number(m.rating_avg).toFixed(1)
        }))
        this.setData({ machines, loading: false })
      } else {
        this.setData({ machines: [], loading: false })
        wx.showToast({ title: res.msg || '加载失败', icon: 'none' })
      }
    } catch (e) {
      this.setData({ machines: [], loading: false })
      wx.showToast({ title: '网络异常，请检查网络', icon: 'none' })
    }
  },

  onCategory(e) {
    const catSel = e.currentTarget.dataset.name
    if (catSel === this.data.catSel) return
    this.setData({ catSel })
    this.loadMachines()
  },

  onSort(e) {
    const sortSel = e.currentTarget.dataset.key
    if (sortSel === this.data.sortSel) return
    this.setData({ sortSel })
    this.loadMachines()
  },

  onMachine(e) {
    const id = e.currentTarget.dataset.id
    const { lat, lng } = this.data
    let url = `/pages/machine/detail?id=${id}`
    if (lat && lng) url += `&lat=${lat}&lng=${lng}`
    wx.navigateTo({ url })
  },

  onMyOrders() {
    wx.navigateTo({ url: '/subpkg-supplies/my-orders/index' })
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  },

  noop() {}
})
