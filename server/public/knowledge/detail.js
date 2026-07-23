const id = Number(new URLSearchParams(location.search).get('id'))
const state = {
  token: localStorage.getItem('knowledge_token') || '', user: JSON.parse(localStorage.getItem('knowledge_user') || 'null'),
  adminToken: localStorage.getItem('admin_token') || '', isAdmin: false,
  content: null, comments: [], viewer: null, replyingTo: null, lastSavedSecond: -1, aiHistory: [],
  quizAnswers: [], quizSubmitted: false
}
const $ = value => document.getElementById(value)
const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char])
const formatDate = value => value ? new Date(value).toLocaleString('zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : ''
const typeName = { video:'视频课', article:'图文课', gallery:'图集课' }
const difficultyName = { intro:'入门', intermediate:'进阶', advanced:'高级' }

async function api(path, options = {}) {
  const response = await fetch(`/api/knowledge${path}`, { ...options, headers: { 'Content-Type':'application/json', ...(state.token ? { Authorization:`Bearer ${state.token}` } : {}), ...(options.headers || {}) } })
  const result = await response.json().catch(() => ({ msg:'请求失败' }))
  if (!response.ok || result.code !== 200) throw new Error(result.msg || '请求失败')
  return result.data
}
async function adminApi(path, options = {}) {
  const response = await fetch(`/api/knowledge/admin${path}`, { ...options, headers: { 'Content-Type':'application/json', Authorization:`Bearer ${state.adminToken}`, ...(options.headers || {}) } })
  const result = await response.json().catch(() => ({ msg:'管理操作失败' }))
  if (!response.ok || result.code !== 200) throw new Error(result.msg || '管理操作失败')
  return result.data
}
async function initAdminMode() {
  if (!state.adminToken) return
  try {
    await adminApi('/stats')
    state.isAdmin = true
    $('adminPreviewBar').classList.remove('hidden')
    if (!state.token) $('accountBtn').textContent = '管理员'
  } catch {}
}
function accountLabel() { $('accountBtn').textContent = state.user ? (state.user.real_name || state.user.company_name || '我的学习') : '登录' }
function requireLogin() { if (state.token) return true; $('loginModal').classList.remove('hidden'); return false }
async function initWechatLogin() {
  try {
    const response = await fetch('/api/auth/wechat-web/status')
    const result = await response.json()
    $('wechatLoginBtn').classList.toggle('hidden', !result.data?.enabled)
    $('wechatLoginBtn').href = `/api/auth/wechat-web/start?return_to=${encodeURIComponent(`${location.pathname}${location.search}`)}`
  } catch {}
}
async function exchangeLoginBridge() {
  const params = new URLSearchParams(location.search)
  const ticket = params.get('bridge')
  const wechatError = params.get('wechat_error')
  for (const key of ['bridge', 'source', 'wechat_error']) params.delete(key)
  const cleanUrl = `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`
  if (cleanUrl !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', cleanUrl)
  if (wechatError) {
    $('loginModal').classList.remove('hidden')
    $('loginMessage').textContent = wechatError
  }
  if (!ticket) return
  try {
    const response = await fetch('/api/auth/web-bridge/exchange', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ ticket })
    })
    const result = await response.json()
    if (!response.ok || result.code !== 200) throw new Error(result.msg || '自动登录失败')
    state.token = result.data.token
    state.user = result.data
    localStorage.setItem('knowledge_token', state.token)
    localStorage.setItem('knowledge_user', JSON.stringify(state.user))
  } catch (error) {
    $('loginModal').classList.remove('hidden')
    $('loginMessage').textContent = error.message
  }
}

