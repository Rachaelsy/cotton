(() => {
  const token = localStorage.getItem('admin_token') || ''
  const state = { contents: [], comments: [], questions: [], answers: [], requests: [] }
  const byId = id => document.getElementById(id)
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
  const typeNames = { video: '视频', article: '图文', gallery: '图集' }
  const statusNames = { pending: '待处理', contacted: '已联系', closed: '已完成' }
  const kindNames = { business: '商业需求', activity: '活动意向', privacy: '个人信息申请' }

  function notify(message, type = 'error') {
    window.CottonRuntime.notify(message || '操作失败，请稍后重试', type)
  }

  async function request(path, options = {}) {
    const result = await window.CottonRuntime.requestJson(`/api/knowledge/admin${path}`, options, {
      token,
      onUnauthorized: () => {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_name')
        location.replace('/admin/login.html?role=admin')
      }
    })
    return result.data
  }

  async function loadStats() {
    const data = await request('/stats')
    const badge = byId('serviceRequestBadge')
    badge.textContent = Number(data.pendingRequests || 0)
    badge.style.display = Number(data.pendingRequests || 0) ? 'flex' : 'none'
  }

  function populateCommentFilters() {
    const category = byId('knowledgeCommentCategory')
    const content = byId('knowledgeCommentContent')
    const oldCategory = category.value
    const oldContent = content.value
    const categories = [...new Map(state.contents.map(item => [item.categoryKey, item.categoryName])).entries()]
    category.innerHTML = '<option value="">全部专区</option>' + categories.map(([key, name]) => `<option value="${escapeHtml(key)}">${escapeHtml(name)}</option>`).join('')
    if (categories.some(([key]) => key === oldCategory)) category.value = oldCategory
    const rows = state.contents.filter(item => !category.value || item.categoryKey === category.value)
    content.innerHTML = '<option value="">全部内容</option>' + rows.map(item => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join('')
    if (rows.some(item => String(item.id) === oldContent)) content.value = oldContent
  }

  async function loadContents() {
    const table = byId('knowledgeContentTable')
    table.innerHTML = '<tr class="empty-row"><td colspan="8">加载中...</td></tr>'
    state.contents = await request('/contents')
    byId('knowledgeContentCount').textContent = `${state.contents.length} 条`
    table.innerHTML = state.contents.length ? state.contents.map(item => `<tr>
      <td><img class="knowledge-thumb" src="${escapeHtml(item.coverUrl || '/assets/cotton-field-sky.png')}" alt=""></td>
      <td><strong>${escapeHtml(item.title)}</strong><div class="muted">${escapeHtml(item.subtitle)}</div></td>
      <td>${escapeHtml(typeNames[item.type] || item.type)}<div class="muted">${escapeHtml(item.categoryName)}</div></td>
      <td><span class="knowledge-status ${escapeHtml(item.status)}">${item.status === 'published' ? '已上架' : '草稿'}</span>${item.isFeatured ? '<div class="muted">首页推荐</div>' : ''}</td>
      <td>${Number(item.viewCount || 0)}</td><td>${Number(item.commentCount || 0)}</td><td>${Number(item.sortOrder || 0)}</td>
      <td><button class="act-btn edit" data-knowledge-edit="${item.id}">编辑</button><button class="act-btn ${item.status === 'published' ? 'disable' : 'enable'}" data-knowledge-toggle="${item.id}" data-status="${escapeHtml(item.status)}">${item.status === 'published' ? '下架' : '上架'}</button><button class="act-btn reject" data-knowledge-delete="${item.id}">删除</button></td>
    </tr>`).join('') : '<tr class="empty-row"><td colspan="8">暂无网站内容</td></tr>'
    populateCommentFilters()
  }

  async function loadComments() {
    if (!state.contents.length) await loadContents()
    const params = new URLSearchParams()
    const mappings = [
      ['status', 'knowledgeCommentStatus'], ['category_key', 'knowledgeCommentCategory'],
      ['content_id', 'knowledgeCommentContent'], ['q', 'knowledgeCommentQuery']
    ]
    mappings.forEach(([key, id]) => {
      const value = byId(id).value.trim()
      if (value) params.set(key, value)
    })
    state.comments = await request(`/comments${params.size ? `?${params}` : ''}`)
    byId('knowledgeCommentCount').textContent = `${state.comments.length} 条`
    byId('knowledgeCommentTable').innerHTML = state.comments.length ? state.comments.map(item => `<tr>
      <td>${escapeHtml(item.category_name)}</td><td><strong>${escapeHtml(item.content_title)}</strong></td><td>${escapeHtml(item.nickname)}</td>
      <td class="knowledge-cell-long">${item.parent_id ? `<div class="muted">${item.parent_nickname ? `回复 @${escapeHtml(item.parent_nickname)}` : '原评论已删除'}</div>` : ''}${escapeHtml(item.body)}</td>
      <td>${new Date(item.created_at).toLocaleString('zh-CN')}</td><td><span class="knowledge-status ${escapeHtml(item.status)}">${item.status === 'visible' ? '公开' : '隐藏'}</span></td>
      <td><button class="act-btn edit" data-comment-toggle="${item.id}" data-status="${escapeHtml(item.status)}">${item.status === 'visible' ? '隐藏' : '恢复'}</button><button class="act-btn reject" data-comment-delete="${item.id}">删除</button></td>
    </tr>`).join('') : '<tr class="empty-row"><td colspan="7">当前筛选下暂无评论</td></tr>'
  }

  async function loadForum() {
    const data = await request('/forum')
    state.questions = data.questions || []
    state.answers = data.answers || []
    byId('knowledgeQuestionTable').innerHTML = state.questions.length ? state.questions.map(item => `<tr>
      <td><strong>${escapeHtml(item.title)}</strong></td><td>${escapeHtml(item.nickname)}</td><td>${escapeHtml(item.categoryName)}</td><td>${Number(item.answerCount || 0)}</td>
      <td><span class="knowledge-status ${item.status === 'hidden' ? 'hidden' : 'visible'}">${escapeHtml(item.status === 'open' ? '进行中' : item.status === 'solved' ? '已解决' : '已隐藏')}</span></td>
      <td><button class="act-btn edit" data-question-toggle="${item.id}" data-status="${escapeHtml(item.status)}">${item.status === 'hidden' ? '恢复' : '隐藏'}</button></td>
    </tr>`).join('') : '<tr class="empty-row"><td colspan="6">暂无问题</td></tr>'
    byId('knowledgeAnswerTable').innerHTML = state.answers.length ? state.answers.map(item => `<tr>
      <td>${escapeHtml(item.question_title)}</td><td>${escapeHtml(item.nickname)}</td><td class="knowledge-cell-long">${escapeHtml(String(item.body || '').slice(0, 180))}</td><td>${Number(item.vote_count || 0)}</td>
      <td><span class="knowledge-status ${escapeHtml(item.status)}">${item.status === 'visible' ? '公开' : '隐藏'}</span></td>
      <td><button class="act-btn edit" data-answer-toggle="${item.id}" data-status="${escapeHtml(item.status)}">${item.status === 'visible' ? '隐藏' : '恢复'}</button></td>
    </tr>`).join('') : '<tr class="empty-row"><td colspan="6">暂无回答</td></tr>'
  }

  async function loadRequests() {
    const params = new URLSearchParams()
    const kind = byId('serviceRequestKind').value
    const status = byId('serviceRequestStatus').value
    if (kind) params.set('kind', kind)
    if (status) params.set('status', status)
    state.requests = await request(`/service-requests${params.size ? `?${params}` : ''}`)
    byId('serviceRequestCount').textContent = `${state.requests.length} 条`
    byId('serviceRequestTable').innerHTML = state.requests.length ? state.requests.map(item => `<tr>
      <td><span class="knowledge-status">${escapeHtml(kindNames[item.kind] || item.kind)}</span><div class="muted">${escapeHtml(item.category)}</div></td>
      <td><strong>${escapeHtml(item.reference_name || item.category || '一般需求')}</strong>${item.region ? `<div class="muted">${escapeHtml(item.region)}</div>` : ''}</td>
      <td>${escapeHtml(item.contact_name)}<div class="muted">${escapeHtml(item.contact_phone)}</div></td>
      <td class="knowledge-cell-long">${escapeHtml(item.message || '未补充说明')}${item.admin_note ? `<div class="knowledge-note">处理备注：${escapeHtml(item.admin_note)}</div>` : ''}</td>
      <td>${new Date(item.created_at).toLocaleString('zh-CN')}</td><td><span class="knowledge-status ${escapeHtml(item.status)}">${escapeHtml(statusNames[item.status] || item.status)}</span></td>
      <td><button class="act-btn approve" data-request-next="${item.id}">${item.status === 'pending' ? '标记已联系' : item.status === 'contacted' ? '标记完成' : '重新处理'}</button><button class="act-btn edit" data-request-note="${item.id}">备注</button></td>
    </tr>`).join('') : '<tr class="empty-row"><td colspan="7">当前筛选下暂无服务需求</td></tr>'
    await loadStats()
  }

  function fillContentForm(item = {}) {
    byId('knowledgeContentId').value = item.id || ''
    byId('knowledgeContentType').value = item.type || 'article'
    byId('knowledgeContentDifficulty').value = item.difficulty || 'intro'
    byId('knowledgeContentTitle').value = item.title || ''
    byId('knowledgeContentSubtitle').value = item.subtitle || ''
    const categoryValue = `${item.categoryKey || 'planting'}|${item.categoryName || '栽培技术'}`
    byId('knowledgeContentCategory').value = [...byId('knowledgeContentCategory').options].some(option => option.value === categoryValue) ? categoryValue : 'other|其他知识'
    byId('knowledgeContentTags').value = (item.tags || []).join('，')
    byId('knowledgeContentCover').value = item.coverUrl || ''
    byId('knowledgeContentVideo').value = item.videoUrl || ''
    byId('knowledgeContentImages').value = (item.images || []).join('\n')
    byId('knowledgeContentBody').value = item.content || ''
    byId('knowledgeContentQuiz').value = item.quiz?.length ? JSON.stringify(item.quiz, null, 2) : ''
    byId('knowledgeContentDuration').value = item.durationSeconds || 300
    byId('knowledgeContentSort').value = item.sortOrder || 0
    byId('knowledgeContentSource').value = item.sourceName || '川月智能'
    byId('knowledgeContentPublished').checked = item.status === 'published'
    byId('knowledgeContentFeatured').checked = Boolean(item.isFeatured)
    byId('knowledgeContentMessage').textContent = ''
  }

  function openContent(id = 0) {
    const item = state.contents.find(row => Number(row.id) === Number(id)) || {}
    fillContentForm(item)
    byId('knowledgeContentModalTitle').textContent = id ? '编辑网站内容' : '新增网站内容'
    byId('knowledgeContentModal').classList.add('show')
  }

  function closeContent() {
    byId('knowledgeContentModal').classList.remove('show')
    byId('knowledgeContentForm').reset()
  }

  async function uploadFile(input, statusId, targetId) {
    const file = input.files[0]
    if (!file) return
    byId(statusId).textContent = `正在上传 ${file.name}...`
    const form = new FormData()
    form.append('file', file)
    try {
      const result = await window.CottonRuntime.requestJson('/api/knowledge/admin/upload', { method: 'POST', body: form }, { token, timeoutMs: 10 * 60 * 1000 })
      byId(targetId).value = result.data.url
      byId(statusId).textContent = '上传完成'
    } catch (error) {
      byId(statusId).textContent = error.message
    } finally { input.value = '' }
  }

  async function saveContent(event) {
    event.preventDefault()
    const id = byId('knowledgeContentId').value
    const [categoryKey, categoryName] = byId('knowledgeContentCategory').value.split('|')
    let quiz = []
    try {
      const raw = byId('knowledgeContentQuiz').value.trim()
      quiz = raw ? JSON.parse(raw) : []
      if (!Array.isArray(quiz)) throw new Error('必须是数组')
    } catch (error) {
      byId('knowledgeContentMessage').textContent = `课后小测格式错误：${error.message}`
      return
    }
    const body = {
      type: byId('knowledgeContentType').value, difficulty: byId('knowledgeContentDifficulty').value,
      title: byId('knowledgeContentTitle').value, subtitle: byId('knowledgeContentSubtitle').value,
      category_key: categoryKey, category_name: categoryName, tags: byId('knowledgeContentTags').value,
      cover_url: byId('knowledgeContentCover').value, video_url: byId('knowledgeContentVideo').value,
      images: byId('knowledgeContentImages').value, content: byId('knowledgeContentBody').value, quiz,
      duration_seconds: byId('knowledgeContentDuration').value, sort_order: byId('knowledgeContentSort').value,
      source_name: byId('knowledgeContentSource').value, status: byId('knowledgeContentPublished').checked ? 'published' : 'draft',
      is_featured: byId('knowledgeContentFeatured').checked
    }
    byId('knowledgeContentMessage').textContent = '正在保存...'
    try {
      await request(`/contents${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) })
      closeContent()
      await loadContents()
      notify('内容已保存', 'success')
    } catch (error) { byId('knowledgeContentMessage').textContent = error.message }
  }

  async function handleTableAction(event) {
    const target = event.target.closest('button')
    if (!target) return
    try {
      if (target.dataset.knowledgeEdit) return openContent(target.dataset.knowledgeEdit)
      if (target.dataset.knowledgeToggle) {
        await request(`/contents/${target.dataset.knowledgeToggle}/status`, { method: 'PATCH', body: JSON.stringify({ status: target.dataset.status === 'published' ? 'draft' : 'published' }) })
        await loadContents(); return notify('内容状态已更新', 'success')
      }
      if (target.dataset.knowledgeDelete) {
        if (!confirm('删除后相关评论和学习记录也会清除，确定继续？')) return
        await request(`/contents/${target.dataset.knowledgeDelete}`, { method: 'DELETE' })
        await loadContents(); return notify('内容已删除', 'success')
      }
      if (target.dataset.commentToggle) {
        await request(`/comments/${target.dataset.commentToggle}/status`, { method: 'PATCH', body: JSON.stringify({ status: target.dataset.status === 'visible' ? 'hidden' : 'visible' }) })
        await loadComments(); return notify('评论状态已更新', 'success')
      }
      if (target.dataset.commentDelete) {
        if (!confirm('永久删除这条评论？')) return
        await request(`/comments/${target.dataset.commentDelete}`, { method: 'DELETE' })
        await loadComments(); return notify('评论已删除', 'success')
      }
      if (target.dataset.questionToggle) {
        await request(`/forum/questions/${target.dataset.questionToggle}/status`, { method: 'PATCH', body: JSON.stringify({ status: target.dataset.status === 'hidden' ? 'open' : 'hidden' }) })
        await loadForum(); return notify('问题状态已更新', 'success')
      }
      if (target.dataset.answerToggle) {
        await request(`/forum/answers/${target.dataset.answerToggle}/status`, { method: 'PATCH', body: JSON.stringify({ status: target.dataset.status === 'visible' ? 'hidden' : 'visible' }) })
        await loadForum(); return notify('回答状态已更新', 'success')
      }
      if (target.dataset.requestNext) {
        const item = state.requests.find(row => Number(row.id) === Number(target.dataset.requestNext))
        if (!item) return
        const status = item.status === 'pending' ? 'contacted' : item.status === 'contacted' ? 'closed' : 'pending'
        await request(`/service-requests/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status, admin_note: item.admin_note || '' }) })
        await loadRequests(); return notify('处理状态已更新', 'success')
      }
      if (target.dataset.requestNote) {
        const item = state.requests.find(row => Number(row.id) === Number(target.dataset.requestNote))
        if (!item) return
        const note = prompt('填写内部处理备注（用户不可见）', item.admin_note || '')
        if (note === null) return
        await request(`/service-requests/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: item.status, admin_note: note }) })
        await loadRequests(); return notify('备注已保存', 'success')
      }
    } catch (error) { notify(error.message) }
  }

  async function load(panel) {
    try {
      if (panel === 'knowledgeContents') await loadContents()
      else if (panel === 'knowledgeComments') await loadComments()
      else if (panel === 'knowledgeForum') await loadForum()
      else if (panel === 'serviceRequests') await loadRequests()
    } catch (error) { notify(error.message) }
  }

  byId('knowledgeAddContent').addEventListener('click', () => openContent())
  byId('knowledgeRefreshContents').addEventListener('click', () => load('knowledgeContents'))
  byId('knowledgeContentCancel').addEventListener('click', closeContent)
  byId('knowledgeContentForm').addEventListener('submit', saveContent)
  byId('knowledgeCoverFile').addEventListener('change', event => uploadFile(event.target, 'knowledgeCoverStatus', 'knowledgeContentCover'))
  byId('knowledgeVideoFile').addEventListener('change', event => uploadFile(event.target, 'knowledgeVideoStatus', 'knowledgeContentVideo'))
  byId('knowledgeContentTable').addEventListener('click', handleTableAction)
  byId('knowledgeCommentTable').addEventListener('click', handleTableAction)
  byId('knowledgeQuestionTable').addEventListener('click', handleTableAction)
  byId('knowledgeAnswerTable').addEventListener('click', handleTableAction)
  byId('serviceRequestTable').addEventListener('click', handleTableAction)
  byId('knowledgeCommentCategory').addEventListener('change', () => { populateCommentFilters(); load('knowledgeComments') })
  byId('knowledgeCommentContent').addEventListener('change', () => load('knowledgeComments'))
  byId('knowledgeCommentStatus').addEventListener('change', () => load('knowledgeComments'))
  byId('knowledgeCommentSearch').addEventListener('click', () => load('knowledgeComments'))
  byId('knowledgeCommentQuery').addEventListener('keydown', event => { if (event.key === 'Enter') load('knowledgeComments') })
  byId('knowledgeCommentReset').addEventListener('click', () => {
    byId('knowledgeCommentCategory').value = ''; populateCommentFilters(); byId('knowledgeCommentContent').value = ''
    byId('knowledgeCommentStatus').value = ''; byId('knowledgeCommentQuery').value = ''; load('knowledgeComments')
  })
  byId('knowledgeForumRefresh').addEventListener('click', () => load('knowledgeForum'))
  byId('serviceRequestFilter').addEventListener('click', () => load('serviceRequests'))
  byId('serviceRequestKind').addEventListener('change', () => load('serviceRequests'))
  byId('serviceRequestStatus').addEventListener('change', () => load('serviceRequests'))
  byId('serviceRequestReset').addEventListener('click', () => {
    byId('serviceRequestKind').value = ''; byId('serviceRequestStatus').value = ''; load('serviceRequests')
  })

  window.KnowledgeManagement = { load }
  loadStats().catch(() => {})

  const requestedPanel = new URLSearchParams(location.search).get('panel')
  if (['knowledgeContents', 'knowledgeComments', 'knowledgeForum', 'serviceRequests'].includes(requestedPanel)) {
    const nav = document.querySelector(`.nav-item[data-panel="${requestedPanel}"]`)
    if (nav) window.switchPanel(nav)
  }
})()
