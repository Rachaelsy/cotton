(() => {
  const token = localStorage.getItem('admin_token') || ''
  const runtime = window.CottonRuntime
  const state = { courses: [], series: [], comments: [], storage: { configured: false }, coverFile: null, loaded: false }
  const $ = id => document.getElementById(id)
  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
  const levels = { basic: '初级', intermediate: '中级', advanced: '高级' }

  function returnToLogin() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    location.replace('/admin/login.html?role=admin')
  }

  async function request(path, options = {}) {
    const result = await runtime.requestJson(`/api/miniapp-academy/admin${path}`, options, {
      token,
      timeoutMs: options.timeoutMs || 30000,
      onUnauthorized: returnToLogin
    })
    return result.data
  }

  function hideOtherPanels() {
    ['listPanel', 'editorPanel', 'financePanel', 'homepagePanel', 'voicePanel', 'pestPanel', 'productPanel', 'varietyPanel', 'factoryPanel', 'expertPanel', 'securityPanel', 'farmerPanel', 'plotPanel']
      .forEach(id => { const node = $(id); if (node) node.classList.add('hidden') })
  }

  function show() {
    hideOtherPanels()
    $('academyPanel').classList.remove('hidden')
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === 'academy'))
    $('pageTitle').textContent = '优棉学堂'
    load()
  }

  function renderCourses() {
    $('academyCourseCount').textContent = state.courses.length
    $('academyPublishedCount').textContent = state.courses.filter(item => item.status === 'published').length
    $('academyCourseTable').innerHTML = state.courses.length ? state.courses.map(item => `<tr>
      <td>${item.cover ? `<img class="academy-thumb" src="${esc(item.cover)}" alt="">` : '<div class="academy-thumb product-placeholder">课</div>'}</td>
      <td class="academy-course-title"><strong>${esc(item.title)}</strong><div class="academy-muted">${esc(item.id)}</div></td>
      <td>${esc(levels[item.level] || item.level)}<div class="academy-muted">${esc(item.seriesTitle || '未分组')} · 第${Number(item.lessonNo || 1)}节</div>${item.isFeatured ? '<div class="academy-muted">本级推荐</div>' : ''}</td>
      <td>${esc(item.type)}<div class="academy-muted">${esc(item.duration)}</div></td>
      <td>${item.vodFileId ? `<span class="status-on">VOD</span><div class="academy-muted">FileId ${esc(item.vodFileId)}</div>` : item.videoRawUrl ? '<span class="status-on">已有视频</span>' : '<span class="academy-muted">未上传</span>'}</td>
      <td><span class="status-pill ${item.status === 'published' ? 'published' : ''}">${item.status === 'published' ? '已上架' : item.status === 'offline' ? '已下架' : '草稿'}</span></td>
      <td>${Number(item.viewCount || 0)}</td>
      <td><div class="academy-actions"><button class="small-btn primary" data-academy-edit="${item.databaseId}">编辑</button><button class="small-btn ${item.status === 'published' ? 'danger' : 'primary'}" data-academy-toggle="${item.databaseId}" data-status="${esc(item.status)}">${item.status === 'published' ? '下架' : '上架'}</button><button class="small-btn danger" data-academy-delete="${item.databaseId}">删除</button></div></td>
    </tr>`).join('') : '<tr><td colspan="8">暂无课程，请点击“新增课程”。</td></tr>'
  }

  function renderComments() {
    $('academyCommentCount').textContent = state.comments.length
    $('academyCommentTable').innerHTML = state.comments.length ? state.comments.map(item => `<tr>
      <td>${esc(item.course_title || item.course_id)}</td><td>${esc(item.author)}</td><td class="academy-comment">${esc(item.content)}</td>
      <td>${item.created_at ? new Date(item.created_at).toLocaleString('zh-CN', { hour12: false }) : '—'}</td>
      <td><span class="status-pill ${item.status === 'visible' ? 'published' : ''}">${item.status === 'visible' ? '公开' : '已隐藏'}</span></td>
      <td><button class="small-btn ${item.status === 'visible' ? 'danger' : 'primary'}" data-academy-comment="${item.id}" data-status="${esc(item.status)}">${item.status === 'visible' ? '隐藏' : '恢复'}</button></td>
    </tr>`).join('') : '<tr><td colspan="6">暂无课程评论。</td></tr>'
  }

  async function loadStorage() {
    state.storage = await request('/storage')
    const node = $('academyStorage')
    if (state.storage.configured) {
      node.classList.remove('warn')
      node.innerHTML = `<strong>腾讯云云点播已连接</strong>　APPID：${esc(state.storage.appId)}${state.storage.subAppId ? `　子应用：${esc(state.storage.subAppId)}` : ''}<br>视频由浏览器直接上传至云点播，密钥只在服务器端用于签发短时上传凭证。`
    } else {
      node.classList.add('warn')
      node.innerHTML = '<strong>腾讯云云点播尚未配置</strong><br>请配置 VOD_APP_ID、VOD_SECRET_ID、VOD_SECRET_KEY；使用子应用时再配置 VOD_SUB_APP_ID。完成后重新创建 app 容器。'
    }
  }

  async function load() {
    $('academyCourseTable').innerHTML = '<tr><td colspan="8">正在加载...</td></tr>'
    try {
      const [courses, series, comments] = await Promise.all([request('/courses'), request('/series'), request('/comments'), loadStorage()])
      state.courses = courses || []
      state.series = series || []
      state.comments = comments || []
      state.loaded = true
      renderCourses()
      renderComments()
    } catch (error) {
      $('academyCourseTable').innerHTML = `<tr><td colspan="8">${esc(error.message || '课程加载失败')}</td></tr>`
      runtime.notify(error.message || '课程加载失败', 'error')
    }
  }

  function syncSeries(selected = '') {
    const rows = state.series.filter(item => item.level === $('academyLevel').value)
    $('academySeries').innerHTML = rows.length ? rows.map(item => `<option value="${esc(item.id)}">${esc(item.title)}</option>`).join('') : '<option value="">暂无系列课程</option>'
    if (selected && rows.some(item => item.id === selected)) $('academySeries').value = selected
  }

  function fillForm(item = {}) {
    $('academyCourseId').value = item.databaseId || ''
    $('academyLevel').value = item.level || 'basic'
    syncSeries(item.seriesKey || '')
    $('academyLessonNo').value = item.lessonNo || 1
    $('academyType').value = item.rawType || 'video'
    $('academyKey').value = item.id || ''
    $('academySort').value = item.sortOrder || 10
    $('academyTitle').value = item.title || ''
    $('academySummary').value = item.summary || ''
    $('academyTeacher').value = item.teacher || '平台农技组'
    $('academyTeacherTitle').value = item.role || '棉花栽培课程'
    $('academyDuration').value = item.durationSeconds || 60
    $('academyPublished').checked = item.status === 'published'
    $('academyFeatured').checked = Boolean(item.isFeatured)
    $('academyObjectives').value = (item.objectives || []).join('\n')
    $('academyCoverUrl').value = item.coverUrl || ''
    $('academyVideoUrl').value = item.videoRawUrl || ''
    $('academyVodFileId').value = item.vodFileId || ''
    $('academyVodStatus').value = item.vodStatus || (item.vodFileId ? 'ready' : 'none')
    state.coverFile = null
    $('academyCoverStatus').textContent = item.coverUrl ? '当前已有课程封面' : ''
    $('academyVideoStatus').textContent = item.vodFileId ? `云点播 FileId：${item.vodFileId}` : ''
    $('academyCoverProgress').style.width = '0'
    $('academyVideoProgress').style.width = '0'
    $('academyCourseMessage').textContent = ''
  }

  function openCourse(id = 0) {
    fillForm(state.courses.find(item => Number(item.databaseId) === Number(id)) || {})
    $('academyCourseModalTitle').textContent = id ? '编辑课程' : '新增课程'
    $('academyCourseModal').classList.remove('hidden')
  }

  function closeCourse() {
    $('academyCourseModal').classList.add('hidden')
    $('academyCourseForm').reset()
  }

  function vodConstructor() {
    return window.TcVod && (window.TcVod.default || window.TcVod)
  }

  function percent(value) {
    const number = Number(value || 0)
    return Math.max(0, Math.min(100, Math.round(number <= 1 ? number * 100 : number)))
  }

  function createVodClient() {
    const Constructor = vodConstructor()
    if (!Constructor) throw new Error('云点播上传组件加载失败，请检查网络后刷新页面')
    return new Constructor({
      appId: Number(state.storage.appId || 0),
      getSignature: async () => {
        const data = await request('/upload-signature', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseKey: $('academyKey').value || 'new-course' })
        })
        return data.signature
      }
    })
  }

  async function uploadVideoToVod(input) {
    const file = input.files && input.files[0]
    if (!file) return
    if (!state.storage.configured) { input.value = ''; return runtime.notify('请先配置腾讯云云点播', 'error') }
    if (!/^video\/(mp4|webm|quicktime|x-m4v|ogg)$/i.test(file.type || '')) { input.value = ''; return runtime.notify('请选择 MP4、WebM、MOV、M4V 或 OGV 视频', 'error') }
    if (file.size > 300 * 1024 * 1024) { input.value = ''; return runtime.notify('课程视频不能超过 300MB', 'error') }
    $('academyVideoStatus').textContent = `正在上传 ${file.name}...`
    $('academyVideoProgress').style.width = '2%'
    $('uploadAcademyVideoBtn').disabled = true
    try {
      const uploader = createVodClient().upload({
        mediaFile: file,
        coverFile: state.coverFile || undefined,
        mediaName: String($('academyTitle').value || file.name).trim()
      })
      uploader.on('media_progress', info => { $('academyVideoProgress').style.width = `${percent(info.percent)}%` })
      uploader.on('cover_progress', info => { $('academyCoverProgress').style.width = `${percent(info.percent)}%` })
      const result = await uploader.done()
      if (!result || !result.fileId || !result.video || !result.video.url) throw new Error('云点播未返回有效的媒资信息')
      $('academyVodFileId').value = result.fileId
      $('academyVodStatus').value = 'ready'
      $('academyVideoUrl').value = String(result.video.url).replace(/^http:\/\//i, 'https://')
      if (result.cover && result.cover.url) $('academyCoverUrl').value = String(result.cover.url).replace(/^http:\/\//i, 'https://')
      $('academyVideoProgress').style.width = '100%'
      if (state.coverFile) $('academyCoverProgress').style.width = '100%'
      $('academyVideoStatus').textContent = `上传完成，云点播 FileId：${result.fileId}`
      $('academyCoverStatus').textContent = result.cover && result.cover.url ? '封面已随视频上传' : $('academyCoverStatus').textContent
      state.coverFile = null
      runtime.notify('视频已上传到腾讯云云点播，请保存课程', 'success')
    } catch (error) {
      $('academyVodStatus').value = 'failed'
      $('academyVideoProgress').style.width = '0'
      $('academyVideoStatus').textContent = error.message || '云点播上传失败'
    } finally {
      $('uploadAcademyVideoBtn').disabled = false
      input.value = ''
    }
  }

  async function selectOrUploadCover(input) {
    const file = input.files && input.files[0]
    if (!file) return
    if (!/^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type || '') || file.size > 10 * 1024 * 1024) {
      input.value = ''
      return runtime.notify('请选择不超过 10MB 的 JPG、PNG、WebP、GIF 或 AVIF 图片', 'error')
    }
    state.coverFile = file
    $('academyCoverStatus').textContent = $('academyVodFileId').value ? '正在更新云点播封面...' : `已选择 ${file.name}，上传视频时将一并提交`
    $('academyCoverProgress').style.width = '2%'
    if (!$('academyVodFileId').value) { input.value = ''; return }
    try {
      if (!state.storage.configured) throw new Error('请先配置腾讯云云点播')
      const uploader = createVodClient().upload({ coverFile: file, fileId: $('academyVodFileId').value })
      uploader.on('cover_progress', info => { $('academyCoverProgress').style.width = `${percent(info.percent)}%` })
      const result = await uploader.done()
      if (result.cover && result.cover.url) $('academyCoverUrl').value = String(result.cover.url).replace(/^http:\/\//i, 'https://')
      $('academyCoverProgress').style.width = '100%'
      $('academyCoverStatus').textContent = '云点播封面已更新，请保存课程'
      state.coverFile = null
    } catch (error) {
      $('academyCoverProgress').style.width = '0'
      $('academyCoverStatus').textContent = error.message || '封面上传失败'
    } finally { input.value = '' }
  }

  async function saveCourse(event) {
    event.preventDefault()
    const databaseId = $('academyCourseId').value
    const body = {
      courseKey: $('academyKey').value, seriesKey: $('academySeries').value, lessonNo: $('academyLessonNo').value,
      level: $('academyLevel').value, type: $('academyType').value,
      sortOrder: $('academySort').value, title: $('academyTitle').value, summary: $('academySummary').value,
      teacher: $('academyTeacher').value, teacherTitle: $('academyTeacherTitle').value,
      durationSeconds: $('academyDuration').value, objectives: $('academyObjectives').value,
      coverUrl: $('academyCoverUrl').value,
      videoUrl: $('academyVideoUrl').value,
      vodFileId: $('academyVodFileId').value, vodStatus: $('academyVodStatus').value,
      status: $('academyPublished').checked ? 'published' : 'draft', isFeatured: $('academyFeatured').checked
    }
    $('academyCourseMessage').textContent = '正在保存...'
    try {
      await request(`/courses${databaseId ? `/${databaseId}` : ''}`, { method: databaseId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      closeCourse()
      await load()
      runtime.notify('课程已保存', 'success')
    } catch (error) { $('academyCourseMessage').textContent = error.message || '保存失败' }
  }

  async function tableAction(event) {
    const button = event.target.closest('button')
    if (!button) return
    try {
      if (button.dataset.academyEdit) return openCourse(button.dataset.academyEdit)
      if (button.dataset.academyToggle) {
        const status = button.dataset.status === 'published' ? 'offline' : 'published'
        await request(`/courses/${button.dataset.academyToggle}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
        await load(); return runtime.notify(status === 'published' ? '课程已上架' : '课程已下架', 'success')
      }
      if (button.dataset.academyDelete) {
        if (!confirm('确定删除这门课程吗？相关评论将同时删除，云点播中的媒资文件会保留。')) return
        await request(`/courses/${button.dataset.academyDelete}`, { method: 'DELETE' })
        await load(); return runtime.notify('课程已删除', 'success')
      }
      if (button.dataset.academyComment) {
        const status = button.dataset.status === 'visible' ? 'hidden' : 'visible'
        await request(`/comments/${button.dataset.academyComment}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
        await load(); return runtime.notify('评论状态已更新', 'success')
      }
    } catch (error) { runtime.notify(error.message || '操作失败', 'error') }
  }

  document.querySelector('[data-view="academy"]').onclick = show
  document.querySelectorAll('[data-view]:not([data-view="academy"])').forEach(item => item.addEventListener('click', () => $('academyPanel').classList.add('hidden')))
  $('academyRefresh').onclick = load
  $('academyAddCourse').onclick = () => openCourse()
  $('closeAcademyCourseModal').onclick = closeCourse
  $('cancelAcademyCourseBtn').onclick = closeCourse
  $('academyCourseForm').addEventListener('submit', saveCourse)
  $('academyLevel').addEventListener('change', () => syncSeries())
  $('academyCourseTable').addEventListener('click', tableAction)
  $('academyCommentTable').addEventListener('click', tableAction)
  $('uploadAcademyCoverBtn').onclick = () => $('academyCoverFile').click()
  $('uploadAcademyVideoBtn').onclick = () => $('academyVideoFile').click()
  $('academyCoverFile').addEventListener('change', event => selectOrUploadCover(event.target))
  $('academyVideoFile').addEventListener('change', event => uploadVideoToVod(event.target))
  $('academyCourseModal').addEventListener('click', event => { if (event.target === $('academyCourseModal')) closeCourse() })
  window.AcademyAdmin = { show, load }
})()