function renderMedia(item) {
  if (item.type === 'video' && item.videoUrl) {
    $('mediaStage').innerHTML = `<video id="courseVideo" controls playsinline poster="${escapeHtml(item.coverUrl || '')}" src="${escapeHtml(item.videoUrl)}"></video>`
    const video = $('courseVideo')
    video.addEventListener('loadedmetadata', () => { if (item.progressSeconds > 0 && item.progressSeconds < video.duration - 5) video.currentTime = item.progressSeconds })
    video.addEventListener('timeupdate', () => {
      const second = Math.floor(video.currentTime)
      if (state.token && second > 0 && second !== state.lastSavedSecond && second % 10 === 0) {
        state.lastSavedSecond = second
        saveProgress(second, Math.floor(video.duration), false)
      }
    })
    video.addEventListener('ended', () => state.token && saveProgress(Math.floor(video.duration), Math.floor(video.duration), true))
  } else if (item.coverUrl) {
    $('mediaStage').innerHTML = `<img src="${escapeHtml(item.coverUrl)}" alt="${escapeHtml(item.title)}">`
  } else {
    $('mediaStage').innerHTML = '<div class="media-placeholder">本节以文字内容为主</div>'
  }
}

function safeMediaUrl(value) {
  const url = String(value || '').trim()
  return url.startsWith('/admin/assets/') || url.startsWith('/uploads/') || /^https:\/\//i.test(url) ? url : ''
}

