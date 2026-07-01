// pages/fields/draw.js — 地块边界绘制
const auth = require('../../utils/auth')
const {
  normalizeCoordinates,
  calculateAreaMu,
  calculatePerimeterMeters
} = require('../../utils/plot-geometry')

// 新疆喀什默认中心（GPS 不可用时的回退坐标）
const DEFAULT_LAT = 39.4700
const DEFAULT_LNG = 75.9900

Page({
  data: {
    statusBarHeight: 20,
    // 地图中心
    mapLat: DEFAULT_LAT,
    mapLng: DEFAULT_LNG,
    isSatellite: false,
    // 打点数据
    points: [],
    closed: false,
    // 计算结果
    area: '0',
    perimeter: 0,
    // 地图元素
    markers:   [],
    polylines: [],
    polygons:  [],
    // 提示文字
    tipText: '点击地图添加地块顶点',
    // 表单（完成绘制后填写）
    showForm: false,
    saving: false,
    form: {
      name: '',
      variety: '',
      sowDate: '',
      irrigation: '滴灌',
      soilType: '壤土',
      plantingStatus: '已播种',
      note: ''
    },
    irrigationOptions: ['滴灌', '漫灌', '喷灌', '无'],
    irrigationIndex: 0,
    soilOptions: ['壤土', '沙壤土', '粘土', '沙土', '盐碱土'],
    soilIndex: 0,
    plantingOptions: ['已播种', '计划播种', '未播种'],
    plantingIndex: 0
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this._locateUser()
  },

  onToggleSatellite() {
    this.setData({ isSatellite: !this.data.isSatellite })
  },

  onHelp() {
    wx.showModal({
      title: '如何绘制地块',
      content: '依次点击地块边界添加顶点，至少添加 3 个点。点击第 1 个点闭合边界，也可直接点击“完成绘制”自动闭合。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#9B6738'
    })
  },

  _locateUser() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ mapLat: res.latitude, mapLng: res.longitude })
      },
      fail: () => { /* 用默认坐标 */ }
    })
  },

  // ── 地图打点 ───────────────────────────────
  onMapTap(e) {
    if (this.data.closed || this.data.showForm) return
    const { latitude, longitude } = e.detail
    const pts = normalizeCoordinates([...this.data.points, { latitude, longitude }])
    this._updateMap(pts, false)
  },

  // ── 点击第一个 marker（dot）→ 闭合多边形 ─
  onMarkerTap(e) {
    if (this.data.closed || this.data.showForm) return
    const markerId = e.detail?.markerId ?? e.markerId
    if (markerId === 0 && this.data.points.length >= 3) {
      this._closePolygon()
    }
  },

  // ── 点击 callout"点我闭合"→ 闭合多边形 ──
  onCalloutTap(e) {
    if (this.data.closed || this.data.showForm) return
    const markerId = e.detail?.markerId ?? e.markerId
    if (markerId === 0 && this.data.points.length >= 3) {
      this._closePolygon()
    }
  },

  _closePolygon() {
    this._updateMap(this.data.points, true)
    this.setData({ closed: true })
  },

  _updateMap(pts, closed) {
    const normalized = normalizeCoordinates(pts)
    const areaMuValue = calculateAreaMu(normalized)
    const areaMu = areaMuValue.toFixed(areaMuValue >= 100 ? 0 : 1)
    const perim = Math.round(calculatePerimeterMeters(normalized))

    // markers：用 label 显示序号
    const markers = normalized.map((p, i) => ({
      id: i,
      latitude: p.latitude,
      longitude: p.longitude,
      width: 20,
      height: 20,
      label: {
        content: String(i + 1),
        color: '#fff',
        fontSize: 11,
        bgColor: i === 0 ? '#D97706' : '#1F2937',
        padding: 3,
        borderRadius: 4,
        anchorX: 0,
        anchorY: 0
      },
      ...((!closed && i === 0 && normalized.length >= 3) ? {
        callout: {
          content: '点击闭合', color: '#fff', bgColor: '#9B6738', fontSize: 11,
          padding: 5, borderRadius: 6, display: 'ALWAYS'
        }
      } : {})
    }))

    // 绘制中：折线；闭合后：多边形
    const polylines = closed ? [] : (normalized.length >= 2 ? [{
      points:     normalized,
      color:      '#C8902E',
      width:      3,
      dottedLine: false
    }, ...(normalized.length >= 3 ? [{
      points: [normalized[normalized.length - 1], normalized[0]],
      color: '#C8902E88',
      width: 2,
      dottedLine: true
    }] : [])] : [])

    const polygons = closed ? [{
      points:      normalized,
      strokeWidth: 3,
      strokeColor: '#C8902EFF',
      fillColor:   '#C8902E33'
    }] : []

    let tipText = '点击地图添加地块顶点'
    if (normalized.length === 1) tipText = '继续添加顶点（至少3个）'
    else if (normalized.length === 2) tipText = '再添加至少 1 个顶点'
    else if (!closed) tipText = `已打 ${normalized.length} 个点，点击第 1 个点闭合`
    else tipText = `已绘制 ${areaMu} 亩，请填写地块信息`

    this.setData({ points: normalized, area: areaMu, perimeter: perim, markers, polylines, polygons, tipText })
  },

  // ── 撤销 ──────────────────────────────────
  onUndo() {
    if (this.data.closed) {
      // 打开已闭合的多边形，回到最后一点
      this._updateMap(this.data.points, false)
      this.setData({ closed: false })
      return
    }
    const pts = this.data.points.slice(0, -1)
    this._updateMap(pts, false)
  },

  // ── 清空 ──────────────────────────────────
  onClear() {
    if (!this.data.points.length) return
    wx.showModal({
      title: '清空地块',
      content: '确定清除所有已打的点？',
      confirmColor: '#DC2626',
      success: (r) => {
        if (r.confirm) {
          this._updateMap([], false)
          this.setData({ closed: false })
        }
      }
    })
  },

  // ── 定位到当前位置 ────────────────────────
  onLocate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ mapLat: res.latitude, mapLng: res.longitude })
        wx.createMapContext('mymap').moveToLocation({ latitude: res.latitude, longitude: res.longitude })
      },
      fail: () => wx.showToast({ title: '定位失败，请检查权限', icon: 'none' })
    })
  },

  // ── 完成绘制 → 展开表单 ───────────────────
  onFinishDraw() {
    if (!this.data.closed) {
      if (this.data.points.length < 3) {
        wx.showToast({ title: '至少需要 3 个顶点', icon: 'none' }); return
      }
      this._closePolygon()
    }
    this.setData({ showForm: true })
  },

  // ── 表单输入 ──────────────────────────────
  onNameInput(e)    { this.setData({ 'form.name':    e.detail.value }) },
  onVarietyInput(e) { this.setData({ 'form.variety': e.detail.value }) },
  onSowDateChange(e){ this.setData({ 'form.sowDate': e.detail.value }) },
  onIrrChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ irrigationIndex: idx, 'form.irrigation': this.data.irrigationOptions[idx] })
  },
  onSoilChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ soilIndex: idx, 'form.soilType': this.data.soilOptions[idx] })
  },
  onPlantingChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ plantingIndex: idx, 'form.plantingStatus': this.data.plantingOptions[idx] })
  },
  onNoteInput(e) { this.setData({ 'form.note': e.detail.value }) },

  // ── 保存地块 ──────────────────────────────
  async onSave() {
    const { name, variety, sowDate, irrigation, soilType, plantingStatus, note } = this.data.form
    if (!name.trim()) { wx.showToast({ title: '请填写地块名称', icon: 'none' }); return }
    if (!variety.trim()) { wx.showToast({ title: '请填写棉花品种', icon: 'none' }); return }
    if (this.data.points.length < 3 || Number(this.data.area) <= 0) {
      wx.showToast({ title: '地块边界无效，请重新绘制', icon: 'none' }); return
    }
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      const res = await auth.request('POST', '/api/plots', {
        name:        name.trim(),
        variety:     variety.trim(),
        area:        parseFloat(this.data.area) || 0,
        perimeter:   this.data.perimeter,
        coordinates: this.data.points,
        sow_date:    sowDate || null,
        irrigation,
        soil_type:   soilType,
        planting_status: plantingStatus,
        note: note.trim()
      })
      if (res.code === 200) {
        wx.showToast({ title: '地块已保存', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1200)
      } else {
        wx.showToast({ title: res.msg || '保存失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
    this.setData({ saving: false })
  },

  onBack() {
    if (this.data.showForm) { this.setData({ showForm: false }); return }
    if (this.data.points.length) {
      wx.showModal({
        title: '放弃绘制',
        content: '确定放弃当前绘制？',
        confirmColor: '#DC2626',
        success: (r) => { if (r.confirm) wx.navigateBack() }
      })
      return
    }
    wx.navigateBack()
  }
})
