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

    copy: {},
    commonCountText: '',
    historyCountText: '',

    pests: [],
    filters: [],
    filter: '',
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

    this._applyFilter(this.data.filter || this.data.filters[0])
    this._loadHistory()
  },

  onShow() {
    this.applyLanguage()

    this.setData({
      scrollTop: 0
    })

    this._applyFilter(this.data.filter || this.data.filters[0])
    this._loadHistory()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    const copy = getPestCopy('index', lang)

    const pests = copy.pests || []
    const filters = copy.filters || []
    const currentFilter = this.data.filter || filters[0]

    const validFilter = filters.includes(currentFilter)
      ? currentFilter
      : filters[0]

    this.textCopy = copy

    this.setData({
      copy,
      pests,
      filters,
      filter: validFilter,
      commonCountText: copy.commonCount
        ? copy.commonCount(pests.length)
        : `${pests.length}`,
      historyCountText: ''
    })
  },

  _applyFilter(filter) {
    const pests = this.data.pests || []
    const filters = this.data.filters || []
    const rootFilter = filters[0]

    const result = filter === rootFilter
      ? pests
      : pests.filter(item => item.type === filter)

    const decoratedResult = result.map(item => ({
      ...item,
      tagClass: this._getTagClass(item.type)
    }))

    this.setData({
      filteredPests: decoratedResult,
      filter
    })
  },

  _getTagClass(type) {
    const filters = this.data.filters || []

    if (type === filters[1]) return 'tag-bug'
    if (type === filters[2]) return 'tag-disease'
    return 'tag-physio'
  },

  _loadHistory() {
    const stored = wx.getStorageSync(HISTORY_KEY)
    const history = Array.isArray(stored) ? stored : []

    const recentHistory = history
      .slice(0, 6)
      .map(item => decorateHistoryRecord(item, this.textCopy || this.data.copy))

    const copy = this.textCopy || this.data.copy

    this.setData({
      recentHistory,
      historyCountText: copy.historyCount
        ? copy.historyCount(recentHistory.length)
        : `${recentHistory.length}`
    })
  },

  onFilterTap(e) {
    const filter = e.currentTarget.dataset.val
    this._applyFilter(filter)
  },

  onTakePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (filePath) {
          this._openResultPage(filePath)
        }
      },
      fail: () => {
        wx.showToast({
          title: this.textCopy.photoCancel,
          icon: 'none'
        })
      }
    })
  },

  onChooseAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (filePath) {
          this._openResultPage(filePath)
        }
      },
      fail: () => {
        wx.showToast({
          title: this.textCopy.albumCancel,
          icon: 'none'
        })
      }
    })
  },

  _openResultPage(filePath) {
    app.globalData.pendingPestPhoto = {
      tempFilePath: filePath
    }

    wx.navigateTo({
      url: '/pages/pest/result'
    })
  },

  onHistory() {
    const list = this.data.recentHistory || []

    if (!list.length) {
      wx.showToast({
        title: this.textCopy.noHistory,
        icon: 'none'
      })
      return
    }

    wx.showActionSheet({
      itemList: list.map(item => `${item.title}｜${item.displaySeverity}`),
      success: (res) => {
        const picked = list[res.tapIndex]
        if (!picked) return

        app.globalData.pestRecognitionResult = picked

        wx.navigateTo({
          url: `/pages/pest/result?mode=history&id=${picked.id}`
        })
      }
    })
  },

  onHistoryTap(e) {
    const id = e.currentTarget.dataset.id
    const record = this.data.recentHistory.find(item => item.id === id)

    if (!record) return

    app.globalData.pestRecognitionResult = record

    wx.navigateTo({
      url: `/pages/pest/result?mode=history&id=${record.id}`
    })
  },

  onPestTap(e) {
    const id = e.currentTarget.dataset.id

    wx.navigateTo({
      url: `/pages/pest/detail?id=${id}`
    })
  },

  onBack() {
    wx.navigateBack()
  }
})