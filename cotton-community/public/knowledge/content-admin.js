(() => {
  const token = localStorage.getItem('admin_token') || ''
  const runtime = window.CottonRuntime
  const $ = id => document.getElementById(id)
  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
  const typeLabels = { policy: '政策资讯', industry: '行业资讯', finance: '优棉金融', home: '首页专稿' }
  const financeLabels = { loan: '种植贷', insurance: '棉花保险', futures: '期货基础', 'finance-policy': '金融政策解读' }
  let articles = []

  function logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    location.replace('/admin/login.html?role=admin')
  }

  async function request(path, options = {}) {
    const response = await runtime.requestJson(`/api/policies${path}`, options, { token, onUnauthorized: logout })
    return response.data
  }

  function hideSharedPanels() {
    ['listPanel', 'editorPanel', 'securityPanel', 'farmerPanel', 'productPanel', 'factoryPanel', 'expertPanel', 'financePanel', 'homepagePanel']
      .forEach(id => { const node = $(id); if (node) node.classList.add('hidden') })
  }

  async function loadAll() {
    articles = await request('/admin/list') || []
    renderFinance()
    renderHomepage()
  }

  function statusHtml(item) {
    return `<span class="status-pill ${item.status}">${item.status === 'published' ? '已发布' : '草稿'}</span>`
  }

  function homeHtml(item) {
    return item.isHomeFeatured
      ? '<span class="status-pill published">已推送</span>'
      : '<span style="color:#9aa29e">未推送</span>'
  }

  function renderFinance() {
    const rows = articles.filter(item => item.contentType === 'finance')
    $('financeArticleTable').innerHTML = rows.length ? rows.map(item => `<tr>
      <td><strong>${esc(financeLabels[item.section] || item.section)}</strong></td><td>${esc(item.title)}</td><td>${esc(item.issuer || '—')}</td>
      <td>${statusHtml(item)}</td><td>${homeHtml(item)}</td><td>${item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '—'}</td>
      <td><div class="policy-list-actions"><button class="small-btn ${item.isHomeFeatured ? 'danger' : 'primary'}" data-content-home="${item.id}" data-enabled="${item.isHomeFeatured ? '1' : '0'}" ${item.status !== 'published' ? 'disabled' : ''}>${item.isHomeFeatured ? '取消推送' : '推送首页'}</button><button class="small-btn primary" data-content-edit="${item.id}">编辑文章</button></div></td>
    </tr>`).join('') : '<tr><td colspan="7">金融文章尚未初始化，请先执行数据库迁移。</td></tr>'
    bindRows()
  }

  function renderHomepage() {
    const rows = articles.filter(item => item.isHomeFeatured || item.contentType === 'home')
      .sort((a, b) => Number(b.isHomeFeatured) - Number(a.isHomeFeatured) || new Date(b.homeFeaturedAt || b.updatedAt) - new Date(a.homeFeaturedAt || a.updatedAt))
    const pushed = articles.filter(item => item.isHomeFeatured).length
    $('homepageQueueHint').textContent = `当前已推送 ${pushed}/5 篇。政策、行业、金融文章可在各自栏目推送；首页专稿只在首页出现。`
    $('homepageArticleTable').innerHTML = rows.length ? rows.map(item => `<tr>
      <td><strong>${esc(item.title)}</strong></td><td>${esc(typeLabels[item.contentType] || item.contentType)}</td><td>${esc(item.issuer || '—')}</td>
      <td>${statusHtml(item)}</td><td>${homeHtml(item)}</td><td>${item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '—'}</td>
      <td><div class="policy-list-actions"><button class="small-btn ${item.isHomeFeatured ? 'danger' : 'primary'}" data-content-home="${item.id}" data-enabled="${item.isHomeFeatured ? '1' : '0'}" ${item.status !== 'published' ? 'disabled' : ''}>${item.isHomeFeatured ? '取消推送' : '推送首页'}</button>${item.contentType === 'home' ? `<button class="small-btn primary" data-content-edit="${item.id}">编辑</button><button class="small-btn danger" data-content-delete="${item.id}">删除</button>` : ''}</div></td>
    </tr>`).join('') : '<tr><td colspan="7">暂无首页推送内容，请从政策或金融栏目推送，或新增首页专稿。</td></tr>'
    bindRows()
  }

  function bindRows() {
    document.querySelectorAll('[data-content-edit]').forEach(button => { button.onclick = () => openEditor(Number(button.dataset.contentEdit)) })
    document.querySelectorAll('[data-content-home]').forEach(button => { button.onclick = () => toggleHome(Number(button.dataset.contentHome), button.dataset.enabled === '1') })
    document.querySelectorAll('[data-content-delete]').forEach(button => { button.onclick = () => removeArticle(Number(button.dataset.contentDelete)) })
  }

  function openEditor(id = 0) {
    const item = articles.find(row => Number(row.id) === Number(id))
    const standalone = !item
    $('managedArticleId').value = item ? item.id : ''
    $('managedArticleType').value = item ? item.contentType : 'home'
    $('managedArticleSection').value = item ? item.section : 'homepage'
    $('managedArticleTitle').value = item ? item.title : ''
    $('managedArticleIssuer').value = item ? item.issuer || '' : '喀什优棉公共服务平台'
    $('managedArticleCover').value = item ? item.coverImage || '' : ''
    $('managedArticleMarkdown').value = item ? item.markdown || '' : ''
    $('managedArticleStatus').value = item ? item.status : 'draft'
    $('managedArticleHome').checked = item ? !!item.isHomeFeatured : false
    $('managedArticleModalTitle').textContent = standalone ? '新增首页专稿' : `编辑${typeLabels[item.contentType] || ''}文章`
    $('managedArticleMessage').textContent = ''
    $('managedArticleModal').classList.remove('hidden')
  }

  function closeEditor() { $('managedArticleModal').classList.add('hidden') }

  async function saveArticle(event) {
    event.preventDefault()
    const id = $('managedArticleId').value
    const body = {
      title: $('managedArticleTitle').value.trim(),
      content_type: $('managedArticleType').value || 'home',
      section: $('managedArticleSection').value || 'homepage',
      issuer: $('managedArticleIssuer').value.trim(),
      cover_url: $('managedArticleCover').value.trim(),
      body_markdown: $('managedArticleMarkdown').value.trim(),
      status: $('managedArticleStatus').value,
      is_home_featured: $('managedArticleHome').checked
    }
    if (!body.title || !body.body_markdown) { $('managedArticleMessage').textContent = '标题和 Markdown 正文不能为空'; return }
    if (body.is_home_featured && body.status !== 'published') { $('managedArticleMessage').textContent = '首页推送内容必须先发布'; return }
    $('managedArticleMessage').textContent = '正在保存...'
    try {
      await request(`/admin${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      closeEditor()
      await loadAll()
      runtime.notify('文章已保存并同步到小程序', 'success')
    } catch (error) { $('managedArticleMessage').textContent = error.message }
  }

  async function toggleHome(id, enabled) {
    try {
      await request(`/admin/${id}/home-featured`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !enabled }) })
      await loadAll()
      runtime.notify(enabled ? '已取消首页推送' : '已推送至小程序首页', 'success')
    } catch (error) { runtime.notify(error.message, 'error') }
  }

  async function removeArticle(id) {
    if (!confirm('确定删除这篇首页专稿？此操作不可恢复。')) return
    try { await request(`/admin/${id}`, { method: 'DELETE' }); await loadAll(); runtime.notify('首页专稿已删除', 'success') }
    catch (error) { runtime.notify(error.message, 'error') }
  }

  async function show(view) {
    hideSharedPanels()
    $(view === 'finance' ? 'financePanel' : 'homepagePanel').classList.remove('hidden')
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view))
    $('pageTitle').textContent = view === 'finance' ? '优棉金融' : '首页推送'
    try { await loadAll() } catch (error) { runtime.notify(error.message, 'error') }
  }

  document.querySelector('[data-view="finance"]').onclick = () => show('finance')
  document.querySelector('[data-view="homepage"]').onclick = () => show('homepage')
  document.querySelectorAll('[data-view]:not([data-view="finance"]):not([data-view="homepage"])').forEach(item => item.addEventListener('click', () => {
    $('financePanel').classList.add('hidden'); $('homepagePanel').classList.add('hidden')
  }))
  $('addHomepageArticleBtn').onclick = () => openEditor()
  $('closeManagedArticleModal').onclick = closeEditor
  $('cancelManagedArticleBtn').onclick = closeEditor
  $('managedArticleForm').addEventListener('submit', saveArticle)
  $('importManagedMarkdownBtn').onclick = () => $('managedMarkdownFile').click()
  $('managedMarkdownFile').addEventListener('change', event => {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    if (file.size > 200000) { runtime.notify('Markdown 文件不能超过 200KB', 'error'); event.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = () => { $('managedArticleMarkdown').value = String(reader.result || '').slice(0, 200000); runtime.notify('Markdown 文件已导入', 'success') }
    reader.onerror = () => runtime.notify('Markdown 文件读取失败', 'error')
    reader.readAsText(file, 'UTF-8')
    event.target.value = ''
  })
})()
