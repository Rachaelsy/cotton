const app = getApp()
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')
const { getPestCopy } = require('../../utils/pest-copy')
const { decorateHistoryRecord } = require('../../utils/pest-recognition')

const HISTORY_KEY = 'pest_recognition_history'

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    scrollTop: 0,
    copy: getPestCopy('index', i18n.getLanguage()),
    commonCountText: '',
    pests: getPestCopy('index', i18n.getLanguage()).pests,
    filter: getPestCopy('index', i18n.getLanguage()).filters[0],
    filters: getPestCopy('index', i18n.getLanguage()).filters,
    filteredPests: [],
    recentHistory: []
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.applyLanguage()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight()
    })
    this._applyFilter(this.data.filters[0])
    this._loadHistory()
  },

  onShow() {
    this.applyLanguage()
    this.setData({ scrollTop: 0 })
    this._applyFilter(this.data.filter || this.data.filters[0])
    this._loadHistory()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.textCopy = getPestCopy('index', lang)
    this.setData({
      copy: this.textCopy,
      pests: this.textCopy.pests,
      filters: this.textCopy.filters,
      commonCountText: this.textCopy.commonCount(this.textCopy.pests.length)
    })
  },

  _applyFilter(filter) {
    const all = this.data.pests
    const rootFilter = this.data.filters[0]
    const result = filter === rootFilter ? all : all.filter(item => item.type === filter)
    this.setData({ filteredPests: result, filter })
  },

  _loadHistory() {
    const stored = wx.getStorageSync(HISTORY_KEY)
    const history = Array.isArray(stored) ? stored : []
    this.setData({
      recentHistory: history.slice(0, 6).map(item => decorateHistoryRecord(item, this.textCopy))
    })
  },

  onFilterTap(e) {
    this._applyFilter(e.currentTarget.dataset.val)
  },

  onTakePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => this._openResultPage(res.tempFiles[0].tempFilePath),
      fail: () => wx.showToast({ title: this.textCopy.photoCancel, icon: 'none' })
    })
  },

  onChooseAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => this._openResultPage(res.tempFiles[0].tempFilePath),
      fail: () => wx.showToast({ title: this.textCopy.albumCancel, icon: 'none' })
    })
  },

  _openResultPage(filePath) {
    app.globalData.pendingPestPhoto = { tempFilePath: filePath }
    wx.navigateTo({ url: '/pages/pest/result' })
  },

  onHistory() {
    const list = this.data.recentHistory
    if (!list.length) {
      wx.showToast({ title: this.textCopy.noHistory, icon: 'none' })
      return
    }
    wx.showActionSheet({
      itemList: list.slice(0, 6).map(item => `${item.title}｜${item.displaySeverity}`),
      success: (res) => {
        const picked = list[res.tapIndex]
        if (!picked) return
        app.globalData.pestRecognitionResult = picked
        wx.navigateTo({ url: `/pages/pest/result?mode=history&id=${picked.id}` })
      }
    })
  },

  onHistoryTap(e) {
    const id = e.currentTarget.dataset.id
    const record = this.data.recentHistory.find(item => item.id === id)
    if (!record) return
    app.globalData.pestRecognitionResult = record
    wx.navigateTo({ url: `/pages/pest/result?mode=history&id=${record.id}` })
  },

  onPestTap(e) {
    wx.navigateTo({ url: `/pages/pest/detail?id=${e.currentTarget.dataset.id}` })
  },

  onBack() {
    wx.navigateBack()
  }
})
