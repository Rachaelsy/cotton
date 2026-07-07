// pages/fields/draw.js — 地块边界绘制
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')
const {
  normalizeCoordinates,
  calculateAreaMu,
  calculatePerimeterMeters
} = require('../../utils/plot-geometry')

// 新疆喀什默认中心（GPS 不可用时的回退坐标）
const DEFAULT_LAT = 39.4700
const DEFAULT_LNG = 75.9900
const MAX_REFERENCE_IMAGES = 6
const MIN_TRACK_POINT_DISTANCE = 6
const MAX_TRACK_POINTS = 500
const EARTH_RADIUS_METERS = 6371000

function imageDisplayUrl(url) {
  if (!url) return ''
  return String(url).startsWith('http') ? url : `${auth.BASE_URL}${url}`
}

function distanceMeters(a, b) {
  if (!a || !b) return 0
  const toRad = value => Number(value) * Math.PI / 180
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    lang: 'zh',
    common: i18n.getCopy('common'),
    copy: i18n.getPageCopy('draw'),
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
    summaryText: '0 亩 · 0 个顶点 · 周长 0 米',
    // 地图元素
    markers:   [],
    polylines: [],
    polygons:  [],
    showCoordPanel: false,
    manualLat: '',
    manualLng: '',
    pickedLocationName: '',
    referenceImages: [],
    referenceImageItems: [],
    uploadingImages: false,
    trackingBoundary: false,
    trackDistance: 0,
    trackPointCount: 0,
    trackAccuracy: 0,
    trackAccuracyText: '--',
    trackStatusText: '',
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
    irrigationOptions: i18n.getOptionLabels('irrigation'),
    irrigationIndex: 0,
    soilOptions: i18n.getOptionLabels('soil'),
    soilIndex: 0,
    plantingOptions: i18n.getOptionLabels('planting'),
    plantingIndex: 0
  },

  textCopy: i18n.getCopy('draw'),

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })
    this.applyLanguage()
    this._locateUser()
  },

  onShow() {
    this.applyLanguage()
  },

  onHide() {
    if (this.data.trackingBoundary) this._stopBoundaryTrack({ silent: true, closePolygon: false })
  },

  onUnload() {
    this._stopBoundaryTrack({ silent: true, closePolygon: false })
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    const copy = i18n.getCopy('draw', lang)
    this.textCopy = copy
    const irrigationOptions = i18n.getOptionLabels('irrigation', lang)
    const soilOptions = i18n.getOptionLabels('soil', lang)
    const plantingOptions = i18n.getOptionLabels('planting', lang)
    this.setData({
      lang,
      common: i18n.getCopy('common', lang),
      copy: i18n.getPageCopy('draw', lang),
      irrigationOptions,
      soilOptions,
      plantingOptions
    })
    this._updateMap(this.data.points, this.data.closed)
  },

  onToggleSatellite() {
    this.setData({ isSatellite: !this.data.isSatellite })
  },

  onHelp() {
    wx.showModal({
      title: this.data.copy.helpTitle,
      content: this.data.copy.helpContent,
      showCancel: false,
      confirmText: this.data.copy.know,
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
    if (this.data.trackingBoundary) {
      wx.showToast({ title: this.data.copy.trackManualDisabled, icon: 'none' })
      return
    }
    const { latitude, longitude } = e.detail
    this._addPoint({ latitude, longitude })
  },

  _addPoint(point) {
    if (this.data.closed || this.data.showForm) {
      wx.showToast({ title: this.data.copy.closedCannotAdd, icon: 'none' })
      return
    }
    const pts = normalizeCoordinates([...this.data.points, point])
    if (pts.length !== this.data.points.length + 1) {
      wx.showToast({ title: this.data.copy.invalidCoord, icon: 'none' })
      return
    }
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
          content: this.data.copy.closeCallout, color: '#fff', bgColor: '#9B6738', fontSize: 11,
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

    let tipText = this.data.copy.tipStart
    if (normalized.length === 1) tipText = this.data.copy.tipOne
    else if (normalized.length === 2) tipText = this.data.copy.tipTwo
    else if (!closed) tipText = this.textCopy.tipDrawing(normalized.length)
    else tipText = this.textCopy.tipDone(areaMu)

    this.setData({
      points: normalized,
      area: areaMu,
      perimeter: perim,
      summaryText: this.textCopy.summaryDesc(areaMu, normalized.length, perim),
      markers,
      polylines,
      polygons,
      tipText
    })
  },

  // ── 撤销 ──────────────────────────────────
  onUndo() {
    if (this.data.trackingBoundary) {
      wx.showToast({ title: this.data.copy.trackStopFirst, icon: 'none' })
      return
    }
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
    if (this.data.trackingBoundary) this._stopBoundaryTrack({ silent: true, closePolygon: false })
    if (!this.data.points.length) return
    wx.showModal({
      title: this.data.copy.clearTitle,
      content: this.data.copy.clearContent,
      confirmColor: '#DC2626',
      success: (r) => {
        if (r.confirm) {
          this._updateMap([], false)
          this.setData({ closed: false })
        }
      }
    })
  },

  // ── 沿边界行走采集 ─────────────────────────
  onStartBoundaryTrack() {
    if (this.data.closed || this.data.showForm) {
      wx.showToast({ title: this.data.copy.closedCannotAdd, icon: 'none' })
      return
    }
    if (this.data.trackingBoundary) return
    if (typeof wx.startLocationUpdate !== 'function' || typeof wx.onLocationChange !== 'function') {
      wx.showToast({ title: this.data.copy.trackUnsupported, icon: 'none' })
      return
    }

    this.setData({
      showCoordPanel: false,
      trackStatusText: this.data.copy.trackPreparing,
      trackDistance: 0,
      trackPointCount: this.data.points.length,
      trackAccuracy: 0,
      trackAccuracyText: '--'
    })

    wx.startLocationUpdate({
      type: 'gcj02',
      success: () => {
        this._boundaryLocationHandler = res => this._appendTrackPoint(res)
        wx.onLocationChange(this._boundaryLocationHandler)
        this.setData({
          trackingBoundary: true,
          closed: false,
          trackStatusText: this.data.copy.trackCollecting
        })
        wx.getLocation({
          type: 'gcj02',
          success: res => this._appendTrackPoint(res)
        })
      },
      fail: (err) => {
        const message = err && err.errMsg ? `${this.data.copy.trackLocationFail}：${err.errMsg}` : this.data.copy.trackLocationFail
        this.setData({ trackStatusText: '' })
        wx.showToast({ title: message, icon: 'none' })
      }
    })
  },

  onStopBoundaryTrack() {
    this._stopBoundaryTrack({ silent: false, closePolygon: true })
  },

  _appendTrackPoint(res) {
    if (!this.data.trackingBoundary || this.data.closed || this.data.showForm) return
    const latitude = Number(res && res.latitude)
    const longitude = Number(res && res.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

    const point = { latitude, longitude }
    const points = this.data.points || []
    const prevPoint = points[points.length - 1]
    const segment = prevPoint ? distanceMeters(prevPoint, point) : 0
    const accuracy = Math.round(Number(res.accuracy) || 0)
    const accuracyText = accuracy > 0 ? `${accuracy}m` : '--'

    this.setData({
      mapLat: latitude,
      mapLng: longitude,
      trackAccuracy: accuracy,
      trackAccuracyText: accuracyText
    })

    if (prevPoint && segment < MIN_TRACK_POINT_DISTANCE) return
    if (points.length >= MAX_TRACK_POINTS) {
      wx.showToast({ title: this.data.copy.trackTooManyPoints, icon: 'none' })
      this._stopBoundaryTrack({ silent: true, closePolygon: false })
      return
    }

    const nextPoints = normalizeCoordinates([...points, point])
    if (nextPoints.length !== points.length + 1) return

    this._updateMap(nextPoints, false)
    this.setData({
      trackDistance: Math.round(this.data.trackDistance + segment),
      trackPointCount: nextPoints.length,
      trackStatusText: this.data.copy.trackCollecting
    })
  },

  _stopBoundaryTrack(options = {}) {
    const wasTracking = this.data.trackingBoundary || this._boundaryLocationHandler
    if (this._boundaryLocationHandler && typeof wx.offLocationChange === 'function') {
      wx.offLocationChange(this._boundaryLocationHandler)
    }
    this._boundaryLocationHandler = null
    if (wasTracking && typeof wx.stopLocationUpdate === 'function') {
      wx.stopLocationUpdate({ complete: () => {} })
    }
    if (wasTracking) {
      this.setData({
        trackingBoundary: false,
        trackStatusText: ''
      })
    }

    if (!options.closePolygon) return
    if (this.data.points.length >= 3) {
      this._closePolygon()
      if (!options.silent) wx.showToast({ title: this.data.copy.trackCompleted, icon: 'success' })
    } else if (!options.silent) {
      wx.showToast({ title: this.data.copy.trackNeedMore, icon: 'none' })
    }
  },

  // ── 定位到当前位置 ────────────────────────
  onLocate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ mapLat: res.latitude, mapLng: res.longitude })
        wx.createMapContext('mymap').moveToLocation({ latitude: res.latitude, longitude: res.longitude })
      },
      fail: () => wx.showToast({ title: this.data.copy.locateFail, icon: 'none' })
    })
  },

  onChooseLocation() {
    if (this.data.trackingBoundary) {
      wx.showToast({ title: this.data.copy.trackStopFirst, icon: 'none' })
      return
    }
    if (this.data.closed || this.data.showForm) {
      wx.showToast({ title: this.data.copy.closedCannotAdd, icon: 'none' })
      return
    }
    wx.chooseLocation({
      latitude: this.data.mapLat,
      longitude: this.data.mapLng,
      success: (res) => {
        const point = { latitude: res.latitude, longitude: res.longitude }
        this.setData({
          mapLat: point.latitude,
          mapLng: point.longitude,
          manualLat: point.latitude.toFixed(6),
          manualLng: point.longitude.toFixed(6),
          pickedLocationName: res.name || res.address || ''
        })
        this._moveMap(point)
        wx.showModal({
          title: this.data.copy.addSearchPointTitle,
          content: this.textCopy.addSearchPointContent(res.name || res.address),
          cancelText: this.data.copy.onlyMove,
          confirmText: this.data.copy.addPoint,
          confirmColor: '#9B6738',
          success: modal => {
            if (modal.confirm) {
              this._addPoint(point)
              wx.showToast({ title: this.data.copy.pointAdded, icon: 'none' })
            }
          }
        })
      }
    })
  },

  onToggleCoordPanel() {
    if (this.data.trackingBoundary) {
      wx.showToast({ title: this.data.copy.trackStopFirst, icon: 'none' })
      return
    }
    this.setData({ showCoordPanel: !this.data.showCoordPanel })
  },

  onManualLatInput(e) {
    this.setData({ manualLat: e.detail.value })
  },

  onManualLngInput(e) {
    this.setData({ manualLng: e.detail.value })
  },

  _readManualPoint() {
    const latitude = Number(this.data.manualLat)
    const longitude = Number(this.data.manualLng)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      wx.showToast({ title: this.data.copy.invalidCoord, icon: 'none' })
      return null
    }
    return { latitude, longitude }
  },

  _moveMap(point) {
    this.setData({ mapLat: point.latitude, mapLng: point.longitude })
    const map = wx.createMapContext('mymap')
    if (map && map.moveToLocation) {
      map.moveToLocation({ latitude: point.latitude, longitude: point.longitude })
    }
  },

  onMoveToManualCoord() {
    const point = this._readManualPoint()
    if (!point) return
    this._moveMap(point)
    wx.showToast({ title: this.data.copy.mapMoved, icon: 'none' })
  },

  onAddManualPoint() {
    const point = this._readManualPoint()
    if (!point) return
    this._moveMap(point)
    this._addPoint(point)
    wx.showToast({ title: this.data.copy.pointAdded, icon: 'none' })
  },

  // ── 完成绘制 → 展开表单 ───────────────────
  onFinishDraw() {
    if (this.data.trackingBoundary) this._stopBoundaryTrack({ silent: true, closePolygon: false })
    if (!this.data.closed) {
      if (this.data.points.length < 3) {
        wx.showToast({ title: this.data.copy.minPoints, icon: 'none' }); return
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
    this.setData({ irrigationIndex: idx, 'form.irrigation': i18n.getOptionValue('irrigation', idx) })
  },
  onSoilChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ soilIndex: idx, 'form.soilType': i18n.getOptionValue('soil', idx) })
  },
  onPlantingChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ plantingIndex: idx, 'form.plantingStatus': i18n.getOptionValue('planting', idx) })
  },
  onNoteInput(e) { this.setData({ 'form.note': e.detail.value }) },

  _setReferenceImages(images) {
    const referenceImages = images.slice(0, MAX_REFERENCE_IMAGES)
    this.setData({
      referenceImages,
      referenceImageItems: referenceImages.map(url => ({
        url,
        displayUrl: imageDisplayUrl(url)
      }))
    })
  },

  onChoosePlotImages() {
    if (this.data.uploadingImages) return
    const remain = MAX_REFERENCE_IMAGES - this.data.referenceImages.length
    if (remain <= 0) {
      wx.showToast({ title: this.data.copy.referenceImageMax, icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const files = (res.tempFiles || []).map(file => file.tempFilePath).filter(Boolean)
        if (!files.length) return
        this.setData({ uploadingImages: true })
        wx.showLoading({ title: this.data.copy.uploadingImage, mask: true })
        const uploaded = []
        try {
          for (const filePath of files) {
            const result = await auth.uploadFile('/api/upload', filePath)
            if (result.code === 200 && result.data && result.data.url) uploaded.push(result.data.url)
          }
          if (!uploaded.length) throw new Error(this.data.copy.imageUploadFail)
          this._setReferenceImages([...this.data.referenceImages, ...uploaded])
          if (uploaded.length < files.length) wx.showToast({ title: this.data.copy.imageUploadPartial, icon: 'none' })
        } catch (error) {
          wx.showToast({ title: error.message || this.data.copy.imageUploadFail, icon: 'none' })
        } finally {
          wx.hideLoading()
          this.setData({ uploadingImages: false })
        }
      }
    })
  },

  onRemovePlotImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    this._setReferenceImages(this.data.referenceImages.filter((_, i) => i !== index))
  },

  onPreviewPlotImage(e) {
    const current = e.currentTarget.dataset.url
    const urls = this.data.referenceImageItems.map(item => item.displayUrl)
    if (current && urls.length) wx.previewImage({ current, urls })
  },

  // ── 保存地块 ──────────────────────────────
  async onSave() {
    const { name, variety, sowDate, irrigation, soilType, plantingStatus, note } = this.data.form
    if (!name.trim()) { wx.showToast({ title: this.data.copy.needName, icon: 'none' }); return }
    if (!variety.trim()) { wx.showToast({ title: this.data.copy.needVariety, icon: 'none' }); return }
    if (this.data.points.length < 3 || Number(this.data.area) <= 0) {
      wx.showToast({ title: this.data.copy.invalidBoundary, icon: 'none' }); return
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
        reference_images: this.data.referenceImages,
        sow_date:    sowDate || null,
        irrigation,
        soil_type:   soilType,
        planting_status: plantingStatus,
        note: note.trim()
      })
      if (res.code === 200) {
        wx.showToast({ title: this.data.copy.saved, icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1200)
      } else {
        wx.showToast({ title: res.msg || this.data.copy.saveFail, icon: 'none' })
      }
    } catch {
      wx.showToast({ title: this.data.copy.networkFail, icon: 'none' })
    }
    this.setData({ saving: false })
  },

  onBack() {
    if (this.data.showForm) { this.setData({ showForm: false }); return }
    if (this.data.points.length || this.data.referenceImages.length) {
      wx.showModal({
        title: this.data.copy.abandonTitle,
        content: this.data.copy.abandonContent,
        confirmColor: '#DC2626',
        success: (r) => {
          if (r.confirm) {
            this._stopBoundaryTrack({ silent: true, closePolygon: false })
            wx.navigateBack()
          }
        }
      })
      return
    }
    this._stopBoundaryTrack({ silent: true, closePolygon: false })
    wx.navigateBack()
  }
})
