// pages/machine/index.js — 农机租赁列表页
const app = getApp()

const ALL_MACHINES = [
  {
    id: 'm001',
    icon: '🚁',
    name: '极飞P80植保无人机',
    org: '疏附县农机合作社',
    price: 8,
    unit: '亩',
    rating: 4.9,
    status: 'available',
    statusText: '可预约',
    category: '植保无人机',
    params: [
      { label: '喷幅', value: '9m' },
      { label: '日效率', value: '500亩' },
      { label: '电耗', value: '4度/架次' }
    ]
  },
  {
    id: 'm002',
    icon: '🚜',
    name: '采棉机（4行）',
    org: '卡拉苏农机队',
    price: 120,
    unit: '亩',
    rating: 4.8,
    status: 'busy',
    statusText: '紧俏',
    category: '采棉机',
    params: [
      { label: '行数', value: '4行' },
      { label: '日效率', value: '200亩' },
      { label: '油耗', value: '35L/小时' }
    ]
  },
  {
    id: 'm003',
    icon: '🚁',
    name: 'DJI T50植保机',
    org: '疏附县智慧农业',
    price: 10,
    unit: '亩',
    rating: 5.0,
    status: 'available',
    statusText: '可预约',
    category: '植保无人机',
    params: [
      { label: '喷幅', value: '11m' },
      { label: '日效率', value: '600亩' },
      { label: '电耗', value: '5度/架次' }
    ]
  },
  {
    id: 'm004',
    icon: '🚜',
    name: '犁地机（深松）',
    org: '帕克热巴农机',
    price: 60,
    unit: '亩',
    rating: 4.7,
    status: 'available',
    statusText: '可预约',
    category: '其他农机',
    params: [
      { label: '深松', value: '35cm' },
      { label: '幅宽', value: '2.4m' },
      { label: '油耗', value: '28L/小时' }
    ]
  },
  {
    id: 'm005',
    icon: '💦',
    name: '滴灌铺设机',
    org: '农业局服务队',
    price: 30,
    unit: '亩',
    rating: 4.6,
    status: 'available',
    statusText: '可预约',
    category: '其他农机',
    params: [
      { label: '幅宽', value: '2m' },
      { label: '日效率', value: '150亩' },
      { label: '功率', value: '45kW' }
    ]
  }
]

const FILTERS = ['全部', '植保无人机', '采棉机']

Page({
  data: {
    statusBarHeight: 20,
    filters: FILTERS,
    filterSel: '全部',
    allMachines: ALL_MACHINES,
    displayMachines: ALL_MACHINES
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onFilter(e) {
    const sel = e.currentTarget.dataset.name
    const list = sel === '全部'
      ? ALL_MACHINES
      : ALL_MACHINES.filter(m => m.category === sel)
    this.setData({ filterSel: sel, displayMachines: list })
  },

  onMachine(e) {
    const id = e.currentTarget.dataset.id
    const machine = ALL_MACHINES.find(m => m.id === id)
    if (!machine) return
    app.globalData.selectedMachine = machine
    wx.navigateTo({ url: '/pages/machine/detail' })
  }
})
