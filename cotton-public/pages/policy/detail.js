const { getPolicy } = require('../../utils/policy-data')
const auth = require('../../utils/auth')
const { markdownToRichTextNodes } = require('../../utils/markdown')

function formatTime(value) {
  if (!value) return ''
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16)
  const now = Date.now()
  const diff = now - date.getTime()
  if (diff >= 0 && diff < 60000) return '刚刚'
  if (diff >= 0 && diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

Page({
  data: {
    statusBarHeight: 20, policy: {}, collected: false, loading: true, demoMode: false,
    bodyNodes: [], isIndustry: false, comments: [], commentsLoading: true,
    commentText: '', commentFocus: false, submittingComment: false
  },

  async onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.articleId = options.id
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    await this.loadArticle(options.id)
    this.loadComments()
  },

  async loadArticle(id) {
    try {
      const res = await auth.request('GET', `/api/policies/${encodeURIComponent(id)}`)
      if (res.code !== 200 || !res.data) throw new Error(res.msg || '资讯详情加载失败')
      this.applyArticle(res.data, false)
    } catch {
      this.applyArticle(getPolicy(id), true)
    }
  },

  applyArticle(policy, demoMode) {
    const isIndustry = policy.contentType === 'industry'
    this.setData({
      policy,
      isIndustry,
      demoMode,
      loading: false,
      bodyNodes: markdownToRichTextNodes(policy.markdown || ''),
      collected: !!wx.getStorageSync(`policy_collected_${policy.id}`)
    })
  },

  async loadComments() {
    this.setData({ commentsLoading: true })
    try {
      const res = await auth.request('GET', `/api/policies/${encodeURIComponent(this.articleId)}/comments`)
      if (res.code !== 200) throw new Error(res.msg)
      this.setData({ comments: (res.data || []).map(item => ({ ...item, timeText: formatTime(item.createdAt), initial: String(item.author || '棉').charAt(0) })) })
    } catch {
      this.setData({ comments: [] })
    } finally {
      this.setData({ commentsLoading: false })
    }
  },

  onCommentInput(e) { this.setData({ commentText: e.detail.value }) },
  focusComment() { this.setData({ commentFocus: true }) },
  onCommentBlur() { this.setData({ commentFocus: false }) },
  async submitComment() {
    if (this.data.demoMode) return wx.showToast({ title: '演示内容暂不支持评论', icon: 'none' })
    if (!auth.isLoggedIn()) {
      wx.showToast({ title: '请先登录后发表评论', icon: 'none' })
      setTimeout(() => wx.navigateTo({ url: '/pages/login/index' }), 500)
      return
    }
    const content = this.data.commentText.trim()
    if (content.length < 2) return wx.showToast({ title: '评论至少需要2个字', icon: 'none' })
    if (this.data.submittingComment) return
    this.setData({ submittingComment: true })
    try {
      const res = await auth.request('POST', `/api/policies/${encodeURIComponent(this.articleId)}/comments`, { content })
      if (res.code !== 200) throw new Error(res.msg)
      this.setData({ commentText: '', commentFocus: false })
      wx.showToast({ title: '评论已发表', icon: 'success' })
      await this.loadComments()
    } catch (error) {
      wx.showToast({ title: error.message || '评论发表失败', icon: 'none' })
    } finally {
      this.setData({ submittingComment: false })
    }
  },

  toggleCollect() {
    const collected = !this.data.collected
    wx.setStorageSync(`policy_collected_${this.data.policy.id}`, collected)
    this.setData({ collected })
    wx.showToast({ title: collected ? '已收藏' : '已取消收藏', icon: 'none' })
  },

  copySource() {
    const policy = this.data.policy
    wx.setClipboardData({ data: policy.originalUrl || `${policy.issuer}（请以发布单位正式原文为准）` })
  },
  back() { if (getCurrentPages().length > 1) wx.navigateBack(); else wx.navigateTo({ url: '/pages/policy/index' }) },
  onShareAppMessage() { return { title: this.data.policy.title, path: `/pages/policy/detail?id=${this.data.policy.id}` } },
  onShareTimeline() { return { title: this.data.policy.title, query: `id=${this.data.policy.id}` } }
})
