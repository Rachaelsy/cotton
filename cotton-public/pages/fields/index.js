// pages/fields/index.js — 地块管理列表
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')
const { normalizeCoordinates, calculateCenter } = require('../../utils/plot-geometry')

const STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '需要关注', value: 'attention' },
  { label: '正常种植', value: 'normal' }
]

const AREA_OPTIONS = [
  { label: '全部面积', min: 0, max: Infinity },
  { label: '50亩以下', min: 0, max: 50 },
  { label: '50–100亩', min: 50, max: 100 },
  { label: '100亩以上', min: 100, max: Infinity }
]

function parseCoordinates(value) {
  if (Array.isArray(value)) return normalizeCoordinates(value)
  try {
    return normalizeCoordinates(value ? JSON.parse(value) : [])
  } catch (error) {
    return []
  }
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

function formatDate(value, lang = i18n.getLanguage(), copy = i18n.getCopy('fields', lang)) {
  if (!value) return ''
  const raw = String(value)
  const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (match) {
    const month = Number(match[2])
    const day = Number(match[3])
    return lang === 'ug' ? `${month}-${day} ${copy.updated}` : `${month}月${day}日更新`
  }
  const date = new Date(raw.replace(/-/g, '/'))
  if (Number.isNaN(date.getTime())) return ''
  const month = date.getMonth() + 1
  const day = date.getDate()
  return lang === 'ug' ? `${month}-${day} ${copy.updated}` : `${month}月${day}日更新`
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    lang: 'zh',
    common: i18n.getCopy('common'),
    copy: i18n.getPageCopy('fields'),
    loading: true,
    refreshing: false,
    loadError: '',
    totalCount: 0,
    totalArea: '0',
    attentionCount: 0,
    allFields: [],
    warnFields: [],
    okFields: [],
    keyword: '',
    statusOptions: i18n.getCopy('fields').statusOptions,
    statusIndex: 0,
    areaOptions: i18n.getCopy('fields').areaOptions,
    areaIndex: 0,
    resultCount: 0,
    hasActiveFilter: false,
    manageMode: false,
    selectedIds: [],
    allVisibleSelected: false,
    batchActionText: i18n.getCopy('fields').selectPlot
  },

  textCopy: i18n.getCopy('fields'),

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })
    this.applyLanguage()
  },

  onShow() {
    this.applyLanguage()
    this.loadPlots()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    const copy = i18n.getCopy('fields', lang)
    this.textCopy = copy
    this.setData({
      lang,
      common: i18n.getCopy('common', lang),
      copy: i18n.getPageCopy('fields', lang),
      statusOptions: copy.statusOptions,
      areaOptions: copy.areaOptions,
      batchActionText: this.buildBatchActionText(this.data.selectedIds, copy)
    })
  },

  buildBatchActionText(ids = this.data.selectedIds, copy = this.textCopy) {
    return ids.length ? copy.deleteSelected(ids.length) : copy.selectPlot
  },

  async loadPlots({ silent = false } = {}) {
    if (!silent) this.setData({ loading: true, loadError: '' })
    try {
      const res = await auth.request('GET', '/api/plots')
      if (res.code !== 200 || !Array.isArray(res.data)) {
        throw new Error(res.msg || this.data.copy.loadFail)
      }
      const plots = res.data.map(plot => this.formatPlot(plot))
      const totalArea = plots.reduce((sum, plot) => sum + plot.areaNumber, 0)
      this.setData({
        loading: false,
        refreshing: false,
        loadError: '',
        allFields: plots,
        totalCount: plots.length,
        totalArea: totalArea.toFixed(totalArea >= 100 ? 0 : 1),
        attentionCount: plots.filter(plot => plot.status === 'attention').length,
        selectedIds: [],
        batchActionText: this.buildBatchActionText([])
      })
      this.applyFilters()
    } catch (error) {
      this.setData({
        loading: false,
        refreshing: false,
        loadError: error.message || this.data.copy.loadFail
      })
    }
  },

  formatPlot(plot) {
    const score = Number.isFinite(Number(plot.health_score)) ? Number(plot.health_score) : 100
    const areaNumber = finiteNumber(plot.area)
    let scoreCls = 'excel'
    if (score < 75) scoreCls = 'warn'
    else if (score < 88) scoreCls = 'good'

    let tagText = this.textCopy.growthNormal || i18n.localizeText('长势正常', this.data.lang)
    if (plot.status === 'attention') tagText = plot.health_issue ? i18n.localizeText(plot.health_issue, this.data.lang) : this.textCopy.needAttention
    else if (score >= 90) tagText = this.textCopy.growthExcellent || i18n.localizeText('长势优', this.data.lang)
    else if (score >= 80) tagText = this.textCopy.growthGood || i18n.localizeText('长势良好', this.data.lang)

    const coordinates = parseCoordinates(plot.coordinates)
    const referenceImages = parseReferenceImages(plot.reference_images)
    const center = calculateCenter(coordinates)
    const previewPolygons = coordinates.length >= 3 ? [{
      points: coordinates,
      strokeWidth: 2,
      strokeColor: plot.status === 'attention' ? '#E57A32FF' : '#2D8B57FF',
      fillColor: plot.status === 'attention' ? '#E57A3238' : '#2D8B5738'
    }] : []

    return {
      ...plot,
      areaNumber,
      areaText: areaNumber.toFixed(areaNumber % 1 === 0 ? 0 : 1),
      health_score: score,
      scoreCls,
      tagText,
      date: formatDate(plot.updated_at, this.data.lang, this.textCopy),
      mapLat: center.latitude,
      mapLng: center.longitude,
      referenceImages,
      firstReferenceImage: imageDisplayUrl(referenceImages[0]),
      hasReferenceImage: referenceImages.length > 0,
      previewPolygons,
      hasBoundary: coordinates.length >= 3,
      planting_status: plot.planting_status || '已播种',
      plantingStatusText: i18n.localizeText(plot.planting_status || '已播种', this.data.lang),
      varietyText: plot.variety ? i18n.localizeText(plot.variety, this.data.lang) : this.textCopy.noVariety,
      irrigationText: plot.irrigation ? i18n.localizeText(plot.irrigation, this.data.lang) : this.textCopy.noIrrigation
    }
  },

  applyFilters() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const status = STATUS_OPTIONS[this.data.statusIndex].value
    const area = AREA_OPTIONS[this.data.areaIndex]
    const filtered = this.data.allFields.filter(plot => {
      const keywordMatched = !keyword || [plot.name, plot.variety, plot.health_issue]
        .some(value => String(value || '').toLowerCase().includes(keyword))
      const statusMatched = status === 'all' || (
        status === 'normal' ? plot.status !== 'attention' : plot.status === status
      )
      const areaMatched = plot.areaNumber >= area.min && plot.areaNumber < area.max
      return keywordMatched && statusMatched && areaMatched
    })
    const selectedIds = this.data.selectedIds.filter(id => filtered.some(plot => plot.id === id))
    const withSelection = filtered.map(plot => ({
      ...plot,
      selected: selectedIds.includes(plot.id)
    }))
    this.setData({
      warnFields: withSelection.filter(plot => plot.status === 'attention'),
      okFields: withSelection.filter(plot => plot.status !== 'attention'),
      resultCount: filtered.length,
      hasActiveFilter: Boolean(keyword || this.data.statusIndex || this.data.areaIndex),
      selectedIds,
      batchActionText: this.buildBatchActionText(selectedIds),
      allVisibleSelected: filtered.length > 0 && selectedIds.length === filtered.length
    })
  },

  onSearchInput(event) {
    this.setData({ keyword: event.detail.value })
    clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => this.applyFilters(), 180)
  },

  onSearchConfirm() {
    clearTimeout(this.searchTimer)
    this.applyFilters()
  },

  onClearSearch() {
    this.setData({ keyword: '' })
    this.applyFilters()
  },

  onStatusChange(event) {
    this.setData({ statusIndex: Number(event.detail.value), selectedIds: [] })
    this.applyFilters()
  },

  onAreaChange(event) {
    this.setData({ areaIndex: Number(event.detail.value), selectedIds: [] })
    this.applyFilters()
  },

  onResetFilters() {
    this.setData({ keyword: '', statusIndex: 0, areaIndex: 0, selectedIds: [] })
    this.applyFilters()
  },

  onToggleManage() {
    this.setData({
      manageMode: !this.data.manageMode,
      selectedIds: [],
      allVisibleSelected: false,
      batchActionText: this.buildBatchActionText([])
    })
  },

  onFieldTap(event) {
    const id = Number(event.currentTarget.dataset.id)
    if (this.data.manageMode) {
      this.toggleSelection(id)
      return
    }
    wx.navigateTo({ url: `/pages/fields/detail?id=${id}` })
  },

  onFieldWeather(event) {
    if (this.data.manageMode) return
    const id = Number(event.currentTarget.dataset.id)
    const name = event.currentTarget.dataset.name || ''
    if (!id) return
    wx.navigateTo({ url: `/pages/weather/index?plotId=${id}&plotName=${encodeURIComponent(name)}` })
  },

  toggleSelection(id) {
    const selectedIds = this.data.selectedIds.includes(id)
      ? this.data.selectedIds.filter(item => item !== id)
      : [...this.data.selectedIds, id]
    const visibleCount = this.data.warnFields.length + this.data.okFields.length
    this.setData({
      selectedIds,
      batchActionText: this.buildBatchActionText(selectedIds),
      allVisibleSelected: visibleCount > 0 && selectedIds.length === visibleCount,
      warnFields: this.data.warnFields.map(plot => ({ ...plot, selected: selectedIds.includes(plot.id) })),
      okFields: this.data.okFields.map(plot => ({ ...plot, selected: selectedIds.includes(plot.id) }))
    })
  },

  onSelectAll() {
    if (this.data.allVisibleSelected) {
      this.setData({
        selectedIds: [],
        batchActionText: this.buildBatchActionText([]),
        allVisibleSelected: false,
        warnFields: this.data.warnFields.map(plot => ({ ...plot, selected: false })),
        okFields: this.data.okFields.map(plot => ({ ...plot, selected: false }))
      })
      return
    }
    const selectedIds = [...this.data.warnFields, ...this.data.okFields].map(plot => plot.id)
    this.setData({
      selectedIds,
      batchActionText: this.buildBatchActionText(selectedIds),
      allVisibleSelected: selectedIds.length > 0,
      warnFields: this.data.warnFields.map(plot => ({ ...plot, selected: true })),
      okFields: this.data.okFields.map(plot => ({ ...plot, selected: true }))
    })
  },

  onBatchDelete() {
    const ids = this.data.selectedIds
    if (!ids.length) return
    wx.showModal({
      title: this.textCopy.deleteTitle(ids.length),
      content: this.data.copy.deleteContent,
      confirmText: this.data.copy.deleteConfirm,
      confirmColor: '#C7473A',
      success: result => {
        if (result.confirm) this.confirmBatchDelete(ids)
      }
    })
  },

  async confirmBatchDelete(ids) {
    wx.showLoading({ title: this.data.copy.deleting, mask: true })
    try {
      const res = await auth.request('POST', '/api/plots/batch-delete', { ids })
      if (res.code !== 200) throw new Error(res.msg || this.textCopy.deleteFail)
      wx.showToast({ title: this.textCopy.deleted(res.data.deleted), icon: 'none' })
      this.setData({ manageMode: false, selectedIds: [], allVisibleSelected: false, batchActionText: this.buildBatchActionText([]) })
      await this.loadPlots({ silent: true })
    } catch (error) {
      wx.showToast({ title: error.message || this.textCopy.deleteFail, icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onRefresh() {
    this.setData({ refreshing: true })
    this.loadPlots({ silent: true })
  },

  onRetry() {
    this.loadPlots()
  },

  onBack() {
    if (this.data.manageMode) {
      this.onToggleManage()
      return
    }
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  },

  onAddField() {
    if (this.data.manageMode) return
    wx.navigateTo({ url: '/pages/fields/draw' })
  },

  onUnload() {
    clearTimeout(this.searchTimer)
  }
})
