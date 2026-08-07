// pages/ai/index.js — AI问答（DeepSeek 文本、Siliconflow 图片、WechatSI 中文语音）
const app  = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')
const { markdownToRichTextNodes } = require('../../utils/markdown')

const HISTORY_KEY = 'ai_chat_history_v1'
const MAX_HISTORY = 30
const MAX_TTS_CHARS = 180
const VOICE_RESULT_TIMEOUT_MS = 12000
const VOICE_START_TIMEOUT_MS = 6000
const VOICE_AUTHORIZE_TIMEOUT_MS = 8000

function loadWechatSI() {
  if (typeof requirePlugin !== 'function') return null
  try {
    return requirePlugin('WechatSI')
  } catch (error) {
    return null
  }
}

const WechatSI = loadWechatSI()
const speechManager = WechatSI && typeof WechatSI.getRecordRecognitionManager === 'function'
  ? WechatSI.getRecordRecognitionManager()
  : null

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    timeStr: '',
    copy: i18n.getPageCopy('ai'),
    tabCopy: i18n.getCopy('tab'),
    voiceMode: false,
    voiceSupported: !!speechManager,
    voiceLiveText: '',
    inputText: '',
    typing: false,
    recordingStarting: false,
    recording: false,
    recognizing: false,
    speaking: false,
    voiceAnswerEnabled: false,
    speakingMessageId: null,
    scrollToId: 'bottom',
    messages: [],
    quickList: i18n.getPageCopy('ai').quickList,
    chips: i18n.getPageCopy('ai').chips
  },

  _msgId: 0,
  _speechReady: false,
  _voiceCancelled: false,
  _voiceTouchActive: false,
  _voiceStopRequested: false,
  _voiceResultHandled: false,
  _voiceTimeoutNotified: false,
  _speechActuallyStarted: false,
  _voicePendingStop: false,
  _voiceAuthorizeTimer: null,
  _voiceStartTimer: null,
  _voiceStopFallbackTimer: null,
  _lastRecognizedText: '',
  _autoJumpTimer: null,
  _trainingPromptConsumed: false,
  _audio: null,

  onLoad() {
    const info = wx.getSystemInfoSync()
    const d = new Date()
    this.applyLanguage()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      timeStr: this._formatTime(d),
      messages: this._loadHistory(),
      voiceSupported: !!speechManager
    })
    this._initSpeech()
    setTimeout(() => this._consumeTrainingPrompt(), 200)
  },

  onShow() {
    this.applyLanguage()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1, copy: i18n.getCopy('tab') })
    }

    if (app.globalData.aiPreferVoice) {
      app.globalData.aiPreferVoice = false
      this.setData({ voiceMode: true })
    }

    this._consumeTrainingPrompt()
  },

  onUnload() {
    this._cleanupVoiceRuntime({ destroyAudio: true })
  },

  onHide() {
    this._cleanupVoiceRuntime()
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.currentLang = lang
    this.textCopy = i18n.getCopy('ai', lang)
    this.setData({
      copy: i18n.getPageCopy('ai', lang),
      tabCopy: i18n.getCopy('tab', lang),
      quickList: this.textCopy.quickList,
      chips: this.textCopy.chips
    })
  },

  onQuick(e) {
    const q = e.currentTarget.dataset.q
    this.setData({ inputText: q })
    this._doSend(q)
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  onSend() {
    const text = this.data.inputText.trim()
    if (!text || this.data.typing) return
    this.setData({ inputText: '' })
    this._doSend(text)
  },

  _consumeTrainingPrompt() {
    if (this._trainingPromptConsumed || this.data.typing) return
    const prompt = wx.getStorageSync('ai_training_prompt')
    if (!prompt) return
    this._trainingPromptConsumed = true
    wx.removeStorageSync('ai_training_prompt')
    this._doSend(prompt)
  },

  async _doSend(text, options = {}) {
    const userMsg = {
      id: ++this._msgId,
      role: 'user',
      text,
      voice: !!options.fromVoice,
      time: this._formatTime()
    }
    const msgs = [...this.data.messages, userMsg]
    this.setData({ messages: msgs, typing: true, scrollToId: 'bottom' })
    this._saveHistory(msgs)

    const history = msgs.slice(-11, -1).map(m => ({
      role:    m.role === 'user' ? 'user' : 'assistant',
      content: m.text || ''
    }))

    try {
      const apiText = this.currentLang === 'ug' ? `请用维吾尔语回答：${text}` : text
      const res = await auth.request('POST', '/api/ai/chat', {
        message: apiText,
        displayMessage: text,
        history,
        language: this.currentLang
      })
      const reply = (res.code === 200 && res.data?.reply)
        ? res.data.reply
        : (res.msg || this.textCopy.aiUnavailable)
      this._appendAI(reply, {
        intent: res.data && res.data.intent,
        jump: res.data && res.data.jump,
        provider: res.data && res.data.provider
      }, {
        speak: options.fromVoice || this.data.voiceAnswerEnabled
      })
    } catch {
      this._appendAI(this.textCopy.networkFail, {}, {
        speak: options.fromVoice || this.data.voiceAnswerEnabled
      })
    }
  },

  _appendAI(text, extra = {}, options = {}) {
    const timeStr = this._formatTime()
    const id = ++this._msgId
    const speakable = extra.speakable !== false &&
      this.currentLang !== 'ug' &&
      !!(WechatSI && typeof WechatSI.textToSpeech === 'function')
    const messages = [
      ...this.data.messages,
      {
        id,
        role: 'ai',
        text,
        richTextNodes: markdownToRichTextNodes(text),
        time: timeStr,
        intent: extra.intent || null,
        jump: extra.jump || null,
        provider: extra.provider || '',
        speakable
      }
    ]
    this.setData({
      typing:     false,
      messages,
      scrollToId: 'bottom'
    })
    this._saveHistory(messages)
    if (options.speak && speakable) this._speak(text, id)
    if (extra.jump && extra.jump.autoOpen) this._scheduleJump(extra.jump)
  },

  onToggleInput() {
    this.setData({ voiceMode: !this.data.voiceMode })
  },

  onToggleVoiceAnswer() {
    if (this.currentLang === 'ug') {
      wx.showToast({ title: this.textCopy.voiceAnswerUnsupported || this.textCopy.ugVoiceUnsupported, icon: 'none' })
      return
    }
    const voiceAnswerEnabled = !this.data.voiceAnswerEnabled
    this.setData({ voiceAnswerEnabled })
    wx.showToast({
      title: voiceAnswerEnabled ? this.textCopy.voiceAnswerOn : this.textCopy.voiceAnswerOff,
      icon: 'none'
    })
  },

  onReplayAnswer(e) {
    const id = Number(e.currentTarget.dataset.id || 0)
    const message = this.data.messages.find(item => Number(item.id) === id)
    if (!(message && message.text && message.speakable)) return
    if (this.data.speaking && Number(this.data.speakingMessageId) === id) {
      this._stopSpeechPlayback()
      return
    }
    this._speak(message.text, id)
  },

  _initSpeech() {
    if (this._speechReady) return
    this._speechReady = true
    if (!speechManager) {
      this.setData({ voiceSupported: false })
      return
    }

    this._bindSpeechCallback('onStart', () => {
      this._clearVoiceAuthorizeGuard()
      this._clearVoiceStartGuard()
      this._speechActuallyStarted = true
      this._lastRecognizedText = ''
      this._voiceTimeoutNotified = false
      this.setData({ recordingStarting: false, recording: true, recognizing: false, voiceLiveText: this.textCopy.voiceListening })
      if (!this._voiceTouchActive || this._voicePendingStop) {
        const cancelled = this._voiceCancelled
        this._voicePendingStop = false
        setTimeout(() => this._stopSpeechRecord({ cancelled }), 0)
      }
    })
    this._bindSpeechCallback('onRecognize', (res) => {
      const text = String((res && res.result) || '').trim()
      if (!text) return
      this._lastRecognizedText = text
      if (this.data.recording || this.data.recognizing) this.setData({ voiceLiveText: text })
    })
    this._bindSpeechCallback('onStop', (res) => {
      const text = this._pickVoiceText(res)
      const alreadyHandled = this._voiceResultHandled
      const timedOut = this._voiceTimeoutNotified
      this._clearVoiceStartGuard()
      this._clearVoiceStopFallback()
      this._voiceTouchActive = false
      this._voiceStopRequested = false
      this._voiceResultHandled = false
      this._voiceTimeoutNotified = false
      this._speechActuallyStarted = false
      this._voicePendingStop = false
      this.setData({ recordingStarting: false, recording: false, recognizing: false, voiceLiveText: '' })
      if (alreadyHandled) {
        this._lastRecognizedText = ''
        return
      }
      if (this._voiceCancelled) {
        this._voiceCancelled = false
        this._lastRecognizedText = ''
        return
      }
      if (!text && timedOut) {
        this._lastRecognizedText = ''
        return
      }
      this._sendVoiceText(text)
    })
    this._bindSpeechCallback('onError', (error) => {
      console.error('[ai-voice] speechManager error', error)
      this._clearVoiceAuthorizeGuard()
      this._clearVoiceStartGuard()
      this._clearVoiceStopFallback()
      this._voiceTouchActive = false
      this._voiceStopRequested = false
      this._voiceResultHandled = false
      this._voiceTimeoutNotified = false
      this._speechActuallyStarted = false
      this._voicePendingStop = false
      this._lastRecognizedText = ''
      this.setData({ recordingStarting: false, recording: false, recognizing: false, voiceLiveText: '' })
      this._appendVoiceFailure({
        stage: '微信语音插件回调',
        reason: 'WechatSI 返回错误',
        error
      })
    })
  },

  _bindSpeechCallback(name, handler) {
    if (!speechManager) return
    if (typeof speechManager[name] === 'function') {
      try {
        speechManager[name](handler)
      } catch (error) {
        console.warn(`[ai-voice] ${name} method bind failed`, error)
      }
    }
    try {
      speechManager[name] = handler
    } catch (error) {
      console.warn(`[ai-voice] ${name} property bind failed`, error)
    }
  },

  onVoiceStart() {
    if (this.data.typing || this.data.recording || this.data.recordingStarting || this.data.recognizing) return
    if (this.currentLang === 'ug') {
      this._appendAI(this.textCopy.ugVoiceUnsupported)
      return
    }
    if (!speechManager) {
      this._appendAI(this.textCopy.voicePluginMissing)
      return
    }
    this._voiceTouchActive = true
    this._voiceStopRequested = false
    this._voiceResultHandled = false
    this._voiceTimeoutNotified = false
    this._speechActuallyStarted = false
    this._voicePendingStop = false
    this._lastRecognizedText = ''
    this._clearVoiceAuthorizeGuard()
    this._clearVoiceStartGuard()
    this._clearVoiceStopFallback()
    this.setData({ recordingStarting: true, recording: false, recognizing: false, voiceLiveText: this.textCopy.voicePreparing })
    this._armVoiceAuthorizeGuard()
    this._requestRecordPermission()
  },

  _requestRecordPermission() {
    if (typeof wx.getSetting !== 'function') {
      this._authorizeRecordPermission()
      return
    }
    wx.getSetting({
      success: (setting) => {
        const authSetting = setting && setting.authSetting
        if (authSetting && authSetting['scope.record']) {
          this._clearVoiceAuthorizeGuard()
          this._startSpeechRecord()
          return
        }
        this._authorizeRecordPermission()
      },
      fail: () => this._authorizeRecordPermission()
    })
  },

  _authorizeRecordPermission() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this._clearVoiceAuthorizeGuard()
        this._startSpeechRecord()
      },
      fail: () => {
        this._clearVoiceAuthorizeGuard()
        this._voiceTouchActive = false
        this.setData({ recordingStarting: false, recording: false, recognizing: false, voiceLiveText: '' })
        wx.showModal({
          title: this.textCopy.recordPermissionTitle,
          content: this.textCopy.recordPermissionContent,
          confirmText: this.textCopy.openSetting,
          success: (res) => {
            if (!res.confirm) return
            wx.openSetting({
              success: (setting) => {
                if (setting.authSetting && setting.authSetting['scope.record']) {
                  this._startSpeechRecord()
                }
              }
            })
          }
        })
      }
    })
  },

  _armVoiceAuthorizeGuard() {
    this._clearVoiceAuthorizeGuard()
    this._voiceAuthorizeTimer = setTimeout(() => {
      this._voiceAuthorizeTimer = null
      if (!this.data.recordingStarting || this._speechActuallyStarted) return
      this._voiceTouchActive = false
      this._voiceStopRequested = false
      this._voiceResultHandled = false
      this._voiceTimeoutNotified = true
      this._voicePendingStop = false
      this.setData({ recordingStarting: false, recording: false, recognizing: false, voiceLiveText: '' })
      this._appendVoiceFailure({
        stage: '麦克风权限检查',
        reason: '麦克风权限检查超时'
      })
    }, VOICE_AUTHORIZE_TIMEOUT_MS)
  },

  _clearVoiceAuthorizeGuard() {
    if (!this._voiceAuthorizeTimer) return
    clearTimeout(this._voiceAuthorizeTimer)
    this._voiceAuthorizeTimer = null
  },

  _startSpeechRecord() {
    if (!this._voiceTouchActive) {
      this.setData({ recordingStarting: false, voiceLiveText: '' })
      wx.showToast({ title: this.textCopy.voiceReadyAgain, icon: 'none' })
      return
    }
    this._voiceCancelled = false
    this._voiceStopRequested = false
    this._voiceResultHandled = false
    this._voiceTimeoutNotified = false
    this._speechActuallyStarted = false
    this._voicePendingStop = false
    this._lastRecognizedText = ''
    this._clearVoiceAuthorizeGuard()
    this._clearVoiceStartGuard()
    this._clearVoiceStopFallback()
    this._stopSpeechPlayback()
    this.setData({ recordingStarting: true, recording: false, recognizing: false, voiceLiveText: this.textCopy.voicePreparing })
    try {
      speechManager.start({ duration: 60000, lang: 'zh_CN' })
      this._armVoiceStartGuard()
    } catch (error) {
      this._voiceTouchActive = false
      this._speechActuallyStarted = false
      this._voicePendingStop = false
      this.setData({ recordingStarting: false, recording: false, recognizing: false, voiceLiveText: '' })
      this._appendVoiceFailure({
        stage: '启动微信语音插件',
        reason: 'speechManager.start 调用失败',
        error
      })
    }
  },

  onVoiceEnd() {
    this._stopSpeechRecord({ cancelled: false })
  },

  onVoiceCancel() {
    this._stopSpeechRecord({ cancelled: true })
  },

  onVoiceGlobalEnd() {
    if (!this._hasActiveVoiceTouch()) return
    this._stopSpeechRecord({ cancelled: false })
  },

  onVoiceGlobalCancel() {
    if (!this._hasActiveVoiceTouch()) return
    this._stopSpeechRecord({ cancelled: true })
  },

  onVoiceTapFallback() {
    if (!this._hasActiveVoiceTouch()) return
    this._stopSpeechRecord({ cancelled: false })
  },

  _hasActiveVoiceTouch() {
    return this._voiceTouchActive || this.data.recordingStarting || this.data.recording
  },

  _stopSpeechRecord({ cancelled = false } = {}) {
    this._voiceTouchActive = false
    if (cancelled) this._voiceCancelled = true

    if (this.data.recordingStarting && !this._speechActuallyStarted) {
      this._voicePendingStop = true
      const liveText = cancelled ? '' : this.textCopy.voiceRecognizing
      this.setData({ recordingStarting: true, recording: false, recognizing: !cancelled, voiceLiveText: liveText })
      return
    }
    if (!this.data.recording) return

    if (!speechManager) {
      this._voiceStopRequested = false
      this.setData({ recordingStarting: false, recording: false, recognizing: false, voiceLiveText: '' })
      return
    }
    if (this._voiceStopRequested) return

    this._voiceStopRequested = true
    const liveText = cancelled ? '' : (this._pickVoiceText() || this.textCopy.voiceRecognizing)
    this.setData({ recordingStarting: false, recording: false, recognizing: !cancelled, voiceLiveText: liveText })
    try {
      speechManager.stop()
      this._armVoiceStopFallback()
    } catch (error) {
      console.error('[ai-voice] speechManager stop failed', error)
      this._clearVoiceStopFallback()
      this._voiceStopRequested = false
      this._voiceTimeoutNotified = false
      this._speechActuallyStarted = false
      this._voicePendingStop = false
      this.setData({ recognizing: false, voiceLiveText: '' })
      this._appendVoiceFailure({
        stage: '停止录音',
        reason: 'speechManager.stop 调用失败',
        error
      })
    }
  },

  _armVoiceStartGuard() {
    this._clearVoiceStartGuard()
    this._voiceStartTimer = setTimeout(() => {
      this._voiceStartTimer = null
      if (!this.data.recordingStarting || this._speechActuallyStarted) return
      this._voiceTouchActive = false
      this._voiceStopRequested = false
      this._voiceResultHandled = false
      this._voiceTimeoutNotified = true
      this._voicePendingStop = false
      this.setData({ recordingStarting: false, recording: false, recognizing: false, voiceLiveText: '' })
      try {
        speechManager.stop()
      } catch (error) {}
      this._appendVoiceFailure({
        stage: '启动微信语音插件',
        reason: '微信语音插件启动超时'
      })
    }, VOICE_START_TIMEOUT_MS)
  },

  _clearVoiceStartGuard() {
    if (!this._voiceStartTimer) return
    clearTimeout(this._voiceStartTimer)
    this._voiceStartTimer = null
  },

  _armVoiceStopFallback() {
    this._clearVoiceStopFallback()
    this._voiceStopFallbackTimer = setTimeout(() => {
      this._voiceStopFallbackTimer = null
      if (!this._voiceStopRequested) return
      const text = this._pickVoiceText()
      const wasCancelled = this._voiceCancelled
      this._voiceStopRequested = false
      this._voiceCancelled = false
      this.setData({ recordingStarting: false, recording: false, recognizing: false, voiceLiveText: '' })
      if (wasCancelled) {
        this._voiceTimeoutNotified = false
        this._lastRecognizedText = ''
        return
      }
      if (text) {
        this._voiceResultHandled = true
        this._voiceTimeoutNotified = false
        this._sendVoiceText(text)
      } else {
        this._voiceTimeoutNotified = true
        this._appendVoiceFailure({
          stage: '等待识别结果',
          reason: '等待识别结果超时'
        })
      }
    }, VOICE_RESULT_TIMEOUT_MS)
  },

  _clearVoiceStopFallback() {
    if (!this._voiceStopFallbackTimer) return
    clearTimeout(this._voiceStopFallbackTimer)
    this._voiceStopFallbackTimer = null
  },

  _appendVoiceFailure({ stage = '', reason = '', error = null } = {}) {
    const detail = this._formatVoiceError(error)
    const title = this.textCopy.voiceRecognizeFail || this.textCopy.voiceRecognizeTimeout || '语音识别失败'
    const lines = [title]
    if (stage) lines.push(`阶段：${stage}`)
    if (reason) lines.push(`原因：${reason}`)
    if (detail) lines.push(`微信返回：${detail}`)
    lines.push('请检查麦克风权限、WechatSI 插件配置和手机网络后重试。')
    this._appendAI(lines.join('\n'))
  },

  _formatVoiceError(error) {
    if (!error) return ''
    if (typeof error === 'string') return error
    const code = error.errCode || error.errcode || error.code || error.errNo || ''
    const message = error.errMsg || error.errmsg || error.message || error.msg || ''
    const parts = []
    if (code) parts.push(`code: ${code}`)
    if (message) parts.push(`msg: ${message}`)
    if (parts.length) return parts.join('，')
    try {
      return JSON.stringify(error)
    } catch (e) {
      return String(error)
    }
  },

  _pickVoiceText(res = {}) {
    const text = String((res && res.result) || this._lastRecognizedText || '').trim()
    const placeholders = [
      this.textCopy.voicePreparing,
      this.textCopy.voiceListening,
      this.textCopy.voiceRecognizing
    ]
    return placeholders.includes(text) ? '' : text
  },

  _sendVoiceText(text) {
    const finalText = String(text || '').trim()
    this._lastRecognizedText = ''
    if (!finalText) {
      this._appendAI(this.textCopy.voiceEmpty)
      return
    }
    this._doSend(finalText, { fromVoice: true })
  },

  onJump(e) {
    this._openJump({
      url: e.currentTarget.dataset.url,
      method: e.currentTarget.dataset.method
    })
  },

  _scheduleJump(jump) {
    if (!(jump && jump.url)) return
    if (this._autoJumpTimer) clearTimeout(this._autoJumpTimer)
    wx.showToast({ title: this.textCopy.autoOpening, icon: 'none', duration: 800 })
    this._autoJumpTimer = setTimeout(() => this._openJump(jump), 900)
  },

  _openJump(jump) {
    const { url, method } = jump || {}
    if (!url) return
    const go = method === 'switchTab' ? wx.switchTab : wx.navigateTo
    go({
      url,
      fail: () => {
        wx.navigateTo({
          url,
          fail: () => wx.showToast({ title: this.textCopy.jumpFail, icon: 'none' })
        })
      }
    })
  },

  _speak(text, messageId = null) {
    if (this.currentLang === 'ug') return false
    if (!(WechatSI && typeof WechatSI.textToSpeech === 'function')) return false
    const content = String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/[⚠️⏱📷🔌]/g, '')
      .trim()
      .slice(0, MAX_TTS_CHARS)
    if (!content) return false

    WechatSI.textToSpeech({
      lang: 'zh_CN',
      tts: true,
      content,
      success: (res) => {
        const src = res && (res.filename || res.fileName)
        if (!src) return
        this._playSpeech(src, messageId)
      },
      fail: () => {
        this.setData({ speaking: false, speakingMessageId: null })
      }
    })
    return true
  },

  _playSpeech(src, messageId = null) {
    this._configureSpeechAudio()
    if (!this._audio) {
      this._audio = wx.createInnerAudioContext()
      this._audio.onEnded(() => this.setData({ speaking: false, speakingMessageId: null }))
      this._audio.onError(() => this.setData({ speaking: false, speakingMessageId: null }))
    }
    this._audio.stop()
    this._audio.volume = 1
    this._audio.src = src
    this.setData({ speaking: true, speakingMessageId: messageId })
    this._audio.play()
  },

  _configureSpeechAudio() {
    if (typeof wx.setInnerAudioOption !== 'function') return
    wx.setInnerAudioOption({
      obeyMuteSwitch: false,
      mixWithOther: false
    })
  },

  _stopSpeechPlayback() {
    if (this._audio) this._audio.stop()
    if (this.data.speaking || this.data.speakingMessageId) {
      this.setData({ speaking: false, speakingMessageId: null })
    }
  },

  _cleanupVoiceRuntime(options = {}) {
    if (this._autoJumpTimer) {
      clearTimeout(this._autoJumpTimer)
      this._autoJumpTimer = null
    }
    this._clearVoiceAuthorizeGuard()
    this._clearVoiceStartGuard()
    this._clearVoiceStopFallback()
    this._voiceTouchActive = false
    this._voiceStopRequested = false
    this._voiceResultHandled = false
    this._voiceTimeoutNotified = false
    this._speechActuallyStarted = false
    this._voicePendingStop = false
    if (this.data.recording && speechManager) {
      this._voiceCancelled = true
      try {
        speechManager.stop()
      } catch (error) {}
    }
    this._stopSpeechPlayback()
    if (options.destroyAudio && this._audio) {
      this._audio.destroy()
      this._audio = null
    }
    if (this.data.recordingStarting || this.data.recording || this.data.recognizing || this.data.voiceLiveText) {
      this.setData({ recordingStarting: false, recording: false, recognizing: false, voiceLiveText: '' })
    }
  },

  _formatTime(date = new Date()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  },

  _loadHistory() {
    try {
      const saved = wx.getStorageSync(HISTORY_KEY)
      if (!Array.isArray(saved)) return []
      const messages = saved.slice(-MAX_HISTORY)
        .map(item => {
          if (item && item.role === 'ai') {
            return {
              ...item,
              richTextNodes: markdownToRichTextNodes(item.text || '')
            }
          }
          return item
        })
      const maxId = messages.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0)
      this._msgId = maxId
      return messages
    } catch (error) {
      return []
    }
  },

  _saveHistory(messages = this.data.messages) {
    try {
      const safeMessages = messages
        .filter(item => !item.image)
        .slice(-MAX_HISTORY)
      wx.setStorageSync(HISTORY_KEY, safeMessages)
    } catch (error) {}
  },

  onMore() {
    wx.showActionSheet({
      itemList: this.textCopy.moreItems,
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showModal({
            title: this.textCopy.clearTitle,
            content: this.textCopy.clearContent,
            confirmColor: '#DC2626',
            success: (r) => {
              if (r.confirm) {
                this.setData({ messages: [] })
                wx.removeStorageSync(HISTORY_KEY)
              }
            }
          })
        } else if (res.tapIndex === 2) {
          wx.showModal({
            title: this.textCopy.helpTitle,
            content: this.textCopy.helpContent,
            showCancel: false
          })
        }
      }
    })
  }
})
