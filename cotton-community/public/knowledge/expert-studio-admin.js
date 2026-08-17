(() => {
  const token = localStorage.getItem('admin_token') || ''
  const runtime = window.CottonRuntime
  const $ = id => document.getElementById(id)
  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
  const state = { tab: 'qa', experts: [], contents: [] }

  function unauthorized() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    location.replace('/admin/login.html?role=admin')
  }
  async function api(path, options = {}) {
    const result = await runtime.requestJson(`/api/expert-studio${path}`, options, { token, onUnauthorized: unauthorized })
    return result.data
  }
  function hidePanels() { ['listPanel', 'editorPanel', 'productPanel', 'factoryPanel', 'securityPanel', 'farmerPanel'].forEach(id => $(id).classList.add('hidden')) }
  function status(value) { return `<span class="status-pill ${value ? 'published' : ''}">${value ? '已发布' : '草稿'}</span>` }
  function expertOptions(selected) { $('studioContentExpert').innerHTML = '<option value="">平台专家</option>' + state.experts.map(item => `<option value="${item.id}"${Number(selected) === item.id ? ' selected' : ''}>${esc(item.name)} · ${esc(item.title || item.org || '专家')}</option>`).join('') }

  function render() {
    const head = $('expertStudioHead')
    const body = $('expertStudioTable')
    if (state.tab === 'experts') {
      head.innerHTML = '<tr><th>专家</th><th>职称/单位</th><th>擅长领域</th><th>在线状态</th><th>排序</th><th>更新时间</th><th>操作</th></tr>'
      body.innerHTML = state.experts.length ? state.experts.map(item => `<tr><td><div class="expert-profile-cell">${item.avatarUrl ? `<img src="${esc(item.avatarUrl)}" alt="">` : `<span class="product-thumb expert-avatar-fallback">${esc(item.avatar || '专')}</span>`}<strong>${esc(item.name)}</strong></div></td><td>${esc(item.title || '—')}<br><span class="question-excerpt">${esc(item.org || '—')}</span></td><td>${esc((item.tags || []).join('、') || '—')}</td><td><span class="status-pill ${item.isActive ? 'published' : ''}">${item.isActive ? '在线' : '停用'}</span></td><td>${item.sortOrder}</td><td>${item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '—'}</td><td><div class="product-actions"><button class="small-btn primary" data-studio-expert-edit="${item.id}">编辑</button>${item.profileOnly ? `<button class="small-btn danger" data-studio-expert-delete="${item.id}">删除</button>` : ''}</div></td></tr>`).join('') : '<tr><td colspan="7">暂无专家资料，点击右上角新增。</td></tr>'
    } else {
      const type = state.tab
      const items = state.contents.filter(item => item.type === type)
      head.innerHTML = `<tr><th>${type === 'qa' ? '问题' : '视频'}</th><th>专家/分类</th><th>媒体</th><th>精选</th><th>状态</th><th>排序</th><th>更新时间</th><th>操作</th></tr>`
      body.innerHTML = items.length ? items.map(item => `<tr><td><strong>${esc(item.title)}</strong><br><span class="question-excerpt">${esc(item.intro || item.subtitle || item.content)}</span></td><td>${esc(item.expertName || '平台专家')}<br><span class="question-excerpt">${esc(item.categoryName)}</span></td><td>${type === 'video' ? (item.videoUrl ? '视频已上传' : '缺少视频') : (item.coverUrl ? '含封面' : '纯文字')}</td><td>${item.isFeatured ? '是' : '否'}</td><td>${status(item.isPublished)}</td><td>${item.sortOrder}</td><td>${item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '—'}</td><td><div class="product-actions"><button class="small-btn primary" data-studio-content-edit="${item.id}">编辑</button><button class="small-btn danger" data-studio-content-delete="${item.id}">删除</button></div></td></tr>`).join('') : `<tr><td colspan="8">暂无${type === 'qa' ? '精选问答' : '精选视频'}，点击右上角新增。</td></tr>`
    }
    document.querySelectorAll('[data-studio-expert-edit]').forEach(button => { button.onclick = () => openExpert(Number(button.dataset.studioExpertEdit)) })
    document.querySelectorAll('[data-studio-expert-delete]').forEach(button => { button.onclick = () => removeExpert(Number(button.dataset.studioExpertDelete)) })
    document.querySelectorAll('[data-studio-content-edit]').forEach(button => { button.onclick = () => openContent(Number(button.dataset.studioContentEdit)) })
    document.querySelectorAll('[data-studio-content-delete]').forEach(button => { button.onclick = () => removeContent(Number(button.dataset.studioContentDelete)) })
  }

  async function load() {
    const data = await api('/admin/overview')
    state.experts = data.experts || []
    state.contents = data.contents || []
    render()
  }
  function show() {
    hidePanels(); $('expertPanel').classList.remove('hidden'); $('pageTitle').textContent = '专家讲堂'
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === 'experts'))
    load().catch(error => runtime.notify(error.message, 'error'))
  }
  function setTab(tab) {
    state.tab = ['qa', 'experts', 'video'].includes(tab) ? tab : 'qa'
    document.querySelectorAll('[data-studio-tab]').forEach(button => button.classList.toggle('active', button.dataset.studioTab === state.tab))
    $('addExpertStudioBtn').textContent = state.tab === 'experts' ? '＋ 新增专家' : state.tab === 'qa' ? '＋ 新增问答' : '＋ 新增视频'
    render()
  }
  function lines(value) { return String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean) }

  function openExpert(id = 0) {
    const item = state.experts.find(row => row.id === id)
    $('studioExpertId').value = item ? item.id : ''; $('expertProfileModalTitle').textContent = item ? '编辑在线专家' : '新增在线专家'
    $('studioExpertName').value = item ? item.name : ''; $('studioExpertTitle').value = item ? item.title : ''; $('studioExpertOrg').value = item ? item.org : ''
    $('studioExpertAvatarUrl').value = item ? item.avatarUrl : ''; $('studioExpertAvatar').value = item ? item.avatar : '专'; $('studioExpertSort').value = item ? item.sortOrder : 0
    $('studioExpertTags').value = item ? (item.tags || []).join('\n') : ''; $('studioExpertBio').value = item ? item.bio : ''; $('studioExpertActive').checked = item ? item.isActive : true
    $('expertAvatarUploadStatus').textContent = ''; $('expertProfileMessage').textContent = ''; $('expertProfileModal').classList.remove('hidden')
  }
  function closeExpert() { $('expertProfileModal').classList.add('hidden') }
  async function saveExpert(event) {
    event.preventDefault(); const id = $('studioExpertId').value
    const body = { name: $('studioExpertName').value.trim(), title: $('studioExpertTitle').value.trim(), org: $('studioExpertOrg').value.trim(), avatar_url: $('studioExpertAvatarUrl').value.trim(), avatar: $('studioExpertAvatar').value.trim() || '专', tags: lines($('studioExpertTags').value), bio: $('studioExpertBio').value.trim(), sort_order: $('studioExpertSort').value, is_active: $('studioExpertActive').checked }
    if (!body.name || !body.bio) { $('expertProfileMessage').textContent = '专家姓名和简介不能为空'; return }
    $('expertProfileMessage').textContent = '正在保存...'
    try { await api(`/admin/experts${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); closeExpert(); await load(); runtime.notify('在线专家已保存', 'success') } catch (error) { $('expertProfileMessage').textContent = error.message }
  }
  async function removeExpert(id) { if (!confirm('确定删除这位展示专家？有关联内容时系统会阻止删除。')) return; try { await api(`/admin/experts/${id}`, { method: 'DELETE' }); await load(); runtime.notify('专家已删除', 'success') } catch (error) { runtime.notify(error.message, 'error') } }

  function syncContentType(type) {
    const video = type === 'video'
    $('studioContentType').value = video ? 'video' : 'qa'; $('studioContentTitleLabel').textContent = video ? '视频标题 *' : '问题 *'; $('studioContentSubtitleLabel').textContent = video ? '副标题（可选）' : '补充说明（可选）'; $('studioContentIntroLabel').textContent = video ? '视频导语' : '答案摘要'; $('studioContentBodyLabel').textContent = video ? '视频正文说明 *' : '完整答案 *'
    $('studioContentIntro').placeholder = video ? '用于列表中的视频导语' : '在问答列表中显示的简短答案'
    $('studioContentBody').placeholder = video ? '输入视频的正文说明' : '直接填写问题的完整解答，可分段列出判断要点和处理建议'
    $('studioVideoRow').classList.toggle('hidden', !video); $('studioDurationRow').classList.toggle('hidden', !video)
  }
  function openContent(id = 0) {
    const item = state.contents.find(row => row.id === id)
    const type = item ? item.type : state.tab
    syncContentType(type); expertOptions(item ? item.expertId : '')
    $('studioContentId').value = item ? item.id : ''; $('expertContentModalTitle').textContent = item ? `编辑${type === 'video' ? '精选视频' : '精选问答'}` : `新增${type === 'video' ? '精选视频' : '精选问答'}`
    $('studioContentTitle').value = item ? item.title : ''; $('studioContentSubtitle').value = item ? item.subtitle : ''; $('studioContentExpert').value = item && item.expertId ? String(item.expertId) : ''
    const categoryValue = item ? `${item.categoryKey}|${item.categoryName}` : 'planting|种植技术'; $('studioContentCategory').value = [...$('studioContentCategory').options].some(option => option.value === categoryValue) ? categoryValue : 'planting|种植技术'
    $('studioContentCover').value = item ? item.coverUrl : ''; $('studioContentVideo').value = item ? item.videoUrl : ''; $('studioContentDuration').value = item ? item.duration : ''
    $('studioContentIntro').value = item ? item.intro : ''; $('studioContentBody').value = item ? item.content : ''; $('studioContentTags').value = item ? (item.tags || []).join('\n') : ''; $('studioContentSort').value = item ? item.sortOrder : 0
    $('studioContentFeatured').checked = item ? item.isFeatured : true; $('studioContentPublished').checked = item ? item.isPublished : true; $('studioCoverUploadStatus').textContent = ''; $('studioVideoUploadStatus').textContent = ''; $('expertContentMessage').textContent = ''; $('expertContentModal').classList.remove('hidden')
  }
  function closeContent() { $('expertContentModal').classList.add('hidden') }
  async function saveContent(event) {
    event.preventDefault(); const id = $('studioContentId').value; const category = $('studioContentCategory').value.split('|')
    const body = { type: $('studioContentType').value, title: $('studioContentTitle').value.trim(), subtitle: $('studioContentSubtitle').value.trim(), expert_id: $('studioContentExpert').value, category_key: category[0], category_name: category[1], cover_url: $('studioContentCover').value.trim(), video_url: $('studioContentVideo').value.trim(), duration: $('studioContentDuration').value.trim(), intro: $('studioContentIntro').value.trim(), content: $('studioContentBody').value.trim(), tags: lines($('studioContentTags').value), sort_order: $('studioContentSort').value, is_featured: $('studioContentFeatured').checked, is_published: $('studioContentPublished').checked }
    if (!body.title || !body.content || (body.type === 'video' && !body.video_url)) { $('expertContentMessage').textContent = body.type === 'video' ? '视频标题、视频文件和正文说明不能为空' : '问题标题和专家答案不能为空'; return }
    $('expertContentMessage').textContent = '正在保存...'
    try { await api(`/admin/contents${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); closeContent(); await load(); runtime.notify(body.is_published ? '内容已同步发布到小程序和网页端' : '草稿已保存', 'success') } catch (error) { $('expertContentMessage').textContent = error.message }
  }
  async function removeContent(id) { if (!confirm('确定删除这条内容？此操作不可恢复。')) return; try { await api(`/admin/contents/${id}`, { method: 'DELETE' }); await load(); runtime.notify('内容已删除', 'success') } catch (error) { runtime.notify(error.message, 'error') } }

  async function uploadFile(inputId, targetId, statusId) {
    const file = $(inputId).files && $(inputId).files[0]
    if (!file) return
    $(statusId).textContent = '上传中...'
    const form = new FormData(); form.append('file', file)
    try {
      const response = await fetch('/api/expert-studio/admin/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      const result = await response.json().catch(() => ({}))
      if (response.status === 401) return unauthorized()
      if (!response.ok || result.code !== 200) throw new Error(result.msg || '上传失败')
      $(targetId).value = result.data.url; $(statusId).textContent = '上传成功'; runtime.notify('文件上传成功', 'success')
    } catch (error) { $(statusId).textContent = error.message || '上传失败' }
    finally { $(inputId).value = '' }
  }

  document.querySelector('[data-view="experts"]').onclick = show
  document.querySelectorAll('[data-view]:not([data-view="experts"])').forEach(item => item.addEventListener('click', () => $('expertPanel').classList.add('hidden')))
  document.querySelectorAll('[data-studio-tab]').forEach(button => { button.onclick = () => setTab(button.dataset.studioTab) })
  $('addExpertStudioBtn').onclick = () => state.tab === 'experts' ? openExpert() : openContent()
  $('closeExpertProfileModal').onclick = closeExpert; $('cancelExpertProfileBtn').onclick = closeExpert; $('expertProfileForm').addEventListener('submit', saveExpert)
  $('closeExpertContentModal').onclick = closeContent; $('cancelExpertContentBtn').onclick = closeContent; $('expertContentForm').addEventListener('submit', saveContent)
  $('uploadExpertAvatarBtn').onclick = () => $('studioExpertAvatarFile').click(); $('studioExpertAvatarFile').onchange = () => uploadFile('studioExpertAvatarFile', 'studioExpertAvatarUrl', 'expertAvatarUploadStatus')
  $('uploadStudioCoverBtn').onclick = () => $('studioContentCoverFile').click(); $('studioContentCoverFile').onchange = () => uploadFile('studioContentCoverFile', 'studioContentCover', 'studioCoverUploadStatus')
  $('uploadStudioVideoBtn').onclick = () => $('studioContentVideoFile').click(); $('studioContentVideoFile').onchange = () => uploadFile('studioContentVideoFile', 'studioContentVideo', 'studioVideoUploadStatus')
})()
