const app = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')
const { getPestCopy } = require('../../utils/pest-copy')
const { buildDiagnosisView, decorateHistoryRecord, normalizeImageUrl } = require('../../utils/pest-recognition')

const HISTORY_KEY = 'pest_recognition_history'

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    copy: getPestCopy('detail', i18n.getLanguage()),
    resultCopy: getPestCopy('result', i18n.getLanguage()),
    phase: 'loading',
    previewImage: '',
    scanStepIndex: 0,
    scanStepText: '',
    recognition: null,
    pest: getPestCopy('detail', i18n.getLanguage()).pest,
    severityLevels: getPestCopy('detail', i18n.getLanguage()).severityLevels,
    severityTipText: '',
    symptomList: [],
    evidenceList: [],
    errorText: ''
  },

  _scanTimer: null,

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    this.options = options || {}
    this.applyLanguage()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight()
    })
  },

  onShow() {
    this.applyLanguage()
    if (this.data.phase === 'done' && this.data.recognition) {
      return
    }
    if (this.options.mode === 'history') {
      this._loadExistingResult()
      return
    }
    this._startRecognitionFlow()
  },

  onUnload() {
    this._clearScanTimer()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.detailCopy = getPestCopy('detail', lang)
    this.resultCopy = getPestCopy('result', lang)
    this.indexCopy = getPestCopy('index', lang)
    this.setData({
      copy: this.detailCopy,
      resultCopy: this.resultCopy,
      severityLevels: this.detailCopy.severityLevels,
      scanStepText: this.resultCopy.scanningSteps[this.data.scanStepIndex] || this.resultCopy.scanningSteps[0]
    })
  },

  _loadExistingResult() {
    const recognition = app.globalData.pestRecognitionResult
    if (!recognition) {
      this.setData({
        phase: 'error',
        errorText: this.indexCopy.noHistory
      })
      return
    }
    this.setData({
      previewImage: recognition.image || recognition.localImage || ''
    })
    this._applyRecognition(decorateHistoryRecord(recognition, this.indexCopy))
  },

  _startRecognitionFlow() {
    const pending = app.globalData.pendingPestPhoto
    if (!pending || !pending.tempFilePath) {
      this.setData({
        phase: 'error',
        errorText: this.indexCopy.uploadFail
      })
      return
    }
    app.globalData.pendingPestPhoto = null
    this.setData({
      previewImage: pending.tempFilePath
    })
    this._startScanAnimation()
    this._recognizePhoto(pending.tempFilePath)
  },

  _startScanAnimation() {
    this._clearScanTimer()
    this.setData({
      phase: 'loading',
      recognition: null,
      scanStepIndex: 0,
      scanStepText: this.resultCopy.scanningSteps[0]
    })
    this._scanTimer = setInterval(() => {
      const currentIndex = this.data.scanStepIndex
      const lastIndex = this.resultCopy.scanningSteps.length - 1
      if (currentIndex >= lastIndex) {
        this._clearScanTimer()
        return
      }
      const nextIndex = currentIndex + 1
      this.setData({
        scanStepIndex: nextIndex,
        scanStepText: this.resultCopy.scanningSteps[nextIndex]
      })
    }, 1300)
  },

  _clearScanTimer() {
    if (this._scanTimer) {
      clearInterval(this._scanTimer)
      this._scanTimer = null
    }
  },

  _recognizePhoto(filePath) {
    wx.uploadFile({
      url: auth.BASE_URL + '/api/ai/photo',
      filePath,
      name: 'photo',
      header: { Authorization: auth.getToken() ? `Bearer ${auth.getToken()}` : '' },
      success: (res) => {
        try {
          const payload = JSON.parse(res.data || '{}')
          if (payload.code !== 200 || !(payload.data && payload.data.reply)) {
            throw new Error(payload.msg || this.indexCopy.recognizeFail)
          }
          const diagnosis = payload.data.diagnosis || null
          const record = {
            id: `pest-${Date.now()}`,
            image: payload.data.image_url || filePath,
            localImage: filePath,
            reply: payload.data.reply,
            diagnosis,
            title: diagnosis && diagnosis.diagnosis_name ? diagnosis.diagnosis_name : this.indexCopy.pendingTitle,
            summary: diagnosis && diagnosis.summary ? diagnosis.summary : payload.data.reply,
            createdAt: Date.now()
          }
          const decorated = decorateHistoryRecord(record, this.indexCopy)
          app.globalData.pestRecognitionResult = decorated
          this._saveHistory(record)
          this._applyRecognition(decorated)
        } catch (error) {
          this._showError(error.message || this.indexCopy.parseFail)
        }
      },
      fail: (error) => {
        this._showError((error && error.errMsg) || this.indexCopy.uploadFail)
      }
    })
  },

  _saveHistory(entry) {
    const stored = wx.getStorageSync(HISTORY_KEY)
    const history = Array.isArray(stored) ? stored : []
    const next = [entry, ...history.filter(item => item.id !== entry.id)].slice(0, 12)
    wx.setStorageSync(HISTORY_KEY, next)
  },

  _applyRecognition(recognition) {
    this._clearScanTimer()
    const view = buildDiagnosisView(recognition, this.detailCopy)
    this.setData({
      phase: 'done',
      recognition: {
        ...recognition,
        image: normalizeImageUrl(recognition.image),
        warning: view.warning,
        confidence: view.confidence
      },
      pest: view.pest,
      symptomList: view.symptomList,
      evidenceList: view.evidenceList,
      severityTipText: view.severityTipText,
      errorText: ''
    })
  },

  _showError(message) {
    this._clearScanTimer()
    this.setData({
      phase: 'error',
      errorText: message || this.resultCopy.scanFail
    })
  },

  onRetry() {
    if (this.options.mode === 'history') {
      wx.navigateBack()
      return
    }
    const recognition = this.data.recognition
    const localImage = recognition && recognition.localImage
    if (!localImage) {
      this.setData({ phase: 'error', errorText: this.indexCopy.uploadFail })
      return
    }
    app.globalData.pendingPestPhoto = { tempFilePath: localImage }
    this._startRecognitionFlow()
  },

  onBackToList() {
    wx.navigateBack()
  },

  onBuyProduct(e) {
    wx.showToast({ title: this.detailCopy.addedCart(e.currentTarget.dataset.name), icon: 'success', duration: 2000 })
  },

  onShare() {
    wx.showToast({ title: this.detailCopy.shareDeveloping, icon: 'none' })
  },

  onBack() {
    wx.navigateBack()
  },

  onShareAppMessage() {
    return {
      title: this.detailCopy.shareTitle(this.data.pest.name),
      path: '/pages/pest/index'
    }
  }
})
