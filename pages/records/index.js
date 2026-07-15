// pages/records/index.js — 农事记录（后端 API 驱动）
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')
const i18n = require('../../utils/i18n')

const TYPE_LABELS = {
  ug: { '全部': 'ھەممىسى', '灌溉': 'سۇغىرىش', '施肥': 'ئوغۇتلاش', '打药': 'دورا پۈركۈش', '无人机': 'ئۇچقۇچىسىز ئۈسكۈنە', '播种': 'تېرىش', '采收': 'يىغىش', '巡田': 'ئېتىز ئايلىنىش', '其他': 'باشقا' }
}

const COPY = {
  zh: {
    title: '农事记录', manage: '管理', done: '完成', countUnit: '次农事', plotUnit: '块地', costUnit: '元投入', list: '列表', calendar: '日历',
    manageTip: '管理模式 · 点击记录选择，可多选后批量删除', viewPlot: '查看地块', switch: '切换 ›', allPlots: '全部地块',
    loading: '加载中…', emptyAll: '还没有农事记录', emptyMatch: '暂无匹配记录', emptyAllDesc: '点击右下角 + 记录第一笔农事', emptyMatchDesc: '换个类型或地块筛选试试',
    monthRecords: '本月农事记录', noRecords: '暂无记录', cancelSelectAll: '取消全选', selectAll: '全选', delete: '删除',
    editRecord: '编辑农事记录', addRecord: '新增农事记录', chooseType: '选择农事类型', cancel: '取消', fillDetails: '填写详情信息',
    plot: '地块', date: '日期', time: '时间', amount: '用量', amountPh: '如：用水量 800 方、尿素 5kg', cost: '成本', worker: '执行人', me: '本人',
    note: '备注', notePh: '记录农事过程、药肥名称、田间情况…', prev: '上一步', update: '更新', save: '保存', type: '类型', deleteOne: '删除', edit: '编辑',
    noCost: '未填写', completed: '记录完成', recordUpdated: '记录已更新', recordAdded: '记录已添加', loadFail: '加载失败', saveFail: '保存失败', network: '网络异常',
    chooseTypeToast: '请先选择农事类型', chooseDate: '请选择日期', choosePlot: '请关联到具体地块后再保存', deleteTitle: '删除记录', deleted: '已删除记录', deleteFail: '删除失败',
    batchDelete: '批量删除', loginExpired: '登录已过期，请重新登录', recordsSuffix: '条'
  },
  ug: {
    title: 'دېھقانچىلىق خاتىرىسى', manage: 'باشقۇرۇش', done: 'تامام', countUnit: 'قېتىم ئىش', plotUnit: 'پارچە يەر', costUnit: 'يۈەن خىراجەت', list: 'تىزىملىك', calendar: 'كالېندار',
    manageTip: 'باشقۇرۇش · خاتىرىنى تاللاپ تۈركۈملەپ ئۆچۈرەلەيسىز', viewPlot: 'يەر بويىچە كۆرۈش', switch: 'ئالماشتۇرۇش ›', allPlots: 'بارلىق يەر',
    loading: 'يۈكلىنىۋاتىدۇ…', emptyAll: 'تېخى خاتىرە يوق', emptyMatch: 'ماس خاتىرە يوق', emptyAllDesc: 'ئوڭ ئاستىدىكى + نى بېسىپ تۇنجى خاتىرىنى قوشۇڭ', emptyMatchDesc: 'باشقا تۈر ياكى يەر تاللاپ سىناڭ',
    monthRecords: 'بۇ ئايدىكى خاتىرىلەر', noRecords: 'خاتىرە يوق', cancelSelectAll: 'ھەممىنى تاللاشنى بىكار قىلىش', selectAll: 'ھەممىنى تاللاش', delete: 'ئۆچۈرۈش',
    editRecord: 'خاتىرىنى تەھرىرلەش', addRecord: 'خاتىرە قوشۇش', chooseType: 'دېھقانچىلىق تۈرىنى تاللاش', cancel: 'بىكار قىلىش', fillDetails: 'تەپسىلاتنى تولدۇرۇش',
    plot: 'يەر', date: 'چېسلا', time: 'ۋاقىت', amount: 'مىقدار', amountPh: 'مەسىلەن: 800 كۇب سۇ، 5kg ئۇرېيە', cost: 'خىراجەت', worker: 'ئىجرا قىلغۇچى', me: 'ئۆزۈم',
    note: 'ئىزاھ', notePh: 'ئىش جەريانى، دورا-ئوغۇت نامى ۋە ئېتىز ئەھۋالى…', prev: 'ئالدىنقى', update: 'يېڭىلاش', save: 'ساقلاش', type: 'تۈرى', deleteOne: 'ئۆچۈرۈش', edit: 'تەھرىرلەش',
    noCost: 'تولدۇرۇلمىغان', completed: 'خاتىرە تامام', recordUpdated: 'خاتىرە يېڭىلاندى', recordAdded: 'خاتىرە قوشۇلدى', loadFail: 'يۈكلەش مەغلۇپ', saveFail: 'ساقلاش مەغلۇپ', network: 'تور نورمال ئەمەس',
    chooseTypeToast: 'ئالدى بىلەن تۈر تاللاڭ', chooseDate: 'چېسلا تاللاڭ', choosePlot: 'كونكرېت يەرنى باغلاڭ', deleteTitle: 'خاتىرىنى ئۆچۈرۈش', deleted: 'خاتىرە ئۆچۈرۈلدى', deleteFail: 'ئۆچۈرۈش مەغلۇپ',
    batchDelete: 'تۈركۈملەپ ئۆچۈرۈش', loginExpired: 'كىرىش ۋاقتى ئۆتتى، قايتا كىرىڭ', recordsSuffix: 'دانە'
  }
}

