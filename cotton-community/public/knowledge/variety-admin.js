(() => {
  const token = localStorage.getItem('admin_token') || ''
  const runtime = window.CottonRuntime
  const $ = id => document.getElementById(id)
  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
  const state = { items: [] }

  function unauthorized() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    location.replace('/admin/login.html?role=admin')
  }

  async function api(path, options = {}) {
    const result = await runtime.requestJson(`/api/cotton-varieties${path}`, options, { token, onUnauthorized: unauthorized })
    return result.data
  }

  function statusName(status) { return status === 'published' ? '已发布' : status === 'offline' ? '已下线' : '草稿' }
  function value(id) { return $(id).value.trim() }
  function numeric(id) { const raw = value(id); return raw === '' ? null : Number(raw) }
  function listValue(id) { return value(id).split(/\r?\n/).map(item => item.trim()).filter(Boolean) }
  function round3(value) { return Math.round(Number(value || 0) * 1000) / 1000 }

  function render() {
    $('varietyTable').innerHTML = state.items.length ? state.items.map(item => `
      <tr>
        <td><strong>${item.overallRank ? `第 ${item.overallRank} 名` : '待评定'} · ${esc(item.name)}</strong>${item.isFeatured ? '<br><span class="status-pill published">优先展示</span>' : ''}</td>
        <td>${item.trialYear}<br><span class="question-excerpt">${esc(item.trialArea)}</span></td>
        <td>${item.seedCottonYieldKgMu == null ? '—' : `${item.seedCottonYieldKgMu} kg/亩`}<br><span class="question-excerpt">衣分 ${item.lintPercent == null ? '—' : `${item.lintPercent}%`}</span></td>
        <td>${item.fiberLengthMm == null ? '—' : `${item.fiberLengthMm} mm`}<br><span class="question-excerpt">${item.fiberStrengthCnTex == null ? '—' : `${item.fiberStrengthCnTex} cN/tex`}</span></td>
        <td>${item.micronaireValue == null ? '—' : item.micronaireValue}<br><span class="question-excerpt">整齐度 ${item.uniformityPercent == null ? '—' : `${item.uniformityPercent}%`}</span></td>
        <td><span class="status-pill ${item.status === 'published' ? 'published' : ''}">${statusName(item.status)}</span></td>
        <td><div class="product-actions"><button class="small-btn primary" data-variety-edit="${item.id}">编辑</button>${item.status === 'published' ? `<button class="small-btn" data-variety-status="${item.id}" data-status="offline">下线</button>` : `<button class="small-btn primary" data-variety-status="${item.id}" data-status="published">发布</button>`}<button class="small-btn danger" data-variety-delete="${item.id}">删除</button></div></td>
      </tr>`).join('') : '<tr><td colspan="7">暂无品种资料，点击右上角“新增品种”开始录入。</td></tr>'
    document.querySelectorAll('[data-variety-edit]').forEach(button => { button.onclick = () => openModal(Number(button.dataset.varietyEdit)) })
    document.querySelectorAll('[data-variety-status]').forEach(button => { button.onclick = () => updateStatus(Number(button.dataset.varietyStatus), button.dataset.status) })
    document.querySelectorAll('[data-variety-delete]').forEach(button => { button.onclick = () => remove(Number(button.dataset.varietyDelete)) })
  }

  async function load() {
    $('varietyTable').innerHTML = '<tr><td colspan="7">加载中...</td></tr>'
    state.items = await api('/admin/list')
    render()
  }

  function hidePanels() {
    ['listPanel','editorPanel','financePanel','homepagePanel','productPanel','factoryPanel','expertPanel','securityPanel','farmerPanel'].forEach(id => {
      const panel = $(id)
      if (panel) panel.classList.add('hidden')
    })
  }

  function show() {
    hidePanels()
    $('varietyPanel').classList.remove('hidden')
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === 'varieties'))
    $('pageTitle').textContent = '品种优选'
    load().catch(error => runtime.notify(error.message, 'error'))
  }

  function setInput(id, value) { $(id).value = value == null ? '' : value }

  function openModal(id = 0) {
    const item = state.items.find(row => Number(row.id) === Number(id))
    setInput('varietyId', item ? item.id : '')
    $('varietyModalTitle').textContent = item ? `编辑品种 · ${item.name}` : '新增品种资料'
    setInput('varietyYear', item ? item.trialYear : 2025)
    setInput('varietyArea', item ? item.trialArea : '喀什地区')
    setInput('varietyName', item ? item.name : '')
    setInput('varietyLint', item ? item.lintPercent : '')
    setInput('varietyLintRank', item ? item.lintRank : '')
    setInput('varietyLength', item ? item.fiberLengthMm : '')
    setInput('varietyLengthRank', item ? item.fiberLengthRank : '')
    setInput('varietyStrength', item ? item.fiberStrengthCnTex : '')
    setInput('varietyStrengthRank', item ? item.fiberStrengthRank : '')
    setInput('varietyMicronaire', item ? item.micronaireValue : '')
    setInput('varietyMicronaireRank', item ? item.micronaireRank : '')
    setInput('varietyUniformity', item ? item.uniformityPercent : '')
    setInput('varietyUniformityRank', item ? item.uniformityRank : '')
    setInput('varietyYield', item ? item.seedCottonYieldKgMu : '')
    setInput('varietyYieldRank', item ? item.yieldRank : '')
    setInput('varietyWeightedTotal', item ? item.weightedTotal : '')
    setInput('varietyOverallRank', item ? item.overallRank : '')
    setInput('varietyCover', item ? item.coverUrl : '')
    setInput('varietyStrengths', item ? (item.strengths || []).join('\n') : '')
    setInput('varietySuitable', item ? item.suitableConditions : '')
    setInput('varietyCounties', item ? (item.recommendedCounties || []).join('\n') : '')
    setInput('varietyNotes', item ? item.notes : '')
    setInput('varietySource', item ? item.sourceName : '2025年喀什地区棉花品种对比试验各项指标统计表')
    $('varietyStatus').value = item ? item.status : 'draft'
    setInput('varietySort', item ? item.sortOrder : 0)
    $('varietyFeatured').checked = item ? item.isFeatured : false
    $('varietyMessage').textContent = ''
    $('varietyModal').classList.remove('hidden')
  }

  function closeModal() { $('varietyModal').classList.add('hidden') }

  async function save(event) {
    event.preventDefault()
    const id = value('varietyId')
    const ranks = {
      lint: numeric('varietyLintRank'), length: numeric('varietyLengthRank'), strength: numeric('varietyStrengthRank'),
      micronaire: numeric('varietyMicronaireRank'), uniformity: numeric('varietyUniformityRank'), yield: numeric('varietyYieldRank')
    }
    const calculatedTotal = ranks.lint == null || ranks.length == null || ranks.strength == null || ranks.micronaire == null || ranks.uniformity == null || ranks.yield == null
      ? null
      : round3(ranks.lint * .15 + ranks.length * .2 + ranks.strength * .2 + ranks.micronaire * .1 + ranks.uniformity * .2 + ranks.yield * .15)
    const body = {
      trial_year: numeric('varietyYear'), trial_area: value('varietyArea'), name: value('varietyName'),
      lint_percent: numeric('varietyLint'), lint_rank: ranks.lint, lint_weighted: ranks.lint == null ? null : round3(ranks.lint * .15),
      fiber_length_mm: numeric('varietyLength'), fiber_length_rank: ranks.length, fiber_length_weighted: ranks.length == null ? null : round3(ranks.length * .2),
      fiber_strength_cn_tex: numeric('varietyStrength'), fiber_strength_rank: ranks.strength, fiber_strength_weighted: ranks.strength == null ? null : round3(ranks.strength * .2),
      micronaire_value: numeric('varietyMicronaire'), micronaire_rank: ranks.micronaire, micronaire_weighted: ranks.micronaire == null ? null : round3(ranks.micronaire * .1),
      uniformity_percent: numeric('varietyUniformity'), uniformity_rank: ranks.uniformity, uniformity_weighted: ranks.uniformity == null ? null : round3(ranks.uniformity * .2),
      seed_cotton_yield_kg_mu: numeric('varietyYield'), yield_rank: ranks.yield, yield_weighted: ranks.yield == null ? null : round3(ranks.yield * .15),
      weighted_total: numeric('varietyWeightedTotal') == null ? calculatedTotal : numeric('varietyWeightedTotal'), overall_rank: numeric('varietyOverallRank'),
      cover_url: value('varietyCover'), strengths: listValue('varietyStrengths'), suitable_conditions: value('varietySuitable'),
      recommended_counties: listValue('varietyCounties'), notes: value('varietyNotes'), source_name: value('varietySource'),
      status: $('varietyStatus').value, is_featured: $('varietyFeatured').checked, sort_order: numeric('varietySort') || 0
    }
    if (!body.trial_year || !body.trial_area || !body.name) { $('varietyMessage').textContent = '试验年份、试验区域和品种名称不能为空'; return }
    $('varietyMessage').textContent = '正在保存...'
    try {
      await api(`/admin${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      closeModal()
      await load()
      runtime.notify(body.status === 'published' ? '品种资料已同步发布到小程序和网页端' : '品种资料已保存', 'success')
    } catch (error) { $('varietyMessage').textContent = error.message }
  }

  async function updateStatus(id, status) {
    if (!confirm(status === 'published' ? '确定发布这个品种资料？' : '确定下线这个品种资料？')) return
    try {
      await api(`/admin/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      await load()
      runtime.notify(status === 'published' ? '品种资料已发布' : '品种资料已下线', 'success')
    } catch (error) { runtime.notify(error.message, 'error') }
  }

  async function remove(id) {
    if (!confirm('确定删除这个品种资料？此操作不可恢复。')) return
    try { await api(`/admin/${id}`, { method: 'DELETE' }); await load(); runtime.notify('品种资料已删除', 'success') }
    catch (error) { runtime.notify(error.message, 'error') }
  }

  const menu = document.querySelector('[data-view="varieties"]')
  if (menu) menu.onclick = show
  document.querySelectorAll('[data-view]:not([data-view="varieties"])').forEach(item => item.addEventListener('click', () => $('varietyPanel').classList.add('hidden')))
  $('addVarietyBtn').onclick = () => openModal()
  $('closeVarietyModal').onclick = closeModal
  $('cancelVarietyBtn').onclick = closeModal
  $('varietyForm').addEventListener('submit', save)
})()
