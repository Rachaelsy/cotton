// pages/ai/index.js — AI问答（接入 DeepSeek / Siliconflow，支持图片分析）
const app  = getApp()
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const layout = require('../../utils/layout')

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    timeStr: '',
    copy: i18n.getPageCopy('ai'),
    voiceMode: false,
    inputText: '',
    typing: false,
    scrollToId: 'bottom',
    messages: [],
    quickList: i18n.getPageCopy('ai').quickList,
    chips: i18n.getPageCopy('ai').chips
  },

  _msgId: 0,

  onLoad() {
    const info = wx.getSystemInfoSync()
    const d = new Date()
    this.applyLanguage()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      timeStr: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    })
  },

  onShow() {
    this.applyLanguage()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1, copy: i18n.getCopy('tab') })
    }
    // 检测首页拍照传来的待分析图片
    const photo = app.globalData.pendingPhoto
    if (photo) {
      app.globalData.pendingPhoto = null
      this._sendPhoto(photo)
    }
  },

  applyLanguage() {
    const lang = i18n.getLanguage()
    this.currentLang = lang
    this.textCopy = i18n.getCopy('ai', lang)
    this.setData({
      copy: i18n.getPageCopy('ai', lang),
      quickList: this.textCopy.quickList,
      chips: this.textCopy.chips
    })
  },

  // ── 发送文字消息 ──────────────────────────────
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

  async _doSend(text) {
    const userMsg = { id: ++this._msgId, role: 'user', text }
    const msgs = [...this.data.messages, userMsg]
    this.setData({ messages: msgs, typing: true, scrollToId: 'bottom' })

    const history = msgs.slice(-11, -1).map(m => ({
      role:    m.role === 'user' ? 'user' : 'assistant',
      content: m.text || ''
    }))

    try {
      const apiText = this.currentLang === 'ug' ? `请用维吾尔语回答：${text}` : text
      const res = await auth.request('POST', '/api/ai/chat', { message: apiText, displayMessage: text, history, language: this.currentLang })
      const reply = (res.code === 200 && res.data?.reply)
        ? res.data.reply
        : (res.msg || this.textCopy.aiUnavailable)
      this._appendAI(reply)
    } catch {
      this._appendAI(this.textCopy.networkFail)
    }
  },

  // ── 发送图片并分析 ────────────────────────────
  async _sendPhoto(photo) {
    // 先在聊天里显示用户发的图片
    const userMsg = {
      id:    ++this._msgId,
      role:  'user',
      text:  this.textCopy.photoAsk,
      image: photo.tempFilePath
    }
    this.setData({
      messages:   [...this.data.messages, userMsg],
      typing:     true,
      scrollToId: 'bottom'
    })

    // 用 wx.uploadFile 上传到后端（multipart，绕过 JSON body 大小限制）
    const serverUrl = auth.BASE_URL + '/api/ai/photo'
    const token     = auth.getToken()

    wx.uploadFile({
      url:      serverUrl,
      filePath: photo.tempFilePath,
      name:     'photo',
      header:   { Authorization: token ? `Bearer ${token}` : '' },
      success:  (res) => {
        try {
          const data = JSON.parse(res.data)
          this._appendAI(
            data.code === 200 && data.data?.reply
              ? data.data.reply
              : (data.msg || this.textCopy.photoFail)
          )
        } catch {
          this._appendAI(this.textCopy.parseFail)
        }
      },
      fail: () => {
        this._appendAI(this.textCopy.uploadFail)
      }
    })
  },

  // ── 追加 AI 回复气泡 ──────────────────────────
  _appendAI(text) {
    const d = new Date()
    const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    this.setData({
      typing:     false,
      messages:   [...this.data.messages, { id: ++this._msgId, role: 'ai', text, time: timeStr }],
      scrollToId: 'bottom'
    })
  },

  onToggleInput() {
    this.setData({ voiceMode: !this.data.voiceMode })
  },

  onVoice() {
    wx.showToast({ title: this.textCopy.voiceDeveloping, icon: 'none' })
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
            success: (r) => { if (r.confirm) this.setData({ messages: [] }) }
          })
        }
      }
    })
  }
})
