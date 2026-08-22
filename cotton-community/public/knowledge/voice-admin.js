(() => {
  const DAILY_GENERATION_LIMIT = 100
  const token = localStorage.getItem('admin_token') || ''
  const runtime = window.CottonRuntime
  const $ = id => document.getElementById(id)
  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
  const state = { farmers: [], currentUserId: 0, context: null, briefing: null }

  function today() { const date = new Date(); const pad = value => String(value).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
  function logout() { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_name'); location.replace('/admin/login.html?role=admin') }
  async function request(path, options = {}) { return runtime.requestJson(`/api/voice-briefings${path}`, options, { token, onUnauthorized: logout }) }
  function dateTime(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false }) }
  function statusLabel(value) { return ({ none: '未生成', draft: '草稿', published: '已发布', offline: '已下线' })[value] || value }
  function sourceLabel(value) { return ({ manual: '人工编写', ai: 'AI 生成', ai_edited: 'AI 后人工修改' })[value] || '未生成' }

  function hidePanels() {
    ['listPanel', 'editorPanel', 'financePanel', 'homepagePanel', 'productPanel', 'varietyPanel', 'factoryPanel', 'expertPanel', 'securityPanel', 'farmerPanel', 'plotPanel']
      .forEach(id => { const node = $(id); if (node) node.classList.add('hidden') })
  }

  function filteredFarmers() {
    const keyword = $('voiceKeyword').value.trim().toLowerCase()
    return state.farmers.filter(item => !keyword || [item.name, item.phoneMasked, item.location].join(' ').toLowerCase().includes(keyword))
  }

  function render() {
    const rows = filteredFarmers()
    $('voiceCountHint').textContent = `${rows.length} 位农户`
    $('voiceFarmerTable').innerHTML = rows.length ? rows.map(item => `<tr>
      <td><div class="voice-farmer"><strong>${esc(item.name)}</strong><span>${esc(item.phoneMasked)}</span></div></td>
      <td>${esc(item.location || '—')}</td><td>${item.plotCount} 个地块 / ${item.workCount} 项农事</td>
      <td><span class="voice-status ${esc(item.status)}">${esc(statusLabel(item.status))}</span></td><td>${esc(sourceLabel(item.sourceType))}</td>
      <td>${item.generationCount}/${DAILY_GENERATION_LIMIT}</td><td>${esc(dateTime(item.updatedAt))}</td>
      <td><button class="small-btn primary" data-voice-edit="${item.id}">${item.status === 'none' ? '创建播报' : '编辑播报'}</button></td>
    </tr>`).join('') : '<tr><td colspan="8">没有符合条件的农户</td></tr>'
    document.querySelectorAll('[data-voice-edit]').forEach(button => { button.onclick = () => openEditor(Number(button.dataset.voiceEdit)) })
  }

  async function load() {
    $('voiceFarmerTable').innerHTML = '<tr><td colspan="8">正在加载...</td></tr>'
    try {
      const result = await request(`/admin/farmers?date=${encodeURIComponent($('voiceFilterDate').value || today())}`)
      state.farmers = Array.isArray(result.data) ? result.data : []
      render()
    } catch (error) { $('voiceFarmerTable').innerHTML = `<tr><td colspan="8">${esc(error.message || '加载失败')}</td></tr>` }
  }

  function weatherHtml(weather) {
    if (!weather) return '<div class="voice-weather missing">暂无该地块的真实天气观测，AI 将明确说明数据缺失。</div>'
    return `<div class="voice-weather">最近观测：${esc(dateTime(weather.observedAt))} · ${weather.temperature == null ? '温度暂无' : `${weather.temperature}℃`} · 降水 ${Number(weather.precipitation || 0)} mm</div>`
  }

  function contextHtml(context) {
    if (!context) return '<div class="voice-context-empty">暂无生成依据</div>'
    const region = context.weatherRegion || { name: '莎车县', usedDefault: true }
    const current = context.regionWeather
    const sourceLabel = region.source === 'current_location' ? '手机当前位置' : (region.source === 'registered_location_fallback' ? '定位失败，已回退注册地区' : '注册地区')
    const regionWeather = current
      ? `<div class="voice-weather"><strong>播报地区：${esc(region.name)}</strong> · ${sourceLabel}${region.usedDefault ? ' · 未填写或未识别地区，使用默认地区' : ''}<br>当前天气：${esc(current.weatherText || '实况')} · ${current.temperature == null ? '温度暂无' : `${current.temperature}℃`} · 降水 ${Number(current.precipitation || 0)} mm${current.windSpeed == null ? '' : ` · 风速 ${current.windSpeed} km/h`}</div>`
      : `<div class="voice-weather missing"><strong>播报地区：${esc(region.name)}</strong>${region.usedDefault ? ' · 使用默认地区' : ''}<br>该地区当前天气获取失败，AI 将明确说明数据缺失。</div>`
    const plots = context.plots || []
    const plotHtml = plots.length ? plots.map(plot => `<article class="voice-plot-card"><div class="voice-plot-head"><strong>${esc(plot.name)}</strong><span>${Number(plot.area || 0)}亩 · ${esc(plot.variety || '未填品种')} · ${esc(plot.growthStage || '未填生育期')}</span></div>${plot.work.length ? plot.work.map(work => `<div class="voice-work"><strong>${esc(work.time)} · ${esc(work.title)}</strong><span>${esc(work.content || '无补充说明')} · ${esc(work.priority)}</span></div>`).join('') : '<div class="voice-weather missing">该地块当天暂无已发布农事</div>'}</article>`).join('') : '<div class="voice-context-empty">该农户暂未登记地块</div>'
    return regionWeather + plotHtml
  }

  function updateLength() {
    const length = Array.from($('voiceContent').value || '').length
    $('voiceLength').textContent = `${length} 字 · 约 ${Math.max(0, Math.ceil(length / 4.2))} 秒`
  }

  function applyBriefing(briefing) {
    state.briefing = briefing
    $('voiceContent').value = briefing ? briefing.content || '' : ''
    $('voiceSourceBadge').textContent = sourceLabel(briefing && briefing.sourceType)
    $('voiceGenerateHint').textContent = `今天已生成 ${briefing ? briefing.generationCount : 0}/${DAILY_GENERATION_LIMIT} 次`
    updateLength()
  }

  async function openEditor(userId) {
    const farmer = state.farmers.find(item => Number(item.id) === Number(userId))
    if (!farmer) return
    state.currentUserId = userId
    $('voiceModalTitle').textContent = `${farmer.name} · 语音播报`
    $('voiceModalMeta').textContent = `${farmer.phoneMasked} · ${farmer.location || '未填写地区'} · ${$('voiceFilterDate').value}`
    $('voiceContextDate').textContent = $('voiceFilterDate').value
    $('voiceContextContent').innerHTML = '<div class="voice-context-empty">正在读取地块、天气与农事...</div>'
    $('voiceContent').value = ''
    $('voiceMessage').textContent = ''
    $('voiceModal').classList.remove('hidden')
    try {
      const result = await request(`/admin/${userId}?date=${encodeURIComponent($('voiceFilterDate').value)}`)
      state.context = result.data.context
      $('voiceContextContent').innerHTML = contextHtml(state.context)
      applyBriefing(result.data.briefing)
    } catch (error) { $('voiceMessage').textContent = error.message || '播报上下文加载失败' }
  }

  function closeEditor() { $('voiceModal').classList.add('hidden') }

  async function generate() {
    if (!state.currentUserId) return
    if (state.briefing && state.briefing.generationCount >= DAILY_GENERATION_LIMIT) { $('voiceMessage').textContent = `该农户今天已生成${DAILY_GENERATION_LIMIT}次，请直接手动编辑`; return }
    $('voiceMessage').textContent = 'AI 正在根据真实数据生成，请稍候...'
    $('generateVoiceBtn').disabled = true
    try {
      const result = await request('/admin/generate', { method: 'POST', body: JSON.stringify({ userId: state.currentUserId, briefingDate: $('voiceFilterDate').value }) })
      applyBriefing(result.data)
      $('voiceMessage').textContent = result.msg || '生成完成，请审核内容'
    } catch (error) { $('voiceMessage').textContent = error.message || 'AI 生成失败' }
    finally { $('generateVoiceBtn').disabled = false }
  }

  async function save(status) {
    const content = $('voiceContent').value.trim()
    if (!content) { $('voiceMessage').textContent = '请先填写或生成播报内容'; return }
    $('voiceMessage').textContent = status === 'published' ? '正在发布...' : '正在保存草稿...'
    try {
      const result = await request(`/admin/${state.currentUserId}`, { method: 'PUT', body: JSON.stringify({ briefingDate: $('voiceFilterDate').value, content, status }) })
      applyBriefing(result.data)
      $('voiceMessage').textContent = result.msg || '保存成功'
      await load()
    } catch (error) { $('voiceMessage').textContent = error.message || '保存失败' }
  }

  async function show() {
    hidePanels(); $('voicePanel').classList.remove('hidden')
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === 'voice'))
    $('pageTitle').textContent = '语音播报'
    await load()
  }

  $('voiceFilterDate').value = today()
  document.querySelector('[data-view="voice"]').onclick = show
  document.querySelectorAll('[data-view]:not([data-view="voice"])').forEach(item => item.addEventListener('click', () => $('voicePanel').classList.add('hidden')))
  $('voiceFilterDate').onchange = load
  $('voiceKeyword').oninput = render
  $('refreshVoiceBtn').onclick = load
  $('closeVoiceModal').onclick = closeEditor
  $('voiceModal').addEventListener('click', event => { if (event.target === $('voiceModal')) closeEditor() })
  $('voiceContent').oninput = updateLength
  $('generateVoiceBtn').onclick = generate
  $('saveVoiceDraftBtn').onclick = () => save('draft')
  $('publishVoiceBtn').onclick = () => save('published')
})()