function typeLabel(type, lang) {
  return lang === 'ug' ? (TYPE_LABELS.ug[type] || type) : type
}

function displayTypeOptions(lang) {
  return typeOptions.map(item => ({ ...item, label: typeLabel(item.type, lang), displayTitle: i18n.localizeText(item.title, lang) }))
}

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
    lang: i18n.getLanguage(),
    copy: COPY[i18n.getLanguage()],
    capsuleSafeRight: 0,
    viewMode: 'list',
    manageMode: false,
    typeFilter: '全部',
    fieldFilter: '全部地块',
    fieldPickerIndex: 0,
    typeFilters: ['全部', '灌溉', '施肥', '打药', '无人机', '播种', '采收', '巡田', '其他'].map(value => ({ value, label: typeLabel(value, i18n.getLanguage()) })),
    fieldFilters: [{ value: '全部地块', label: COPY[i18n.getLanguage()].allPlots }],
    typeOptions: displayTypeOptions(i18n.getLanguage()),
    fieldOptions: ['全部地块'],
    fieldDisplayOptions: [COPY[i18n.getLanguage()].allPlots],
    fieldFilterLabel: COPY[i18n.getLanguage()].allPlots,
    weekDays: i18n.getLanguage() === 'ug' ? ['د', 'س', 'چ', 'پ', 'ج', 'ش', 'ي'] : ['一', '二', '三', '四', '五', '六', '日'],
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

  onLoad(options = {}) {
    const info = wx.getSystemInfoSync()
    this.initialPlotId = Number(options.plotId) || null
    this.initialType = options.type ? decodeURIComponent(options.type) : ''
    this.plotList = []   // [{ id, label }]
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      calendarLabel: this._monthLabel(this.data.calendarMonth)
    })
    this.initPage()
  },

  onShow() {
    const lang = i18n.getLanguage()
    if (lang !== this.data.lang) this.applyLanguage(lang)
    if (this._inited) this.loadRecords()
  },

  applyLanguage(lang) {
    const copy = COPY[lang]
    const displayOptions = [copy.allPlots, ...this.plotList.map(p => `${p.name} · ${p.area}${lang === 'ug' ? ' مو' : '亩'}`)]
    this.setData({
      lang, copy,
      typeFilters: ['全部', '灌溉', '施肥', '打药', '无人机', '播种', '采收', '巡田', '其他'].map(value => ({ value, label: typeLabel(value, lang) })),
      typeOptions: displayTypeOptions(lang),
      fieldDisplayOptions: displayOptions,
      fieldFilters: this.data.fieldOptions.map((value, index) => ({ value, label: displayOptions[index] || value })),
      fieldFilterLabel: displayOptions[this.data.fieldPickerIndex] || copy.allPlots,
      weekDays: lang === 'ug' ? ['د', 'س', 'چ', 'پ', 'ج', 'ش', 'ي'] : ['一', '二', '三', '四', '五', '六', '日']
    })
    this.refreshView()
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
          name: p.name,
          area: Number(p.area || 0),
          label: `${p.name} · ${Number(p.area || 0)}亩`,
          displayLabel: `${p.name} · ${Number(p.area || 0)}${this.data.lang === 'ug' ? ' مو' : '亩'}`
        }))
      }
    } catch (e) {
      this.plotList = []
    }
    const fieldOptions = ['全部地块', ...this.plotList.map(p => p.label)]
    const initialPlot = this.initialPlotId
      ? this.plotList.find(plot => Number(plot.id) === this.initialPlotId)
      : null
    const initialLabel = initialPlot ? initialPlot.label : '全部地块'
    const initialIndex = initialPlot ? fieldOptions.indexOf(initialLabel) : 0
    this.setData({
      fieldOptions,
      fieldDisplayOptions: [this.data.copy.allPlots, ...this.plotList.map(p => p.displayLabel)],
      fieldFilters: fieldOptions.map((value, index) => ({ value, label: index ? this.plotList[index - 1].displayLabel : this.data.copy.allPlots })),
      fieldFilter: initialLabel,
      fieldFilterLabel: initialPlot ? initialPlot.displayLabel : this.data.copy.allPlots,
      fieldPickerIndex: initialIndex >= 0 ? initialIndex : 0,
      selectedFieldLabel: initialLabel,
      typeFilter: this.initialType || this.data.typeFilter,
      'form.fieldIndex': initialIndex
    })
  },

  // 加载农事记录
  async loadRecords() {
    this.setData({ loading: true })
    try {
      const params = []
      if (this.data.typeFilter && this.data.typeFilter !== '全部') {
        params.push(`type=${encodeURIComponent(this.data.typeFilter)}`)
      }
      const plot = this._currentFilterPlot()
      if (plot && plot.id) params.push(`plot_id=${encodeURIComponent(plot.id)}`)
      const query = params.length ? `?${params.join('&')}` : ''
      const res = await auth.request('GET', `/api/farm-records${query}`)
      if (res.code === 200 && Array.isArray(res.data)) {
        this.setData({ records: res.data, loading: false })
        this.refreshView()
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: res.msg || this.data.copy.loadFail, icon: 'none' })
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
    this.loadRecords()
  },

  onFieldFilter(e) {
    const field = e.currentTarget.dataset.field
    const index = this.data.fieldOptions.indexOf(field)
    this.setData({
      fieldFilter: field,
      fieldFilterLabel: this.data.fieldFilters[index >= 0 ? index : 0]?.label || this.data.copy.allPlots,
      fieldPickerIndex: index >= 0 ? index : 0,
      selectedFieldLabel: field,
      selectedIds: []
    })
    this.loadRecords()
  },

  onFieldPickerChange(e) {
    const index = Number(e.detail.value)
    const field = this.data.fieldOptions[index] || '全部地块'
    this.setData({
      fieldFilter: field,
      fieldFilterLabel: this.data.fieldDisplayOptions[index] || this.data.copy.allPlots,
      fieldPickerIndex: index,
      selectedFieldLabel: field,
      selectedIds: []
    })
    this.loadRecords()
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
        amount: record.amount === '记录完成' || record.amount === this.data.copy.completed ? '' : record.amount,
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
      title: this.data.copy.deleteTitle,
      content: this.data.lang === 'ug' ? `«${record.title}» ئۆچۈرۈلسۇنمۇ؟` : `确定删除「${record.title}」吗？`,
      confirmColor: '#DC2626',
      success: async res => {
        if (!res.confirm) return
        try {
          const r = await auth.request('DELETE', `/api/farm-records/${record.id}`)
          if (r.code === 200) {
            this.setData({ showDetail: false, currentRecord: null })
            wx.showToast({ title: this.data.copy.deleted, icon: 'none' })
            this.loadRecords()
          } else {
            wx.showToast({ title: r.msg || this.data.copy.deleteFail, icon: 'none' })
          }
        } catch (e) {
          this._showReqError(e)
        }
      }
    })
  },

  onOpenAddRecord() {
    const defaultFieldIndex = this.getDefaultFieldIndex()
    const defaultFieldLabel = this.data.fieldOptions[defaultFieldIndex] || '全部地块'
    this.setData({
      showAddModal: true,
      modalStep: 1,
      selectedTypeIndex: -1,
      selectedType: null,
      selectedFieldLabel: defaultFieldLabel,
      editingId: null,
      form: {
        fieldIndex: defaultFieldIndex,
        date: todayValue(),
        time: nowTimeValue(),
        amount: '',
        cost: '',
        worker: this.data.copy.me,
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
      wx.showToast({ title: this.data.copy.chooseTypeToast, icon: 'none' })
      return
    }
    if (!form.date) {
      wx.showToast({ title: this.data.copy.chooseDate, icon: 'none' })
      return
    }

    const fieldIndex = this.getSafeFieldIndex(form.fieldIndex)
    if (this.initialPlotId && fieldIndex === 0) {
      wx.showToast({ title: this.data.copy.choosePlot, icon: 'none' })
      return
    }
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
      worker: form.worker.trim() || this.data.copy.me,
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
        wx.showToast({ title: editingId ? this.data.copy.recordUpdated : this.data.copy.recordAdded, icon: 'none' })
        this.loadRecords()
      } else {
        wx.showToast({ title: r.msg || this.data.copy.saveFail, icon: 'none' })
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
      title: this.data.copy.batchDelete,
      content: this.data.lang === 'ug' ? `تاللانغان ${ids.length} خاتىرە ئۆچۈرۈلسۇنمۇ؟` : `确定删除选中的 ${ids.length} 条农事记录吗？`,
      confirmColor: '#DC2626',
      success: async res => {
        if (!res.confirm) return
        try {
          const r = await auth.request('POST', '/api/farm-records/batch-delete', { ids })
          if (r.code === 200) {
            this.setData({ selectedIds: [], manageMode: false })
            wx.showToast({ title: r.msg || (this.data.lang === 'ug' ? `${ids.length} خاتىرە ئۆچۈرۈلدى` : `已删除 ${ids.length} 条`), icon: 'none' })
            this.loadRecords()
          } else {
            wx.showToast({ title: r.msg || this.data.copy.deleteFail, icon: 'none' })
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
    const filterPlot = this._currentFilterPlot()
    const records = this.data.records
      .map(item => this.buildRecordView(item))
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))

    const displayRecords = records
      .filter(item => {
        const typeMatched = this.data.typeFilter === '全部' || item.type === this.data.typeFilter
        const fieldMatched = !filterPlot || Number(item.plot_id) === Number(filterPlot.id) || item.fieldFull === this.data.fieldFilter
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

  _currentFilterPlot() {
    const index = Number(this.data.fieldPickerIndex || 0)
    if (index <= 0) return null
    return this.plotList[index - 1] || null
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
      title: i18n.localizeText(record.title || meta.title, this.data.lang),
      field: shortField(record.plot_name),
      fieldFull: record.plot_name || '全部地块',
      icon: meta.icon,
      bg: meta.bg,
      date: record.work_date,
      time,
      displayType: typeLabel(record.type, this.data.lang),
      amount: record.amount || this.data.copy.completed,
      cost,
      worker: record.worker || this.data.copy.me,
      note: record.note || (this.data.lang === 'ug' ? `${typeLabel(record.type, 'ug')} ئىشى تاماملاندى` : `已完成${record.type}作业`),
      dateText: `${formatDate(record.work_date)} ${time}`.trim(),
      costText: cost ? `¥${cost}` : this.data.copy.noCost,
      metaText: `${record.worker || this.data.copy.me} · ${this.data.lang === 'ug' ? record.work_date : formatDate(record.work_date)} ${time}`.trim()
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
      ? (this.data.lang === 'ug' ? `${selectedDate} خاتىرىلىرى` : `${formatDate(selectedDate)}农事记录`)
      : this.data.copy.monthRecords

    return {
      days,
      records: calendarRecords,
      label: this.data.lang === 'ug' ? `${year}-${pad(month)}` : `${year}年${month}月`,
      listTitle: `${listTitle}（${calendarRecords.length}${this.data.copy.recordsSuffix}）`
    }
  },

  _monthLabel(ym) {
    const [year, month] = ym.split('-').map(Number)
    return this.data && this.data.lang === 'ug' ? `${year}-${pad(month)}` : `${year}年${month}月`
  },

  // 新增时默认选择当前上下文地块（例如从地块详情跳转进来）。
  getDefaultFieldIndex() {
    const options = this.data.fieldOptions || []
    if (!options.length) return 0

    const selectedLabel = this.data.fieldFilter || this.data.selectedFieldLabel || ''
    const selectedIndex = options.indexOf(selectedLabel)
    if (selectedIndex >= 0) return selectedIndex

    return this.getSafeFieldIndex(this.data.form && this.data.form.fieldIndex)
  },

  getSafeFieldIndex(value) {
    const options = this.data.fieldOptions || []
    const index = Number(value)
    if (!Number.isInteger(index) || index < 0 || index >= options.length) return 0
    return index
  },

  // 统一请求错误提示：区分登录失效与网络异常
  _showReqError(e) {
    const expired = e && e.message === '未登录'
    wx.showToast({ title: expired ? this.data.copy.loginExpired : this.data.copy.network, icon: 'none' })
  },

  noop() {}
})
