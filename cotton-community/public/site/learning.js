(() => {
  const typeNames = { video: '视频课', article: '图文课', gallery: '图集课' }
  const difficultyNames = { intro: '入门', intermediate: '进阶', advanced: '高级' }
  const difficultyRewards = { intro: 20, intermediate: 30, advanced: 40 }
  const questionCategories = [
    ['planting', '播种与品种'],
    ['seedling', '苗期管理'],
    ['water', '水肥管理'],
    ['pest', '病虫害'],
    ['boll', '花铃期管理'],
    ['harvest', '采收与质量'],
    ['other', '其他问题']
  ]

  window.COTTON_LEARNING = {
    create(context) {
      const {
        main,
        escapeHtml,
        publicLink,
        setMeta,
        setActiveNav,
        pageHero,
        sectionHeading,
        renderNotFound
      } = context

      const state = {
        token: localStorage.getItem('knowledge_token') || '',
        user: readJson('knowledge_user'),
        adminToken: localStorage.getItem('admin_token') || '',
        isAdmin: false,
        replyingTo: null,
        quizAnswers: [],
        quizSubmitted: false,
        aiHistory: [],
        rewardShown: false
      }
      const runtime = window.CottonRuntime

      function readJson(key) {
        try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
      }

      function saveUserSession(data) {
        state.token = data.token
        state.user = data
        localStorage.setItem('knowledge_token', data.token)
        localStorage.setItem('knowledge_user', JSON.stringify(data))
      }

      function clearUserSession() {
        state.token = ''
        state.user = null
        localStorage.removeItem('knowledge_token')
        localStorage.removeItem('knowledge_user')
      }

      function safeNext(value, fallback = publicLink('/courses')) {
        const next = String(value || '')
        return next.startsWith('/public/') && !next.startsWith('//') ? next : fallback
      }

      function loginLink(next = `${location.pathname}${location.search}`, mode = 'login') {
        const params = new URLSearchParams({ next: safeNext(next) })
        if (mode === 'register') params.set('mode', 'register')
        return `${publicLink('/login')}?${params}`
      }

      function requireLogin() {
        if (state.token) return true
        location.href = loginLink()
        return false
      }

      async function request(url, options = {}, token = '') {
        const result = await runtime.requestJson(url, options, {
          token,
          onUnauthorized: token ? () => {
            if (token === state.token) {
              clearUserSession()
              if (location.pathname !== publicLink('/login')) location.replace(loginLink())
            } else if (token === state.adminToken) {
              state.adminToken = ''
              state.isAdmin = false
              localStorage.removeItem('admin_token')
              localStorage.removeItem('admin_name')
            }
          } : null
        })
        return result.data
      }

      const api = (path, options = {}) => request(`/api/knowledge${path}`, options, state.token)
      const adminApi = (path, options = {}) => request(`/api/knowledge/admin${path}`, options, state.adminToken)

      async function detectAdmin() {
        if (!state.adminToken) return false
        try {
          await adminApi('/stats')
          state.isAdmin = true
        } catch {
          state.isAdmin = false
        }
        return state.isAdmin
      }

      const formatDate = value => value
        ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : ''

      const safeMediaUrl = value => {
        const url = String(value || '').trim()
        return url.startsWith('/assets/') || url.startsWith('/uploads/') || /^https:\/\//i.test(url) ? url : ''
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
            if (url) html += `<figure class="course-article-figure"><img src="${escapeHtml(url)}" alt="${escapeHtml(figure[2])}" loading="lazy"><figcaption>${escapeHtml(figure[2])}</figcaption></figure>`
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
            html += `<aside class="course-callout">${escapeHtml(line.slice(2))}</aside>`
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

      function courseCard(item) {
        const cover = safeMediaUrl(item.coverUrl) || '/assets/cotton-field-sky.png'
        return `
          <article class="learning-course-card">
            <a class="learning-course-cover" href="${publicLink(`/courses/${item.id}`)}">
              <img src="${escapeHtml(cover)}" alt="${escapeHtml(item.title)}" loading="lazy">
              <span>${escapeHtml(typeNames[item.type] || '知识课')}</span>
              ${item.progressPercent ? `<i><b style="width:${Math.min(100, Number(item.progressPercent) || 0)}%"></b></i>` : ''}
            </a>
            <div class="learning-course-copy">
              <div class="learning-course-meta"><span>${escapeHtml(item.categoryName)}</span><span>${escapeHtml(difficultyNames[item.difficulty] || '入门')}</span></div>
              <h3><a href="${publicLink(`/courses/${item.id}`)}">${escapeHtml(item.title)}</a></h3>
              <p>${escapeHtml(item.subtitle || String(item.content || '').slice(0, 80))}</p>
              <div class="learning-course-foot"><span>${Number(item.viewCount || 0)} 次学习</span><span>${Number(item.commentCount || 0)} 条评论</span><strong>${item.completed ? '已完成' : `完成 +${difficultyRewards[item.difficulty] || 20}积分`}</strong></div>
              ${state.isAdmin ? `<div class="inline-admin-actions"><a href="/knowledge/admin.html?edit=${item.id}">编辑</a><button type="button" data-course-status="${item.id}" data-status="${escapeHtml(item.status)}">${item.status === 'published' ? '下架' : '上架'}</button></div>` : ''}
            </div>
          </article>`
      }

      async function renderCourses() {
        setMeta('图文课程', '公共服务平台图文、视频、图片、小测试、评论和 AI 助学课程')
        setActiveNav('courses')
        const params = new URLSearchParams(location.search)
        const requestedScope = params.get('view')
        let scope = ['history', 'favorites'].includes(requestedScope) ? requestedScope : 'all'
        let category = 'all'
        let query = ''
        let rows = []
        let categories = []

        main.innerHTML = `
          ${pageHero('PUBLIC COURSES', '图文课程', '无需登录即可浏览课程；登录后可收藏、评论、参加小测试并同步学习进度。', 'courses-hero')}
          <section class="section-block learning-catalog">
            <div class="shell">
              <div class="learning-toolbar">
                <div class="learning-scopes" id="courseScopes">
                  <button type="button" data-scope="all">全部课程</button>
                  <button type="button" data-scope="history">学习记录</button>
                  <button type="button" data-scope="favorites">我的收藏</button>
                </div>
                <label class="catalog-search"><span>搜索课程</span><input id="courseSearch" type="search" placeholder="输入课程名称或田间问题"></label>
              </div>
              <div class="learning-category-row" id="courseCategories"></div>
              <div class="learning-summary">
                <span id="courseResultCount">正在读取课程...</span>
                <div>
                  <a href="${publicLink('/forum')}">棉友问答</a>
                  ${state.token ? `<a href="${publicLink('/login')}">${escapeHtml(state.user?.real_name || '我的账号')}</a>` : `<a href="${loginLink(publicLink('/courses'))}">登录</a><a href="${loginLink(publicLink('/courses'), 'register')}">注册</a>`}
                  ${state.adminToken ? '<a href="/knowledge/admin.html">内容管理</a>' : ''}
                </div>
              </div>
              <div class="learning-course-grid" id="learningCourseGrid"><div class="loading-panel">正在加载课程...</div></div>
            </div>
          </section>
          <section class="course-forum-band">
            <div class="shell course-forum-inner">
              <div><span class="eyebrow">COTTON QUESTIONS</span><h2>带着田间问题继续交流</h2><p>公开查看已有问题；登录后可以提问、回答、点赞和采纳答案。</p></div>
              <a class="button light" href="${publicLink('/forum')}">进入棉友问答</a>
            </div>
          </section>`

        const grid = document.getElementById('learningCourseGrid')
        const count = document.getElementById('courseResultCount')

        const updateScopeButtons = () => {
          document.querySelectorAll('[data-scope]').forEach(button => button.classList.toggle('active', button.dataset.scope === scope))
        }

        const deriveCategories = courseRows => {
          const counts = new Map()
          courseRows.forEach(item => counts.set(item.categoryKey, {
            key: item.categoryKey,
            name: item.categoryName,
            total: Number(counts.get(item.categoryKey)?.total || 0) + 1
          }))
          return [{ key: 'all', name: '全部专区', total: courseRows.length }, ...counts.values()]
        }

        const renderCategoryButtons = () => {
          document.getElementById('courseCategories').innerHTML = categories.map(item =>
            `<button type="button" class="${category === item.key ? 'active' : ''}" data-course-category="${escapeHtml(item.key)}">${escapeHtml(item.name)} <span>${Number(item.total || 0)}</span></button>`
          ).join('')
        }

        const renderRows = () => {
          const filtered = rows.filter(item => {
            const matchesCategory = category === 'all' || item.categoryKey === category
            const haystack = `${item.title}${item.subtitle}${item.content}${(item.tags || []).join('')}`.toLowerCase()
            return matchesCategory && haystack.includes(query.toLowerCase())
          })
          grid.innerHTML = filtered.length
            ? filtered.map(courseCard).join('')
            : `<div class="learning-empty"><strong>没有找到匹配课程</strong><p>${scope === 'all' ? '可以更换专区或搜索关键词。' : '开始学习或收藏课程后，内容会显示在这里。'}</p></div>`
          count.textContent = `${scope === 'all' ? '公开课程' : scope === 'history' ? '学习记录' : '我的收藏'} · ${filtered.length} 项`
          document.querySelectorAll('[data-course-status]').forEach(button => button.addEventListener('click', async () => {
            const status = button.dataset.status === 'published' ? 'draft' : 'published'
            if (!confirm(status === 'draft' ? '确定下架这项课程？' : '确定上架这项课程？')) return
            try {
              await adminApi(`/contents/${button.dataset.courseStatus}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
              await loadRows()
            } catch (error) {
              alert(error.message)
            }
          }))
        }

        const loadRows = async () => {
          grid.innerHTML = '<div class="loading-panel">正在加载课程...</div>'
          try {
            if (scope === 'history' || scope === 'favorites') {
              if (!state.token) {
                location.href = loginLink(`${publicLink('/courses')}?view=${scope}`)
                return
              }
              rows = await api(scope === 'history' ? '/me/history' : '/me/favorites')
              categories = deriveCategories(rows)
            } else {
              const result = await api('/home')
              rows = result.contents || []
              categories = result.categories || deriveCategories(rows)
            }
            if (!categories.some(item => item.key === category)) category = 'all'
            renderCategoryButtons()
            renderRows()
          } catch (error) {
            grid.innerHTML = `<div class="learning-empty error"><strong>课程加载失败</strong><p>${escapeHtml(error.message)}</p></div>`
            count.textContent = '暂时无法读取课程'
          }
        }

        document.getElementById('courseScopes').addEventListener('click', event => {
          const button = event.target.closest('[data-scope]')
          if (!button || button.dataset.scope === scope) return
          if (button.dataset.scope !== 'all' && !state.token) {
            location.href = loginLink(`${publicLink('/courses')}?view=${button.dataset.scope}`)
            return
          }
          scope = button.dataset.scope
          category = 'all'
          updateScopeButtons()
          loadRows()
        })
        document.getElementById('courseCategories').addEventListener('click', event => {
          const button = event.target.closest('[data-course-category]')
          if (!button) return
          category = button.dataset.courseCategory
          renderCategoryButtons()
          renderRows()
        })
        document.getElementById('courseSearch').addEventListener('input', event => {
          query = event.target.value.trim()
          renderRows()
        })

        await detectAdmin()
        updateScopeButtons()
        await loadRows()
      }

      function renderCourseMedia(item) {
        const cover = safeMediaUrl(item.coverUrl)
        const video = safeMediaUrl(item.videoUrl)
        if (item.type === 'video' && video) {
          return `<video id="integratedCourseVideo" controls playsinline poster="${escapeHtml(cover)}" src="${escapeHtml(video)}"></video>`
        }
        if (cover) return `<img src="${escapeHtml(cover)}" alt="${escapeHtml(item.title)}">`
        return '<div class="course-media-placeholder">本节以文字内容为主</div>'
      }

      function quizMarkup(item) {
        const quiz = item.quiz || []
        if (!quiz.length) return '<div class="learning-empty"><strong>本课暂无小测试</strong><p>管理员补充题目后会在这里显示。</p></div>'
        const correctCount = state.quizSubmitted
          ? quiz.reduce((total, question, index) => total + (state.quizAnswers[index] === question.correctIndex ? 1 : 0), 0)
          : 0
        return `
          <div class="quiz-heading">
            <div><span class="eyebrow">COURSE QUIZ</span><h2>课后小测试</h2><p>完成后可以查看标准解析，错题还可以请 AI 结合本课内容再讲一遍。</p></div>
            <strong>${state.quizSubmitted ? `答对 ${correctCount} / ${quiz.length}` : `${quiz.length} 题`}</strong>
          </div>
          <div class="integrated-quiz-list">
            ${quiz.map((question, questionIndex) => {
              const selected = state.quizAnswers[questionIndex]
              return `<section class="integrated-quiz-question">
                <div class="quiz-question-title"><span>${String(questionIndex + 1).padStart(2, '0')}</span><h3>${escapeHtml(question.question)}</h3></div>
                <div class="integrated-quiz-options">
                  ${question.options.map((option, optionIndex) => {
                    const isCorrect = optionIndex === question.correctIndex
                    const isSelected = optionIndex === selected
                    const resultClass = state.quizSubmitted ? (isCorrect ? ' correct' : isSelected ? ' wrong' : '') : ''
                    return `<label class="${resultClass}"><input type="radio" name="quiz-${questionIndex}" value="${optionIndex}" ${isSelected ? 'checked' : ''} ${state.quizSubmitted ? 'disabled' : ''}><b>${String.fromCharCode(65 + optionIndex)}</b><span>${escapeHtml(option)}</span></label>`
                  }).join('')}
                </div>
                ${state.quizSubmitted ? `<div class="quiz-result ${selected === question.correctIndex ? 'passed' : 'review'}"><strong>${selected === question.correctIndex ? '回答正确' : `正确答案：${String.fromCharCode(65 + question.correctIndex)}`}</strong><p>${escapeHtml(question.explanation)}</p>${selected === question.correctIndex ? '' : `<button type="button" data-explain-quiz="${questionIndex}">让 AI 再讲一遍</button><div class="quiz-ai-answer hidden" id="quizAiAnswer${questionIndex}"></div>`}</div>` : ''}
              </section>`
            }).join('')}
          </div>
          ${state.quizSubmitted ? '<button class="button outline" id="retryQuiz" type="button">重新作答</button>' : '<button class="button primary" id="submitQuiz" type="button">提交答案</button>'}`
      }

      function commentMarkup(item, viewer, nested = false) {
        const own = viewer && Number(viewer.id) === Number(item.user_id)
        return `
          <article class="integrated-comment ${nested ? 'reply' : ''} ${item.status === 'hidden' ? 'hidden-comment' : ''}">
            <span class="comment-avatar">${item.avatar_url ? `<img src="${escapeHtml(item.avatar_url)}" alt="">` : escapeHtml((item.nickname || '棉').slice(0, 1))}</span>
            <div>
              <div class="comment-head"><strong>${escapeHtml(item.nickname)}</strong><time>${escapeHtml(formatDate(item.created_at))}</time></div>
              ${item.parent_id ? `<div class="comment-target">${item.parent_nickname ? `回复 @${escapeHtml(item.parent_nickname)}` : '回复的原评论已不可见'}</div>` : ''}
              <p>${escapeHtml(item.body)}</p>
              <div class="comment-controls">
                ${state.token ? `<button type="button" data-reply-comment="${item.id}">回复</button>` : ''}
                ${own ? `<button class="danger" type="button" data-delete-comment="${item.id}">删除</button>` : ''}
                ${state.isAdmin ? `<button type="button" data-comment-status="${item.id}" data-status="${item.status}">${item.status === 'visible' ? '隐藏' : '恢复'}</button><button class="danger" type="button" data-admin-delete-comment="${item.id}">永久删除</button>` : ''}
              </div>
            </div>
          </article>`
      }

      async function renderCourseDetail(rawId) {
        const id = Number(rawId)
        if (!id) return renderNotFound()
        setActiveNav('courses')
        main.innerHTML = '<section class="not-found"><div class="shell"><div class="page-loading">正在读取课程...</div></div></section>'

        try {
          await detectAdmin()
          const result = await api(`/contents/${id}`)
          const item = result.content
          let comments = []
          let viewer = result.viewer
          let lastSavedSecond = -1
          state.quizAnswers = []
          state.quizSubmitted = false
          state.aiHistory = []
          state.rewardShown = false
          state.replyingTo = null
          setMeta(item.title, item.subtitle || item.content.slice(0, 100))

          main.innerHTML = `
            ${state.isAdmin ? `<div class="public-admin-bar"><div class="shell"><span>管理员预览</span><a href="/knowledge/admin.html?edit=${item.id}">编辑课程</a><a href="/knowledge/admin.html?view=comments&content=${item.id}">管理本课评论</a><button id="toggleCourseStatus" type="button">下架课程</button></div></div>` : ''}
            <article class="integrated-course-page">
              <header class="reading-header course-reading-header">
                <div class="shell reading-header-inner">
                  <nav class="breadcrumbs" aria-label="面包屑"><a href="${publicLink('/')}">公共服务首页</a><span>/</span><a href="${publicLink('/courses')}">图文课程</a><span>/</span><span>${escapeHtml(item.categoryName)}</span></nav>
                  <span class="eyebrow">${escapeHtml(item.categoryName)} · ${escapeHtml(typeNames[item.type] || '知识课')}</span>
                  <h1>${escapeHtml(item.title)}</h1>
                  <p>${escapeHtml(item.subtitle)}</p>
                  <div class="reading-meta"><span>${escapeHtml(difficultyNames[item.difficulty] || '入门')}</span><span>${Number(item.viewCount || 0)} 次学习</span><span>来源：${escapeHtml(item.sourceName)}</span></div>
                </div>
              </header>
              <div class="integrated-course-media">${renderCourseMedia(item)}</div>
              <div class="shell integrated-course-layout">
                <div class="rich-article integrated-course-body">
                  ${renderBody(item.content)}
                  ${item.images?.length && !String(item.content || '').includes('[[image:') ? `<div class="course-gallery">${item.images.map(url => `<img src="${escapeHtml(safeMediaUrl(url))}" alt="课程配图" loading="lazy">`).join('')}</div>` : ''}
                  <aside class="safety-note"><strong>学习内容边界</strong><p>课程用于帮助理解判断方法。涉及具体品种、水肥量、农药和灾害处置时，请结合产品标签、属地规程和现场专业意见。</p></aside>
                </div>
                <aside class="course-detail-aside">
                  <span class="eyebrow">COURSE INFO</span>
                  <h2>课程信息</h2>
                  <dl>
                    <div><dt>课程类型</dt><dd>${escapeHtml(typeNames[item.type] || '知识课')}</dd></div>
                    <div><dt>学习难度</dt><dd>${escapeHtml(difficultyNames[item.difficulty] || '入门')}</dd></div>
                    <div><dt>评论</dt><dd>${Number(item.commentCount || 0)} 条</dd></div>
                    <div><dt>来源</dt><dd>${escapeHtml(item.sourceName)}</dd></div>
                  </dl>
                  <div class="course-points-note"><strong>${item.completed ? '本课已完成' : `农户完成可得 ${difficultyRewards[item.difficulty] || 20} 积分`}</strong><span>农户账号首次完成发放，每日课程奖励最多100积分</span></div>
                  <button class="button outline full" id="favoriteCourse" type="button">${item.isFavorite ? '已收藏' : '收藏课程'}</button>
                  ${state.token ? `<a class="course-account-link" href="${publicLink('/courses?view=history')}">查看学习记录</a>` : `<a class="course-account-link" href="${loginLink(location.pathname)}">登录后保存进度</a>`}
                  <div class="course-related">
                    <h3>相关课程</h3>
                    ${(result.related || []).map(related => `<a href="${publicLink(`/courses/${related.id}`)}"><span>${escapeHtml(related.categoryName)}</span><strong>${escapeHtml(related.title)}</strong></a>`).join('') || '<p>暂无同类课程</p>'}
                  </div>
                </aside>
              </div>
            </article>
            <section class="course-quiz-section"><div class="shell" id="courseQuizHost">${quizMarkup(item)}</div></section>
            <section class="course-community-section">
              <div class="shell course-community-grid">
                <div class="course-ai-panel">
                  <span class="eyebrow">AI STUDY SUPPORT</span>
                  <h2>结合本课内容提问</h2>
                  <p>AI 会结合当前课程整理答案；田间异常和用药问题仍需线下核验。</p>
                  <div class="course-ai-chat" id="courseAiChat"><div class="ai-message">可以问我本课概念、检查顺序或小测试中的疑问。</div></div>
                  <div class="course-ai-compose"><input id="courseAiInput" maxlength="500" placeholder="输入与本课相关的问题"><button type="button" id="courseAiSend">发送</button></div>
                </div>
                <div class="course-comments-panel">
                  <div class="comments-title"><div><span class="eyebrow">COURSE COMMENTS</span><h2>课程评论</h2></div><strong id="courseCommentCount">0 条</strong></div>
                  <div class="reply-context hidden" id="courseReplyContext">正在回复 <strong id="courseReplyName"></strong><button type="button" id="cancelCourseReply">取消</button></div>
                  ${state.token ? `<div class="course-comment-compose"><textarea id="courseCommentInput" maxlength="800" placeholder="写下你的理解或问题"></textarea><button class="button primary" id="publishCourseComment" type="button">发表评论</button></div>` : `<div class="login-required-note"><p>登录后可以评论和回复其他学习者。</p><a class="button primary" href="${loginLink(location.pathname)}">登录</a><a class="button outline" href="${loginLink(location.pathname, 'register')}">注册</a></div>`}
                  <div id="courseCommentList"><div class="loading-panel">正在加载评论...</div></div>
                </div>
              </div>
            </section>`

          const saveProgress = async (progress, duration, completed) => {
            if (!state.token) return
            try {
              const result = await api(`/contents/${id}/progress`, {
                method: 'PUT',
                body: JSON.stringify({ progress_seconds: progress, duration_seconds: duration, completed })
              })
              if (result.reward && result.reward.awarded && !state.rewardShown) {
                state.rewardShown = true
                const notice = document.createElement('div')
                notice.className = 'learning-reward-notice'
                notice.innerHTML = `<strong>课程完成，+${Number(result.reward.points)}积分</strong><span>当前可用积分 ${Number(result.reward.balance)}，可在小程序购买农资时抵扣</span>`
                document.body.appendChild(notice)
                setTimeout(() => notice.classList.add('show'), 20)
                setTimeout(() => {
                  notice.classList.remove('show')
                  setTimeout(() => notice.remove(), 240)
                }, 4200)
              }
            } catch {}
          }

          const video = document.getElementById('integratedCourseVideo')
          if (video) {
            video.addEventListener('loadedmetadata', () => {
              if (item.progressSeconds > 0 && item.progressSeconds < video.duration - 5) video.currentTime = item.progressSeconds
            })
            video.addEventListener('timeupdate', () => {
              const second = Math.floor(video.currentTime)
              if (state.token && second > 0 && second !== lastSavedSecond && second % 10 === 0) {
                lastSavedSecond = second
                saveProgress(second, Math.floor(video.duration), false)
              }
            })
            video.addEventListener('ended', () => saveProgress(Math.floor(video.duration), Math.floor(video.duration), true))
          } else if (state.token) {
            let timer = null
            const progressHandler = () => {
              clearTimeout(timer)
              timer = setTimeout(() => {
                const article = document.querySelector('.integrated-course-page')
                if (!article) return
                const start = article.offsetTop
                const max = Math.max(1, article.offsetHeight - innerHeight)
                const percent = Math.max(0, Math.min(100, Math.round((scrollY - start) / max * 100)))
                const duration = Number(item.durationSeconds || 300)
                saveProgress(Math.round(duration * percent / 100), duration, percent >= 90)
              }, 700)
            }
            window.addEventListener('scroll', progressHandler, { passive: true })
          }

          const renderQuiz = () => {
            document.getElementById('courseQuizHost').innerHTML = quizMarkup(item)
            document.getElementById('submitQuiz')?.addEventListener('click', () => {
              const answers = (item.quiz || []).map((_question, index) => {
                const selected = document.querySelector(`input[name="quiz-${index}"]:checked`)
                return selected ? Number(selected.value) : null
              })
              if (answers.some(answer => answer === null)) {
                alert('请完成全部题目后再提交')
                return
              }
              state.quizAnswers = answers
              state.quizSubmitted = true
              renderQuiz()
              saveProgress(item.durationSeconds || 300, item.durationSeconds || 300, true)
              document.getElementById('courseQuizHost').scrollIntoView({ behavior: 'smooth', block: 'start' })
            })
            document.getElementById('retryQuiz')?.addEventListener('click', () => {
              state.quizAnswers = []
              state.quizSubmitted = false
              renderQuiz()
            })
            document.querySelectorAll('[data-explain-quiz]').forEach(button => button.addEventListener('click', async () => {
              const index = Number(button.dataset.explainQuiz)
              const question = item.quiz[index]
              const host = document.getElementById(`quizAiAnswer${index}`)
              host.classList.remove('hidden')
              host.textContent = 'AI 正在结合标准解析整理讲解...'
              button.disabled = true
              const selectedText = question.options[state.quizAnswers[index]] || '未作答'
              const correctText = question.options[question.correctIndex]
              try {
                const data = await request('/api/community-ai/chat', {
                  method: 'POST',
                  body: JSON.stringify({
                    message: `我在《${item.title}》的小测试中答错了。题目：${question.question}；我的答案：${selectedText}；正确答案：${correctText}；标准解析：${question.explanation}。请仅依据标准解析，用通俗中文说明错误原因和记忆方法。`,
                    history: []
                  })
                })
                host.textContent = data.reply || '暂时无法生成讲解'
              } catch (error) {
                host.textContent = error.message
                button.disabled = false
              }
            }))
          }
          renderQuiz()

          const loadComments = async () => {
            try {
              comments = state.isAdmin
                ? await adminApi(`/comments?content_id=${id}`)
                : await api(`/contents/${id}/comments`)
              document.getElementById('courseCommentCount').textContent = `${comments.length} 条${state.isAdmin ? ' · 管理员视图' : ''}`
              const byId = new Map(comments.map(comment => [Number(comment.id), comment]))
              const children = new Map()
              comments.forEach(comment => {
                const parentId = Number(comment.parent_id)
                if (!parentId || !byId.has(parentId)) return
                if (!children.has(parentId)) children.set(parentId, [])
                children.get(parentId).push(comment)
              })
              const roots = comments.filter(comment => !comment.parent_id || !byId.has(Number(comment.parent_id))).sort((a, b) => Number(b.id) - Number(a.id))
              const repliesFor = rootId => {
                const replies = []
                const visited = new Set([Number(rootId)])
                const walk = parentId => {
                  ;(children.get(Number(parentId)) || []).sort((a, b) => Number(a.id) - Number(b.id)).forEach(reply => {
                    const replyId = Number(reply.id)
                    if (visited.has(replyId)) return
                    visited.add(replyId)
                    replies.push(reply)
                    walk(replyId)
                  })
                }
                walk(rootId)
                return replies
              }
              document.getElementById('courseCommentList').innerHTML = roots.length
                ? roots.map(comment => `<section class="integrated-comment-thread">${commentMarkup(comment, viewer)}${repliesFor(comment.id).map(reply => commentMarkup(reply, viewer, true)).join('')}</section>`).join('')
                : '<div class="learning-empty"><strong>还没有评论</strong><p>欢迎留下第一条学习心得。</p></div>'
              document.querySelectorAll('[data-reply-comment]').forEach(button => button.addEventListener('click', () => {
                if (!requireLogin()) return
                state.replyingTo = comments.find(comment => String(comment.id) === button.dataset.replyComment) || null
                if (!state.replyingTo) return
                document.getElementById('courseReplyName').textContent = state.replyingTo.nickname
                document.getElementById('courseReplyContext').classList.remove('hidden')
                document.getElementById('courseCommentInput').placeholder = `回复 ${state.replyingTo.nickname}`
                document.getElementById('courseCommentInput').focus()
              }))
              document.querySelectorAll('[data-delete-comment]').forEach(button => button.addEventListener('click', async () => {
                if (!confirm('删除这条评论？')) return
                try {
                  await api(`/comments/${button.dataset.deleteComment}`, { method: 'DELETE' })
                  await loadComments()
                } catch (error) { alert(error.message) }
              }))
              document.querySelectorAll('[data-comment-status]').forEach(button => button.addEventListener('click', async () => {
                const status = button.dataset.status === 'visible' ? 'hidden' : 'visible'
                try {
                  await adminApi(`/comments/${button.dataset.commentStatus}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
                  await loadComments()
                } catch (error) { alert(error.message) }
              }))
              document.querySelectorAll('[data-admin-delete-comment]').forEach(button => button.addEventListener('click', async () => {
                if (!confirm('永久删除这条评论？此操作无法撤销。')) return
                try {
                  await adminApi(`/comments/${button.dataset.adminDeleteComment}`, { method: 'DELETE' })
                  await loadComments()
                } catch (error) { alert(error.message) }
              }))
            } catch (error) {
              document.getElementById('courseCommentList').innerHTML = `<div class="learning-empty error"><strong>评论加载失败</strong><p>${escapeHtml(error.message)}</p></div>`
            }
          }

          const cancelReply = () => {
            state.replyingTo = null
            document.getElementById('courseReplyContext')?.classList.add('hidden')
            if (document.getElementById('courseCommentInput')) document.getElementById('courseCommentInput').placeholder = '写下你的理解或问题'
          }
          document.getElementById('cancelCourseReply')?.addEventListener('click', cancelReply)
          document.getElementById('publishCourseComment')?.addEventListener('click', async () => {
            if (!requireLogin()) return
            const input = document.getElementById('courseCommentInput')
            const body = input.value.trim()
            if (body.length < 2) {
              alert('评论至少需要2个字')
              return
            }
            try {
              await api(`/contents/${id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ body, parent_id: state.replyingTo?.id || null })
              })
              input.value = ''
              cancelReply()
              await loadComments()
            } catch (error) { alert(error.message) }
          })

          document.getElementById('favoriteCourse').addEventListener('click', async () => {
            if (!requireLogin()) return
            try {
              const data = await api(`/contents/${id}/favorite`, { method: item.isFavorite ? 'DELETE' : 'POST' })
              item.isFavorite = data.isFavorite
              document.getElementById('favoriteCourse').textContent = item.isFavorite ? '已收藏' : '收藏课程'
            } catch (error) { alert(error.message) }
          })

          const appendAi = (text, mine = false, id = '') => {
            const message = document.createElement('div')
            message.className = `ai-message${mine ? ' mine' : ''}`
            if (id) message.id = id
            message.textContent = text
            document.getElementById('courseAiChat').appendChild(message)
            document.getElementById('courseAiChat').scrollTop = document.getElementById('courseAiChat').scrollHeight
          }
          const askAi = async () => {
            const input = document.getElementById('courseAiInput')
            const question = input.value.trim()
            if (!question) return
            input.value = ''
            appendAi(question, true)
            appendAi('正在思考...', false, 'pendingCourseAi')
            try {
              const data = await request('/api/community-ai/chat', {
                method: 'POST',
                body: JSON.stringify({
                  message: `我正在学习《${item.title}》。课程内容如下：${String(item.content || '').slice(0, 1800)}\n\n我的问题：${question}`,
                  history: state.aiHistory
                })
              })
              document.getElementById('pendingCourseAi')?.remove()
              const reply = data.reply || '暂时无法回答'
              appendAi(reply)
              state.aiHistory.push({ role: 'user', content: question }, { role: 'assistant', content: reply })
              state.aiHistory = state.aiHistory.slice(-8)
            } catch (error) {
              document.getElementById('pendingCourseAi')?.remove()
              appendAi(error.message || 'AI 暂时不可用，请稍后再试。')
            }
          }
          document.getElementById('courseAiSend').addEventListener('click', askAi)
          document.getElementById('courseAiInput').addEventListener('keydown', event => {
            if (event.key === 'Enter') askAi()
          })

          document.getElementById('toggleCourseStatus')?.addEventListener('click', async () => {
            if (!confirm('下架后普通用户将无法继续打开本课程，确定下架？')) return
            try {
              await adminApi(`/contents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'draft' }) })
              location.href = publicLink('/courses')
            } catch (error) { alert(error.message) }
          })

          await loadComments()
        } catch (error) {
          main.innerHTML = `<section class="not-found"><div class="shell"><span class="eyebrow">COURSE</span><h1>课程暂时无法打开</h1><p>${escapeHtml(error.message)}</p><a class="button primary" href="${publicLink('/courses')}">返回图文课程</a></div></section>`
        }
      }

      function questionCard(item) {
        return `
          <article class="forum-question-card">
            <a href="${publicLink(`/forum/${item.id}`)}">
              <div class="forum-answer-count"><strong>${Number(item.answerCount || 0)}</strong><span>个回答</span></div>
              <div>
                <div class="forum-question-labels">${item.status === 'solved' ? '<span class="solved">已解决</span>' : ''}<span>${escapeHtml(item.categoryName)}</span>${(item.tags || []).slice(0, 3).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(String(item.body || '').slice(0, 150))}${String(item.body || '').length > 150 ? '...' : ''}</p>
                <div class="forum-question-meta"><span>${escapeHtml(item.nickname)}</span><time>${escapeHtml(formatDate(item.updatedAt))}</time><span>${Number(item.viewCount || 0)} 次浏览</span></div>
              </div>
            </a>
          </article>`
      }

      async function renderForum() {
        setMeta('棉友问答', '公开棉花种植问题与经验交流')
        setActiveNav('forum')
        let questions = []
        let category = 'all'
        let query = ''
        main.innerHTML = `
          ${pageHero('COTTON COMMUNITY', '棉友问答', '公开查看真实种植问题和已有回答；登录后可以提问、回答、点赞和采纳答案。', 'forum-hero')}
          <section class="section-block">
            <div class="shell forum-page-layout">
              <div>
                <div class="forum-toolbar">
                  <div class="learning-category-row" id="forumCategories"></div>
                  <label class="catalog-search"><span>搜索问题</span><input id="forumSearch" type="search" placeholder="输入症状、阶段或管理问题"></label>
                </div>
                <div class="forum-question-list" id="forumQuestionList"><div class="loading-panel">正在加载问题...</div></div>
              </div>
              <aside class="forum-ask-panel">
                <span class="eyebrow">ASK A QUESTION</span>
                <h2>发起提问</h2>
                ${state.token ? `
                  <form id="forumQuestionForm">
                    <label><span>问题专区</span><select name="category">${questionCategories.map(([key, name]) => `<option value="${key}|${name}">${name}</option>`).join('')}</select></label>
                    <label><span>问题标题</span><input name="title" minlength="5" maxlength="160" required placeholder="用一句话说明核心问题"></label>
                    <label><span>详细描述</span><textarea name="body" minlength="10" maxlength="5000" required placeholder="说明地区、生育期、田间分布、近期管理和已观察到的现象"></textarea></label>
                    <label><span>关键词</span><input name="tags" maxlength="120" placeholder="例如：苗期、叶片、滴灌"></label>
                    <button class="button primary full" type="submit">发布问题</button>
                    <p id="forumQuestionMessage" role="status"></p>
                  </form>` : `
                  <p>登录后可以发布问题，并在自己的问题下采纳最有帮助的回答。</p>
                  <a class="button primary full" href="${loginLink(publicLink('/forum'))}">登录</a>
                  <a class="button outline full" href="${loginLink(publicLink('/forum'), 'register')}">注册</a>`}
                ${state.adminToken ? '<a class="forum-admin-link" href="/knowledge/admin.html?view=forum">进入问答管理</a>' : ''}
                <div class="forum-guidance"><strong>提问建议</strong><p>写清地区、生育期、分布范围和近期水肥或用药记录，不根据单张照片直接下结论。</p></div>
              </aside>
            </div>
          </section>`

        const list = document.getElementById('forumQuestionList')
        const renderRows = () => {
          const filtered = questions.filter(item => {
            const matchesCategory = category === 'all' || item.categoryKey === category
            const haystack = `${item.title}${item.body}${(item.tags || []).join('')}`.toLowerCase()
            return matchesCategory && haystack.includes(query.toLowerCase())
          })
          list.innerHTML = filtered.length
            ? filtered.map(questionCard).join('')
            : '<div class="learning-empty"><strong>还没有匹配的问题</strong><p>可以更换专区或发起第一个提问。</p></div>'
        }
        const renderCategories = () => {
          const counts = new Map()
          questions.forEach(item => counts.set(item.categoryKey, { name: item.categoryName, total: Number(counts.get(item.categoryKey)?.total || 0) + 1 }))
          const rows = [['all', '全部问题', questions.length], ...[...counts.entries()].map(([key, value]) => [key, value.name, value.total])]
          document.getElementById('forumCategories').innerHTML = rows.map(([key, name, total]) =>
            `<button type="button" class="${category === key ? 'active' : ''}" data-forum-category="${escapeHtml(key)}">${escapeHtml(name)} <span>${total}</span></button>`
          ).join('')
        }
        try {
          const result = await api('/forum')
          questions = result.questions || []
          renderCategories()
          renderRows()
        } catch (error) {
          list.innerHTML = `<div class="learning-empty error"><strong>问答加载失败</strong><p>${escapeHtml(error.message)}</p></div>`
        }
        document.getElementById('forumCategories').addEventListener('click', event => {
          const button = event.target.closest('[data-forum-category]')
          if (!button) return
          category = button.dataset.forumCategory
          renderCategories()
          renderRows()
        })
        document.getElementById('forumSearch').addEventListener('input', event => {
          query = event.target.value.trim()
          renderRows()
        })
        document.getElementById('forumQuestionForm')?.addEventListener('submit', async event => {
          event.preventDefault()
          const form = event.currentTarget
          const values = Object.fromEntries(new FormData(form).entries())
          const [categoryKey, categoryName] = String(values.category || '').split('|')
          const message = document.getElementById('forumQuestionMessage')
          message.textContent = '正在发布...'
          try {
            const data = await api('/forum', {
              method: 'POST',
              body: JSON.stringify({
                title: values.title,
                body: values.body,
                tags: values.tags,
                category_key: categoryKey,
                category_name: categoryName
              })
            })
            location.href = publicLink(`/forum/${data.id}`)
          } catch (error) {
            message.textContent = error.message
          }
        })
      }

      async function renderForumDetail(rawId) {
        const id = Number(rawId)
        if (!id) return renderNotFound()
        setActiveNav('forum')
        main.innerHTML = '<section class="not-found"><div class="shell"><div class="page-loading">正在读取问题...</div></div></section>'
        try {
          await detectAdmin()
          let result = await api(`/forum/${id}`)
          const draw = () => {
            const question = result.question
            const answers = result.answers || []
            setMeta(question.title, question.body.slice(0, 100))
            main.innerHTML = `
              ${state.isAdmin ? `<div class="public-admin-bar"><div class="shell"><span>管理员预览</span><a href="/knowledge/admin.html?view=forum">问答管理</a><button id="hideForumQuestion" type="button">隐藏问题</button></div></div>` : ''}
              <section class="forum-detail-header">
                <div class="shell">
                  <nav class="breadcrumbs" aria-label="面包屑"><a href="${publicLink('/')}">公共服务首页</a><span>/</span><a href="${publicLink('/forum')}">棉友问答</a><span>/</span><span>${escapeHtml(question.categoryName)}</span></nav>
                  <div class="forum-question-labels">${question.status === 'solved' ? '<span class="solved">已解决</span>' : '<span>等待回答</span>'}<span>${escapeHtml(question.categoryName)}</span>${question.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
                  <h1>${escapeHtml(question.title)}</h1>
                  <div class="forum-question-meta"><span>${escapeHtml(question.nickname)} 提问</span><time>${escapeHtml(formatDate(question.createdAt))}</time><span>${Number(question.viewCount || 0)} 次浏览</span></div>
                </div>
              </section>
              <section class="section-block">
                <div class="shell forum-detail-layout">
                  <div>
                    <article class="forum-question-body"><p>${escapeHtml(question.body)}</p>${question.images?.length ? `<div class="course-gallery">${question.images.map(url => `<img src="${escapeHtml(safeMediaUrl(url))}" alt="问题配图">`).join('')}</div>` : ''}</article>
                    <div class="forum-answers-heading"><div><span class="eyebrow">COMMUNITY ANSWERS</span><h2>${answers.length} 个回答</h2></div><span>${question.status === 'solved' ? '提问者已采纳答案' : '等待更多经验分享'}</span></div>
                    <div class="forum-answer-list">
                      ${answers.length ? answers.map(answer => `
                        <article class="forum-answer ${answer.isAccepted ? 'accepted' : ''}">
                          <button class="${answer.isVoted ? 'active' : ''}" type="button" data-vote-answer="${answer.id}" title="这个回答有帮助"><span>有帮助</span><strong>${Number(answer.voteCount || 0)}</strong></button>
                          <div>
                            ${answer.isAccepted ? '<span class="accepted-label">已采纳回答</span>' : ''}
                            <p>${escapeHtml(answer.body)}</p>
                            <div class="forum-answer-meta"><span>${escapeHtml(answer.nickname)}</span><time>${escapeHtml(formatDate(answer.createdAt))}</time>${result.viewer && Number(result.viewer.id) === Number(question.userId) && !question.acceptedAnswerId ? `<button type="button" data-accept-answer="${answer.id}">采纳这个回答</button>` : ''}${state.isAdmin ? `<button class="danger" type="button" data-hide-answer="${answer.id}">隐藏回答</button>` : ''}</div>
                          </div>
                        </article>`).join('') : '<div class="learning-empty"><strong>还没有回答</strong><p>欢迎分享第一个有依据的建议。</p></div>'}
                    </div>
                  </div>
                  <aside class="forum-answer-form">
                    <span class="eyebrow">YOUR ANSWER</span>
                    <h2>写下你的回答</h2>
                    <p>尽量说明判断依据和操作步骤，不发布未经核实的药剂剂量。</p>
                    ${state.token ? `<form id="forumAnswerForm"><textarea name="body" minlength="5" maxlength="5000" required placeholder="分享你的经验和建议"></textarea><button class="button primary full" type="submit">发布回答</button><p id="forumAnswerMessage" role="status"></p></form>` : `<a class="button primary full" href="${loginLink(location.pathname)}">登录后回答</a><a class="button outline full" href="${loginLink(location.pathname, 'register')}">注册账号</a>`}
                    <a class="forum-back-link" href="${publicLink('/forum')}">返回全部问题</a>
                  </aside>
                </div>
              </section>`

            document.querySelectorAll('[data-vote-answer]').forEach(button => button.addEventListener('click', async () => {
              if (!requireLogin()) return
              try {
                await api(`/forum/answers/${button.dataset.voteAnswer}/vote`, { method: 'POST' })
                result = await api(`/forum/${id}`)
                draw()
              } catch (error) { alert(error.message) }
            }))
            document.querySelectorAll('[data-accept-answer]').forEach(button => button.addEventListener('click', async () => {
              if (!confirm('确定采纳这个回答？')) return
              try {
                await api(`/forum/${id}/accept/${button.dataset.acceptAnswer}`, { method: 'PATCH' })
                result = await api(`/forum/${id}`)
                draw()
              } catch (error) { alert(error.message) }
            }))
            document.querySelectorAll('[data-hide-answer]').forEach(button => button.addEventListener('click', async () => {
              if (!confirm('隐藏这条回答？')) return
              try {
                await adminApi(`/forum/answers/${button.dataset.hideAnswer}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'hidden' }) })
                result = await api(`/forum/${id}`)
                draw()
              } catch (error) { alert(error.message) }
            }))
            document.getElementById('hideForumQuestion')?.addEventListener('click', async () => {
              if (!confirm('隐藏这个问题及其公开入口？')) return
              try {
                await adminApi(`/forum/questions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'hidden' }) })
                location.href = publicLink('/forum')
              } catch (error) { alert(error.message) }
            })
            document.getElementById('forumAnswerForm')?.addEventListener('submit', async event => {
              event.preventDefault()
              const form = event.currentTarget
              const message = document.getElementById('forumAnswerMessage')
              const body = new FormData(form).get('body')
              message.textContent = '正在发布...'
              try {
                await api(`/forum/${id}/answers`, { method: 'POST', body: JSON.stringify({ body }) })
                result = await api(`/forum/${id}`)
                draw()
              } catch (error) {
                message.textContent = error.message
              }
            })
          }
          draw()
        } catch (error) {
          main.innerHTML = `<section class="not-found"><div class="shell"><span class="eyebrow">QUESTION</span><h1>问题暂时无法打开</h1><p>${escapeHtml(error.message)}</p><a class="button primary" href="${publicLink('/forum')}">返回棉友问答</a></div></section>`
        }
      }

      function renderLogin() {
        setMeta('账号登录', '公共服务平台账号登录和注册')
        setActiveNav('login')
        const params = new URLSearchParams(location.search)
        const next = safeNext(params.get('next'))
        const ticket = String(params.get('ticket') || '').trim()
        let mode = params.get('mode') === 'register' ? 'register' : 'login'

        if (ticket && !state.token) {
          main.innerHTML = `
            <section class="public-sso-loading">
              <div><span class="eyebrow">ACCOUNT SYNC</span><h1>正在同步小程序账号</h1><p>验证完成后会自动进入公益学习空间。</p></div>
            </section>`
          request('/api/community-auth/ticket-login', {
            method: 'POST',
            body: JSON.stringify({ ticket })
          }).then(data => {
            saveUserSession(data)
            location.replace(next)
          }).catch(error => {
            const cleanUrl = `${publicLink('/login')}?next=${encodeURIComponent(next)}`
            history.replaceState({}, '', cleanUrl)
            renderLogin()
            const message = document.getElementById('publicLoginMessage')
            if (message) message.textContent = error.message
          })
          return
        }

        if (state.token && state.user) {
          main.innerHTML = `
            ${pageHero('PUBLIC ACCOUNT', '我的公益账号', '账号用于保存课程进度、收藏、评论、提问和专家咨询记录。', 'login-hero')}
            <section class="section-block">
              <div class="shell public-account-panel">
                <span class="account-avatar">${escapeHtml((state.user.real_name || '棉').slice(0, 1))}</span>
                <div><span class="eyebrow">SIGNED IN</span><h2>${escapeHtml(state.user.real_name || '已登录用户')}</h2><p>当前账号已登录，可以继续学习或查看自己的记录。</p><div class="account-points-summary" id="accountPointsSummary">正在读取学习积分...</div></div>
                <div class="account-actions"><a class="button primary" href="${publicLink('/courses?view=history')}">学习记录</a><a class="button outline" href="${publicLink('/courses?view=favorites')}">我的收藏</a><button class="button outline" id="logoutPublicAccount" type="button">退出登录</button></div>
              </div>
            </section>`
          document.getElementById('logoutPublicAccount').addEventListener('click', () => {
            if (!confirm('退出当前公益账号？')) return
            clearUserSession()
            location.reload()
          })
          api('/me/points').then(data => {
            if (data.eligible === false) {
              document.getElementById('accountPointsSummary').innerHTML = '<strong>学习记录已启用</strong><span>积分仅面向已注册农户身份的账号</span>'
              return
            }
            const account = data.account || {}
            document.getElementById('accountPointsSummary').innerHTML = `<strong>${Number(account.balance || 0)} 积分</strong><span>累计获得 ${Number(account.totalEarned || 0)} · 已使用 ${Number(account.totalUsed || 0)}</span>`
          }).catch(() => {
            document.getElementById('accountPointsSummary').textContent = '积分信息暂时无法读取'
          })
          return
        }

        main.innerHTML = `
          ${pageHero('PUBLIC ACCOUNT', '公共服务平台账号', '登录与图文课程分开。账号只用于保存学习记录、参与评论问答和提交专家咨询。', 'login-hero')}
          <section class="section-block">
            <div class="shell public-auth-layout">
              <div class="public-auth-context">
                <span class="eyebrow">ONE ACCOUNT</span>
                <h2>沿用棉花平台账号</h2>
                <p>已有农户或平台账号可以直接登录。没有账号时，可在这里注册农户学习账号。</p>
                <div><strong>无需登录</strong><span>浏览农技培训、图文课程、政策和病虫害知识</span></div>
                <div><strong>登录后</strong><span>保存进度、收藏课程、发表评论、参与问答和专家咨询</span></div>
              </div>
              <div class="public-auth-card">
                <div class="public-auth-tabs"><button type="button" data-auth-mode="login">登录</button><button type="button" data-auth-mode="register">注册</button></div>
                <form id="publicLoginForm">
                  <label><span>手机号</span><input name="phone" inputmode="numeric" maxlength="11" autocomplete="tel" required></label>
                  <label><span>登录密码</span><input name="password" type="password" maxlength="20" autocomplete="current-password" required></label>
                  <button class="button primary full" type="submit">登录公共服务平台</button>
                  <p class="auth-message" id="publicLoginMessage" role="status"></p>
                </form>
                <form class="hidden" id="publicRegisterForm">
                  <label><span>手机号</span><input name="phone" inputmode="numeric" maxlength="11" autocomplete="tel" required></label>
                  <label><span>姓名或称呼</span><input name="real_name" maxlength="30" autocomplete="name" required></label>
                  <label><span>所在地区</span><input name="location" maxlength="128" placeholder="例如：新疆阿克苏"></label>
                  <label><span>种植面积（亩）</span><input name="land_size" type="number" min="0" step="0.1"></label>
                  <label><span>设置密码</span><input name="password" type="password" minlength="6" maxlength="20" autocomplete="new-password" required></label>
                  <label><span>确认密码</span><input name="password_confirm" type="password" minlength="6" maxlength="20" autocomplete="new-password" required></label>
                  <label class="consent"><input name="privacy_consent" type="checkbox" required><span>我已阅读并同意<a href="${publicLink('/privacy')}" target="_blank">个人信息使用说明</a></span></label>
                  <button class="button primary full" type="submit">注册并登录</button>
                  <p class="auth-message" id="publicRegisterMessage" role="status"></p>
                </form>
                <a class="public-auth-back" href="${next}">暂不登录，返回公益内容</a>
              </div>
            </div>
          </section>`

        const switchMode = newMode => {
          mode = newMode
          document.getElementById('publicLoginForm').classList.toggle('hidden', mode !== 'login')
          document.getElementById('publicRegisterForm').classList.toggle('hidden', mode !== 'register')
          document.querySelectorAll('[data-auth-mode]').forEach(button => button.classList.toggle('active', button.dataset.authMode === mode))
        }
        document.querySelector('.public-auth-tabs').addEventListener('click', event => {
          const button = event.target.closest('[data-auth-mode]')
          if (button) switchMode(button.dataset.authMode)
        })
        switchMode(mode)

        document.getElementById('publicLoginForm').addEventListener('submit', async event => {
          event.preventDefault()
          const form = event.currentTarget
          const values = Object.fromEntries(new FormData(form).entries())
          const message = document.getElementById('publicLoginMessage')
          const button = form.querySelector('button[type="submit"]')
          message.textContent = '正在登录...'
          button.disabled = true
          try {
            const data = await request('/api/community-auth/login', { method: 'POST', body: JSON.stringify(values) })
            saveUserSession(data)
            location.href = next
          } catch (error) {
            message.textContent = error.message
            button.disabled = false
          }
        })

        document.getElementById('publicRegisterForm').addEventListener('submit', async event => {
          event.preventDefault()
          const form = event.currentTarget
          const values = Object.fromEntries(new FormData(form).entries())
          const message = document.getElementById('publicRegisterMessage')
          if (values.password !== values.password_confirm) {
            message.textContent = '两次输入的密码不一致'
            return
          }
          const button = form.querySelector('button[type="submit"]')
          message.textContent = '正在注册...'
          button.disabled = true
          try {
            const data = await request('/api/community-auth/register', {
              method: 'POST',
              body: JSON.stringify({
                phone: values.phone,
                password: values.password,
                real_name: values.real_name,
                location: values.location,
                land_size: Number(values.land_size) || 0
              })
            })
            saveUserSession(data)
            location.href = next
          } catch (error) {
            message.textContent = error.message
            button.disabled = false
          }
        })
      }

      return {
        renderCourses,
        renderCourseDetail,
        renderForum,
        renderForumDetail,
        renderLogin
      }
    }
  }
})()
