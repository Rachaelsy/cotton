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
      <td>${item.vodFileId ? `<span class="status-on">VOD</span><div class="academy-muted">FileID ${esc(item.vodFileId)}</div>` : item.videoRawUrl ? '<span class="status-on">已有播放地址</span>' : '<span class="academy-muted">未填写</span>'}</td>
      <td><span class="status-pill ${item.status === 'published' ? 'published' : ''}">${statusText(item.status)}</span></td>
      <td>${Number(item.viewCount || 0)}</td>
      <td><div class="academy-actions"><button class="small-btn primary" data-academy-edit="${item.databaseId}">编辑</button><button class="small-btn ${item.status === 'published' ? 'danger' : 'primary'}" data-academy-toggle="${item.databaseId}" data-status="${esc(item.status)}">${item.status === 'published' ? '下架' : '上架'}</button><button class="small-btn danger" data-academy-delete="${item.databaseId}">删除</button></div></td>
    </tr>`).join('') : '<tr><td colspan="8">暂无视频课程，请先创建系列课程，再添加视频。</td></tr>'
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
