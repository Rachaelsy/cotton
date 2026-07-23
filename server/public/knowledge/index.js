const state = {
  token: localStorage.getItem('knowledge_token') || '',
  user: JSON.parse(localStorage.getItem('knowledge_user') || 'null'),
  adminToken: localStorage.getItem('admin_token') || '', isAdmin: false,
  courses: [], questions: [], categories: [], courseCategory: 'all', forumCategory: 'all', view: 'courses', query: ''
}

const $ = id => document.getElementById(id)
const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char])
const dateText = value => value ? new Date(value).toLocaleDateString('zh-CN', { year:'numeric', month:'short', day:'numeric' }) : ''
const typeName = { video: '视频课', article: '图文课', gallery: '图集课' }
const difficultyName = { intro: '入门', intermediate: '进阶', advanced: '高级' }

async function api(path, options = {}) {
  const response = await fetch(`/api/knowledge${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...(options.headers || {}) }
  })
  const result = await response.json().catch(() => ({ code: response.status, msg: '请求失败' }))
  if (response.status === 401 && state.token) logout(false)
  if (!response.ok || result.code !== 200) throw new Error(result.msg || '请求失败')
  return result.data
}

async function adminApi(path, options = {}) {
  const response = await fetch(`/api/knowledge/admin${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.adminToken}`, ...(options.headers || {}) }
  })
  const result = await response.json().catch(() => ({ msg: '管理操作失败' }))
  if (!response.ok || result.code !== 200) throw new Error(result.msg || '管理操作失败')
  return result.data
}

function accountLabel() {
  $('accountBtn').textContent = state.user ? (state.user.real_name || state.user.company_name || state.user.name || '我的学习') : '登录'
  $('registerBtn').classList.toggle('hidden', !!state.user)
}

function courseCard(item) {
  const cover = item.coverUrl || '/admin/assets/cotton-field-sky.png'
  return `<article class="course-card">
    <a class="course-card-link" href="/knowledge/detail.html?id=${item.id}">
      <div class="course-cover">
      <img src="${escapeHtml(cover)}" alt="${escapeHtml(item.title)}">
      <span class="course-type">${typeName[item.type] || '知识课'}</span>
      ${item.progressPercent ? `<div class="course-progress"><span style="width:${Math.min(100,item.progressPercent)}%"></span></div>` : ''}
      </div>
      <div class="course-body">
        <span class="course-category">${escapeHtml(item.categoryName)} · ${difficultyName[item.difficulty] || '入门'}</span>
        <h3 class="course-title">${escapeHtml(item.title)}</h3>
        <p class="course-subtitle">${escapeHtml(item.subtitle || item.content.slice(0, 70))}</p>
        <div class="course-meta"><span>${item.viewCount} 次学习</span><span>${item.commentCount} 条评论</span></div>
      </div>
    </a>
    ${state.isAdmin ? `<div class="course-admin-actions"><strong>管理员操作</strong><button class="small-btn primary" data-admin-edit="${item.id}">编辑</button><button class="small-btn" data-admin-status="${item.id}" data-status="${item.status}">${item.status === 'published' ? '下架' : '上架'}</button></div>` : ''}
  </article>`
}

function renderCourses() {
  const rows = state.courses.filter(item => state.courseCategory === 'all' || item.categoryKey === state.courseCategory)
  $('courseGrid').innerHTML = rows.length ? rows.map(courseCard).join('') : '<div class="empty">没有找到匹配的学习内容</div>'
  $('courseFilters').innerHTML = state.categories.map(item => `<button class="filter-btn ${state.courseCategory === item.key ? 'active' : ''}" data-category="${escapeHtml(item.key)}">${escapeHtml(item.name)} <span>${item.total}</span></button>`).join('')
  $('courseFilters').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    state.courseCategory = button.dataset.category
    renderCourses()
  }))
  document.querySelectorAll('[data-admin-edit]').forEach(button => button.addEventListener('click', () => {
    location.href = `/knowledge/admin.html?edit=${button.dataset.adminEdit}`
  }))
  document.querySelectorAll('[data-admin-status]').forEach(button => button.addEventListener('click', async () => {
    const status = button.dataset.status === 'published' ? 'draft' : 'published'
    if (!confirm(status === 'draft' ? '下架这项内容？' : '重新上架这项内容？')) return
    try {
      await adminApi(`/contents/${button.dataset.adminStatus}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      await loadCourses()
    } catch (error) { alert(error.message) }
  }))
}

