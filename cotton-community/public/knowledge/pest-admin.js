(() => {
  const token = localStorage.getItem('admin_token') || ''
  const runtime = window.CottonRuntime
  const $ = id => document.getElementById(id)
  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
  const categoryNames = { pest: '虫害', disease: '病害', physiological: '生理性' }
  const state = { items: [] }

  function unauthorized() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    location.replace('/admin/login.html?role=admin')
  }

  async function api(path, options = {}) {
    const result = await runtime.requestJson(`/api/pest-knowledge${path}`, options, { token, onUnauthorized: unauthorized })
    return result.data
  }

  function statusName(status) {
    return status === 'published' ? '已发布' : status === 'offline' ? '已下线' : '草稿'
  }

  function render() {
    $('pestTable').innerHTML = state.items.length ? state.items.map(item => `
      <tr><td><strong>${esc(item.icon || '🌿')} ${esc(item.name)}</strong>${item.isFeatured ? '<br><span class="status-pill published">优先</span>' : ''}</td>
      <td>${esc(categoryNames[item.category] || item.categoryName || '病虫害')}</td>
      <td><span class="question-excerpt">${esc(item.summary || '').slice(0, 90)}</span></td>
      <td><span class="status-pill ${item.status === 'published' ? 'published' : ''}">${statusName(item.status)}</span></td>
      <td>${Number(item.sortOrder || 0)}</td><td>${item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '—'}</td>
      <td><div class="product-actions"><button class="small-btn primary" data-pest-edit="${item.id}">编辑</button>${item.status === 'published' ? `<button class="small-btn" data-pest-status="${item.id}" data-status="offline">下线</button>` : `<button class="small-btn primary" data-pest-status="${item.id}" data-status="published">发布</button>`}<button class="small-btn danger" data-pest-delete="${item.id}">删除</button></div></td></tr>`).join('')
      : '<tr><td colspan="7">暂无病虫害知识，点击右上角“新增知识”开始录入。</td></tr>'
    document.querySelectorAll('[data-pest-edit]').forEach(button => { button.onclick = () => openModal(Number(button.dataset.pestEdit)) })
    document.querySelectorAll('[data-pest-status]').forEach(button => { button.onclick = () => updateStatus(Number(button.dataset.pestStatus), button.dataset.status) })
    document.querySelectorAll('[data-pest-delete]').forEach(button => { button.onclick = () => remove(Number(button.dataset.pestDelete)) })
  }

  async function load() {
    $('pestTable').innerHTML = '<tr><td colspan="7">正在加载...</td></tr>'
    state.items = await api('/admin/list') || []
    render()
  }

  function hideOtherPanels() {
    ['listPanel', 'editorPanel', 'financePanel', 'homepagePanel', 'voicePanel', 'productPanel', 'varietyPanel', 'factoryPanel', 'expertPanel', 'securityPanel', 'farmerPanel', 'plotPanel']
      .forEach(id => { const panel = $(id); if (panel) panel.classList.add('hidden') })
  }

  function show() {
    hideOtherPanels()
    $('pestPanel').classList.remove('hidden')
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === 'pests'))
    $('pageTitle').textContent = '病虫害管理'
    load().catch(error => runtime.notify(error.message, 'error'))
  }

  function openModal(id = 0) {
    const item = state.items.find(row => Number(row.id) === Number(id))
    $('pestId').value = item ? item.id : ''
    $('pestModalTitle').textContent = item ? '编辑病虫害知识' : '新增病虫害知识'
    $('pestName').value = item ? item.name : ''
    $('pestCategory').value = item ? item.category : 'pest'
    $('pestIcon').value = item ? item.icon : '🌿'
    $('pestCover').value = item ? item.coverUrl : ''
    $('pestSummary').value = item ? item.summary : ''
    $('pestSymptoms').value = item ? (item.symptoms || []).join('\n') : ''
    $('pestTreatment').value = item ? item.treatmentAdvice : ''
    $('pestWarning').value = item ? item.medicationWarning : ''
    $('pestSourceName').value = item ? item.sourceName : ''
    $('pestSourceUrl').value = item ? item.sourceUrl : ''
    $('pestStatus').value = item ? item.status : 'draft'
    $('pestSort').value = item ? item.sortOrder : 0
    $('pestFeatured').checked = item ? item.isFeatured : false
    $('pestMessage').textContent = ''
    $('pestModal').classList.remove('hidden')
  }

  function closeModal() { $('pestModal').classList.add('hidden') }

  async function save(event) {
    event.preventDefault()
    const id = $('pestId').value
    const body = {
      name: $('pestName').value.trim(), category: $('pestCategory').value, icon: $('pestIcon').value.trim(),
      cover_url: $('pestCover').value.trim(), summary: $('pestSummary').value.trim(),
      symptoms: $('pestSymptoms').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
      treatment_advice: $('pestTreatment').value.trim(), medication_warning: $('pestWarning').value.trim(),
      source_name: $('pestSourceName').value.trim(), source_url: $('pestSourceUrl').value.trim(),
      status: $('pestStatus').value, sort_order: $('pestSort').value, is_featured: $('pestFeatured').checked
    }
    if (!body.name || !body.summary || !body.treatment_advice) { $('pestMessage').textContent = '名称、问题概述和防治建议不能为空'; return }
    $('pestMessage').textContent = '正在保存...'
    try {
      await api(`/admin${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      closeModal(); await load(); runtime.notify(body.status === 'published' ? '知识已发布到小程序和网页端' : '病虫害知识已保存', 'success')
    } catch (error) { $('pestMessage').textContent = error.message }
  }

  async function updateStatus(id, status) {
    if (!confirm(status === 'published' ? '确定发布这条知识？' : '确定下线这条知识？')) return
    try { await api(`/admin/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); await load(); runtime.notify('状态已更新', 'success') }
    catch (error) { runtime.notify(error.message, 'error') }
  }

  async function remove(id) {
    if (!confirm('确定删除这条病虫害知识？此操作不可恢复。')) return
    try { await api(`/admin/${id}`, { method: 'DELETE' }); await load(); runtime.notify('知识已删除', 'success') }
    catch (error) { runtime.notify(error.message, 'error') }
  }

  const pestNav = document.querySelector('[data-view="pests"]')
  if (pestNav) pestNav.onclick = show
  document.querySelectorAll('[data-view]:not([data-view="pests"])').forEach(item => item.addEventListener('click', () => $('pestPanel').classList.add('hidden')))
  $('addPestBtn').onclick = () => openModal()
  $('closePestModal').onclick = closeModal
  $('cancelPestBtn').onclick = closeModal
  $('pestForm').addEventListener('submit', save)
})()
