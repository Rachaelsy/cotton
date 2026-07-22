// pages/machine/booking.js — 农机预约
const app  = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const machineI18n = require('../../utils/machine-i18n')

function pad(n) { return String(n).padStart(2, '0') }
function today() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: machineI18n.getCopy('booking'),
    machine: null,
    lat: null,
    lng: null,
    plots: [{ label: '不指定地块', id: null, area: 0 }],
    plotIndex: 0,
    plotLabel: '不指定地块',
    workAddress: '',
    workAddrDetail: '',
    workDate: today(),
    minDate: today(),
    workArea: '',
    quantityLabel: machineI18n.getCopy('booking').area,
    quantityPlaceholder: machineI18n.getCopy('booking').areaPh,
    quantityUnit: machineI18n.getCopy('booking').mu,
    contactPhone: '',
    note: '',
    totalPrice: 0,
    deposit: 0,
    submitting: false
  },

  onLoad(query) {
    const info = wx.getSystemInfoSync()
    const cachedMachine = app.globalData.selectedMachine
    const machine = cachedMachine && String(cachedMachine.id) === String(query.id) ? cachedMachine : null
    const user = auth.getUser() || {}
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      machine,
      lat: query.lat || null,
      lng: query.lng || null,
      contactPhone: user.phone || ''
    })
    this.loadMachine(query.id)
    this.loadPlots()
  },

  async loadMachine(id) {
    if (!id) return
    let qs = ''
    if (this.data.lat && this.data.lng) qs = `?lat=${this.data.lat}&lng=${this.data.lng}`
    try {
      const res = await auth.request('GET', `/api/machines/${id}${qs}`)
      if (res.code !== 200) throw new Error(res.msg || this.data.copy.loadFail)
      const byDay = res.data.unit === '天'
      this.setData({
        machine: res.data,
        quantityLabel: byDay ? this.data.copy.rentalDays : this.data.copy.area,
        quantityPlaceholder: byDay ? this.data.copy.daysPh : this.data.copy.areaPh,
        quantityUnit: byDay ? this.data.copy.days : this.data.copy.mu,
        workArea: byDay ? '' : this.data.workArea
      }, () => this.calc())
      app.globalData.selectedMachine = res.data
    } catch (error) {
      wx.showToast({ title: error.message || this.data.copy.loadFail, icon: 'none' })
    }
  },

  onShow() {
    const lang = i18n.getLanguage()
    if (lang !== this.data.lang) {
      const copy = machineI18n.getCopy('booking', lang)
      const byDay = this.data.machine && this.data.machine.unit === '天'
      this.setData({
        lang, copy,
        quantityLabel: byDay ? copy.rentalDays : copy.area,
        quantityPlaceholder: byDay ? copy.daysPh : copy.areaPh,
        quantityUnit: byDay ? copy.days : copy.mu
      })
      this.loadPlots()
    }
  },

  async loadPlots() {
    try {
      const res = await auth.request('GET', '/api/plots')
      if (res.code === 200 && Array.isArray(res.data)) {
        const plots = [{ label: this.data.copy.noPlot, id: null, area: 0 }].concat(
          res.data.map(p => ({ label: `${p.name} · ${Number(p.area || 0)}${this.data.copy.mu}`, id: p.id, area: Number(p.area || 0), name: p.name }))
        )
        const plotIndex = Math.min(this.data.plotIndex, plots.length - 1)
        this.setData({ plots, plotIndex, plotLabel: plots[plotIndex].label })
      }
    } catch (e) {}
  },

  onPlotChange(e) {
    const idx = Number(e.detail.value)
    const plot = this.data.plots[idx]
    const patch = { plotIndex: idx, plotLabel: plot.label }
    if (plot.area > 0 && this.data.machine && this.data.machine.unit !== '天') patch.workArea = String(plot.area)
    this.setData(patch, () => this.calc())
  },

  // 地图选点选作业地址
  onChooseAddress() {
    wx.chooseLocation({
      success: (res) => {
        // res: { name, address, latitude, longitude }
        const addr = res.name ? `${res.name}（${res.address}）` : res.address
        this.setData({
          workAddress: res.name || res.address || this.data.copy.location,
          workAddrDetail: addr,
          lat: res.latitude,   // 用选点坐标作为作业地点坐标
          lng: res.longitude
        })
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('auth') >= 0) {
          wx.showModal({
            title: this.data.copy.permission, content: this.data.copy.permissionContent,
            confirmText: this.data.copy.settings, success: (r) => { if (r.confirm) wx.openSetting() }
          })
        }
      }
    })
  },

  // 手动输入地址（地图选不到时的兜底）
  onAddrInput(e) {
    this.setData({ workAddress: e.detail.value, workAddrDetail: e.detail.value, lat: null, lng: null })
  },

  onDateChange(e) { this.setData({ workDate: e.detail.value }) },
  onAreaInput(e) { this.setData({ workArea: e.detail.value }, () => this.calc()) },
  onPhoneInput(e) { this.setData({ contactPhone: e.detail.value }) },
  onNoteInput(e) { this.setData({ note: e.detail.value }) },

  calc() {
    const { machine, workArea } = this.data
    if (!machine) return
    const area = parseFloat(workArea) || 0
    const total = +(Number(machine.price) * area).toFixed(2)
    const deposit = total > 0 ? Math.max(0.01, +(total * 0.2).toFixed(2)) : 0
    this.setData({ totalPrice: total, deposit })
  },

  async onSubmit() {
    const { machine, plots, plotIndex, workDate, workArea, contactPhone, note, lat, lng } = this.data
    if (!machine) return
    if (!this.data.workAddress || !this.data.workAddress.trim()) { wx.showToast({ title: this.data.copy.needAddress, icon: 'none' }); return }
    if (workDate < today()) { wx.showToast({ title: this.data.copy.invalidDate, icon: 'none' }); return }
    if (!workArea || parseFloat(workArea) <= 0) { wx.showToast({ title: this.data.copy.needArea, icon: 'none' }); return }
    if (machine.unit === '天' && (!Number.isInteger(Number(workArea)) || Number(workArea) > 365)) {
      wx.showToast({ title: this.data.copy.needArea, icon: 'none' }); return
    }
    if (!/^1[3-9]\d{9}$/.test(String(contactPhone || '').trim())) { wx.showToast({ title: this.data.copy.needPhone, icon: 'none' }); return }
    if (this.data.submitting) return
    this.setData({ submitting: true })
    const plot = plots[plotIndex]
    try {
      const res = await auth.request('POST', '/api/machine-orders', {
        machine_id: machine.id,
        plot_id: plot.id,
        plot_name: plot.id ? plot.name : '',
        work_address: this.data.workAddrDetail || this.data.workAddress,
        work_date: workDate,
        work_area: parseFloat(workArea),
        pay_mode: 'deposit',
        farmer_lat: lat, farmer_lng: lng,
        contact_phone: contactPhone,
        note
      })
      if (res.code === 200) {
        app.globalData.machineOrder = {
          id: res.data.id, order_no: res.data.order_no,
          total_price: res.data.total_price, deposit: res.data.deposit,
          machine_name: machine.name, machine_icon: machine.icon
        }
        wx.redirectTo({ url: `/pages/machine/pay?id=${res.data.id}` })
      } else {
        this.setData({ submitting: false })
        wx.showToast({ title: res.msg || this.data.copy.submitFail, icon: 'none' })
      }
    } catch (e) {
      this.setData({ submitting: false })
      wx.showToast({ title: this.data.copy.network, icon: 'none' })
    }
  },

  onBack() { wx.navigateBack() }
})