async function initAdminMode() {
  if (!state.adminToken) return
  try {
    await adminApi('/stats')
    state.isAdmin = true
    $('adminPreviewBar').classList.remove('hidden')
    if (!state.token) {
      $('accountBtn').textContent = '管理员'
      $('registerBtn').classList.add('hidden')
    }
    renderCourses()
  } catch {}
}

function renderContinue() {
  const rows = state.courses.filter(item => item.progressPercent > 0).sort((a,b) => b.progressPercent - a.progressPercent).slice(0, 3)
  $('learningHint').textContent = state.token ? (rows.length ? '从上次停下的位置继续。' : '开始学习后会在这里显示进度。') : '登录后自动保存最近观看位置。'
  $('continueList').innerHTML = rows.length ? rows.map(item => `<a class="continue-item" href="/knowledge/detail.html?id=${item.id}">
    <img src="${escapeHtml(item.coverUrl || '/admin/assets/cotton-field-sky.png')}" alt="">
    <span><strong>${escapeHtml(item.title)}</strong><span class="mini-progress"><span style="width:${item.progressPercent}%"></span></span></span>
  </a>`).join('') : `<button class="btn secondary" id="historyLoginBtn">${state.token ? '浏览课程开始学习' : '登录查看学习记录'}</button>`
  const button = $('historyLoginBtn')
  if (button) button.addEventListener('click', () => state.token ? window.scrollTo({ top: 480, behavior: 'smooth' }) : openAuth('login'))
}

function questionRow(item) {
  const excerpt = item.body.length > 150 ? `${item.body.slice(0,150)}...` : item.body
  return `<a class="question-row" href="/knowledge/forum.html?id=${item.id}">
    <div class="question-score"><strong>${item.answerCount}</strong>个回答</div>
    <div><h3 class="question-title">${item.status === 'solved' ? '<span class="solved">已解决 · </span>' : ''}${escapeHtml(item.title)}</h3><p class="question-excerpt">${escapeHtml(excerpt)}</p><div class="tag-row"><span class="tag">${escapeHtml(item.categoryName)}</span>${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div></div>
    <div class="question-by">${escapeHtml(item.nickname)}<br>${dateText(item.updatedAt)}<br>${item.viewCount} 次浏览</div>
  </a>`
}

function renderForum() {
  const rows = state.questions.filter(item => state.forumCategory === 'all' || item.categoryKey === state.forumCategory)
  $('forumList').innerHTML = rows.length ? rows.map(questionRow).join('') : '<div class="empty">还没有这类问题，欢迎发起第一个提问</div>'
}

async function loadCourses() {
  const query = state.query ? `?q=${encodeURIComponent(state.query)}` : ''
  const data = await api(`/home${query}`)
  state.courses = data.contents || []
  state.categories = data.categories || []
  $('heroCourseCount').textContent = state.courses.length
  renderCourses()
  renderContinue()
}

async function loadForum() {
  const query = state.query ? `?q=${encodeURIComponent(state.query)}` : ''
  const data = await api(`/forum${query}`)
  state.questions = data.questions || []
  $('heroQuestionCount').textContent = state.questions.length
  renderForum()
}

function switchView(view) {
  state.view = view
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view))
  $('coursesView').classList.toggle('hidden', view !== 'courses')
  $('forumView').classList.toggle('hidden', view !== 'forum')
}

function openModal(id) { $(id).classList.remove('hidden') }
function closeModal(id) { $(id).classList.add('hidden') }
function openAuth(mode = 'login') {
  const registering = mode === 'register'
  $('loginTitle').textContent = registering ? '注册知识讲堂' : '登录知识讲堂'
  $('loginForm').classList.toggle('hidden', registering)
  $('registerForm').classList.toggle('hidden', !registering)
  $('loginMessage').textContent = ''
  $('registerMessage').textContent = ''
  openModal('loginModal')
}
function logout(reload = true) {
  state.token = ''; state.user = null
  localStorage.removeItem('knowledge_token'); localStorage.removeItem('knowledge_user')
  accountLabel()
  if (reload) Promise.all([loadCourses(), loadForum()]).catch(() => {})
}

async function initWechatLogin() {
  try {
    const response = await fetch('/api/auth/wechat-web/status')
    const result = await response.json()
    $('wechatLoginBtn').classList.toggle('hidden', !result.data?.enabled)
  } catch {}
}

