// pages/fields/detail.js — 地块详情
const app  = getApp()
const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    plot: null,
    polygons: [],
    mapLat: 39.47,
    mapLng: 75.99,
    isSatellite: true,
    // 编辑弹窗
    showEdit: false,
    saving: false,
    form: { name: '', variety: '', sowDate: '', irrigation: '滴灌', soilType: '', healthScore: 100, healthIssue: '', status: 'normal' },
    irrigationOptions: ['滴灌', '漫灌', '喷灌', '无'],
    irrigationIndex: 0,
    statusOptions: ['正常种植', '需要关注'],
    statusIndex: 0
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    const id = parseInt(options.id)
    this._load(id)
  },

  async _load(id) {
    try {
      const res = await auth.request('GET', `/api/plots/${id}`)
      if (res.code === 200) {
        this._apply(res.data)
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  _apply(p) {
    let coords = []
    try { coords = p.coordinates ? JSON.parse(p.coordinates) : [] } catch {}

    const polygons = coords.length >= 3 ? [{
      points:      coords,
      strokeWidth: 3,
      strokeColor: '#C8902EFF',
      fillColor:   '#C8902E33'
    }] : []

    const center = coords.length
      ? { mapLat: coords[0].latitude, mapLng: coords[0].longitude }
      : {}

    const irrOptions = ['滴灌', '漫灌', '喷灌', '无']
    const irrIdx = Math.max(0, irrOptions.indexOf(p.irrigation))
    const stIdx  = p.status === 'attention' ? 1 : 0

    this.setData({
      plot: p,
      polygons,
      ...center,
      form: {
        name:         p.name,
        variety:      p.variety || '',
        sowDate:      p.sow_date ? p.sow_date.slice(0, 10) : '',
        irrigation:   p.irrigation || '滴灌',
        soilType:     p.soil_type || '',
        healthScore:  p.health_score || 100,
        healthIssue:  p.health_issue || '',
        status:       p.status || 'normal'
      },
      irrigationIndex: irrIdx,
      statusIndex:     stIdx
    })
  },

  onToggleSatellite() {
    this.setData({ isSatellite: !this.data.isSatellite })
  },

  // ── 编辑弹窗 ──────────────────────────────
  onEdit()  { this.setData({ showEdit: true }) },
  onCloseEdit() { this.setData({ showEdit: false }) },

  onNameInput(e)   { this.setData({ 'form.name':        e.detail.value }) },
  onVarietyInput(e){ this.setData({ 'form.variety':     e.detail.value }) },
  onSowChange(e)   { this.setData({ 'form.sowDate':     e.detail.value }) },
  onIssueInput(e)  { this.setData({ 'form.healthIssue': e.detail.value }) },
  onScoreInput(e)  { this.setData({ 'form.healthScore': parseInt(e.detail.value) || 100 }) },
  onIrrChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ irrigationIndex: idx, 'form.irrigation': this.data.irrigationOptions[idx] })
  },
  onStatusChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ statusIndex: idx, 'form.status': idx === 1 ? 'attention' : 'normal' })
  },

  async onSave() {
    const { name, variety, sowDate, irrigation, soilType, healthScore, healthIssue, status } = this.data.form
    if (!name.trim()) { wx.showToast({ title: '地块名称不能为空', icon: 'none' }); return }
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      const res = await auth.request('PUT', `/api/plots/${this.data.plot.id}`, {
        name: name.trim(), variety, sow_date: sowDate || null,
        irrigation, soil_type: soilType,
        health_score: parseInt(healthScore) || 100,
        health_issue: healthIssue, status
      })
      if (res.code === 200) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.setData({ showEdit: false })
        this._load(this.data.plot.id)
      } else {
        wx.showToast({ title: res.msg || '保存失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
    this.setData({ saving: false })
  },

  // ── 删除 ──────────────────────────────────
  onDelete() {
    wx.showModal({
      title: '删除地块',
      content: `确定删除「${this.data.plot?.name}」？删除后无法恢复。`,
      confirmText: '确认删除',
      confirmColor: '#DC2626',
      success: (r) => { if (r.confirm) this._confirmDelete() }
    })
  },

  async _confirmDelete() {
    try {
      const res = await auth.request('DELETE', `/api/plots/${this.data.plot.id}`)
      if (res.code === 200) {
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1000)
      } else {
        wx.showToast({ title: res.msg || '删除失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  onBack() {
    wx.navigateBack()
  }
})
