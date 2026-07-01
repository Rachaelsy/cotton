// pages/fields/index.js — 地块管理列表
const auth = require('../../utils/auth')
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

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}月${date.getDate()}日更新`
}

Page({
  data: {
    statusBarHeight: 20,
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
    statusOptions: STATUS_OPTIONS.map(item => item.label),
    statusIndex: 0,
    areaOptions: AREA_OPTIONS.map(item => item.label),
    areaIndex: 0,
    resultCount: 0,
    hasActiveFilter: false,
    manageMode: false,
    selectedIds: [],
    allVisibleSelected: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    this.loadPlots()
  },

  async loadPlots({ silent = false } = {}) {
    if (!silent) this.setData({ loading: true, loadError: '' })
    try {
      const res = await auth.request('GET', '/api/plots')
      if (res.code !== 200 || !Array.isArray(res.data)) {
        throw new Error(res.msg || '加载失败')
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
        selectedIds: []
      })
      this.applyFilters()
    } catch (error) {
      this.setData({
        loading: false,
        refreshing: false,
        loadError: error.message || '网络异常，请稍后重试'
      })
    }
  },

  formatPlot(plot) {
    const score = Number.isFinite(Number(plot.health_score)) ? Number(plot.health_score) : 100
    const areaNumber = Number(plot.area || 0)
    let scoreCls = 'excel'
    if (score < 75) scoreCls = 'warn'
    else if (score < 88) scoreCls = 'good'

    let tagText = '长势正常'
    if (plot.status === 'attention') tagText = plot.health_issue || '需要关注'
    else if (score >= 90) tagText = '长势优'
    else if (score >= 80) tagText = '长势良好'

    const coordinates = parseCoordinates(plot.coordinates)
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
      date: formatDate(plot.updated_at),
      mapLat: center.latitude,
      mapLng: center.longitude,
      previewPolygons,
      hasBoundary: coordinates.length >= 3,
      planting_status: plot.planting_status || '已播种'
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
    this.setData({ manageMode: !this.data.manageMode, selectedIds: [], allVisibleSelected: false })
  },

  onFieldTap(event) {
    const id = Number(event.currentTarget.dataset.id)
    if (this.data.manageMode) {
      this.toggleSelection(id)
      return
    }
    wx.navigateTo({ url: `/pages/fields/detail?id=${id}` })
  },

  toggleSelection(id) {
    const selectedIds = this.data.selectedIds.includes(id)
      ? this.data.selectedIds.filter(item => item !== id)
      : [...this.data.selectedIds, id]
    const visibleCount = this.data.warnFields.length + this.data.okFields.length
    this.setData({
      selectedIds,
      allVisibleSelected: visibleCount > 0 && selectedIds.length === visibleCount,
      warnFields: this.data.warnFields.map(plot => ({ ...plot, selected: selectedIds.includes(plot.id) })),
      okFields: this.data.okFields.map(plot => ({ ...plot, selected: selectedIds.includes(plot.id) }))
    })
  },

  onSelectAll() {
    if (this.data.allVisibleSelected) {
      this.setData({
        selectedIds: [],
        allVisibleSelected: false,
        warnFields: this.data.warnFields.map(plot => ({ ...plot, selected: false })),
        okFields: this.data.okFields.map(plot => ({ ...plot, selected: false }))
      })
      return
    }
    const selectedIds = [...this.data.warnFields, ...this.data.okFields].map(plot => plot.id)
    this.setData({
      selectedIds,
      allVisibleSelected: selectedIds.length > 0,
      warnFields: this.data.warnFields.map(plot => ({ ...plot, selected: true })),
      okFields: this.data.okFields.map(plot => ({ ...plot, selected: true }))
    })
  },

  onBatchDelete() {
    const ids = this.data.selectedIds
    if (!ids.length) return
    wx.showModal({
      title: `删除 ${ids.length} 块地？`,
      content: '地块删除后无法恢复，已有农事记录仍会保留。',
      confirmText: '确认删除',
      confirmColor: '#C7473A',
      success: result => {
        if (result.confirm) this.confirmBatchDelete(ids)
      }
    })
  },

  async confirmBatchDelete(ids) {
    wx.showLoading({ title: '正在删除', mask: true })
    try {
      const res = await auth.request('POST', '/api/plots/batch-delete', { ids })
      if (res.code !== 200) throw new Error(res.msg || '删除失败')
      wx.showToast({ title: `已删除 ${res.data.deleted} 块`, icon: 'none' })
      this.setData({ manageMode: false, selectedIds: [], allVisibleSelected: false })
      await this.loadPlots({ silent: true })
    } catch (error) {
      wx.showToast({ title: error.message || '删除失败', icon: 'none' })
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
