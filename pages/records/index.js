// pages/records/index.js — 农事记录（后端 API 驱动）
const auth = require('../../utils/auth')

// 农事类型 → 图标 / 背景色 / 默认标题
const typeOptions = [
  { type: '灌溉',   icon: '💧', bg: '#E3F2FD', title: '滴灌作业' },
  { type: '施肥',   icon: '🌿', bg: '#F3E5F5', title: '追施肥料' },
  { type: '打药',   icon: '🚿', bg: '#E8F5E9', title: '病虫害防治' },
  { type: '无人机', icon: '🚁', bg: '#E8F5E9', title: '无人机作业' },
  { type: '播种',   icon: '🌱', bg: '#E8F5E9', title: '棉花播种' },
  { type: '采收',   icon: '🌾', bg: '#FFF3E0', title: '棉花采收' },
  { type: '巡田',   icon: '👁', bg: '#FFF9C4', title: '人工巡田' },
  { type: '其他',   icon: '📌', bg: '#FFF9C4', title: '其他农事' }
]

function typeMeta(type) {
  return typeOptions.find(item => item.type === type) || { icon: '📌', bg: '#FFF9C4', title: type }
}

function shortField(plotName) {
  if (!plotName) return '全部地块'
  return plotName.split('·')[0].trim()
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function todayValue() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function nowTimeValue() {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDate(date) {
  if (!date) return ''
  const [, month, day] = date.split('-')
  return `${Number(month)}月${Number(day)}日`
}

function formatCost(cost) {
  const value = Number(cost || 0)
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return `${value}`
}

Page({
  data: {
    statusBarHeight: 20,
    viewMode: 'list',
    manageMode: false,
    typeFilter: '全部',
    fieldFilter: '全部地块',
    typeFilters: ['全部', '灌溉', '施肥', '打药', '无人机', '播种', '采收', '巡田', '其他'],
    fieldFilters: ['全部地块'],
    typeOptions,
    fieldOptions: ['全部地块'],
    weekDays: ['一', '二', '三', '四', '五', '六', '日'],
    records: [],            // 原始 API 数据
    displayRecords: [],
    calendarRecords: [],
    calendarDays: [],
    calendarMonth: todayValue().slice(0, 7),
    calendarLabel: '',
    selectedDate: '',
    calendarListTitle: '本月农事记录',
    loading: true,
    stats: {
      recordCount: 0,
      fieldCount: 0,
      costText: '0'
    },
    selectedIds: [],
    showAddModal: false,
    showDetail: false,
    modalStep: 1,
    selectedTypeIndex: -1,
    selectedType: null,
    selectedFieldLabel: '全部地块',
    editingId: null,
    currentRecord: null,
    form: {
      fieldIndex: 0,
      date: todayValue(),
      time: nowTimeValue(),
      amount: '',
      cost: '',
      worker: '本人',
      note: ''
    }
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.plotList = []   // [{ id, label }]
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      calendarLabel: this._monthLabel(this.data.calendarMonth)
    })
    this.initPage()
  },

  onShow() {
    if (this._inited) this.loadRecords()
  },

  async initPage() {
    await this.loadPlots()
    await this.loadRecords()
    this._inited = true
  },

  // 加载用户真实地块，构建地块下拉选项
  async loadPlots() {
    try {
      const res = await auth.request('GET', '/api/plots')
      if (res.code === 200 && Array.isArray(res.data)) {
        this.plotList = res.data.map(p => ({
          id: p.id,
          label: `${p.name} · ${Number(p.area || 0)}亩`
        }))
      }
    } catch (e) {
      this.plotList = []
    }
    const fieldOptions = ['全部地块', ...this.plotList.map(p => p.label)]
    this.setData({
      fieldOptions,
      fieldFilters: fieldOptions
    })
  },

  // 加载农事记录
  async loadRecords() {
    this.setData({ loading: true })
    try {
      const res = await auth.request('GET', '/api/farm-records')
      if (res.code === 200 && Array.isArray(res.data)) {
        this.setData({ records: res.data, loading: false })
        this.refreshView()
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: res.msg || '加载失败', icon: 'none' })
      }
    } catch (e) {
      this.setData({ loading: false })
      this._showReqError(e)
    }
  },

  onBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/index/index' })
  },

  onViewMode(e) {
    this.setData({
      viewMode: e.currentTarget.dataset.mode,
      selectedIds: [],
      manageMode: false
    })
    this.refreshView()
  },

  onToggleManage() {
    this.setData({
      manageMode: !this.data.manageMode,
      selectedIds: []
    })
    this.refreshView()
  },

  onTypeFilter(e) {
    this.setData({
      typeFilter: e.currentTarget.dataset.type,
      selectedIds: []
    })
    this.refreshView()
  },

  onFieldFilter(e) {
    this.setData({
      fieldFilter: e.currentTarget.dataset.field,
      selectedIds: []
    })
    this.refreshView()
  },

  onCalendarPrev() {
    const [year, month] = this.data.calendarMonth.split('-').map(Number)
    const nextYear = month === 1 ? year - 1 : year
    const nextMonth = month === 1 ? 12 : month - 1
    const calendarMonth = `${nextYear}-${pad(nextMonth)}`
    this.setData({
      calendarMonth,
      calendarLabel: this._monthLabel(calendarMonth),
      selectedDate: ''
    })
    this.refreshView()
  },

  onCalendarNext() {
    const [year, month] = this.data.calendarMonth.split('-').map(Number)
    const nextYear = month === 12 ? year + 1 : year
    const nextMonth = month === 12 ? 1 : month + 1
    const calendarMonth = `${nextYear}-${pad(nextMonth)}`
    this.setData({
      calendarMonth,
      calendarLabel: this._monthLabel(calendarMonth),
      selectedDate: ''
    })
    this.refreshView()
  },

  onCalendarDay(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    this.setData({
      selectedDate: this.data.selectedDate === date ? '' : date
    })
    this.refreshView()
  },

  onRecordTap(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (this.data.manageMode) {
      this.toggleRecordSelection(id)
      return
    }
    const raw = this.data.records.find(item => item.id === id)
    this.setData({
      currentRecord: this.buildRecordView(raw),
      showDetail: true
    })
  },

  onCloseDetail() {
    this.setData({
      showDetail: false,
      currentRecord: null
    })
  },

  onEditRecord() {
    const record = this.data.currentRecord
    if (!record) return

    const typeIndex = this.data.typeOptions.findIndex(item => item.type === record.type)
    let fieldIndex = this.data.fieldOptions.findIndex(item => item === record.fieldFull)
    if (fieldIndex < 0) fieldIndex = 0

    this.setData({
      showDetail: false,
      showAddModal: true,
      modalStep: 2,
      editingId: record.id,
      selectedTypeIndex: typeIndex,
      selectedType: this.data.typeOptions[typeIndex] || null,
      selectedFieldLabel: this.data.fieldOptions[fieldIndex] || '全部地块',
      form: {
        fieldIndex,
        date: record.date,
        time: record.time,
        amount: record.amount === '记录完成' ? '' : record.amount,
        cost: record.cost ? String(record.cost) : '',
        worker: record.worker,
        note: record.note
      }
    })
  },

  onDeleteCurrentRecord() {
    const record = this.data.currentRecord
    if (!record) return

    wx.showModal({
      title: '删除记录',
      content: `确定删除「${record.title}」吗？`,
      confirmColor: '#DC2626',
      success: async res => {
        if (!res.confirm) return
        try {
          const r = await auth.request('DELETE', `/api/farm-records/${record.id}`)
          if (r.code === 200) {
            this.setData({ showDetail: false, currentRecord: null })
            wx.showToast({ title: '已删除记录', icon: 'none' })
            this.loadRecords()
          } else {
            wx.showToast({ title: r.msg || '删除失败', icon: 'none' })
          }
        } catch (e) {
          this._showReqError(e)
        }
      }
    })
  },

  onOpenAddRecord() {
    this.setData({
      showAddModal: true,
      modalStep: 1,
      selectedTypeIndex: -1,
      selectedType: null,
      selectedFieldLabel: this.data.fieldOptions[0] || '全部地块',
      editingId: null,
      form: {
        fieldIndex: 0,
        date: todayValue(),
        time: nowTimeValue(),
        amount: '',
        cost: '',
        worker: '本人',
        note: ''
      }
    })
  },

  onCloseAddModal() {
    this.setData({
      showAddModal: false,
      modalStep: 1,
      selectedTypeIndex: -1,
      selectedType: null,
      editingId: null
    })
  },

  onSelectRecordType(e) {
    const selectedTypeIndex = Number(e.currentTarget.dataset.index)
    this.setData({
      selectedTypeIndex,
      selectedType: this.data.typeOptions[selectedTypeIndex],
      modalStep: 2
    })
  },

  onPrevModalStep() {
    this.setData({ modalStep: 1 })
  },

  onFieldChange(e) {
    const fieldIndex = Number(e.detail.value)
    this.setData({
      'form.fieldIndex': fieldIndex,
      selectedFieldLabel: this.data.fieldOptions[fieldIndex]
    })
  },

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value })
  },

  onTimeChange(e) {
    this.setData({ 'form.time': e.detail.value })
  },

  onAmountInput(e) {
    this.setData({ 'form.amount': e.detail.value })
  },

  onCostInput(e) {
    this.setData({ 'form.cost': e.detail.value })
  },

  onWorkerInput(e) {
    this.setData({ 'form.worker': e.detail.value })
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value })
  },

  async onSaveRecord() {
    const { selectedTypeIndex, typeOptions: options, form, editingId } = this.data
    const typeInfo = options[selectedTypeIndex]
    if (!typeInfo) {
      wx.showToast({ title: '请先选择农事类型', icon: 'none' })
      return
    }
    if (!form.date) {
      wx.showToast({ title: '请选择日期', icon: 'none' })
      return
    }

    const fieldIndex = form.fieldIndex
    const plotLabel = this.data.fieldOptions[fieldIndex] || '全部地块'
    const plot = fieldIndex === 0 ? null : this.plotList[fieldIndex - 1]

    const payload = {
      plot_id: plot ? plot.id : null,
      plot_name: plotLabel,
      type: typeInfo.type,
      title: typeInfo.title,
      work_date: form.date,
      work_time: form.time || '08:00',
      amount: form.amount.trim(),
      cost: Number(form.cost || 0),
      worker: form.worker.trim() || '本人',
      note: form.note.trim()
    }
    await this._submitRecord(payload, editingId)
  },

  async _submitRecord(payload, editingId) {
    try {
      const r = editingId
        ? await auth.request('PUT', `/api/farm-records/${editingId}`, payload)
        : await auth.request('POST', '/api/farm-records', payload)
      if (r.code === 200) {
        this.setData({
          showAddModal: false,
          modalStep: 1,
          selectedTypeIndex: -1,
          selectedType: null,
          editingId: null
        })
        wx.showToast({ title: editingId ? '记录已更新' : '记录已添加', icon: 'none' })
        this.loadRecords()
      } else {
        wx.showToast({ title: r.msg || '保存失败', icon: 'none' })
      }
    } catch (e) {
      this._showReqError(e)
    }
  },

  onSelectAll() {
    const visibleIds = this.data.displayRecords.map(item => item.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => this.data.selectedIds.includes(id))
    this.setData({
      selectedIds: allSelected ? [] : visibleIds
    })
    this.refreshView()
  },

  onDeleteSelected() {
    const ids = this.data.selectedIds
    if (!ids.length) return

    wx.showModal({
      title: '批量删除',
      content: `确定删除选中的 ${ids.length} 条农事记录吗？`,
      confirmColor: '#DC2626',
      success: async res => {
        if (!res.confirm) return
        try {
          const r = await auth.request('POST', '/api/farm-records/batch-delete', { ids })
          if (r.code === 200) {
            this.setData({ selectedIds: [], manageMode: false })
            wx.showToast({ title: r.msg || `已删除 ${ids.length} 条`, icon: 'none' })
            this.loadRecords()
          } else {
            wx.showToast({ title: r.msg || '删除失败', icon: 'none' })
          }
        } catch (e) {
          this._showReqError(e)
        }
      }
    })
  },

  toggleRecordSelection(id) {
    const selectedIds = this.data.selectedIds.slice()
    const index = selectedIds.indexOf(id)
    if (index >= 0) selectedIds.splice(index, 1)
    else selectedIds.push(id)
    this.setData({ selectedIds })
    this.refreshView()
  },

  refreshView() {
    const selectedSet = new Set(this.data.selectedIds)
    const records = this.data.records
      .map(item => this.buildRecordView(item))
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))

    const displayRecords = records
      .filter(item => {
        const typeMatched = this.data.typeFilter === '全部' || item.type === this.data.typeFilter
        const fieldMatched = this.data.fieldFilter === '全部地块' || item.fieldFull === this.data.fieldFilter
        return typeMatched && fieldMatched
      })
      .map(item => ({
        ...item,
        selected: selectedSet.has(item.id)
      }))

    const stats = this.buildStats(records)
    const calendar = this.buildCalendar(records)

    this.setData({
      displayRecords,
      stats,
      calendarDays: calendar.days,
      calendarRecords: calendar.records,
      calendarLabel: calendar.label,
      calendarListTitle: calendar.listTitle
    })
  },

  buildRecordView(record) {
    if (!record) return null
    const meta = typeMeta(record.type)
    const cost = Number(record.cost || 0)
    const time = record.work_time || ''
    return {
      id: record.id,
      plot_id: record.plot_id,
      type: record.type,
      title: record.title || meta.title,
      field: shortField(record.plot_name),
      fieldFull: record.plot_name || '全部地块',
      icon: meta.icon,
      bg: meta.bg,
      date: record.work_date,
      time,
      amount: record.amount || '记录完成',
      cost,
      worker: record.worker || '本人',
      note: record.note || `已完成${record.type}作业`,
      dateText: `${formatDate(record.work_date)} ${time}`.trim(),
      costText: cost ? `¥${cost}` : '未填写',
      metaText: `${record.worker || '本人'} · ${formatDate(record.work_date)} ${time}`.trim()
    }
  },

  buildStats(records) {
    const fields = new Set(records.map(item => item.field).filter(name => name && name !== '全部地块'))
    const cost = records.reduce((sum, item) => sum + Number(item.cost || 0), 0)
    return {
      recordCount: records.length,
      fieldCount: fields.size,
      costText: formatCost(cost)
    }
  },

  buildCalendar(records) {
    const [year, month] = this.data.calendarMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDay = new Date(year, month - 1, 1).getDay()
    const startBlanks = (firstDay + 6) % 7
    const today = todayValue()
    const recordsByDate = records.reduce((map, item) => {
      if (!map[item.date]) map[item.date] = []
      map[item.date].push(item)
      return map
    }, {})
    const days = []

    for (let i = 0; i < startBlanks; i += 1) {
      days.push({ key: `blank-${i}`, day: '', date: '', hasRecords: false, count: 0, isToday: false })
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${pad(month)}-${pad(day)}`
      const dayRecords = recordsByDate[date] || []
      days.push({
        key: date,
        day,
        date,
        hasRecords: dayRecords.length > 0,
        count: dayRecords.length,
        isToday: date === today
      })
    }

    const monthPrefix = `${year}-${pad(month)}`
    const selectedDate = this.data.selectedDate
    const calendarRecords = selectedDate
      ? records.filter(item => item.date === selectedDate)
      : records.filter(item => item.date && item.date.startsWith(monthPrefix))
    const listTitle = selectedDate
      ? `${formatDate(selectedDate)}农事记录`
      : '本月农事记录'

    return {
      days,
      records: calendarRecords,
      label: `${year}年${month}月`,
      listTitle: `${listTitle}（${calendarRecords.length}条）`
    }
  },

  _monthLabel(ym) {
    const [year, month] = ym.split('-').map(Number)
    return `${year}年${month}月`
  },

  // 统一请求错误提示：区分登录失效与网络异常
  _showReqError(e) {
    const expired = e && e.message === '未登录'
    wx.showToast({ title: expired ? '登录已过期，请重新登录' : '网络异常', icon: 'none' })
  },

  noop() {}
})
