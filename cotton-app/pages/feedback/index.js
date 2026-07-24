const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')

const COPY = {
  zh: {
    title: '意见反馈与客服', intro: '遇到使用问题或有改进建议，可以在这里告诉平台管理员。管理员回复后会显示在下方记录中。',
    content: '问题描述', contentPh: '请描述遇到的问题、发生步骤或你的建议', contact: '联系方式（选填）',
    contactPh: '手机号或微信号，便于需要时联系', submit: '提交反馈', submitting: '正在提交…', history: '反馈记录',
    addImage: '添加图片', imageHint: '最多4张，单张不超过8MB', uploading: '图片上传中…', imageFail: '图片上传失败',
    onlineService: '在线客服', onlineServiceSub: '需要及时沟通？进入聊天向平台客服咨询', enterChat: '进入聊天',
    loading: '加载中…', empty: '还没有提交过反馈', emptySub: '你的问题和建议会帮助我们持续改进。',
    pending: '等待回复', replied: '管理员已回复', closed: '已处理', reply: '管理员回复',
    minContent: '请至少填写5个字的问题描述', submitFail: '提交失败，请稍后重试', loadFail: '反馈记录加载失败', loginRequired: '请先登录后提交反馈'
  },
  ug: {
    title: 'پىكىر ۋە خېرىدارلار مۇلازىمىتى', intro: 'ئىشلىتىشتە مەسىلە ياكى تەكلىپ بولسا، بۇ يەردە سۇپا باشقۇرغۇچىسىغا يوللاڭ. جاۋاب تۆۋەندىكى خاتىرىدە كۆرۈنىدۇ.',
    content: 'مەسىلە چۈشەندۈرۈشى', contentPh: 'مەسىلە، يۈز بەرگەن قەدەم ياكى تەكلىپىڭىزنى يېزىڭ', contact: 'ئالاقە ئۇسۇلى (ئىختىيارى)',
    contactPh: 'تېلېفون ياكى WeChat نومۇرى', submit: 'پىكىر يوللاش', submitting: 'يوللىنىۋاتىدۇ…', history: 'پىكىر خاتىرىسى',
    addImage: 'رەسىم قوشۇش', imageHint: 'ئەڭ كۆپ 4 پارچە، ھەر بىرى 8MB دىن كىچىك', uploading: 'رەسىم يوللىنىۋاتىدۇ…', imageFail: 'رەسىم يوللاش مەغلۇپ بولدى',
    onlineService: 'تور مۇلازىمىتى', onlineServiceSub: 'تېز ئالاقە ئۈچۈن سۇپا مۇلازىمىتى بىلەن پاراڭلىشىڭ', enterChat: 'پاراڭغا كىرىش',
    loading: 'يۈكلىنىۋاتىدۇ…', empty: 'تېخى پىكىر يوللانمىدى', emptySub: 'پىكرىڭىز سۇپىنى ياخشىلاشقا ياردەم بېرىدۇ.',
    pending: 'جاۋاب كۈتۈۋاتىدۇ', replied: 'باشقۇرغۇچى جاۋاب بەردى', closed: 'بىر تەرەپ قىلىندى', reply: 'باشقۇرغۇچى جاۋابى',
    minContent: 'كەم دېگەندە 5 ھەرپ كىرگۈزۈڭ', submitFail: 'يوللاش مەغلۇپ، كېيىن قايتا سىناڭ', loadFail: 'خاتىرىنى يۈكلىگىلى بولمىدى', loginRequired: 'پىكىر يوللاش ئۈچۈن كىرىڭ'
  }
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16)
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: COPY[i18n.getLanguage()] || COPY.zh,
    content: '',
    contact: '',
    images: [],
    uploadingImages: false,
    chatUnread: 0,
    loading: true,
    submitting: false,
    feedbacks: []
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
    const lang = i18n.getLanguage()
    this.setData({ lang, copy: COPY[lang] || COPY.zh })
    if (auth.isLoggedIn()) {
      this.loadFeedbacks()
      this.loadUnread()
    }
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value })
  },

  chooseImages() {
    if (this.data.uploadingImages || this.data.images.length >= 4) return
    const remaining = 4 - this.data.images.length
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async result => {
        const files = (result.tempFiles || []).filter(file => {
          if (!file.size || file.size <= 8 * 1024 * 1024) return true
          wx.showToast({ title: this.data.copy.imageHint, icon: 'none' })
          return false
        })
        if (!files.length) return
        this.setData({ uploadingImages: true })
        const images = [...this.data.images]
        let failedMessage = ''
        for (const file of files) {
          try {
            const response = await auth.uploadFile('/api/upload', file.tempFilePath)
            if (response.code !== 200 || !response.data || !response.data.url) {
              throw new Error(response.msg || this.data.copy.imageFail)
            }
            images.push({ url: response.data.url, src: auth.BASE_URL + response.data.url })
          } catch (error) {
            failedMessage = error.message || this.data.copy.imageFail
          }
        }
        this.setData({ images: images.slice(0, 4), uploadingImages: false })
        if (failedMessage) wx.showToast({ title: failedMessage, icon: 'none' })
      }
    })
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({ images: this.data.images.filter((_item, itemIndex) => itemIndex !== index) })
  },

  previewFormImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const urls = this.data.images.map(item => item.src)
    wx.previewImage({ current: urls[index], urls })
  },

  previewRecordImage(e) {
    const feedbackIndex = Number(e.currentTarget.dataset.feedbackIndex)
    const imageIndex = Number(e.currentTarget.dataset.imageIndex)
    const item = this.data.feedbacks[feedbackIndex]
    if (!item) return
    wx.previewImage({ current: item.imageViews[imageIndex], urls: item.imageViews })
  },

  onOpenChat() {
    wx.navigateTo({ url: '/pages/support-chat/index' })
  },

  async loadUnread() {
    try {
      const response = await auth.request('GET', '/api/feedback/unread')
      if (response.code === 200) this.setData({ chatUnread: Number(response.data.chat_count || 0) })
    } catch { /* 未读数不影响反馈主流程 */ }
  },

  async loadFeedbacks() {
    this.setData({ loading: true })
    try {
      const res = await auth.request('GET', '/api/feedback')
      if (res.code !== 200) throw new Error(res.msg)
      const labels = this.data.copy
      const feedbacks = (res.data || []).map(item => ({
        ...item,
        statusLabel: labels[item.status] || labels.pending,
        statusClass: item.status === 'closed' ? 'closed' : (item.status === 'replied' ? 'replied' : 'pending'),
        imageViews: (item.images || []).map(url => auth.BASE_URL + url),
        createdText: formatTime(item.created_at),
        repliedText: formatTime(item.replied_at)
      }))
      this.setData({ feedbacks })
    } catch (error) {
      wx.showToast({ title: error.message || this.data.copy.loadFail, icon: 'none' })
    } finally {
      this.setData({ loading: false })
      wx.stopPullDownRefresh()
    }
  },

  async submit() {
    if (this.data.submitting || this.data.uploadingImages) return
    const content = this.data.content.trim()
    if (content.length < 5) {
      wx.showToast({ title: this.data.copy.minContent, icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      const res = await auth.request('POST', '/api/feedback', {
        content,
        contact: this.data.contact.trim(),
        images: this.data.images.map(item => item.url)
      })
      if (res.code !== 200) throw new Error(res.msg)
      wx.showToast({ title: res.msg, icon: 'success' })
      this.setData({ content: '', contact: '', images: [] })
      await this.loadFeedbacks()
    } catch (error) {
      wx.showToast({ title: error.message || this.data.copy.submitFail, icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  onPullDownRefresh() {
    this.loadFeedbacks()
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/my/index' })
  }
})
