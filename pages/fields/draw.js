Page({
  data: {
    statusBarHeight: 20,
    points: [],
    area: 0,
    canUndo: false,
    closed: false
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },
  onBack() { wx.navigateBack() },
  onMapTap(e) {
    if (this.data.closed) return
    const { x, y } = e.detail
    const pts = [...this.data.points, { x, y }]
    let area = 0
    if (pts.length >= 3) {
      // 鞋带公式
      let sum = 0
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length
        sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y
      }
      // 1px = 0.5m (mock scale), 1m² = 0.0015亩
      area = Math.abs(sum / 2) * 0.003
    }
    this.setData({ points: pts, area: area.toFixed(1), canUndo: true })
  },
  onUndo() {
    const pts = this.data.points.slice(0, -1)
    this.setData({ points: pts, canUndo: pts.length > 0 })
  },
  onClear() {
    this.setData({ points: [], area: 0, canUndo: false, closed: false })
  },
  onConfirm() {
    if (this.data.points.length < 3) {
      wx.showToast({ title: '至少需要3个点', icon: 'none' }); return
    }
    wx.showModal({
      title: '确认保存',
      content: `预计面积约 ${this.data.area} 亩，确认保存该地块？`,
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '地块保存成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  },
  getPolyline() {
    const pts = this.data.points
    if (pts.length < 2) return ''
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + (pts.length >= 3 ? ' Z' : '')
  }
})
