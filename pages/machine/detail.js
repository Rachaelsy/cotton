// pages/machine/detail.js — 农机预约详情页
const app = getApp()

// 示例地块数据
const FIELDS = [
  { id: 'f1', name: '1号地', area: 120, unit: '亩' },
  { id: 'f2', name: '2号地', area: 85, unit: '亩' },
  { id: 'f3', name: '3号地', area: 200, unit: '亩' }
]

// 生成最近3天可选日期
function getAvailableDates() {
  const dates = []
  const now = new Date()
  const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const m = d.getMonth() + 1
    const day = d.getDate()
    dates.push({
      id: 'd' + i,
      label: m + '月' + day + '日',
      week: weekNames[d.getDay()]
    })
  }
  return dates
}

Page({
  data: {
    statusBarHeight: 20,
    machine: null,
    fields: FIELDS,
    dates: getAvailableDates(),
    selectedFieldId: 'f1',
    selectedDateId: 'd1',
    totalCost: 0,
    estimatedTime: '',
    booked: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const machine = app.globalData.selectedMachine
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      machine
    })
    this._calcCost()
  },

  onBack() {
    wx.navigateBack()
  },

  onSelectField(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ selectedFieldId: id })
    this._calcCost()
  },

  onSelectDate(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ selectedDateId: id })
  },

  _calcCost() {
    const { machine, fields, selectedFieldId } = this.data
    if (!machine) return
    const field = fields.find(f => f.id === selectedFieldId)
    if (!field) return
    const totalCost = field.area * machine.price
    // 预计完成时间（简单估算：日效率/area*8小时 约 x小时）
    const dailyEff = machine.params && machine.params[1]
      ? parseInt(machine.params[1].value) || 200
      : 200
    const hoursNeeded = Math.ceil((field.area / dailyEff) * 8)
    let estimatedTime = ''
    if (hoursNeeded <= 8) {
      estimatedTime = '约' + hoursNeeded + '小时内完成'
    } else {
      estimatedTime = '约' + Math.ceil(hoursNeeded / 8) + '天内完成'
    }
    this.setData({ totalCost, estimatedTime })
  },

  onBook() {
    const { machine, fields, selectedFieldId, dates, selectedDateId } = this.data
    if (!machine) return
    const field = fields.find(f => f.id === selectedFieldId)
    const date = dates.find(d => d.id === selectedDateId)
    wx.showModal({
      title: '确认预约',
      content: '预约 ' + machine.name + '\n地块：' + field.name + '（' + field.area + '亩）\n日期：' + date.label + '\n费用：¥' + this.data.totalCost,
      confirmText: '立即预约',
      confirmColor: '#C8902E',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '预约成功！',
            icon: 'success',
            duration: 1500
          })
          setTimeout(() => {
            wx.navigateBack()
          }, 1600)
        }
      }
    })
  }
})
