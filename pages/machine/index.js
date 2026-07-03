// pages/machine/index.js — 农机租赁列表
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const { KASHGAR_REGIONS, locateService } = require('../../utils/regions')

const CATEGORIES = ['全部', '打药机', '采棉机', '播种机', '旋耕机', '其他']

Page({
  data: {
    statusBarHeight: 20,
    copy: i18n.getPageCopy('machine'),
    categories: CATEGORIES.map(name => ({ value: name, label: name })),
    sorts: i18n.getPageCopy('machine').sorts,
    regions: KASHGAR_REGIONS,
    selectedRegionIndex: 0,
    catSel: '全部',
    sortSel: 'recommend',
    machines: [],
    loading: true,
    locName: i18n.t('machine', 'locating'),
    locByGps: false,
    outOfService: false,
    showRegionPicker: false,
    lat: null,
    lng: null
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.applyLanguage()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.autoLocate()
  },

  onShow() {
    this.applyLanguage()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.currentLang = lang
    this.textCopy = i18n.getCopy('machine', lang)
    this.setData({
      copy: i18n.getPageCopy('machine', lang),
      categories: CATEGORIES.map((name, index) => ({ value: name, label: this.textCopy.categories[index] || name })),
      sorts: this.textCopy.sorts
    })
  },

  autoLocate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const svc = locateService(res.latitude, res.longitude)
        const regionIndex = KASHGAR_REGIONS.findIndex(item => item.name === svc.name)
        this.setData({
          lat: res.latitude,
          lng: res.longitude,
          locByGps: true,
          locName: `${svc.name}附近`,
          selectedRegionIndex: regionIndex >= 0 ? regionIndex : 0,
          outOfService: !svc.inService
        })
        this.loadMachines()
      },
      fail: () => {
        const def = KASHGAR_REGIONS[0]
        this.setData({
          lat: def.lat,
          lng: def.lng,
          locByGps: false,
          locName: def.name,
          selectedRegionIndex: 0,
          outOfService: false
        })
        this.loadMachines()
      }
    })
  },

  onOpenRegion() {
    this.setData({ showRegionPicker: true })
  },

  onCloseRegion() {
    this.setData({ showRegionPicker: false })
  },

  onUseGps() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const svc = locateService(res.latitude, res.longitude)
        const regionIndex = KASHGAR_REGIONS.findIndex(item => item.name === svc.name)
        this.setData({
          lat: res.latitude,
          lng: res.longitude,
          locByGps: true,
          locName: `${svc.name}附近`,
          selectedRegionIndex: regionIndex >= 0 ? regionIndex : 0,
          outOfService: !svc.inService,
          showRegionPicker: false
        })
        this.loadMachines()
      },
      fail: () => {
        wx.showModal({
          title: this.textCopy.needLocation,
          content: this.textCopy.locationContent,
          confirmText: this.textCopy.openSetting,
          success: (result) => { if (result.confirm) wx.openSetting() }
        })
      }
    })
  },

  onPickRegion(e) {
    const index = Number(e.currentTarget.dataset.index)
    const region = KASHGAR_REGIONS[index]
    if (!region) return
    this.setData({
      lat: region.lat,
      lng: region.lng,
      locByGps: false,
      locName: region.name,
      selectedRegionIndex: index,
      outOfService: false,
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
        const machines = (res.data || []).map(machine => ({
          ...machine,
          priceText: Number(machine.price || 0).toFixed(Number(machine.price || 0) % 1 === 0 ? 0 : 1),
          statusText: machine.status === 'busy' ? this.textCopy.busy : this.textCopy.available,
          distText: machine.distance_km != null ? `${machine.distance_km}km` : '',
          ratingText: Number(machine.rating_avg || 0).toFixed(1)
        }))
        this.setData({ machines, loading: false })
      } else {
        this.setData({ machines: [], loading: false })
        wx.showToast({ title: res.msg || this.textCopy.loadFail, icon: 'none' })
      }
    } catch (error) {
      this.setData({ machines: [], loading: false })
      wx.showToast({ title: this.textCopy.networkFail, icon: 'none' })
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
    wx.navigateTo({ url: '/pages/machine/orders' })
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  },

  noop() {}
})
