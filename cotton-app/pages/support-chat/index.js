const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')

const COPY = {
  zh: {
    title: '在线客服', serviceName: '平台客服', connected: '消息实时同步', connecting: '正在连接，消息仍可发送',
    welcome: '你好，请发送需要咨询的问题，平台管理员会尽快回复。', empty: '开始与平台客服沟通',
    inputPh: '输入消息…', send: '发送', sendFail: '消息发送失败', loadFail: '聊天记录加载失败',
    imageFail: '图片发送失败', loginRequired: '请先登录后联系客服',
    quoteMessage: '引用', copyMessage: '复制', recallMessage: '撤回', deleteMessage: '删除',
    recalledMine: '你撤回了一条消息', recalledOther: '客服撤回了一条消息',
    you: '你', imageMessage: '[图片]', replyingTo: '正在引用',
    read: '已读', unread: '未读', recallSuccess: '消息已撤回', deleteSuccess: '消息已删除',
    deleteTitle: '删除消息', deleteContent: '删除后仅你看不到这条消息，对方仍可查看。', operationFail: '操作失败'
  },
  ug: {
    title: 'تور مۇلازىمىتى', serviceName: 'سۇپا مۇلازىمىتى', connected: 'ئۇچۇر دەرھال ماسلىشىدۇ', connecting: 'ئۇلىنىۋاتىدۇ، ئۇچۇر يوللاشقا بولىدۇ',
    welcome: 'ياخشىمۇسىز، مەسىلىڭىزنى يوللاڭ، باشقۇرغۇچى تېزدىن جاۋاب بېرىدۇ.', empty: 'سۇپا مۇلازىمىتى بىلەن پاراڭنى باشلاڭ',
    inputPh: 'ئۇچۇر كىرگۈزۈڭ…', send: 'يوللاش', sendFail: 'ئۇچۇر يوللاش مەغلۇپ بولدى', loadFail: 'پاراڭ خاتىرىسىنى يۈكلىگىلى بولمىدى',
    imageFail: 'رەسىم يوللاش مەغلۇپ بولدى', loginRequired: 'مۇلازىمەت بىلەن ئالاقىلىشىش ئۈچۈن كىرىڭ',
    quoteMessage: 'نەقىل', copyMessage: 'كۆچۈرۈش', recallMessage: 'قايتۇرۇۋېلىش', deleteMessage: 'ئۆچۈرۈش',
    recalledMine: 'سىز بىر ئۇچۇرنى قايتۇرۇۋالدىڭىز', recalledOther: 'مۇلازىمەتچى بىر ئۇچۇرنى قايتۇرۇۋالدى',
    you: 'سىز', imageMessage: '[رەسىم]', replyingTo: 'نەقىل قىلىنىۋاتىدۇ',
    read: 'ئوقۇلدى', unread: 'ئوقۇلمىدى', recallSuccess: 'ئۇچۇر قايتۇرۇۋېلىندى', deleteSuccess: 'ئۇچۇر ئۆچۈرۈلدى',
    deleteTitle: 'ئۇچۇرنى ئۆچۈرۈش', deleteContent: 'ئۆچۈرگەندىن كېيىن پەقەت سىزگە كۆرۈنمەيدۇ، قارشى تەرەپ يەنىلا كۆرەلەيدۇ.', operationFail: 'مەشغۇلات مەغلۇپ بولدى'
  }
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return String(value).slice(11, 16)
  const pad = number => String(number).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

Page({
  data: {
    statusBarHeight: 20,
    copy: COPY[i18n.getLanguage()] || COPY.zh,
    messages: [],
    input: '',
    canSend: false,
    loading: true,
    sending: false,
    uploading: false,
    connected: false,
    scrollToId: '',
    replyingTo: null
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    if (!auth.isLoggedIn()) {
      wx.showToast({ title: this.data.copy.loginRequired, icon: 'none' })
      setTimeout(() => wx.redirectTo({ url: '/pages/login/index' }), 600)
    }
  },

  onShow() {
    this._active = true
    this.setData({ copy: COPY[i18n.getLanguage()] || COPY.zh, connected: false })
    if (!auth.isLoggedIn()) return
    this.loadMessages(true)
    this.connectSocket()
    this.startPolling()
  },

  onHide() { this.stopRealtime() },
  onUnload() { this.stopRealtime() },

  decorateMessage(item) {
    const recalled = !!item.is_recalled
    const reply = item.reply_to ? {
      id: Number(item.reply_to.id),
      label: item.reply_to.sender_type === 'farmer' ? this.data.copy.you : this.data.copy.serviceName,
      summary: item.reply_to.content || (item.reply_to.image_url ? this.data.copy.imageMessage : '')
    } : null
    return {
      ...item,
      mine: item.sender_type === 'farmer',
      recalled,
      imageSrc: !recalled && item.image_url ? auth.BASE_URL + item.image_url : '',
      reply,
      timeText: formatTime(item.created_at),
      readLabel: item.read_at ? this.data.copy.read : this.data.copy.unread
    }
  },

  async loadMessages(replace = false, showLoading = replace) {
    if (this._loadingMessages) return
    this._loadingMessages = true
    if (showLoading) this.setData({ loading: true })
    try {
      const current = this.data.messages
      const after = replace || !current.length ? 0 : current[current.length - 1].id
      const response = await auth.request('GET', `/api/feedback/chat/messages${after ? `?after=${after}` : ''}`)
      if (response.code !== 200) throw new Error(response.msg)
      const incoming = (response.data || []).map(item => this.decorateMessage(item))
      const messages = replace ? incoming : [...current, ...incoming.filter(item => !current.some(existing => existing.id === item.id))]
      this.setData({ messages, loading: false })
      if (incoming.length || showLoading) this.scrollToBottom(messages)
    } catch (error) {
      if (showLoading) wx.showToast({ title: error.message || this.data.copy.loadFail, icon: 'none' })
      this.setData({ loading: false })
    } finally {
      this._loadingMessages = false
    }
  },

  scrollToBottom(messages = this.data.messages) {
    if (!messages.length) return
    this.setData({ scrollToId: `message-${messages[messages.length - 1].id}` })
  },

  onInput(e) {
    const input = e.detail.value
    this.setData({ input, canSend: !!input.trim() })
  },

  async sendMessage() {
    const content = this.data.input.trim()
    if (!content || this.data.sending) return
    this.setData({ sending: true })
    try {
      const body = { content }
      if (this.data.replyingTo) body.reply_to_id = this.data.replyingTo.id
      const response = await auth.request('POST', '/api/feedback/chat/messages', body)
      if (response.code !== 200) throw new Error(response.msg)
      const message = this.decorateMessage(response.data)
      const messages = [...this.data.messages.filter(item => item.id !== message.id), message]
      this.setData({ input: '', canSend: false, messages, replyingTo: null })
      this.scrollToBottom(messages)
    } catch (error) {
      wx.showToast({ title: error.message || this.data.copy.sendFail, icon: 'none' })
    } finally {
      this.setData({ sending: false })
    }
  },

  chooseImage() {
    if (this.data.uploading) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async result => {
        const file = result.tempFiles && result.tempFiles[0]
        if (!file) return
        if (file.size && file.size > 8 * 1024 * 1024) {
          wx.showToast({ title: '图片不能超过8MB', icon: 'none' })
          return
        }
        this.setData({ uploading: true })
        try {
          const upload = await auth.uploadFile('/api/upload', file.tempFilePath)
          if (upload.code !== 200 || !upload.data || !upload.data.url) throw new Error(upload.msg)
          const body = { image_url: upload.data.url }
          if (this.data.replyingTo) body.reply_to_id = this.data.replyingTo.id
          const response = await auth.request('POST', '/api/feedback/chat/messages', body)
          if (response.code !== 200) throw new Error(response.msg)
          const message = this.decorateMessage(response.data)
          const messages = [...this.data.messages.filter(item => item.id !== message.id), message]
          this.setData({ messages, replyingTo: null })
          this.scrollToBottom(messages)
        } catch (error) {
          wx.showToast({ title: error.message || this.data.copy.imageFail, icon: 'none' })
        } finally {
          this.setData({ uploading: false })
        }
      }
    })
  },

  previewImage(e) {
    wx.previewImage({ current: e.currentTarget.dataset.src, urls: [e.currentTarget.dataset.src] })
  },

  openMessageActions(e) {
    const message = this.data.messages.find(item => Number(item.id) === Number(e.currentTarget.dataset.id))
    if (!message) return
    const actions = []
    if (!message.recalled) actions.push({ label: this.data.copy.quoteMessage, action: 'quote' })
    if (!message.recalled && message.content) actions.push({ label: this.data.copy.copyMessage, action: 'copy' })
    const createdAt = new Date(String(message.created_at || '').replace(' ', 'T')).getTime()
    if (message.mine && !message.recalled && Number.isFinite(createdAt) && Date.now() - createdAt <= 120000) {
      actions.push({ label: this.data.copy.recallMessage, action: 'recall' })
    }
    actions.push({ label: this.data.copy.deleteMessage, action: 'delete' })
    wx.showActionSheet({
      itemList: actions.map(item => item.label),
      success: result => {
        const selected = actions[result.tapIndex]
        if (!selected) return
        if (selected.action === 'quote') this.quoteMessage(message)
        if (selected.action === 'copy') this.copyMessage(message)
        if (selected.action === 'recall') this.recallMessage(message)
        if (selected.action === 'delete') this.deleteMessage(message)
      }
    })
  },

  copyMessage(message) {
    wx.setClipboardData({ data: message.content || '' })
  },

  quoteMessage(message) {
    this.setData({
      replyingTo: {
        id: Number(message.id),
        label: message.mine ? this.data.copy.you : this.data.copy.serviceName,
        summary: message.content || (message.imageSrc ? this.data.copy.imageMessage : '')
      }
    })
  },

  cancelReply() {
    this.setData({ replyingTo: null })
  },

  jumpToQuotedMessage(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (this.data.messages.some(item => Number(item.id) === id)) this.setData({ scrollToId: `message-${id}` })
  },

  async recallMessage(message) {
    try {
      const response = await auth.request('PATCH', `/api/feedback/chat/messages/${message.id}/recall`)
      if (response.code !== 200) throw new Error(response.msg)
      const updated = this.decorateMessage(response.data)
      const messages = this.data.messages.map(item => item.id === updated.id ? updated : item)
      this.setData({ messages })
      wx.showToast({ title: this.data.copy.recallSuccess, icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || this.data.copy.operationFail, icon: 'none' })
    }
  },

  deleteMessage(message) {
    wx.showModal({
      title: this.data.copy.deleteTitle,
      content: this.data.copy.deleteContent,
      success: async result => {
        if (!result.confirm) return
        try {
          const response = await auth.request('DELETE', `/api/feedback/chat/messages/${message.id}`)
          if (response.code !== 200) throw new Error(response.msg)
          this.setData({ messages: this.data.messages.filter(item => item.id !== message.id) })
          wx.showToast({ title: this.data.copy.deleteSuccess, icon: 'success' })
        } catch (error) {
          wx.showToast({ title: error.message || this.data.copy.operationFail, icon: 'none' })
        }
      }
    })
  },

  connectSocket() {
    if (this._socket) return
    const socketBase = auth.BASE_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
    const task = wx.connectSocket({ url: `${socketBase}/api/support/socket?token=${encodeURIComponent(auth.getToken())}` })
    this._socket = task
    task.onOpen(() => { if (this._active) this.setData({ connected: true }) })
    task.onMessage(event => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'support_message') this.loadMessages(false, false)
        if (['support_message_changed', 'support_read'].includes(payload.type)) this.loadMessages(true, false)
        if (payload.type === 'support_message_deleted' && payload.viewerType === 'farmer') {
          this.setData({ messages: this.data.messages.filter(item => item.id !== Number(payload.messageId)) })
        }
      } catch {}
    })
    task.onClose(() => {
      this._socket = null
      if (this._active) {
        this.setData({ connected: false })
        clearTimeout(this._reconnectTimer)
        this._reconnectTimer = setTimeout(() => this.connectSocket(), 3000)
      }
    })
    task.onError(() => { if (this._active) this.setData({ connected: false }) })
  },

  startPolling() {
    clearInterval(this._pollTimer)
    this._pollCount = 0
    this._pollTimer = setInterval(() => {
      this._pollCount += 1
      this.loadMessages(this._pollCount % 3 === 0, false)
    }, 5000)
  },

  stopRealtime() {
    this._active = false
    clearInterval(this._pollTimer)
    clearTimeout(this._reconnectTimer)
    if (this._socket) this._socket.close({ code: 1000, reason: 'page hidden' })
    this._socket = null
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/my/index' })
  }
})
