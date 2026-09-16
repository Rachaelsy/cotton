const auth = require('../../utils/auth')
const { COURSES, getCourse, getLevel } = require('../../utils/academy-data')

const PROGRESS_KEY = 'academy_course_progress'
const ACADEMY_API = '/api/miniapp-academy'
const LEGACY_COMMENT_API = '/api/academy/courses/'

function readProgress() {
  const value = wx.getStorageSync(PROGRESS_KEY)
  return value && typeof value === 'object' ? value : {}
}

function saveProgress(courseId, percent) {
  const progress = readProgress()
  progress[courseId] = Math.max(Number(progress[courseId] || 0), Math.max(0, Math.min(100, Math.round(percent))))
  wx.setStorageSync(PROGRESS_KEY, progress)
  return progress[courseId]
}

function relativeTime(value) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}天前`
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

Page({
  data: {
    navTop: 24,
    course: {},
    level: {},
    progress: 0,
    completed: false,
    comments: [],
    commentsLoading: true,
    commentText: '',
    replyTo: null,
    commentFocus: false,
    sending: false
  },

  onLoad(options) {
    let navTop = 24
    try { navTop = wx.getSystemInfoSync().statusBarHeight || 24 } catch (error) {}
    const requestedId = String(options.id || '')
    const course = COURSES.find(item => item.id === requestedId) || { ...getCourse(requestedId), id: requestedId || getCourse(requestedId).id }
    const level = getLevel(course.level)
    const progress = Number(readProgress()[course.id] || 0)
    this.courseId = course.id
    this.setData({ navTop, course, level, progress, completed: progress >= 100 })
    if (progress === 0) this.setData({ progress: saveProgress(course.id, 5) })
    this.loadCourse()
    this.loadComments()
  },

  async loadCourse() {
    try {
      const result = await auth.request('GET', `/api/miniapp-academy/courses/${encodeURIComponent(this.courseId)}`)
      if (!result || result.code !== 200 || !result.data) return
      const remote = result.data
      const current = this.data.course || {}
      const remoteCover = /^(https:\/\/|\/uploads\/)/.test(String(remote.cover || '')) ? remote.cover : ''
      const course = {
        ...current,
        ...remote,
        cover: remoteCover || current.cover || '/images/cotton-seedling-inspection-v1.jpg',
        objectives: Array.isArray(remote.objectives) && remote.objectives.length ? remote.objectives : (current.objectives || [])
      }
      this.setData({ course, level: getLevel(course.level) })
    } catch (error) {
      console.warn('[academy-course-detail]', error && error.message || error)
    }
  },

  async loadComments() {
    this.setData({ commentsLoading: true })
    try {
      const result = await this.commentRequest('GET', '/comments')
      const rows = result && result.code === 200 && Array.isArray(result.data) ? result.data : []
      this.setData({ comments: rows.map(item => ({ ...item, timeText: relativeTime(item.createdAt), avatarText: String(item.author || '棉').slice(0, 1) })), commentsLoading: false })
    } catch (error) {
      this.setData({ comments: [], commentsLoading: false })
    }
  },

  async commentRequest(method, suffix, data) {
    const courseId = encodeURIComponent(this.courseId)
    const result = await auth.request(method, `${ACADEMY_API}/courses/${courseId}${suffix}`, data)
    if (!result || result.code !== 404) return result
    return auth.request(method, `${LEGACY_COMMENT_API}${courseId}${suffix}`, data)
  },

  onVideoTimeUpdate(event) {
    const detail = event.detail || {}
    if (!detail.duration) return
    const percent = Math.min(99, detail.currentTime / detail.duration * 100)
    if (percent >= this.data.progress + 5) this.setData({ progress: saveProgress(this.courseId, percent) })
  },

  onVideoEnded() {
    this.finishCourse(false)
  },

  complete() {
    if (this.data.completed) return wx.showToast({ title: '本课已完成', icon: 'none' })
    this.finishCourse(true)
  },

  finishCourse(showToast) {
    saveProgress(this.courseId, 100)
    this.setData({ progress: 100, completed: true })
    if (showToast) wx.showToast({ title: '已完成本课', icon: 'success' })
  },

  onCommentInput(event) {
    this.setData({ commentText: event.detail.value })
  },

  replyComment(event) {
    const id = Number(event.currentTarget.dataset.id)
    const comment = this.data.comments.find(item => item.id === id)
    if (!comment) return
    this.setData({ replyTo: { id: comment.id, author: comment.author }, commentFocus: true })
  },

  cancelReply() {
    this.setData({ replyTo: null, commentFocus: false })
  },

  async submitComment() {
    const content = String(this.data.commentText || '').trim()
    if (content.length < 2) return wx.showToast({ title: '请输入至少2个字', icon: 'none' })
    if (!auth.isLoggedIn()) {
      return wx.showModal({
        title: '登录后发表评论',
        content: '登录后可以参与课程讨论、回复和点赞。',
        confirmText: '去登录',
        success: result => { if (result.confirm) wx.navigateTo({ url: '/pages/login/index' }) }
      })
    }
    if (this.data.sending) return
    this.setData({ sending: true })
    try {
      const result = await this.commentRequest('POST', '/comments', {
        content,
        parentId: this.data.replyTo ? this.data.replyTo.id : null
      })
      if (!result || result.code !== 200) throw new Error(result && result.msg || '评论发送失败')
      this.setData({ commentText: '', replyTo: null, commentFocus: false })
      await this.loadComments()
      wx.showToast({ title: '评论已发布', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '评论发送失败', icon: 'none' })
    } finally {
      this.setData({ sending: false })
    }
  },

  async toggleLike(event) {
    if (!auth.isLoggedIn()) return wx.showToast({ title: '登录后可以点赞', icon: 'none' })
    const id = Number(event.currentTarget.dataset.id)
    try {
      const result = await this.commentRequest('POST', `/comments/${id}/like`)
      if (!result || result.code !== 200) throw new Error(result && result.msg || '操作失败')
      const comments = this.data.comments.map(item => item.id === id ? { ...item, liked: result.data.liked, likeCount: result.data.likeCount } : item)
      this.setData({ comments })
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    }
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.redirectTo({ url: `/pages/academy/index?level=${this.data.course.level}` })
  },

  openDirectory() {
    const seriesKey = this.data.course && this.data.course.seriesKey
    if (seriesKey) wx.navigateTo({ url: `/pages/academy/series?id=${encodeURIComponent(seriesKey)}` })
  },

  onShareAppMessage() {
    return { title: `${this.data.course.title}｜优棉学堂`, path: `/pages/academy/course?id=${this.courseId}` }
  }
})
