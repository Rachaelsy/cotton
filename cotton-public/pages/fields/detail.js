// pages/fields/detail.js — 地块详情与数据聚合
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')
const { normalizeCoordinates, calculateCenter } = require('../../utils/plot-geometry')

const IRRIGATION_OPTIONS = ['滴灌', '漫灌', '喷灌', '无']
const SOIL_OPTIONS = ['壤土', '沙壤土', '粘土', '沙土', '盐碱土']
const PLANTING_OPTIONS = ['已播种', '计划播种', '未播种']

function optionIndex(options, value) {
  const index = options.indexOf(value)
  return index >= 0 ? index : 0
}

function dateText(value, copy, lang) {
  if (!value) return copy.notFilled
  const raw = String(value).slice(0, 10)
  if (lang === 'ug') return raw
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  return `${Number(parts[0])}${copy.year}${Number(parts[1])}${copy.month}${Number(parts[2])}${copy.day}`
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function parseReferenceImages(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  try {
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch (error) {
    return []
  }
}

function imageDisplayUrl(url) {
  if (!url) return ''
  return String(url).startsWith('http') ? url : `${auth.BASE_URL}${url}`
}

function formatArea(value) {
  const number = finiteNumber(value)
  return number.toFixed(number % 1 === 0 ? 0 : 1)
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    common: i18n.getPageCopy('common'),
    copy: i18n.getPageCopy('fieldDetail'),
    loading: true,
    loadError: '',
    plot: {},
    recentRecords: [],
    recordCount: 0,
    polygons: [],
    mapLat: 39.47,
    mapLng: 75.99,
    isSatellite: false,
    showEdit: false,
    saving: false,
    form: {
      name: '', variety: '', sowDate: '', irrigation: '滴灌',
      soilType: '壤土', plantingStatus: '已播种', note: ''
    },
    irrigationOptions: i18n.getOptionLabels('irrigation'),
    irrigationIndex: 0,
    soilOptions: i18n.getOptionLabels('soil'),
    soilIndex: 0,
    plantingOptions: i18n.getOptionLabels('planting'),
    plantingIndex: 0,
    irrigationLabel: '',
    soilLabel: '',
    plantingLabel: '',
    recordsSubText: '',
    totalRecordsText: ''
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.plotId = Number(options.id)
    this.applyLanguage()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })
    this.loadPlot()
  },

  onShow() {
    const prev = this.currentLang
    this.applyLanguage()
    if (prev && prev !== this.currentLang && this.rawPlot) this.applyPlot(this.rawPlot)
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.currentLang = lang
    this.textCopy = i18n.getCopy('fieldDetail', lang)
    this.setData({
      common: i18n.getPageCopy('common', lang),
      copy: i18n.getPageCopy('fieldDetail', lang),
      irrigationOptions: i18n.getOptionLabels('irrigation', lang),
      soilOptions: i18n.getOptionLabels('soil', lang),
      plantingOptions: i18n.getOptionLabels('planting', lang)
    })
  },

  async loadPlot() {
    if (!this.plotId) {
      this.setData({ loading: false, loadError: this.textCopy.invalidId })
      return
    }
    this.setData({ loading: true, loadError: '' })
    try {
      const res = await auth.request('GET', `/api/plots/${this.plotId}`)
      if (res.code !== 200 || !res.data) throw new Error(res.msg || this.textCopy.loadFailToast)
      this.applyPlot(res.data)
    } catch (error) {
      this.setData({ loading: false, loadError: error.message || this.textCopy.networkFail })
    }
  },

  applyPlot(raw) {
    this.rawPlot = raw
    let parsed = []
    try {
      parsed = Array.isArray(raw.coordinates)
        ? raw.coordinates
        : (raw.coordinates ? JSON.parse(raw.coordinates) : [])
    } catch (error) {}
    const coordinates = normalizeCoordinates(parsed)
    const center = calculateCenter(coordinates)
    const score = Number.isFinite(Number(raw.health_score)) ? Number(raw.health_score) : 100
    const referenceImages = parseReferenceImages(raw.reference_images)
    const plot = {
      ...raw,
      referenceImages,
      referenceImageItems: referenceImages.map(url => ({ url, displayUrl: imageDisplayUrl(url) })),
      health_score: score,
      sowDateText: dateText(raw.sow_date, this.textCopy, this.currentLang),
      areaText: formatArea(raw.area),
      perimeterText: Math.round(finiteNumber(raw.perimeter)),
      planting_status: raw.planting_status || '已播种',
      plantingStatusText: i18n.localizeText(raw.planting_status || '已播种', this.currentLang),
      irrigationText: i18n.localizeText(raw.irrigation || this.textCopy.notFilled, this.currentLang),
      soilTypeText: i18n.localizeText(raw.soil_type || this.textCopy.notFilled, this.currentLang),
      growthLabel: raw.status === 'attention'
        ? (raw.health_issue ? i18n.localizeText(raw.health_issue, this.currentLang) : this.textCopy.needAttention)
        : (score >= 90 ? this.textCopy.growthExcellent : score >= 80 ? this.textCopy.growthGood : this.textCopy.growthNormal)
    }
    const overview = raw.overview || {}
    const recentRecords = (overview.recent_records || []).map(record => ({
      ...record,
      workDateText: dateText(record.work_date, this.textCopy, this.currentLang),
      title: i18n.localizeText(record.title || record.type, this.currentLang),
      typeText: i18n.localizeText(record.type, this.currentLang)
    }))
    const irrigationIndex = optionIndex(IRRIGATION_OPTIONS, raw.irrigation)
    const soilIndex = optionIndex(SOIL_OPTIONS, raw.soil_type || '壤土')
    const plantingIndex = optionIndex(PLANTING_OPTIONS, raw.planting_status || '已播种')
    const irrigationOptions = i18n.getOptionLabels('irrigation', this.currentLang)
    const soilOptions = i18n.getOptionLabels('soil', this.currentLang)
    const plantingOptions = i18n.getOptionLabels('planting', this.currentLang)
    this.setData({
      loading: false,
      loadError: '',
      plot,
      recentRecords,
      recordCount: Number(overview.record_count || 0),
      recordsSubText: this.textCopy.recordsSub(Number(overview.record_count || 0)),
      totalRecordsText: this.textCopy.totalRecords(Number(overview.record_count || 0)),
      polygons: coordinates.length >= 3 ? [{
        points: coordinates,
        strokeWidth: 3,
        strokeColor: '#A46836FF',
        fillColor: '#A4683638'
      }] : [],
      mapLat: center.latitude,
      mapLng: center.longitude,
      form: {
        name: raw.name || '',
        variety: raw.variety || '',
        sowDate: raw.sow_date ? String(raw.sow_date).slice(0, 10) : '',
        irrigation: raw.irrigation || '滴灌',
        soilType: raw.soil_type || '壤土',
        plantingStatus: raw.planting_status || '已播种',
        note: raw.note || ''
      },
      irrigationIndex,
      soilIndex,
      plantingIndex,
      irrigationOptions,
      soilOptions,
      plantingOptions,
      irrigationLabel: irrigationOptions[irrigationIndex],
      soilLabel: soilOptions[soilIndex],
      plantingLabel: plantingOptions[plantingIndex]
    })
  },

  onRetry() { this.loadPlot() },
  noop() {},
  onToggleSatellite() { this.setData({ isSatellite: !this.data.isSatellite }) },
  onEdit() { this.setData({ showEdit: true }) },
  onCloseEdit() { if (!this.data.saving) this.setData({ showEdit: false }) },

  onNameInput(event) { this.setData({ 'form.name': event.detail.value }) },
  onVarietyInput(event) { this.setData({ 'form.variety': event.detail.value }) },
  onSowChange(event) { this.setData({ 'form.sowDate': event.detail.value }) },
  onNoteInput(event) { this.setData({ 'form.note': event.detail.value }) },
  onIrrChange(event) {
    const index = Number(event.detail.value)
    this.setData({ irrigationIndex: index, irrigationLabel: this.data.irrigationOptions[index], 'form.irrigation': IRRIGATION_OPTIONS[index] })
  },
  onSoilChange(event) {
    const index = Number(event.detail.value)
    this.setData({ soilIndex: index, soilLabel: this.data.soilOptions[index], 'form.soilType': SOIL_OPTIONS[index] })
  },
  onPlantingChange(event) {
    const index = Number(event.detail.value)
    this.setData({ plantingIndex: index, plantingLabel: this.data.plantingOptions[index], 'form.plantingStatus': PLANTING_OPTIONS[index] })
  },

  async onSave() {
    const { name, variety, sowDate, irrigation, soilType, plantingStatus, note } = this.data.form
    if (!name.trim()) { wx.showToast({ title: this.textCopy.needName, icon: 'none' }); return }
    if (!variety.trim()) { wx.showToast({ title: this.textCopy.needVariety, icon: 'none' }); return }
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      const res = await auth.request('PUT', `/api/plots/${this.plotId}`, {
        name: name.trim(),
        variety: variety.trim(),
        sow_date: sowDate || null,
        irrigation,
        soil_type: soilType,
        planting_status: plantingStatus,
        reference_images: this.data.plot.referenceImages || [],
        note: note.trim()
      })
      if (res.code !== 200) throw new Error(res.msg || this.textCopy.saveFail)
      wx.showToast({ title: this.textCopy.saved, icon: 'success' })
      this.setData({ showEdit: false })
      await this.loadPlot()
    } catch (error) {
      wx.showToast({ title: error.message || this.textCopy.saveFail, icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  onOpenModule(event) {
    const moduleName = event.currentTarget.dataset.module
    const routes = {
      water: '/pages/water/index',
      fert: '/pages/fert/index',
      weather: '/pages/weather/index',
      records: '/pages/records/index',
      pest: '/pages/pest/index'
    }
    const route = routes[moduleName]
    if (!route) return
    const query = `plotId=${this.plotId}&plotName=${encodeURIComponent(this.data.plot.name || '')}`
    wx.navigateTo({ url: `${route}?${query}` })
  },

  onPreviewReferenceImage(event) {
    const current = event.currentTarget.dataset.url
    const urls = (this.data.plot.referenceImageItems || []).map(item => item.displayUrl)
    if (current && urls.length) wx.previewImage({ current, urls })
  },

  onDelete() {
    wx.showModal({
      title: this.textCopy.deleteModalTitle,
      content: this.textCopy.deleteModalContent(this.data.plot.name),
      confirmText: this.textCopy.deleteConfirm,
      confirmColor: '#C7473A',
      success: result => {
        if (result.confirm) this.confirmDelete()
      }
    })
  },

  async confirmDelete() {
    wx.showLoading({ title: this.textCopy.deleting, mask: true })
    try {
      const res = await auth.request('DELETE', `/api/plots/${this.plotId}`)
      if (res.code !== 200) throw new Error(res.msg || this.textCopy.deleteFail)
      wx.showToast({ title: this.textCopy.deleted, icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (error) {
      wx.showToast({ title: error.message || this.textCopy.deleteFail, icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onBack() { wx.navigateBack() }
})
