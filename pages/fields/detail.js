// pages/fields/detail.js — 地块详情与数据聚合
const auth = require('../../utils/auth')
const { normalizeCoordinates, calculateCenter } = require('../../utils/plot-geometry')

const IRRIGATION_OPTIONS = ['滴灌', '漫灌', '喷灌', '无']
const SOIL_OPTIONS = ['壤土', '沙壤土', '粘土', '沙土', '盐碱土']
const PLANTING_OPTIONS = ['已播种', '计划播种', '未播种']

function optionIndex(options, value) {
  const index = options.indexOf(value)
  return index >= 0 ? index : 0
}

function dateText(value) {
  if (!value) return '未填写'
  const raw = String(value).slice(0, 10)
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  return `${Number(parts[0])}年${Number(parts[1])}月${Number(parts[2])}日`
}

Page({
  data: {
    statusBarHeight: 20,
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
    irrigationOptions: IRRIGATION_OPTIONS,
    irrigationIndex: 0,
    soilOptions: SOIL_OPTIONS,
    soilIndex: 0,
    plantingOptions: PLANTING_OPTIONS,
    plantingIndex: 0
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.plotId = Number(options.id)
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.loadPlot()
  },

  async loadPlot() {
    if (!this.plotId) {
      this.setData({ loading: false, loadError: '地块编号无效' })
      return
    }
    this.setData({ loading: true, loadError: '' })
    try {
      const res = await auth.request('GET', `/api/plots/${this.plotId}`)
      if (res.code !== 200 || !res.data) throw new Error(res.msg || '加载失败')
      this.applyPlot(res.data)
    } catch (error) {
      this.setData({ loading: false, loadError: error.message || '网络异常，请稍后重试' })
    }
  },

  applyPlot(raw) {
    let parsed = []
    try {
      parsed = Array.isArray(raw.coordinates)
        ? raw.coordinates
        : (raw.coordinates ? JSON.parse(raw.coordinates) : [])
    } catch (error) {}
    const coordinates = normalizeCoordinates(parsed)
    const center = calculateCenter(coordinates)
    const score = Number.isFinite(Number(raw.health_score)) ? Number(raw.health_score) : 100
    const plot = {
      ...raw,
      health_score: score,
      sowDateText: dateText(raw.sow_date),
      areaText: Number(raw.area || 0).toFixed(Number(raw.area || 0) % 1 === 0 ? 0 : 1),
      perimeterText: Math.round(Number(raw.perimeter || 0)),
      planting_status: raw.planting_status || '已播种',
      growthLabel: raw.status === 'attention'
        ? (raw.health_issue || '需要关注')
        : (score >= 90 ? '长势优' : score >= 80 ? '长势良好' : '长势正常')
    }
    const overview = raw.overview || {}
    const recentRecords = (overview.recent_records || []).map(record => ({
      ...record,
      workDateText: dateText(record.work_date),
      title: record.title || record.type
    }))
    this.setData({
      loading: false,
      loadError: '',
      plot,
      recentRecords,
      recordCount: Number(overview.record_count || 0),
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
      irrigationIndex: optionIndex(IRRIGATION_OPTIONS, raw.irrigation),
      soilIndex: optionIndex(SOIL_OPTIONS, raw.soil_type || '壤土'),
      plantingIndex: optionIndex(PLANTING_OPTIONS, raw.planting_status || '已播种')
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
    this.setData({ irrigationIndex: index, 'form.irrigation': IRRIGATION_OPTIONS[index] })
  },
  onSoilChange(event) {
    const index = Number(event.detail.value)
    this.setData({ soilIndex: index, 'form.soilType': SOIL_OPTIONS[index] })
  },
  onPlantingChange(event) {
    const index = Number(event.detail.value)
    this.setData({ plantingIndex: index, 'form.plantingStatus': PLANTING_OPTIONS[index] })
  },

  async onSave() {
    const { name, variety, sowDate, irrigation, soilType, plantingStatus, note } = this.data.form
    if (!name.trim()) { wx.showToast({ title: '请填写地块名称', icon: 'none' }); return }
    if (!variety.trim()) { wx.showToast({ title: '请填写棉花品种', icon: 'none' }); return }
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
        note: note.trim()
      })
      if (res.code !== 200) throw new Error(res.msg || '保存失败')
      wx.showToast({ title: '地块信息已更新', icon: 'success' })
      this.setData({ showEdit: false })
      await this.loadPlot()
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  onOpenModule(event) {
    const moduleName = event.currentTarget.dataset.module
    const routes = {
      remote: '/pages/remote/index',
      weather: '/pages/weather/index',
      records: '/pages/records/index',
      pest: '/pages/pest/index'
    }
    const route = routes[moduleName]
    if (!route) return
    const query = `plotId=${this.plotId}&plotName=${encodeURIComponent(this.data.plot.name || '')}`
    wx.navigateTo({ url: `${route}?${query}` })
  },

  onDelete() {
    wx.showModal({
      title: '删除地块',
      content: `确定删除「${this.data.plot.name}」？已有农事记录会保留，但地块无法恢复。`,
      confirmText: '确认删除',
      confirmColor: '#C7473A',
      success: result => {
        if (result.confirm) this.confirmDelete()
      }
    })
  },

  async confirmDelete() {
    wx.showLoading({ title: '正在删除', mask: true })
    try {
      const res = await auth.request('DELETE', `/api/plots/${this.plotId}`)
      if (res.code !== 200) throw new Error(res.msg || '删除失败')
      wx.showToast({ title: '地块已删除', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (error) {
      wx.showToast({ title: error.message || '删除失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onBack() { wx.navigateBack() }
})
