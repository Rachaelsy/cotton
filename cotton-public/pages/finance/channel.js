const auth = require('../../utils/auth')
const { markdownToRichTextNodes } = require('../../utils/markdown')

const META = {
  loan: { title: '种植贷', icon: '贷', eyebrow: 'PLANTING FINANCE', tone: 'green' },
  insurance: { title: '棉花保险', icon: '保', eyebrow: 'COTTON INSURANCE', tone: 'blue' },
  futures: { title: '期货基础', icon: '期', eyebrow: 'FUTURES BASICS', tone: 'purple' },
  policy: { title: '金融政策解读', icon: '政', eyebrow: 'FINANCIAL POLICY', tone: 'gold', apiSection: 'finance-policy' }
}

function getReadStorageKey() {
  const user = auth.getUser && auth.getUser()
  const identity = user && (user.id || user.phone)
  return `cotton_finance_read_${identity || 'guest'}`
}

function formatTime(value) {
  if (!value) return ''
  const text = String(value)
  return text.slice(0, 10)
}

function articleMarkdown(value) {
  return String(value || '').replace(/^\s*#\s+[^\n]+\n+/, '')
}

Page({
  data: {
    statusBarHeight: 20, meta: META.loan, article: {}, bodyNodes: [], loading: true,
    error: '', collected: false, comments: [], commentsLoading: true, commentText: '', commentFocus: false, submittingComment: false
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.key = META[options.key] ? options.key : 'loan'
    this.setData({ statusBarHeight: info.statusBarHeight || 20, meta: META[this.key] })
    this.loadArticle()
  },

  async loadArticle() {
    const section = META[this.key].apiSection || this.key
    try {
      const list = await auth.request('GET', `/api/policies?type=finance&section=${encodeURIComponent(section)}`)
      const row = list.code === 200 && Array.isArray(list.data) ? list.data[0] : null
      if (!row) throw new Error('该专题文章尚未发布')
      const detail = await auth.request('GET', `/api/policies/${row.id}`)
      if (detail.code !== 200 || !detail.data) throw new Error(detail.msg || '文章加载失败')
      this.articleId = detail.data.id
      const read = wx.getStorageSync(getReadStorageKey()) || []
      const nextRead = Array.isArray(read) ? read.slice() : []
      if (!nextRead.includes(this.key)) { nextRead.push(this.key); wx.setStorageSync(getReadStorageKey(), nextRead) }
      this.setData({ article: { ...detail.data, publishDate: formatTime(detail.data.publishDate) }, bodyNodes: markdownToRichTextNodes(articleMarkdown(detail.data.markdown)), loading: false, error: '', collected: !!wx.getStorageSync(`policy_collected_${detail.data.id}`) })
      this.loadComments()
    } catch (error) {
      this.setData({ loading: false, error: error.message || '文章暂时无法加载' })
    }
  },

  async loadComments() {
    if (!this.articleId) return
    this.setData({ commentsLoading: true })
    try {
      const res = await auth.request('GET', `/api/policies/${this.articleId}/comments`)
      this.setData({ comments: res.code === 200 ? (res.data || []).map(item => ({ ...item, initial: String(item.author || '棉').charAt(0), timeText: formatTime(item.createdAt) })) : [] })
    } catch (_) { this.setData({ comments: [] }) }
    finally { this.setData({ commentsLoading: false }) }
  },

  onCommentInput(event) { this.setData({ commentText: event.detail.value }) },
  focusComment() { this.setData({ commentFocus: true }) },
  onCommentBlur() { this.setData({ commentFocus: false }) },
  async submitComment() {
    if (!auth.isLoggedIn()) { wx.showToast({ title: '请先登录后发表评论', icon: 'none' }); setTimeout(() => wx.navigateTo({ url: '/pages/login/index' }), 500); return }
    const content = this.data.commentText.trim()
    if (content.length < 2 || this.data.submittingComment) return wx.showToast({ title: '评论至少需要2个字', icon: 'none' })
    this.setData({ submittingComment: true })
    try {
      const res = await auth.request('POST', `/api/policies/${this.articleId}/comments`, { content })
      if (res.code !== 200) throw new Error(res.msg)
      this.setData({ commentText: '', commentFocus: false })
      await this.loadComments()
      wx.showToast({ title: '评论已发表', icon: 'success' })
    } catch (error) { wx.showToast({ title: error.message || '评论发表失败', icon: 'none' }) }
    finally { this.setData({ submittingComment: false }) }
  },
  toggleCollect() {
    const collected = !this.data.collected
    wx.setStorageSync(`policy_collected_${this.articleId}`, collected)
    this.setData({ collected })
    wx.showToast({ title: collected ? '已收藏' : '已取消收藏', icon: 'none' })
  },
  copySource() { wx.setClipboardData({ data: this.data.article.originalUrl || `${this.data.article.issuer || '喀什优棉公共服务平台'}（请以正式资料为准）` }) },
  back() { wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/finance/index' }) }) },
  onShareAppMessage() { return { title: this.data.article.title || META[this.key].title, path: `/pages/finance/channel?key=${this.key}` } },
  onShareTimeline() { return { title: this.data.article.title || META[this.key].title, query: `key=${this.key}` } }
})
