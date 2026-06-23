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

// 全国主要城市/县就近匹配（覆盖全国，喀什细化到县）
const { REGIONS, nearestRegion } = require('../../utils/regions')

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
