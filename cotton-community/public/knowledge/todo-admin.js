(() => {
  const token = localStorage.getItem('admin_token') || ''
  const runtime = window.CottonRuntime
  const $ = id => document.getElementById(id)
  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
  const state = { rows: [] }
  const priorityNames = { normal: '普通', important: '重要', urgent: '紧急' }
  const statusNames = { draft: '草稿', published: '已发布', offline: '已下线' }

  function localDate(date = new Date()) {
    const pad = number => String(number).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
  function unauthorized() {
    localStorage.removeItem('admin_token'); localStorage.removeItem('admin_name')
    location.replace('/admin/login.html?role=admin')
  }
  async function api(path, options = {}) {
    const result = await runtime.requestJson(`/api/daily-todos${path}`, options, { token, onUnauthorized: unauthorized })
    return result.data
  }
  function hidePanels() {
    ['listPanel', 'editorPanel', 'homepagePanel', 'financePanel', 'productPanel', 'varietyPanel', 'factoryPanel', 'expertPanel', 'securityPanel', 'farmerPanel'].forEach(id => $(id).classList.add('hidden'))
  }
  function render() {
    $('todoCountHint').textContent = `${$('todoFilterDate').value} 共 ${state.rows.length} 条`
    $('todoTable').innerHTML = state.rows.length ? state.rows.map(item => `
      <tr><td>${esc(item.timeLabel || '全天')}<br><strong>${esc(item.title)}</strong></td><td><span class="question-excerpt">${esc(item.content || '—')}</span></td>
      <td><span class="status-pill ${item.priority === 'normal' ? '' : 'published'}">${priorityNames[item.priority] || '普通'}</span></td>
      <td><span class="question-excerpt">${esc(item.voiceText || '自动生成')}</span></td><td><span class="status-pill ${item.status === 'published' ? 'published' : ''}">${statusNames[item.status] || '草稿'}</span></td>
      <td>${Number(item.sortOrder || 0)}</td><td><div class="table-actions"><button class="small-btn primary" data-todo-edit="${item.id}">编辑</button><button class="small-btn danger" data-todo-delete="${item.id}">删除</button></div></td></tr>`).join('') : '<tr><td colspan="7">该日期暂无待办，点击右上角“新增待办”开始录入。</td></tr>'
    document.querySelectorAll('[data-todo-edit]').forEach(button => { button.onclick = () => openModal(Number(button.dataset.todoEdit)) })
    document.querySelectorAll('[data-todo-delete]').forEach(button => { button.onclick = () => remove(Number(button.dataset.todoDelete)) })
  }
  async function load() {
    const date = $('todoFilterDate').value || localDate()
    $('todoTable').innerHTML = '<tr><td colspan="7">加载中...</td></tr>'
    state.rows = await api(`/admin/list?date=${encodeURIComponent(date)}`)
    render()
  }
  function show() {
    hidePanels(); $('todoPanel').classList.remove('hidden'); $('pageTitle').textContent = '今日待办'
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === 'todos'))
    load().catch(error => runtime.notify(error.message, 'error'))
  }
  function openModal(id = 0) {
    const item = state.rows.find(row => Number(row.id) === Number(id))
    $('todoId').value = item ? item.id : ''; $('todoModalTitle').textContent = item ? '编辑待办' : '新增今日待办'
    $('todoDate').value = item ? item.date : ($('todoFilterDate').value || localDate()); $('todoTime').value = item ? item.timeLabel : ''
    $('todoTitle').value = item ? item.title : ''; $('todoContent').value = item ? item.content : ''; $('todoVoice').value = item ? item.voiceText : ''
    $('todoPriority').value = item ? item.priority : 'normal'; $('todoStatus').value = item ? item.status : 'published'; $('todoSort').value = item ? item.sortOrder : state.rows.length
    $('todoMessage').textContent = ''; $('todoModal').classList.remove('hidden')
  }
  function closeModal() { $('todoModal').classList.add('hidden') }
  async function save(event) {
    event.preventDefault(); const id = $('todoId').value
    const body = { todo_date: $('todoDate').value, time_label: $('todoTime').value.trim(), title: $('todoTitle').value.trim(), content: $('todoContent').value.trim(), voice_text: $('todoVoice').value.trim(), priority: $('todoPriority').value, status: $('todoStatus').value, sort_order: $('todoSort').value }
    if (!body.todo_date || !body.title) { $('todoMessage').textContent = '待办日期和标题不能为空'; return }
    $('todoMessage').textContent = '正在保存...'
    try {
      await api(`/admin${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const selectedDate = body.todo_date; closeModal(); $('todoFilterDate').value = selectedDate; await load()
      runtime.notify(body.status === 'published' ? '待办已发布到小程序首页' : '待办已保存', 'success')
    } catch (error) { $('todoMessage').textContent = error.message }
  }
  async function remove(id) {
    if (!confirm('确定删除这条待办？此操作不可恢复。')) return
    try { await api(`/admin/${id}`, { method: 'DELETE' }); await load(); runtime.notify('待办已删除', 'success') }
    catch (error) { runtime.notify(error.message, 'error') }
  }

  $('todoFilterDate').value = localDate()
  document.querySelector('[data-view="todos"]').onclick = show
  document.querySelectorAll('[data-view]:not([data-view="todos"])').forEach(item => item.addEventListener('click', () => $('todoPanel').classList.add('hidden')))
  $('todoFilterDate').addEventListener('change', () => load().catch(error => runtime.notify(error.message, 'error')))
  $('todoTodayBtn').onclick = () => { $('todoFilterDate').value = localDate(); load().catch(error => runtime.notify(error.message, 'error')) }
  $('addTodoBtn').onclick = () => openModal(); $('closeTodoModal').onclick = closeModal; $('cancelTodoBtn').onclick = closeModal; $('todoForm').addEventListener('submit', save)
})()
