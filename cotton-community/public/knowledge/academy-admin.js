(() => {
  const token = localStorage.getItem('admin_token') || ''
  const runtime = window.CottonRuntime
  const state = { courses: [], series: [], comments: [], loaded: false, selected: '', tab: 'series' }
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
      token, timeoutMs: options.timeoutMs || 30000, onUnauthorized: returnToLogin
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

  function statusText(status) {
    return status === 'published' ? '已上架' : status === 'offline' ? '已下架' : '草稿'
  }

  function renderSeries() {
    const rows = state.series.filter(item => (!$('academyFilterLevel').value || item.level === $('academyFilterLevel').value) && (!$('academyFilterStatus').value || item.status === $('academyFilterStatus').value) && item.title.includes($('academySearch').value.trim()))
    $('academySeriesCount').textContent = state.series.length
    $('academySeriesTable').innerHTML = rows.length ? rows.map(item => `<tr>
      <td>${item.cover ? `<img class="academy-thumb" src="${esc(item.cover)}" alt="">` : '<div class="academy-thumb product-placeholder">系列</div>'}</td>
      <td class="academy-course-title"><button class="small-btn primary" data-manage-series="${esc(item.id)}">${esc(item.title)} · 管理课时</button><div class="academy-muted">${esc(item.summary || '')}</div></td>
      <td>${esc(levels[item.level] || item.level)}${item.isFeatured ? '<div class="academy-muted">本级推荐</div>' : ''}</td>
      <td>${Number(item.lessonCount || 0)} 节</td>
      <td><span class="status-pill ${item.status === 'published' ? 'published' : ''}">${statusText(item.status)}</span></td>
      <td>${Number(item.sortOrder || 0)}</td>
      <td><div class="academy-actions"><button class="small-btn primary" data-academy-series-course="${esc(item.id)}">添加视频</button><button class="small-btn primary" data-academy-series-edit="${item.databaseId}">编辑</button><button class="small-btn ${item.status === 'published' ? 'danger' : 'primary'}" data-academy-series-toggle="${item.databaseId}" data-status="${esc(item.status)}">${item.status === 'published' ? '下架' : '上架'}</button><button class="small-btn danger" data-academy-series-delete="${item.databaseId}">删除</button></div></td>
    </tr>`).join('') : '<tr><td colspan="7">暂无系列课程，请先点击“新增系列”。</td></tr>'
  }

  function renderCourses() {
    $('academyCourseCount').textContent = state.courses.length
    $('academyPublishedCount').textContent = state.courses.filter(item => item.status === 'published').length
    const rows = seriesCourses()
    $('academyCourseTable').innerHTML = rows.length ? rows.map(item => `<tr draggable="true" data-course-row="${item.databaseId}">
      <td>${item.cover ? `<img class="academy-thumb" src="${esc(item.cover)}" alt="">` : '<div class="academy-thumb product-placeholder">课</div>'}</td>
      <td class="academy-course-title"><strong>${esc(item.title)}</strong><div class="academy-muted"><button class="small-btn" data-move="${item.databaseId}" data-direction="-1">↑</button> <button class="small-btn" data-move="${item.databaseId}" data-direction="1">↓</button> 拖动调整顺序</div></td>
      <td>${esc(levels[item.level] || item.level)}<div class="academy-muted">${esc(item.seriesTitle || '未分组')} · 第${Number(item.lessonNo || 1)}节</div></td>
      <td>${esc(item.type)}<div class="academy-muted">${esc(item.duration)}</div></td>
      <td>${item.rawType === 'quiz' ? '<span class="status-on">在线答题 · 自动判分</span>' : item.vodFileId ? `<span class="status-on">VOD</span><div class="academy-muted">FileID ${esc(item.vodFileId)}</div>` : item.videoRawUrl ? '<span class="status-on">已有播放地址</span>' : '<span class="academy-muted">未填写</span>'}</td>
      <td><span class="status-pill ${item.status === 'published' ? 'published' : ''}">${statusText(item.status)}</span></td>
      <td>${Number(item.viewCount || 0)}</td>
      <td><div class="academy-actions"><button class="small-btn primary" data-academy-edit="${item.databaseId}">编辑</button><button class="small-btn ${item.status === 'published' ? 'danger' : 'primary'}" data-academy-toggle="${item.databaseId}" data-status="${esc(item.status)}">${item.status === 'published' ? '下架' : '上架'}</button><button class="small-btn danger" data-academy-delete="${item.databaseId}">删除</button></div></td>
    </tr>`).join('') : '<tr><td colspan="8">暂无课程内容，请添加视频或小测验。</td></tr>'
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

  async function load() {
    $('academySeriesTable').innerHTML = '<tr><td colspan="7">正在加载...</td></tr>'
    $('academyCourseTable').innerHTML = '<tr><td colspan="8">正在加载...</td></tr>'
    try {
      const [courses, series, comments, stats] = await Promise.all([request('/courses'), request('/series'), request('/comments'), request('/learning-stats')])
      state.courses = courses || []
      state.series = series || []
      state.comments = comments || []
      $('academyLearnerCount').textContent = Number(stats && stats.learnerCount || 0)
      $('academyCompletionRate').textContent = `${Number(stats && stats.completionRate || 0)}%`
      $('academyPointsIssued').textContent = Number(stats && stats.pointsIssued || 0)
      state.loaded = true
      renderSeries(); renderCourses(); renderComments()
      updateWorkspace()
    } catch (error) {
      $('academySeriesTable').innerHTML = `<tr><td colspan="7">${esc(error.message || '系列课程加载失败')}</td></tr>`
      $('academyCourseTable').innerHTML = `<tr><td colspan="8">${esc(error.message || '课程加载失败')}</td></tr>`
      runtime.notify(error.message || '优棉学堂数据加载失败', 'error')
    }
  }

  function fillSeriesForm(item = {}) {
    $('academySeriesId').value = item.databaseId || ''
    $('academySeriesLevel').value = item.level || 'basic'
    $('academySeriesTitle').value = item.title || ''
    $('academySeriesSummary').value = item.summary || ''
    $('academySeriesTeacher').value = item.teacher || '平台农技组'
    $('academySeriesSort').value = item.sortOrder == null ? 10 : item.sortOrder
    $('academySeriesCoverUrl').value = item.cover || ''
    $('academySeriesPublished').checked = item.status === 'published'
    $('academySeriesFeatured').checked = Boolean(item.isFeatured)
    $('academySeriesMessage').textContent = ''
  }

  function openSeries(id = 0) {
    fillSeriesForm(state.series.find(item => Number(item.databaseId) === Number(id)) || {})
    $('academySeriesModalTitle').textContent = id ? '编辑系列课程' : '新增系列课程'
    $('academySeriesModal').classList.remove('hidden')
  }

  function closeSeries() {
    $('academySeriesModal').classList.add('hidden')
    $('academySeriesForm').reset()
  }

  async function saveSeries(event) {
    event.preventDefault()
    const submit = event.target.querySelector('[type="submit"]')
    if (submit.disabled) return
    submit.disabled = true
    const databaseId = $('academySeriesId').value
    const body = {
      level: $('academySeriesLevel').value,
      title: $('academySeriesTitle').value, summary: $('academySeriesSummary').value,
      teacher: $('academySeriesTeacher').value, coverUrl: $('academySeriesCoverUrl').value,
      sortOrder: $('academySeriesSort').value,
      status: $('academySeriesPublished').checked ? 'published' : 'draft',
      isFeatured: $('academySeriesFeatured').checked
    }
    $('academySeriesMessage').textContent = '正在保存...'
    try {
      await request(`/series${databaseId ? `/${databaseId}` : ''}`, { method: databaseId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      closeSeries(); await load(); runtime.notify('系列课程已保存', 'success')
    } catch (error) { $('academySeriesMessage').textContent = error.message || '保存失败' }
    finally { submit.disabled = false }
  }

  function syncSeries(selected = '') {
    const rows = state.series.filter(item => item.level === $('academyLevel').value)
    $('academySeries').innerHTML = rows.length ? rows.map(item => `<option value="${esc(item.id)}">${esc(item.title)}</option>`).join('') : '<option value="">暂无系列课程，请先创建</option>'
    if (selected && rows.some(item => item.id === selected)) $('academySeries').value = selected
  }

  function fillCourseForm(item = {}) {
    $('academyCourseId').value = item.databaseId || ''
    $('academyLevel').value = item.level || 'basic'
    syncSeries(item.seriesKey || '')
    $('academyLessonNo').value = item.lessonNo || 1
    $('academyType').value = item.rawType || 'video'
    $('academySort').value = item.sortOrder == null ? 10 : item.sortOrder
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
    $('academyVodStatus').value = item.vodStatus || (item.videoRawUrl ? 'ready' : 'none')
    $('academyCourseMessage').textContent = ''
    updateRewardHint()
  }

  function updateRewardHint() {
    const rewards = { basic: 5, intermediate: 8, advanced: 10 }
    const level = $('academyLevel').value
    $('academyRewardHint').textContent = `${levels[level] || '初级'}课时首次有效完成可获得 ${rewards[level] || 5} 学习积分`
  }

  function openCourse(id = 0, initialSeriesKey = '') {
    if (id && state.courses.some(item => Number(item.databaseId) === Number(id) && item.rawType === 'quiz')) return openQuiz(id)
    if (!state.series.length) return runtime.notify('请先创建系列课程，再添加视频课程', 'error')
    const course = state.courses.find(item => Number(item.databaseId) === Number(id)) || {}
    if (!id) {
      const series = state.series.find(item => item.id === (initialSeriesKey || state.selected))
      if (!series) return runtime.notify('请先进入一个系列，再添加视频', 'error')
      const lessonNo = Math.max(0, ...state.courses.filter(item => item.seriesKey === series.id).map(item => item.lessonNo)) + 1
      Object.assign(course, { level: series.level, seriesKey: series.id, teacher: series.teacher, coverUrl: series.cover, lessonNo, sortOrder: lessonNo })
    }
    fillCourseForm(course)
    $('academyCourseModalTitle').textContent = id ? '编辑视频课程' : '添加视频课程'
    $('academyCourseModal').classList.remove('hidden')
  }

  function closeCourse() {
    $('academyPreview').pause()
    $('academyPreview').removeAttribute('src')
    $('academyPreview').load()
    $('academyPreview').classList.add('hidden')
    $('academyCourseModal').classList.add('hidden')
    $('academyCourseForm').reset()
  }

  async function saveCourse(event) {
    event.preventDefault()
    const submit = event.target.querySelector('[type="submit"]')
    if (submit.disabled) return
    submit.disabled = true
    const databaseId = $('academyCourseId').value
    const videoUrl = $('academyVideoUrl').value.trim()
    const body = {
      seriesKey: $('academySeries').value, lessonNo: $('academyLessonNo').value,
      level: $('academyLevel').value, type: $('academyType').value, sortOrder: $('academySort').value,
      title: $('academyTitle').value, summary: $('academySummary').value,
      teacher: $('academyTeacher').value, teacherTitle: $('academyTeacherTitle').value,
      durationSeconds: $('academyDuration').value, objectives: $('academyObjectives').value,
      coverUrl: $('academyCoverUrl').value, videoUrl,
      vodFileId: $('academyVodFileId').value, vodStatus: videoUrl ? 'ready' : 'none',
      status: $('academyPublished').checked ? 'published' : 'draft', isFeatured: $('academyFeatured').checked
    }
    $('academyCourseMessage').textContent = '正在保存...'
    try {
      await request(`/courses${databaseId ? `/${databaseId}` : ''}`, { method: databaseId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      closeCourse(); await load(); runtime.notify('视频课程已保存', 'success')
    } catch (error) { $('academyCourseMessage').textContent = error.message || '保存失败' }
    finally { submit.disabled = false }
  }

  async function tableAction(event) {
    const button = event.target.closest('button')
    if (!button) return
    try {
      if (button.dataset.manageSeries) { state.selected = button.dataset.manageSeries; updateWorkspace(); return }
      if (button.dataset.move) {
        const rows = seriesCourses(); const from = rows.findIndex(item => item.databaseId === Number(button.dataset.move)); const to = from + Number(button.dataset.direction)
        if (from >= 0 && to >= 0 && to < rows.length) { const [item] = rows.splice(from, 1); rows.splice(to, 0, item); await saveOrder(rows) }
        return
      }
      if (button.dataset.academySeriesCourse) { state.selected = button.dataset.academySeriesCourse; updateWorkspace(); return openCourse(0, state.selected) }
      if (button.dataset.academySeriesEdit) return openSeries(button.dataset.academySeriesEdit)
      if (button.dataset.academySeriesToggle) {
        const status = button.dataset.status === 'published' ? 'offline' : 'published'
        await request(`/series/${button.dataset.academySeriesToggle}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
        await load(); return runtime.notify(status === 'published' ? '系列课程已上架' : '系列课程已下架', 'success')
      }
      if (button.dataset.academySeriesDelete) {
        if (!confirm('确定删除这个系列课程吗？系列内仍有课程时不能删除。')) return
        await request(`/series/${button.dataset.academySeriesDelete}`, { method: 'DELETE' })
        await load(); return runtime.notify('系列课程已删除', 'success')
      }
      if (button.dataset.academyEdit) return openCourse(button.dataset.academyEdit)
      if (button.dataset.academyToggle) {
        const status = button.dataset.status === 'published' ? 'offline' : 'published'
        await request(`/courses/${button.dataset.academyToggle}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
        await load(); return runtime.notify(status === 'published' ? '课程已上架' : '课程已下架', 'success')
      }
      if (button.dataset.academyDelete) {
        if (!confirm('确定删除这门课程吗？相关评论将同时删除，腾讯云 VOD 中的视频不会被删除。')) return
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

  function seriesCourses() { return state.courses.filter(item => item.seriesKey === state.selected).sort((a,b) => a.lessonNo-b.lessonNo || a.sortOrder-b.sortOrder || a.databaseId-b.databaseId) }
  async function saveOrder(rows) {
    const series = state.series.find(item => item.id === state.selected)
    await request(`/series/${series.databaseId}/order`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: rows.map(item => item.databaseId) }) })
    await load()
  }
  function updateWorkspace() {
    const series = state.series.find(item => item.id === state.selected)
    const comments = state.tab === 'comments'
    $('academySeriesTable').closest('.academy-section').classList.toggle('hidden', comments || Boolean(series))
    $('academyCourseTable').closest('.academy-section').classList.toggle('hidden', comments || !series)
    $('academyCommentTable').closest('.academy-section').classList.toggle('hidden', !comments)
    $('academyFilters').classList.toggle('hidden', comments || Boolean(series))
    $('academySeriesContext').classList.toggle('hidden', comments || !series)
    $('academySeriesContextTitle').textContent = series ? `${series.title} · ${levels[series.level]} · ${statusText(series.status)}` : ''
    $('academyAddCourse').classList.toggle('hidden', comments || !series)
    $('academyAddQuiz').classList.toggle('hidden', comments || !series)
    $('academyAddSeries').classList.toggle('hidden', comments || Boolean(series))
    renderCourses()
  }
  const controls = document.createElement('div')
  controls.innerHTML = `<div style="padding:18px 21px"><button class="btn secondary" id="academySeriesTab">系列管理</button> <button class="btn secondary" id="academyCommentsTab">评论管理</button></div><div id="academyFilters" style="padding:0 21px 16px;display:flex;gap:12px;flex-wrap:wrap"><input id="academySearch" placeholder="搜索系列名称"><select id="academyFilterLevel"><option value="">全部等级</option><option value="basic">初级</option><option value="intermediate">中级</option><option value="advanced">高级</option></select><select id="academyFilterStatus"><option value="">全部状态</option><option value="published">已上架</option><option value="draft">草稿</option><option value="offline">已下架</option></select></div><div id="academySeriesContext" class="hidden" style="padding:18px 21px"><button class="small-btn" id="academyBackSeries">← 返回系列</button> <strong id="academySeriesContextTitle"></strong><p>在此管理课时顺序和上架状态。视频上架后，还需要上架所属系列才能在小程序展示。</p></div>`
  $('academyPanel').insertBefore(controls, $('academySeriesTable').closest('.academy-section'))
  $('academySeriesTab').onclick = () => { state.tab = 'series'; state.selected = ''; updateWorkspace() }
  $('academyCommentsTab').onclick = () => { state.tab = 'comments'; updateWorkspace() }
  $('academyBackSeries').onclick = () => { state.selected = ''; updateWorkspace() }
  ;['academySearch','academyFilterLevel','academyFilterStatus'].forEach(id => $(id).addEventListener('input', renderSeries))
  $('academyCourseTable').addEventListener('dragstart', event => { const row = event.target.closest('[data-course-row]'); if (row) event.dataTransfer.setData('text/plain', row.dataset.courseRow) })
  $('academyCourseTable').addEventListener('dragover', event => event.preventDefault())
  $('academyCourseTable').addEventListener('drop', async event => {
    event.preventDefault(); const target = event.target.closest('[data-course-row]'); if (!target) return
    const rows = seriesCourses(); const from = rows.findIndex(item => item.databaseId === Number(event.dataTransfer.getData('text/plain'))); const to = rows.findIndex(item => item.databaseId === Number(target.dataset.courseRow))
    if (from < 0 || to < 0 || from === to) return
    const [item] = rows.splice(from,1); rows.splice(to,0,item)
    try { await saveOrder(rows) } catch (error) { runtime.notify(error.message || '排序保存失败','error') }
  })
  $('academyPreviewButton').onclick = () => {
    const url = $('academyVideoUrl').value.trim()
    if (!/^https:\/\//i.test(url)) return runtime.notify('请填写 HTTPS 视频播放地址', 'error')
    const player = $('academyPreview'); player.src = url; player.poster = $('academyCoverUrl').value; player.classList.remove('hidden'); player.load()
    $('academyCourseMessage').textContent = '点击播放器试听，确认画面和声音正常后再发布。'
  }
  $('academyPreview').onloadedmetadata = () => { if (Number.isFinite($('academyPreview').duration)) $('academyDuration').value = Math.ceil($('academyPreview').duration) }
  $('academyPreview').onerror = () => { $('academyCourseMessage').textContent = '预览失败，请检查链接、有效期或浏览器是否支持该视频格式。' }
  const advanced = document.createElement('details')
  advanced.className = 'full'
  advanced.innerHTML = '<summary>更多课程信息 · 讲师、时长和学习要点</summary><div class="policy-fields" style="margin-top:16px"></div>'
  $('academyObjectives').closest('.policy-fields').appendChild(advanced)
  ;['academyTeacher','academyTeacherTitle','academyDuration','academyObjectives'].forEach(id => advanced.querySelector('.policy-fields').appendChild($(id).parentElement))
  const addQuiz = document.createElement('button')
  addQuiz.id = 'academyAddQuiz'; addQuiz.className = 'btn secondary'; addQuiz.textContent = '添加小测验'
  $('academyAddCourse').after(addQuiz)
  addQuiz.onclick = () => openQuiz()
  let quizEdit = null
  const quizDialog = document.createElement('div')
  quizDialog.className = 'modal-mask hidden'
  quizDialog.setAttribute('role', 'dialog')
  quizDialog.setAttribute('aria-modal', 'true')
  document.body.appendChild(quizDialog)
  const freshQuestion = () => ({type:'single',title:'',options:['',''],answer:[],explanation:''})
  function readQuizForm() {
    quizEdit.title = quizDialog.querySelector('[name=title]').value
    quizEdit.passScore = Number(quizDialog.querySelector('[name=passScore]').value)
    quizEdit.status = quizDialog.querySelector('[name=published]').checked ? 'published' : 'draft'
    quizDialog.querySelectorAll('[data-question]').forEach((card,i) => {
      const q=quizEdit.questions[i]
      q.title=card.querySelector('[name=questionTitle]').value
      q.explanation=card.querySelector('[name=explanation]').value
      q.options=[...card.querySelectorAll('[name=option]')].map(el=>el.value)
      q.answer=[...card.querySelectorAll('[data-answer]:checked')].map(el=>Number(el.dataset.answer))
    })
  }
  function renderQuizEditor() {
    quizDialog.innerHTML=`<div class="modal-card academy-modal quiz-modal">
      <div class="modal-head"><div><h2>${quizEdit.id?'编辑':'添加'}小测验</h2><p class="quiz-description">测验可插入系列目录中的任意位置，拖拽题目可调整答题顺序。</p></div><button class="modal-close" type="button" data-close aria-label="关闭">×</button></div>
      <div class="modal-body quiz-modal-body">
        <div class="quiz-settings">
          <label class="quiz-field quiz-title-field"><span>测验标题 <b>*</b></span><input name="title" maxlength="160" value="${esc(quizEdit.title)}" placeholder="例如：播种与出苗知识小测验"></label>
          <label class="quiz-field quiz-score-field"><span>及格线 <b>*</b></span><div class="quiz-score-input"><input name="passScore" type="number" min="1" max="100" value="${quizEdit.passScore}"><em>分</em></div></label>
        </div>
        <div class="quiz-editor-head"><div><strong>题目设置</strong><small>共 ${quizEdit.questions.length} 题，支持单选、多选和判断题</small></div><button class="small-btn primary" type="button" data-add-question>＋ 添加题目</button></div>
        <div class="quiz-question-list">${quizEdit.questions.map((q,i)=>`<section class="quiz-question-card" draggable="true" data-question="${i}">
          <div class="quiz-question-head"><div class="quiz-question-number"><i>☷</i><span>第 ${i+1} 题</span><select data-type="${i}" aria-label="题目类型"><option value="single" ${q.type==='single'?'selected':''}>单选题</option><option value="multiple" ${q.type==='multiple'?'selected':''}>多选题</option><option value="boolean" ${q.type==='boolean'?'selected':''}>判断题</option></select></div><div class="quiz-question-actions"><button class="small-btn" type="button" data-copy="${i}">复制</button><button class="small-btn danger" type="button" data-delete="${i}">删除</button></div></div>
          <label class="quiz-field"><span>题干 <b>*</b></span><textarea name="questionTitle" maxlength="2000" placeholder="请输入题目内容">${esc(q.title)}</textarea></label>
          <div class="quiz-options-head"><span>选项与正确答案 <b>*</b></span><small>${q.type==='multiple'?'请勾选至少两个正确答案':'请勾选一个正确答案'}</small></div>
          <div class="quiz-options">${q.options.map((o,j)=>`<div class="quiz-option-row"><label class="quiz-answer-check" title="设为正确答案"><input type="${q.type==='multiple'?'checkbox':'radio'}" name="answer-${i}" data-answer="${j}" ${q.answer.includes(j)?'checked':''}><span>${String.fromCharCode(65+j)}</span></label><input name="option" maxlength="500" value="${esc(o)}" ${q.type==='boolean'?'readonly':''} placeholder="请输入选项 ${String.fromCharCode(65+j)}">${q.type!=='boolean'?`<button class="quiz-remove-option" type="button" data-remove-option="${i}:${j}" aria-label="删除选项">×</button>`:''}</div>`).join('')}</div>
          ${q.type!=='boolean'?`<button class="quiz-add-option" type="button" data-add-option="${i}">＋ 添加选项</button>`:''}
          <label class="quiz-field quiz-explanation"><span>答案解析</span><textarea name="explanation" maxlength="3000" placeholder="提交后向学员展示，可填写知识点说明和易错原因">${esc(q.explanation)}</textarea></label>
        </section>`).join('')}</div>
        <div class="quiz-publish-row"><label><input name="published" type="checkbox" ${quizEdit.status==='published'?'checked':''}><span>保存后立即发布</span></label><small>未发布的测验不会显示在小程序课程目录中</small></div>
        <p id="quizMessage" class="form-message"></p>
      </div>
      <div class="quiz-modal-footer"><button class="btn secondary" type="button" data-preview>预览测验</button><div><button class="btn secondary" type="button" data-close>取消</button><button class="btn" type="button" data-save>保存测验</button></div></div>
    </div>`
  }
  async function openQuiz(id) {
    try {
      quizEdit=id?await request(`/quizzes/${id}`):{title:'',passScore:60,status:'draft',questions:[freshQuestion()]}
      renderQuizEditor(); quizDialog.classList.remove('hidden')
    } catch(e){runtime.notify(e.message,'error')}
  }
  function closeQuiz() { quizDialog.classList.add('hidden') }
  quizDialog.addEventListener('change',event=>{
    if(event.target.dataset.type===undefined)return
    readQuizForm(); const q=quizEdit.questions[Number(event.target.dataset.type)]
    q.type=event.target.value;q.answer=[];if(q.type==='boolean')q.options=['正确','错误']
    renderQuizEditor()
  })
  quizDialog.addEventListener('dragstart',event=>{const card=event.target.closest('[data-question]');if(card)event.dataTransfer.setData('text/plain',card.dataset.question)})
  quizDialog.addEventListener('dragover',event=>event.preventDefault())
  quizDialog.addEventListener('drop',event=>{
    event.preventDefault();const card=event.target.closest('[data-question]');const raw=event.dataTransfer.getData('text/plain');if(!card||raw==='')return
    readQuizForm();const from=Number(raw),to=Number(card.dataset.question);if(!Number.isInteger(from)||!quizEdit.questions[from])return
    const [q]=quizEdit.questions.splice(from,1);quizEdit.questions.splice(to,0,q);renderQuizEditor()
  })
  quizDialog.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b)return
    if(b.hasAttribute('data-close'))return closeQuiz()
    readQuizForm()
    if(b.hasAttribute('data-save')) {
      b.disabled=true
      try {
        await request(`/quizzes${quizEdit.id?'/'+quizEdit.id:''}`,{method:quizEdit.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...quizEdit,seriesKey:state.selected})})
        closeQuiz();await load();runtime.notify('测验已保存，可在目录中拖拽排序','success')
      }catch(e){quizDialog.querySelector('#quizMessage').textContent=e.message}finally{b.disabled=false}
      return
    }
    if(b.hasAttribute('data-preview')) {
      const preview=document.createElement('div');preview.className='modal-mask'
      preview.innerHTML=`<div class="modal-card academy-modal quiz-preview-modal"><div class="modal-head"><div><h2>测验预览</h2><p class="quiz-description">${esc(quizEdit.title || '未填写测验标题')}</p></div><button class="modal-close" type="button">×</button></div><div class="modal-body">${quizEdit.questions.map((q,i)=>`<section class="quiz-preview-question"><div><span>${i+1}</span><strong>${esc(q.title || '未填写题干')}</strong><small>${q.type==='multiple'?'多选题':q.type==='boolean'?'判断题':'单选题'}</small></div>${q.options.map((o,j)=>`<p><label><input type="${q.type==='multiple'?'checkbox':'radio'}" name="preview-${i}"> ${esc(o || `选项 ${String.fromCharCode(65+j)}`)}</label></p>`).join('')}<details><summary>查看答案与解析</summary><b>正确答案：${q.answer.map(j=>esc(q.options[j])).join('、') || '未设置'}</b><p>${esc(q.explanation || '暂无解析')}</p></details></section>`).join('')}</div><div class="quiz-modal-footer"><span></span><button class="btn secondary" type="button">关闭预览</button></div></div>`
      preview.querySelectorAll('button').forEach(button=>button.onclick=()=>preview.remove());document.body.appendChild(preview);return
    }
    if(b.hasAttribute('data-add-question')&&quizEdit.questions.length<50)quizEdit.questions.push(freshQuestion())
    if(b.dataset.copy!==undefined&&quizEdit.questions.length<50)quizEdit.questions.splice(Number(b.dataset.copy)+1,0,JSON.parse(JSON.stringify(quizEdit.questions[Number(b.dataset.copy)])))
    if(b.dataset.delete!==undefined){
      if(quizEdit.questions.length===1)return runtime.notify('测验至少需要保留一道题','error')
      quizEdit.questions.splice(Number(b.dataset.delete),1)
    }
    if(b.dataset.addOption!==undefined){const q=quizEdit.questions[Number(b.dataset.addOption)];if(q.options.length<6)q.options.push('')}
    if(b.dataset.removeOption!==undefined){const [i,j]=b.dataset.removeOption.split(':').map(Number),q=quizEdit.questions[i];if(q.options.length>2){q.options.splice(j,1);q.answer=q.answer.filter(n=>n!==j).map(n=>n>j?n-1:n)}}
    renderQuizEditor()
  })
  quizDialog.addEventListener('click', event => { if (event.target === quizDialog) closeQuiz() })
  updateWorkspace()
  document.querySelector('[data-view="academy"]').onclick = show
  document.querySelectorAll('[data-view]:not([data-view="academy"])').forEach(item => item.addEventListener('click', () => $('academyPanel').classList.add('hidden')))
  $('academyRefresh').onclick = load
  $('academyAddSeries').onclick = () => openSeries()
  $('academyAddCourse').onclick = () => openCourse()
  $('closeAcademySeriesModal').onclick = closeSeries
  $('cancelAcademySeriesBtn').onclick = closeSeries
  $('academySeriesForm').addEventListener('submit', saveSeries)
  $('closeAcademyCourseModal').onclick = closeCourse
  $('cancelAcademyCourseBtn').onclick = closeCourse
  $('academyCourseForm').addEventListener('submit', saveCourse)
  $('academyLevel').addEventListener('change', () => { syncSeries(); updateRewardHint() })
  $('academySeriesTable').addEventListener('click', tableAction)
  $('academyCourseTable').addEventListener('click', tableAction)
  $('academyCommentTable').addEventListener('click', tableAction)
  $('academySeriesModal').addEventListener('click', event => { if (event.target === $('academySeriesModal')) closeSeries() })
  $('academyCourseModal').addEventListener('click', event => { if (event.target === $('academyCourseModal')) closeCourse() })
  window.AcademyAdmin = { show, load }
})()
