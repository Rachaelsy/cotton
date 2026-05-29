// pages/ai/index.js — AI问答（接入 DeepSeek / Siliconflow，支持图片分析）
const app  = getApp()
const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    timeStr: '',
    voiceMode: false,
    inputText: '',
    typing: false,
    scrollToId: 'bottom',
    messages: [],
    quickList: [
      { i: '🌧', t: '今天能打药吗' },
      { i: '🌡', t: '地温适合播种吗' },
      { i: '🐛', t: '棉蚜怎么防治' },
      { i: '💰', t: '今日棉花收购价' }
    ],
    chips: ['施肥建议', '病虫害预警', '灌溉时机', '天气查询', '卖棉咨询']
  },

  _msgId: 0,

  onLoad() {
    const info = wx.getSystemInfoSync()
    const d = new Date()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      timeStr: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    // 检测首页拍照传来的待分析图片
    const photo = app.globalData.pendingPhoto
    if (photo) {
      app.globalData.pendingPhoto = null
      this._sendPhoto(photo)
    }
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
      const res = await auth.request('POST', '/api/ai/chat', { message: text, history })
      const reply = (res.code === 200 && res.data?.reply)
        ? res.data.reply
        : (res.msg || 'AI 服务暂时不可用，请稍后重试')
      this._appendAI(reply)
    } catch {
      this._appendAI('网络异常，请检查连接后重试 🔌')
    }
  },

  // ── 发送图片并分析 ────────────────────────────
  async _sendPhoto(photo) {
    // 先在聊天里显示用户发的图片
    const userMsg = {
      id:    ++this._msgId,
      role:  'user',
      text:  '帮我分析这张照片',
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
              : (data.msg || '图片分析失败，请重试')
          )
        } catch {
          this._appendAI('解析响应失败，请重试')
        }
      },
      fail: () => {
        this._appendAI('图片上传失败，请检查网络连接 🔌')
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
    wx.showToast({ title: '语音识别功能开发中', icon: 'none' })
  },

  onMore() {
    wx.showActionSheet({
      itemList: ['清空对话', '联系客服', '使用帮助'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showModal({
            title: '清空对话',
            content: '确认清除所有聊天记录？',
            confirmColor: '#DC2626',
            success: (r) => { if (r.confirm) this.setData({ messages: [] }) }
          })
        }
      }
    })
  }
})