async function exchangeLoginBridge() {
  const params = new URLSearchParams(location.search)
  const ticket = params.get('bridge')
  const wechatError = params.get('wechat_error')
  for (const key of ['bridge', 'source', 'wechat_error']) params.delete(key)
  const cleanUrl = `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`
  if (cleanUrl !== `${location.pathname}${location.search}${location.hash}`) {
    history.replaceState(null, '', cleanUrl)
  }
  if (wechatError) {
    openAuth('login')
    $('loginMessage').textContent = wechatError
  }
  if (!ticket) return
  try {
    const response = await fetch('/api/auth/web-bridge/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket })
    })
    const result = await response.json()
    if (!response.ok || result.code !== 200) throw new Error(result.msg || '自动登录失败')
    state.token = result.data.token
    state.user = result.data
    localStorage.setItem('knowledge_token', state.token)
    localStorage.setItem('knowledge_user', JSON.stringify(state.user))
  } catch (error) {
    openAuth('login')
    $('loginMessage').textContent = error.message
  }
}

document.querySelectorAll('.nav-tab').forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.view)))
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)))
document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop.id) }))

$('forumFilters').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
  state.forumCategory = button.dataset.category
  $('forumFilters').querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button))
  renderForum()
}))

$('globalSearch').addEventListener('search', async event => {
  state.query = event.target.value.trim()
  await Promise.all([loadCourses(), loadForum()])
})

$('accountBtn').addEventListener('click', () => {
  if (state.isAdmin && !state.token) {
    location.href = '/knowledge/admin.html'
    return
  }
  if (!state.token) return openAuth('login')
  if (confirm('退出当前知识讲堂账号？')) logout()
})

$('registerBtn').addEventListener('click', () => openAuth('register'))
$('loginAuthTab').addEventListener('click', () => openAuth('login'))
$('registerAuthTab').addEventListener('click', () => openAuth('register'))
$('loginAuthTabFromRegister').addEventListener('click', () => openAuth('login'))
$('askBtn').addEventListener('click', () => state.token ? openModal('questionModal') : openAuth('login'))
$('heroForumBtn').addEventListener('click', () => {
  switchView('forum')
  $('forumView').scrollIntoView({ behavior: 'smooth', block: 'start' })
})

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault()
  const message = $('loginMessage')
  message.textContent = '正在登录...'
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: $('loginPhone').value.trim(), password: $('loginPassword').value })
    })
    const result = await response.json()
    if (!response.ok || result.code !== 200) throw new Error(result.msg || '登录失败')
    state.token = result.data.token; state.user = result.data
    localStorage.setItem('knowledge_token', state.token); localStorage.setItem('knowledge_user', JSON.stringify(state.user))
    message.textContent = ''
    closeModal('loginModal'); accountLabel()
    await Promise.all([loadCourses(), loadForum()])
  } catch (error) { message.textContent = error.message }
})

$('registerForm').addEventListener('submit', async event => {
  event.preventDefault()
  const message = $('registerMessage')
  const password = $('registerPassword').value
  if (password !== $('registerPasswordConfirm').value) {
    message.textContent = '两次输入的密码不一致'
    return
  }
  message.textContent = '正在注册...'
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: $('registerPhone').value.trim(),
        password,
        role: 'farmer',
        real_name: $('registerName').value.trim(),
        location: $('registerLocation').value.trim(),
        land_size: Number($('registerLandSize').value) || 0,
        crop_type: '棉花'
      })
    })
    const result = await response.json()
    if (!response.ok || result.code !== 200) throw new Error(result.msg || '注册失败')
    state.token = result.data.token
    state.user = result.data
    localStorage.setItem('knowledge_token', state.token)
    localStorage.setItem('knowledge_user', JSON.stringify(state.user))
    $('registerForm').reset()
    closeModal('loginModal')
    accountLabel()
    await Promise.all([loadCourses(), loadForum()])
  } catch (error) {
    message.textContent = error.message
  }
})

$('questionForm').addEventListener('submit', async event => {
  event.preventDefault()
  const message = $('questionMessage')
  const [category_key, category_name] = $('qCategory').value.split('|')
  message.textContent = '正在发布...'
  try {
    const data = await api('/forum', { method: 'POST', body: JSON.stringify({
      title: $('qTitle').value, body: $('qBody').value, category_key, category_name, tags: $('qTags').value
    }) })
    closeModal('questionModal'); $('questionForm').reset(); message.textContent = ''
    window.location.href = `/knowledge/forum.html?id=${data.id}`
  } catch (error) { message.textContent = error.message }
})

async function initialize() {
  await exchangeLoginBridge()
  accountLabel()
  initWechatLogin()
  const params = new URLSearchParams(location.search)
  if (params.get('view') === 'forum') switchView('forum')
  if (params.get('auth') === 'register') openAuth('register')
  await Promise.all([loadCourses(), loadForum(), initAdminMode()])
}

initialize().catch(error => {
  $('courseGrid').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`
  $('forumList').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`
})
