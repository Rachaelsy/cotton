const auth = require('../../utils/auth')
const { COURSES, getCourse, getLevel } = require('../../utils/academy-data')

const progressStore = require('../../utils/academy-progress')
const { WatchTracker, flushQueue } = require('../../utils/academy-watch')
const ACADEMY_API = '/api/miniapp-academy'

function readProgress() {
  return progressStore.percentages()
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
    loading: true, error: '', videoError: '', lessons: [],
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
    this.progressOwner = auth.getUser() && auth.getUser().id || 'guest'
    let navTop = 24
    try { navTop = wx.getSystemInfoSync().statusBarHeight || 24 } catch (error) {}
    const requestedId = String(options.id || '')
    const course = COURSES.find(item => item.id === requestedId) || { ...getCourse(requestedId), id: requestedId || getCourse(requestedId).id }
    const level = getLevel(course.level)
    const progress = Number(readProgress()[course.id] || 0)
    this.courseId = course.id
    this.setData({ navTop, course, level, progress, completed: progress >= 100 })
    this.loadCourse()
    this.loadComments()
  },

  onShow() {
    flushQueue()
    const currentOwner = auth.getUser() && auth.getUser().id || 'guest'
    if (currentOwner !== this.progressOwner) {
      if (this.watchTracker) this.watchTracker.close()
      this.progressOwner = currentOwner
      this.loadCourse()
      this.loadComments()
      return
    }
    if (this.waitingForAccess && auth.isLoggedIn()) {
      this.waitingForAccess = false
      this.progressOwner = auth.getUser() && auth.getUser().id || 'guest'
      this.loadCourse()
      this.loadComments()
    }
  },

  promptCourseLogin() {
    if (this.accessPromptOpen) return
    this.accessPromptOpen = true
    wx.showModal({
      title: '登录后学习',
      content: '初级课程可直接播放，中级和高级课程需登录后观看。',
      confirmText: '去登录',
      complete: result => {
        this.accessPromptOpen = false
        if (result.confirm) {
          this.waitingForAccess = true
          wx.navigateTo({ url: '/pages/login/index' })
        }
      }
    })
  },

  async loadCourse() {
    if (this.watchTracker) await this.watchTracker.close()
    this.setData({ loading: true, error: '', videoError: '' })
    try {
      await flushQueue()
      await progressStore.sync()
      const result = await auth.request('GET', `/api/miniapp-academy/courses/${encodeURIComponent(this.courseId)}`)
      if (!result || result.code !== 200 || !result.data) throw new Error(result && result.code === 404 ? '课程已下架或不存在' : '课程加载失败，请重试')
      const remote = result.data
      if (remote.rawType === 'quiz') {
        wx.redirectTo({ url: `/pages/academy/quiz?id=${encodeURIComponent(this.courseId)}` })
        return
      }
      const current = this.data.course || {}
      const remoteCover = /^(https:\/\/|\/uploads\/)/.test(String(remote.cover || '')) ? remote.cover : ''
      const course = {
        ...current,
        ...remote,
        cover: remoteCover || current.cover || '/images/cotton-seedling-inspection-v1.jpg',
        objectives: Array.isArray(remote.objectives) && remote.objectives.length ? remote.objectives : (current.objectives || [])
      }
      const saved = progressStore.read()[this.courseId] || {}
      const usable = !saved.version || saved.version === course.videoVersion
      this.watchTracker = new WatchTracker(course, (state, message) => {
        if (state && state.completed && !this.data.completed) wx.showToast({ title: state.awardedPoints ? `本节已完成，积分 +${state.awardedPoints}` : '本节已完成', icon: 'none' })
        if (state) this.setData({ progress: state.completed ? 100 : Number(state.percent || 0), completed: Boolean(state.completed), syncMessage: message })
        else this.setData({ syncMessage: message })
      })
      this.setData({ course, level: getLevel(course.level), progress: usable ? (saved.completed ? 100 : Number(saved.percent || 0)) : 0, completed: usable && Boolean(saved.completed), resumePosition: usable && !saved.completed ? Number(saved.position || 0) : 0, syncMessage: auth.isLoggedIn() ? '播放后自动记录学习进度' : '游客进度仅保存在本机，登录后记录学习成果', loading: false })
      if (course.seriesKey) {
        progressStore.markViewed(course.id, course.seriesKey)
        this.loadDirectory(course.seriesKey)
      }
    } catch (error) {
      if (error && error.statusCode === 401) {
        this.setData({ error: '中级和高级课程需登录后学习', loading: false, course: {} })
        this.promptCourseLogin()
      } else this.setData({ error: error.message || '课程加载失败，请重试', loading: false, course: {} })
    }
  },

  async loadDirectory(key) {
    try {
      const result = await auth.request('GET', `/api/miniapp-academy/series/${encodeURIComponent(key)}`)
      if (result.code !== 200) throw new Error('目录加载失败')
      const lessons = (result.data.lessons || []).map((item, itemIndex) => ({
        ...item,
        displayNo: String(Number(item.lessonNo || itemIndex + 1)).padStart(2, '0')
      })); const index = lessons.findIndex(item => item.id === this.courseId)
      this.setData({ lessons, previousId: index > 0 ? lessons[index - 1].id : '', nextId: index >= 0 && index < lessons.length - 1 ? lessons[index + 1].id : '', nextIsQuiz: Boolean(lessons[index+1] && lessons[index+1].rawType === 'quiz'), directoryError: '' })
    } catch (_) { this.setData({ directoryError: '目录加载失败，点击重试' }) }
  },
  retryDirectory() { this.loadDirectory(this.data.course.seriesKey) },
  selectLesson(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.lessons.find(row => row.id === id)
    if (id && id !== this.courseId) wx.redirectTo({ url: `/pages/academy/${item && item.rawType === 'quiz' ? 'quiz' : 'course'}?id=${encodeURIComponent(id)}` })
  },
  onVideoError() { if (this.watchTracker) this.watchTracker.pause(); this.setData({ videoError: '视频暂时无法播放，请稍后重试或联系平台更新播放地址。' }) },
  retryVideo() { this.loadCourse() },
  onVideoPlay() { if (this.watchTracker) this.watchTracker.play() },
  onVideoMetadata(event) { if (this.watchTracker) this.watchTracker.checkDuration(Number(event.detail.duration)) },
  onVideoTimeUpdate(event) { if (this.watchTracker && this.watchTracker.checkDuration(Number(event.detail.duration))) this.watchTracker.tick(Number(event.detail.currentTime)) },
  onVideoPause() { if (this.watchTracker) this.watchTracker.pause() },
  onVideoWaiting() { if (this.watchTracker) this.watchTracker.last = null },
  onVideoEnded() { if (this.watchTracker) this.watchTracker.pause() },
  onHide() { if (this.watchTracker) this.watchTracker.pause(); const player=wx.createVideoContext('academyVideo',this); player.pause() },
  onUnload() { if (this.watchTracker) this.watchTracker.close() },

  async loadComments() {
    this.setData({ commentsLoading: true, commentsError: false })
    try {
      const result = await this.commentRequest('GET', '/comments')
      if (!result || result.code !== 200) throw new Error('评论加载失败')
      const rows = result && result.code === 200 && Array.isArray(result.data) ? result.data : []
      this.setData({ comments: rows.map(item => ({ ...item, timeText: relativeTime(item.createdAt), avatarText: String(item.author || '棉').slice(0, 1) })), commentsLoading: false })
    } catch (error) {
      this.setData({ comments: [], commentsLoading: false, commentsError: true })
    }
  },

  async commentRequest(method, suffix, data) {
    const courseId = encodeURIComponent(this.courseId)
    return auth.request(method, `${ACADEMY_API}/courses/${courseId}${suffix}`, data)
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
    if (this.data.course.seriesKey) wx.navigateTo({ url: `/pages/academy/series?id=${encodeURIComponent(this.data.course.seriesKey)}` })
  },

  onShareAppMessage() {
    return { title: `${this.data.course.title}｜优棉学堂`, path: `/pages/academy/course?id=${this.courseId}` }
  }
})