function renderBody(text) {
  const lines = String(text || '').split(/\r?\n/)
  let html = ''
  let list = []
  const flushList = () => {
    if (!list.length) return
    html += `<ul>${list.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    list = []
  }
  lines.forEach(rawLine => {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      return
    }
    const figure = line.match(/^\[\[image:([^|\]]+)\|([^\]]+)\]\]$/)
    if (figure) {
      flushList()
      const url = safeMediaUrl(figure[1])
      if (url) html += `<figure class="article-figure"><img src="${escapeHtml(url)}" alt="${escapeHtml(figure[2])}" loading="lazy"><figcaption>${escapeHtml(figure[2])}</figcaption></figure>`
      return
    }
    if (line.startsWith('### ')) {
      flushList()
      html += `<h3>${escapeHtml(line.slice(4))}</h3>`
      return
    }
    if (line.startsWith('## ')) {
      flushList()
      html += `<h2>${escapeHtml(line.slice(3))}</h2>`
      return
    }
    if (line.startsWith('> ')) {
      flushList()
      html += `<aside class="article-callout">${escapeHtml(line.slice(2))}</aside>`
      return
    }
    if (line.startsWith('- ')) {
      list.push(line.slice(2))
      return
    }
    flushList()
    html += `<p>${escapeHtml(line)}</p>`
  })
  flushList()
  return html
}

function renderQuiz(quiz = []) {
  if (!quiz.length) return
  $('courseQuiz').classList.remove('hidden')
  const correctCount = state.quizSubmitted
    ? quiz.reduce((total, question, index) => total + (state.quizAnswers[index] === question.correctIndex ? 1 : 0), 0)
    : 0
  $('quizProgress').textContent = state.quizSubmitted ? `${correctCount} / ${quiz.length}` : `${quiz.length} 题`
  $('quizScore').textContent = state.quizSubmitted ? `答对 ${correctCount} 题，正确率 ${Math.round(correctCount / quiz.length * 100)}%` : ''
  $('submitQuiz').classList.toggle('hidden', state.quizSubmitted)
  $('quizList').innerHTML = quiz.map((question, questionIndex) => {
    const selected = state.quizAnswers[questionIndex]
    const options = question.options.map((option, optionIndex) => {
      const isCorrect = optionIndex === question.correctIndex
      const isSelected = optionIndex === selected
      const resultClass = state.quizSubmitted ? (isCorrect ? ' correct' : (isSelected ? ' wrong' : '')) : ''
      return `<label class="quiz-option${resultClass}"><input type="radio" name="quiz-${questionIndex}" value="${optionIndex}" ${isSelected ? 'checked' : ''} ${state.quizSubmitted ? 'disabled' : ''}><span class="quiz-option-mark">${String.fromCharCode(65 + optionIndex)}</span><span>${escapeHtml(option)}</span></label>`
    }).join('')
    const result = state.quizSubmitted
      ? `<div class="quiz-explanation ${selected === question.correctIndex ? 'passed' : 'needs-review'}"><strong>${selected === question.correctIndex ? '回答正确' : `正确答案：${String.fromCharCode(65 + question.correctIndex)}`}</strong><p>${escapeHtml(question.explanation)}</p>${selected === question.correctIndex ? '' : `<button class="small-btn primary" data-ai-quiz="${questionIndex}">让 AI 再讲一遍</button><div class="quiz-ai-answer hidden" id="quizAiAnswer${questionIndex}"></div>`}</div>`
      : ''
    return `<section class="quiz-question"><div class="quiz-question-title"><span>${String(questionIndex + 1).padStart(2, '0')}</span><h3>${escapeHtml(question.question)}</h3></div><div class="quiz-options">${options}</div>${result}</section>`
  }).join('')
  document.querySelectorAll('[data-ai-quiz]').forEach(button => button.addEventListener('click', () => explainQuiz(Number(button.dataset.aiQuiz), button)))
}

async function explainQuiz(index, button) {
  const question = state.content && state.content.quiz && state.content.quiz[index]
  if (!question) return
  const answer = $('quizAiAnswer' + index)
  answer.classList.remove('hidden')
  answer.textContent = 'AI 正在结合本课内容整理讲解...'
  button.disabled = true
  const selectedText = question.options[state.quizAnswers[index]] || '未作答'
  const correctText = question.options[question.correctIndex]
  const message = `我在《${state.content.title}》的课后小测中答错了。题目：${question.question}；我的答案：${selectedText}；正确答案：${correctText}；课程标准解析：${question.explanation}。请严格依据课程标准解析，用通俗中文说明我错在哪里，再给出一个便于记忆的判断方法。只允许使用标准解析已有的技术事实，不得引入新的株数、药量、生育指标或操作阈值；尤其不能改变标准解析中的数字范围。记忆方法不要增加任何新数字。请使用纯文本，不要使用 Markdown 符号。`
  try {
    const response = await fetch('/api/ai/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ message, displayMessage:`讲解错题：${question.question}`, history:[] }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.msg || 'AI 解答失败')
    answer.textContent = result.data && result.data.reply || result.msg || '暂时无法回答'
  } catch (error) {
    answer.textContent = error.message || 'AI 暂时不可用，请稍后再试。'
    button.disabled = false
  }
}

function renderDetail(data) {
  state.viewer = data.viewer
  state.content = data.content
  const item = state.content
  document.title = `${item.title} · 棉知学堂`
  $('breadcrumbTitle').textContent = item.title
  $('title').textContent = item.title
  $('subtitle').textContent = item.subtitle
  $('meta').innerHTML = `<span>${escapeHtml(item.categoryName)}</span><span>${typeName[item.type] || '知识内容'}</span><span>${difficultyName[item.difficulty] || '入门'}</span><span>${item.viewCount} 次学习</span><span>来源：${escapeHtml(item.sourceName)}</span>`
  renderMedia(item)
  $('articleBody').innerHTML = renderBody(item.content)
  if (item.images && item.images.length && !String(item.content || '').includes('[[image:')) {
    $('gallery').classList.remove('hidden')
    $('gallery').innerHTML = item.images.map(url => `<img src="${escapeHtml(url)}" alt="课程配图">`).join('')
  }
  renderQuiz(item.quiz || [])
  $('favoriteBtn').textContent = item.isFavorite ? '已收藏' : '收藏'
  $('favoriteBtn').classList.toggle('gold', item.isFavorite)
  if (state.isAdmin) {
    $('detailAdminActions').classList.remove('hidden')
    $('adminEditContent').href = `/knowledge/admin.html?edit=${item.id}`
    $('adminCourseComments').href = `/knowledge/admin.html?view=comments&content=${item.id}`
    $('adminCommentsLink').href = `/knowledge/admin.html?view=comments&content=${item.id}`
    $('adminToggleContent').textContent = item.status === 'published' ? '下架课程' : '上架课程'
  }
  $('relatedList').innerHTML = data.related.length ? data.related.map(row => `<a class="related-item" href="/knowledge/detail.html?id=${row.id}"><img src="${escapeHtml(row.coverUrl || '/admin/assets/cotton-field-sky.png')}" alt=""><strong>${escapeHtml(row.title)}</strong></a>`).join('') : '<p class="question-excerpt">暂无同类内容</p>'
  $('detailLoading').classList.add('hidden'); $('detailContent').classList.remove('hidden')
}

async function saveProgress(progress, duration, completed) {
  try { await api(`/contents/${id}/progress`, { method:'PUT', body:JSON.stringify({ progress_seconds:progress, duration_seconds:duration, completed }) }) } catch {}
}

function commentMarkup(item, nested = false) {
  const replyTarget = item.parent_id
    ? `<div class="comment-reply-target">${item.parent_nickname ? `回复 @${escapeHtml(item.parent_nickname)}` : '回复的原评论已不可见'}</div>`
    : ''
  const userActions = `<div class="comment-actions"><button class="small-btn" data-reply-comment="${item.id}">回复</button>${
    state.viewer && Number(state.viewer.id) === Number(item.user_id)
      ? `<button class="small-btn danger delete-comment" data-id="${item.id}">删除</button>`
      : ''
  }</div>`
  const adminActions = `<div class="comment-admin-actions"><span class="status-pill ${item.status}">${item.status === 'visible' ? '公开' : '已隐藏'}</span><button class="small-btn" data-admin-comment-status="${item.id}" data-status="${item.status}">${item.status === 'visible' ? '隐藏' : '恢复'}</button><button class="small-btn danger" data-admin-comment-delete="${item.id}">永久删除</button></div>`
  return `<div class="comment ${nested ? 'comment-reply' : ''} ${item.status === 'hidden' ? 'hidden-comment' : ''}">
    <div class="avatar">${item.avatar_url ? `<img src="${escapeHtml(item.avatar_url)}" alt="">` : escapeHtml((item.nickname || '棉').slice(0,1))}</div>
    <div><div class="comment-head"><strong>${escapeHtml(item.nickname)}</strong><span class="comment-time">${formatDate(item.created_at)}</span></div>${replyTarget}<div class="comment-body">${escapeHtml(item.body)}</div>
    ${state.isAdmin ? `${userActions}${adminActions}` : userActions}</div>
  </div>`
}

function renderComments() {
  $('commentCount').textContent = state.isAdmin ? `${state.comments.length} 条评论 · 管理员视图` : `${state.comments.length} 条评论`
  const byId = new Map(state.comments.map(item => [Number(item.id), item]))
  const children = new Map()
  state.comments.forEach(item => {
    const parentId = Number(item.parent_id)
    if (!parentId || !byId.has(parentId)) return
    if (!children.has(parentId)) children.set(parentId, [])
    children.get(parentId).push(item)
  })
  const descendants = rootId => {
    const rows = []
    const visited = new Set([Number(rootId)])
    const walk = parentId => {
      ;(children.get(Number(parentId)) || []).sort((a, b) => Number(a.id) - Number(b.id)).forEach(child => {
        const childId = Number(child.id)
        if (visited.has(childId)) return
        visited.add(childId)
        rows.push(child)
        walk(childId)
      })
    }
    walk(rootId)
    return rows
  }
  const roots = state.comments
    .filter(item => !item.parent_id || !byId.has(Number(item.parent_id)))
    .sort((a, b) => Number(b.id) - Number(a.id))
  $('commentList').innerHTML = roots.length ? roots.map(item => {
    const replies = descendants(item.id)
    return `<section class="comment-thread">${commentMarkup(item)}${replies.length ? `<div class="comment-replies">${replies.map(reply => commentMarkup(reply, true)).join('')}</div>` : ''}</section>`
  }).join('') : '<div class="empty">还没有评论，欢迎留下第一条学习心得</div>'
  document.querySelectorAll('[data-reply-comment]').forEach(button => button.addEventListener('click', () => {
    if (!requireLogin()) return
    const target = state.comments.find(item => String(item.id) === button.dataset.replyComment)
    if (!target) return
    state.replyingTo = target
    $('replyNickname').textContent = target.nickname
    $('replyContext').classList.remove('hidden')
    $('commentInput').placeholder = `回复 ${target.nickname}`
    $('commentInput').focus()
  }))
  document.querySelectorAll('.delete-comment').forEach(button => button.addEventListener('click', async () => {
    if (!confirm('删除这条评论？')) return
    try {
      await api(`/comments/${button.dataset.id}`, { method:'DELETE' })
      if (state.replyingTo && String(state.replyingTo.id) === button.dataset.id) cancelReply()
      await loadComments()
    } catch (error) { alert(error.message) }
  }))
  document.querySelectorAll('[data-admin-comment-status]').forEach(button => button.addEventListener('click', async () => {
    const status = button.dataset.status === 'visible' ? 'hidden' : 'visible'
    try { await adminApi(`/comments/${button.dataset.adminCommentStatus}/status`, { method:'PATCH', body:JSON.stringify({ status }) }); await loadComments() } catch (error) { alert(error.message) }
  }))
  document.querySelectorAll('[data-admin-comment-delete]').forEach(button => button.addEventListener('click', async () => {
    if (!confirm('永久删除这条评论？此操作不能撤销。')) return
    try { await adminApi(`/comments/${button.dataset.adminCommentDelete}`, { method:'DELETE' }); await loadComments() } catch (error) { alert(error.message) }
  }))
}

async function loadComments() {
  state.comments = state.isAdmin ? await adminApi(`/comments?content_id=${id}`) : await api(`/contents/${id}/comments`)
  renderComments()
}

function cancelReply() {
  state.replyingTo = null
  $('replyContext').classList.add('hidden')
  $('replyNickname').textContent = ''
  $('commentInput').placeholder = '登录后写下你的理解或问题'
}

$('accountBtn').addEventListener('click', () => {
  if (state.isAdmin && !state.token) {
    location.href = '/knowledge/admin.html'
    return
  }
  if (!state.token) return $('loginModal').classList.remove('hidden')
  if (confirm('退出当前账号？')) { localStorage.removeItem('knowledge_token'); localStorage.removeItem('knowledge_user'); location.reload() }
})
$('closeLogin').addEventListener('click', () => $('loginModal').classList.add('hidden'))
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); $('loginMessage').textContent = '正在登录...'
  try {
    const response = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ phone:$('loginPhone').value.trim(), password:$('loginPassword').value }) })
    const result = await response.json(); if (!response.ok || result.code !== 200) throw new Error(result.msg || '登录失败')
    state.token = result.data.token; state.user = result.data
    localStorage.setItem('knowledge_token', state.token); localStorage.setItem('knowledge_user', JSON.stringify(state.user))
    $('loginModal').classList.add('hidden'); accountLabel(); location.reload()
  } catch (error) { $('loginMessage').textContent = error.message }
})
$('favoriteBtn').addEventListener('click', async () => {
  if (!requireLogin()) return
  try {
    const method = state.content.isFavorite ? 'DELETE' : 'POST'
    const result = await api(`/contents/${id}/favorite`, { method })
    state.content.isFavorite = result.isFavorite
    $('favoriteBtn').textContent = result.isFavorite ? '已收藏' : '收藏'
    $('favoriteBtn').classList.toggle('gold', result.isFavorite)
  } catch (error) { alert(error.message) }
})
$('submitQuiz').addEventListener('click', () => {
  const quiz = state.content && state.content.quiz || []
  const answers = quiz.map((_question, index) => {
    const selected = document.querySelector(`input[name="quiz-${index}"]:checked`)
    return selected ? Number(selected.value) : null
  })
  if (answers.some(answer => answer === null)) return alert('请完成全部题目后再提交')
  state.quizAnswers = answers
  state.quizSubmitted = true
  renderQuiz(quiz)
  if (state.token) saveProgress(state.content.durationSeconds || 300, state.content.durationSeconds || 300, true)
  $('courseQuiz').scrollIntoView({ behavior:'smooth', block:'start' })
})
$('commentBtn').addEventListener('click', async () => {
  if (!requireLogin()) return
  const body = $('commentInput').value.trim(); if (body.length < 2) return alert('请至少输入2个字')
  try {
    await api(`/contents/${id}/comments`, {
      method:'POST',
      body:JSON.stringify({ body, parent_id: state.replyingTo ? state.replyingTo.id : null })
    })
    $('commentInput').value=''
    cancelReply()
    await loadComments()
  } catch (error) { alert(error.message) }
})
$('cancelReply').addEventListener('click', cancelReply)
$('adminToggleContent').addEventListener('click', async () => {
  if (!state.isAdmin || !state.content) return
  const status = state.content.status === 'published' ? 'draft' : 'published'
  if (!confirm(status === 'draft' ? '下架后普通用户将无法继续打开本课程，确定下架？' : '确定重新上架本课程？')) return
  try {
    await adminApi(`/contents/${id}/status`, { method:'PATCH', body:JSON.stringify({ status }) })
    if (status === 'draft') location.href = '/knowledge/'
    else location.reload()
  } catch (error) { alert(error.message) }
})
$('aiBtn').addEventListener('click', askAi)
$('aiInput').addEventListener('keydown', event => { if (event.key === 'Enter') askAi() })
async function askAi() {
  const question = $('aiInput').value.trim(); if (!question || !state.content) return
  $('aiInput').value = ''; appendAi(question, true); appendAi('正在思考...', false, 'pendingAi')
  const context = state.content.content.slice(0, 1800)
  try {
    const response = await fetch('/api/ai/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ message:`我正在学习《${state.content.title}》。课程内容如下：${context}\n\n我的问题：${question}`, displayMessage:question, history:state.aiHistory }) })
    const result = await response.json(); $('pendingAi')?.remove()
    const reply = result.data && result.data.reply || result.msg || '暂时无法回答'
    appendAi(reply, false); state.aiHistory.push({ role:'user',content:question }, { role:'assistant',content:reply }); state.aiHistory = state.aiHistory.slice(-8)
  } catch { $('pendingAi')?.remove(); appendAi('AI 暂时不可用，请稍后再试。', false) }
}
function appendAi(text, mine, elementId='') {
  const div = document.createElement('div'); div.className = `ai-msg${mine ? ' me' : ''}`; if (elementId) div.id=elementId; div.textContent=text
  $('aiChat').appendChild(div); $('aiChat').scrollTop = $('aiChat').scrollHeight
}

let readingTimer = null
window.addEventListener('scroll', () => {
  if (!state.token || !state.content || state.content.type === 'video') return
  clearTimeout(readingTimer)
  readingTimer = setTimeout(() => {
    const max = document.documentElement.scrollHeight - innerHeight
    const percent = max > 0 ? Math.round(scrollY / max * 100) : 100
    const duration = state.content.durationSeconds || 300
    saveProgress(Math.round(duration * Math.min(100,percent) / 100), duration, percent >= 90)
  }, 700)
})

async function initialize() {
  await exchangeLoginBridge()
  accountLabel()
  initWechatLogin()
  if (!id) {
    $('detailLoading').textContent = '缺少内容编号'
    return
  }
  const [data] = await Promise.all([api(`/contents/${id}`), initAdminMode()])
  renderDetail(data)
  await loadComments()
}

initialize().catch(error => { $('detailLoading').textContent = error.message })
