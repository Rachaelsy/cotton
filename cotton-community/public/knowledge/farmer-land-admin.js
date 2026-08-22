(() => {
  const token = localStorage.getItem('admin_token') || ''
  const runtime = window.CottonRuntime
  const byId = id => document.getElementById(id)
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
  const state = { data: null, plots: [], farmers: [], workPlotId: 0, workItems: [] }

  function logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    location.replace('/admin/login.html?role=admin')
  }

  async function request() {
    const result = await runtime.requestJson('/api/admin/farmer-landscape', {}, { token, onUnauthorized: logout })
    return result.data || {}
  }

  function number(value, digits = 0) {
    return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  }

  function dateTime(value) {
    if (!value) return '暂无记录'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false })
  }

  function verificationLabel(value) {
    return ({ approved: '已实名', pending: '审核中', rejected: '未通过', unverified: '未实名' })[value] || '未实名'
  }

  function renderSummary(data) {
    const summary = data.summary || {}
    byId('landStatFarmers').textContent = number(summary.farmerCount)
    byId('landStatPlots').textContent = number(summary.plotCount)
    byId('landStatArea').textContent = number(summary.totalArea, 2)
    byId('landStatAttention').textContent = number(summary.attentionPlotCount)
    byId('landStatActive').textContent = number(summary.activeFarmerCount)
    byId('landStatVerified').textContent = number(summary.verifiedFarmerCount)
    byId('farmerStatPlots').textContent = number(summary.plotCount)
    byId('farmerStatArea').textContent = number(summary.totalArea, 2)
    byId('plotStatFarmers').textContent = number(new Set(state.plots.map(item => Number(item.farmerId))).size)
    const risks = data.risks || {}
    byId('riskHeat').textContent = number(risks.highTemperature)
    byId('riskRain').textContent = number(risks.heavyRain)
    byId('riskFrost').textContent = number(risks.frost)
    byId('riskWind').textContent = risks.highWindAvailable ? number(risks.highWind) : '—'
    byId('riskWindHint').textContent = risks.highWindAvailable ? '达到预警阈值' : '暂无风速数据'
    const covered = state.plots.filter(item => item.weather && item.weather.lastObservedAt).length
    byId('weatherCoverage').textContent = `数据覆盖 ${covered} 个地块`
  }

  function renderCountyStats(rows) {
    byId('countyStats').innerHTML = rows.length ? rows.map(item => `<div class="county-row"><strong>${escapeHtml(item.county)}</strong><span><b>${number(item.plotCount)}</b>地块</span><span><b>${number(item.totalArea, 1)}</b>亩</span><span><b>${number(item.activeFarmerCount)}</b>活跃</span></div>`).join('') : '<div class="county-row"><strong>暂无县域数据</strong></div>'
  }

  function renderDistribution(id, rows) {
    const max = Math.max(1, ...rows.map(item => Number(item.count || 0)))
    byId(id).innerHTML = rows.length ? rows.slice(0, 8).map(item => `<div class="distribution-row"><span title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span><span class="distribution-track"><i style="width:${Math.max(5, Number(item.count || 0) / max * 100)}%"></i></span><b>${number(item.count)}</b></div>`).join('') : '<div style="padding:8px 0;color:#8b9691;font-size:11px">暂无统计数据</div>'
  }

  function populateFilters() {
    const county = byId('farmerLandCounty')
    const stage = byId('farmerLandStage')
    const farmerCounty = byId('farmerAccountCounty')
    const countyValue = county.value
    const stageValue = stage.value
    const farmerCountyValue = farmerCounty.value
    const counties = [...new Set([...state.plots.map(item => item.county), ...state.farmers.map(item => item.county)].filter(Boolean))].sort()
    const stages = [...new Set(state.plots.map(item => item.growthStage).filter(Boolean))]
    county.innerHTML = '<option value="">全部县市</option>' + counties.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')
    farmerCounty.innerHTML = '<option value="">全部县市</option>' + counties.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')
    stage.innerHTML = '<option value="">全部生育期</option>' + stages.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')
    if (counties.includes(countyValue)) county.value = countyValue
    if (counties.includes(farmerCountyValue)) farmerCounty.value = farmerCountyValue
    if (stages.includes(stageValue)) stage.value = stageValue
  }

  function farmerRows() {
    const plotGroups = new Map()
    state.plots.forEach(plot => {
      const id = Number(plot.farmerId)
      const current = plotGroups.get(id) || { count: 0, area: 0, lastActivityAt: null }
      current.count += 1
      current.area += Number(plot.area || 0)
      const candidate = plot.production && plot.production.lastActivityAt
      if (candidate && (!current.lastActivityAt || new Date(candidate) > new Date(current.lastActivityAt))) current.lastActivityAt = candidate
      plotGroups.set(id, current)
    })
    return state.farmers.map(farmer => ({ ...farmer, ...(plotGroups.get(Number(farmer.id)) || { count: 0, area: 0, lastActivityAt: null }) }))
  }

  function filteredFarmerRows() {
    const keyword = byId('farmerAccountKeyword').value.trim().toLowerCase()
    const county = byId('farmerAccountCounty').value
    const verification = byId('farmerAccountVerification').value
    const status = byId('farmerAccountStatus').value
    return farmerRows().filter(item => {
      const text = [item.name, item.phoneMasked, item.county, item.township, item.location].join(' ').toLowerCase()
      return (!keyword || text.includes(keyword)) && (!county || item.county === county) &&
        (!verification || item.verificationStatus === verification) && (!status || item.accountStatus === status)
    })
  }

  function renderFarmerTable() {
    const rows = filteredFarmerRows()
    byId('farmerAccountResultCount').textContent = `${rows.length} 位农户`
    byId('farmerAccountTable').innerHTML = rows.length ? rows.map(item => `<tr>
      <td><div class="farmer-cell"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.phoneMasked)}</span></div></td>
      <td>${escapeHtml(item.county || '—')}<br><span style="color:#89938e;font-size:11px">${escapeHtml(item.township || '—')}</span></td>
      <td><span class="account-state ${escapeHtml(item.verificationStatus)}">${escapeHtml(verificationLabel(item.verificationStatus))}</span></td>
      <td><span class="account-state ${item.accountStatus === 'active' ? 'active' : 'disabled'}">${item.accountStatus === 'active' ? '正常' : '已停用'}</span></td>
      <td>${number(item.count)} 个</td><td>${number(item.area, 2)} 亩</td>
      <td><span class="last-activity">${escapeHtml(dateTime(item.lastActivityAt))}</span></td>
      <td><div class="farmer-actions"><button class="small-btn primary" data-account-edit="${Number(item.id)}">编辑</button><button class="small-btn ${item.accountStatus === 'active' ? 'danger' : 'primary'}" data-account-status="${Number(item.id)}" data-active="${item.accountStatus === 'active' ? '1' : '0'}">${item.accountStatus === 'active' ? '禁用' : '启用'}</button></div></td>
    </tr>`).join('') : '<tr><td colspan="8">没有符合筛选条件的农户</td></tr>'
    document.querySelectorAll('[data-account-edit]').forEach(button => { button.onclick = () => window.PolicyFarmerAdmin && window.PolicyFarmerAdmin.edit(Number(button.dataset.accountEdit)) })
    document.querySelectorAll('[data-account-status]').forEach(button => { button.onclick = () => window.PolicyFarmerAdmin && window.PolicyFarmerAdmin.toggle(Number(button.dataset.accountStatus), button.dataset.active === '1') })
  }

  function riskHtml(item) {
    const risks = item.weather && item.weather.risks ? item.weather.risks : {}
    const labels = []
    if (risks.highTemperature) labels.push('高温')
    if (risks.highWind) labels.push('大风')
    if (risks.heavyRain) labels.push('降雨')
    if (risks.frost) labels.push('霜冻')
    if (item.plotStatus === 'attention' && !labels.length) labels.push(item.healthIssue || '生产关注')
    return labels.length ? labels.map(label => `<i>${escapeHtml(label)}</i>`).join('') : '<i class="normal">正常</i>'
  }

  function mergedRows() {
    return state.plots.map(item => ({ ...item, hasPlot: true }))
  }

  function filteredRows() {
    const keyword = byId('farmerLandKeyword').value.trim().toLowerCase()
    const county = byId('farmerLandCounty').value
    const stage = byId('farmerLandStage').value
    const risk = byId('farmerLandRisk').value
    return mergedRows().filter(item => {
      const text = [item.farmerName, item.phoneMasked, item.county, item.township, item.plotName, item.variety].join(' ').toLowerCase()
      if (keyword && !text.includes(keyword)) return false
      if (county && item.county !== county) return false
      if (stage && item.growthStage !== stage) return false
      if (risk === 'attention' && !item.needsAttention) return false
      if (risk === 'normal' && item.needsAttention) return false
      return true
    })
  }

  function renderTable() {
    const rows = filteredRows()
    byId('farmerLandResultCount').textContent = `${rows.length} 个地块`
    byId('farmerTable').innerHTML = rows.length ? rows.map(item => {
      const production = item.production || {}
      return `<tr>
        <td><div class="farmer-cell"><strong>${escapeHtml(item.farmerName)}</strong><span>${escapeHtml(item.phoneMasked)}</span><small class="${item.accountStatus === 'active' ? '' : 'disabled'}">${escapeHtml(verificationLabel(item.verificationStatus))} · ${item.accountStatus === 'active' ? '账号正常' : '账号停用'}</small></div></td>
        <td>${escapeHtml(item.county || '—')}<br><span style="color:#89938e;font-size:11px">${escapeHtml(item.township || '—')}</span></td>
        <td><div class="plot-cell"><strong>${escapeHtml(item.plotName)}</strong><span>${escapeHtml(item.crop)} · ${escapeHtml(item.variety)}</span><em>${escapeHtml(item.growthStage)}</em></div></td>
        <td>${number(item.area, 2)} 亩<br><span style="color:#89938e;font-size:11px">${escapeHtml(item.sowDate || '未设置播期')}</span></td>
        <td><div class="production-cell"><strong>${escapeHtml(production.lastRecordTitle || production.lastRecordType || '暂无农事记录')}</strong><span>灌溉 ${number(production.irrigationCount)} · 施肥 ${number(production.fertilizationCount)} · 识别 ${number(production.pestRecognitionCount)}</span></div></td>
        <td><div class="risk-tags">${riskHtml(item)}</div></td>
        <td><span class="last-activity">${escapeHtml(dateTime(production.lastActivityAt))}</span></td>
        <td>${item.hasPlot ? `<div class="farmer-actions"><button class="small-btn primary" data-plot-work="${Number(item.id)}">今日农事</button><button class="small-btn" data-plot-detail="${Number(item.id)}">查看地块</button></div>` : '<span style="color:#9aa29e;font-size:11px">暂无地块</span>'}</td>
      </tr>`
    }).join('') : '<tr><td colspan="8">没有符合筛选条件的农户或地块</td></tr>'
    document.querySelectorAll('[data-plot-detail]').forEach(button => { button.onclick = () => openPlot(Number(button.dataset.plotDetail)) })
    document.querySelectorAll('[data-plot-work]').forEach(button => { button.onclick = () => openPlotWork(Number(button.dataset.plotWork)) })
  }

  function today() {
    const date = new Date(); const pad = value => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  async function workRequest(path, options = {}) {
    return runtime.requestJson(`/api/plot-daily-work${path}`, options, { token, onUnauthorized: logout })
  }

  function resetPlotWorkForm() {
    byId('plotWorkId').value = ''
    byId('plotWorkPlotId').value = String(state.workPlotId || '')
    byId('plotWorkDate').value = byId('plotWorkFilterDate').value || today()
    byId('plotWorkTime').value = ''
    byId('plotWorkItemTitle').value = ''
    byId('plotWorkContent').value = ''
    byId('plotWorkPriority').value = 'normal'
    byId('plotWorkStatus').value = 'published'
    byId('plotWorkSort').value = '0'
    byId('plotWorkFormTitle').textContent = '新增地块农事'
    byId('plotWorkMessage').textContent = ''
  }

  function renderPlotWork() {
    const priority = { normal: '普通', important: '重要', urgent: '紧急' }
    const status = { draft: '草稿', published: '已发布', offline: '已下线' }
    byId('plotWorkTable').innerHTML = state.workItems.length ? state.workItems.map(item => `<tr>
      <td>${escapeHtml(item.timeLabel || '全天')}</td>
      <td><div class="production-cell"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.content || '无补充说明')}</span></div></td>
      <td><span class="work-priority ${escapeHtml(item.priority)}">${priority[item.priority] || '普通'}</span></td>
      <td>${status[item.status] || escapeHtml(item.status)}</td>
      <td><div class="farmer-actions"><button class="small-btn primary" data-work-edit="${item.id}">编辑</button><button class="small-btn danger" data-work-delete="${item.id}">删除</button></div></td>
    </tr>`).join('') : '<tr><td colspan="5">该地块在所选日期暂无农事安排</td></tr>'
    document.querySelectorAll('[data-work-edit]').forEach(button => { button.onclick = () => editPlotWork(Number(button.dataset.workEdit)) })
    document.querySelectorAll('[data-work-delete]').forEach(button => { button.onclick = () => deletePlotWork(Number(button.dataset.workDelete)) })
  }

  async function loadPlotWork() {
    if (!state.workPlotId) return
    byId('plotWorkTable').innerHTML = '<tr><td colspan="5">正在加载...</td></tr>'
    try {
      const date = byId('plotWorkFilterDate').value || today()
      const result = await workRequest(`/admin/list?plotId=${state.workPlotId}&date=${encodeURIComponent(date)}`)
      state.workItems = Array.isArray(result.data) ? result.data : []
      renderPlotWork()
    } catch (error) {
      byId('plotWorkTable').innerHTML = `<tr><td colspan="5">${escapeHtml(error.message || '加载失败')}</td></tr>`
    }
  }

  function openPlotWork(id) {
    const plot = state.plots.find(item => Number(item.id) === Number(id))
    if (!plot) return
    state.workPlotId = Number(id)
    byId('plotWorkTitle').textContent = `${plot.plotName} · 今日农事`
    byId('plotWorkFarmer').textContent = `${plot.farmerName} · ${plot.phoneMasked} · ${plot.county} ${plot.township}`
    byId('plotWorkFilterDate').value = today()
    resetPlotWorkForm()
    byId('plotWorkModal').classList.remove('hidden')
    loadPlotWork()
  }

  function editPlotWork(id) {
    const item = state.workItems.find(row => Number(row.id) === Number(id))
    if (!item) return
    byId('plotWorkId').value = String(item.id)
    byId('plotWorkPlotId').value = String(item.plotId)
    byId('plotWorkDate').value = item.workDate
    byId('plotWorkTime').value = item.timeLabel || ''
    byId('plotWorkItemTitle').value = item.title || ''
    byId('plotWorkContent').value = item.content || ''
    byId('plotWorkPriority').value = item.priority || 'normal'
    byId('plotWorkStatus').value = item.status || 'draft'
    byId('plotWorkSort').value = String(item.sortOrder || 0)
    byId('plotWorkFormTitle').textContent = '编辑地块农事'
    byId('plotWorkItemTitle').focus()
  }

  async function savePlotWork(event) {
    event.preventDefault()
    const id = Number(byId('plotWorkId').value || 0)
    const body = {
      plotId: state.workPlotId, workDate: byId('plotWorkDate').value, timeLabel: byId('plotWorkTime').value,
      title: byId('plotWorkItemTitle').value, content: byId('plotWorkContent').value,
      priority: byId('plotWorkPriority').value, status: byId('plotWorkStatus').value, sortOrder: Number(byId('plotWorkSort').value || 0)
    }
    byId('plotWorkMessage').textContent = '正在保存...'
    try {
      const result = await workRequest(id ? `/admin/${id}` : '/admin', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) })
      byId('plotWorkFilterDate').value = body.workDate
      resetPlotWorkForm()
      await loadPlotWork()
      runtime.notify(result.msg || '今日农事已保存', 'success')
    } catch (error) {
      byId('plotWorkMessage').textContent = error.message || '保存失败'
    }
  }

  async function deletePlotWork(id) {
    if (!window.confirm('确定删除这条地块农事吗？')) return
    try {
      const result = await workRequest(`/admin/${id}`, { method: 'DELETE' })
      await loadPlotWork()
      runtime.notify(result.msg || '已删除', 'success')
    } catch (error) { runtime.notify(error.message || '删除失败', 'error') }
  }

  function fact(label, value) {
    return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value == null || value === '' ? '—' : value)}</strong></div>`
  }

  function renderBoundary(plot) {
    const svg = byId('plotMapCanvas')
    svg.innerHTML = ''
    const points = (plot.boundary || []).map(item => ({
      lat: Number(item.latitude == null ? item.lat : item.latitude),
      lng: Number(item.longitude == null ? item.lng : item.longitude)
    })).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    if (points.length < 3) {
      svg.innerHTML = '<text x="320" y="164" text-anchor="middle" class="plot-map-empty">该地块暂未保存有效轮廓</text>'
      return
    }
    const minLat = Math.min(...points.map(item => item.lat)); const maxLat = Math.max(...points.map(item => item.lat))
    const minLng = Math.min(...points.map(item => item.lng)); const maxLng = Math.max(...points.map(item => item.lng))
    const latSpan = Math.max(maxLat - minLat, 0.00001); const lngSpan = Math.max(maxLng - minLng, 0.00001)
    const projected = points.map(item => ({ x: 34 + (item.lng - minLng) / lngSpan * 572, y: 286 - (item.lat - minLat) / latSpan * 252 }))
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    polygon.setAttribute('points', projected.map(item => `${item.x},${item.y}`).join(' ')); polygon.setAttribute('class', 'plot-polygon'); svg.appendChild(polygon)
    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    center.setAttribute('cx', projected.reduce((sum, item) => sum + item.x, 0) / projected.length); center.setAttribute('cy', projected.reduce((sum, item) => sum + item.y, 0) / projected.length); center.setAttribute('r', '7'); center.setAttribute('class', 'plot-center-dot'); svg.appendChild(center)
  }

  function openPlot(id) {
    const plot = state.plots.find(item => Number(item.id) === Number(id))
    if (!plot) return
    byId('plotDetailTitle').textContent = plot.plotName
    byId('plotDetailFarmer').textContent = `${plot.farmerName} · ${plot.phoneMasked} · ${plot.county} ${plot.township}`
    const coordinate = plot.center ? `${plot.center.latitude.toFixed(6)}, ${plot.center.longitude.toFixed(6)}` : '暂无有效中心点'
    byId('plotMapCoordinate').textContent = coordinate
    const mapLink = byId('plotExternalMap')
    if (plot.center) {
      mapLink.href = `https://apis.map.qq.com/uri/v1/marker?marker=coord:${plot.center.latitude},${plot.center.longitude};title:${encodeURIComponent(plot.plotName)}&referer=cotton-public-admin`
      mapLink.classList.remove('hidden')
    } else mapLink.classList.add('hidden')
    renderBoundary(plot)
    byId('plotDetailFacts').innerHTML = [fact('所属地区', `${plot.county} ${plot.township}`), fact('面积', `${number(plot.area, 2)} 亩`), fact('作物 / 品种', `${plot.crop} / ${plot.variety}`), fact('播种日期', plot.sowDate || '未设置'), fact('当前生育期', plot.growthStage), fact('地块状态', plot.needsAttention ? '需要关注' : '正常')].join('')
    const p = plot.production || {}
    byId('plotProductionFacts').innerHTML = [fact('最近农事', p.lastRecordTitle || p.lastRecordType || '暂无'), fact('最近农事时间', dateTime(p.lastRecordAt)), fact('灌溉次数', number(p.irrigationCount)), fact('施肥次数', number(p.fertilizationCount)), fact('病虫害识别（农户）', number(p.pestRecognitionCount)), fact('最近操作', dateTime(p.lastActivityAt))].join('')
    const weather = plot.weather || {}; const risks = weather.risks || {}
    byId('plotWeatherFacts').innerHTML = [fact('近72小时最高温', weather.maxTemperature == null ? '暂无数据' : `${weather.maxTemperature}℃`), fact('近72小时最低温', weather.minTemperature == null ? '暂无数据' : `${weather.minTemperature}℃`), fact('累计降雨', weather.precipitation == null ? '暂无数据' : `${weather.precipitation} mm`), fact('高温预警', risks.highTemperature ? '需关注' : '正常'), fact('降雨 / 霜冻', `${risks.heavyRain ? '降雨预警' : '无降雨预警'} / ${risks.frost ? '霜冻预警' : '无霜冻预警'}`), fact('大风预警', risks.highWindAvailable ? (risks.highWind ? '需关注' : '正常') : '暂无风速数据')].join('')
    byId('plotDetailModal').classList.remove('hidden')
  }

  async function load() {
    byId('farmerLandLoading').textContent = '正在汇总地块数据...'
    byId('farmerAccountLoading').textContent = '正在加载农户数据...'
    byId('farmerLandLoading').classList.remove('hidden')
    byId('farmerLandContent').classList.add('hidden')
    byId('farmerAccountLoading').classList.remove('hidden')
    byId('farmerAccountContent').classList.add('hidden')
    try {
      const data = await request()
      state.data = data; state.plots = data.plots || []; state.farmers = data.farmers || []
      renderSummary(data); renderCountyStats(data.counties || []); renderDistribution('varietyDistribution', data.varieties || []); renderDistribution('stageDistribution', data.growthStages || []); populateFilters(); renderFarmerTable(); renderTable()
      byId('farmerLandUpdated').textContent = `更新于 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`
      byId('farmerAccountUpdated').textContent = `更新于 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`
      byId('farmerLandLoading').classList.add('hidden'); byId('farmerLandContent').classList.remove('hidden')
      byId('farmerAccountLoading').classList.add('hidden'); byId('farmerAccountContent').classList.remove('hidden')
    } catch (error) {
      byId('farmerLandLoading').textContent = error.message || '农户与地块数据加载失败'
      byId('farmerAccountLoading').textContent = error.message || '农户数据加载失败'
      runtime.notify(error.message || '数据加载失败', 'error')
    }
  }

  function show(view = 'farmers') {
    ['listPanel', 'editorPanel', 'financePanel', 'homepagePanel', 'productPanel', 'varietyPanel', 'factoryPanel', 'expertPanel', 'securityPanel', 'farmerPanel', 'plotPanel'].forEach(id => { const node = byId(id); if (node) node.classList.add('hidden') })
    const target = view === 'plots' ? 'plotPanel' : 'farmerPanel'
    byId(target).classList.remove('hidden')
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === view))
    byId('pageTitle').textContent = view === 'plots' ? '地块管理' : '农户管理'
    load()
  }

  window.FarmerLandAdmin = { show, load }
  byId('refreshFarmerLandBtn').onclick = load
  byId('refreshFarmerAccountBtn').onclick = load
  byId('closePlotDetailModal').onclick = () => byId('plotDetailModal').classList.add('hidden')
  byId('plotDetailModal').addEventListener('click', event => { if (event.target === byId('plotDetailModal')) byId('plotDetailModal').classList.add('hidden') })
  byId('closePlotWorkModal').onclick = () => byId('plotWorkModal').classList.add('hidden')
  byId('plotWorkModal').addEventListener('click', event => { if (event.target === byId('plotWorkModal')) byId('plotWorkModal').classList.add('hidden') })
  byId('plotWorkFilterDate').onchange = () => { resetPlotWorkForm(); loadPlotWork() }
  byId('refreshPlotWorkBtn').onclick = loadPlotWork
  byId('resetPlotWorkBtn').onclick = resetPlotWorkForm
  byId('plotWorkForm').onsubmit = savePlotWork
  ;['farmerLandKeyword', 'farmerLandCounty', 'farmerLandStage', 'farmerLandRisk'].forEach(id => byId(id).addEventListener(id === 'farmerLandKeyword' ? 'input' : 'change', renderTable))
  ;['farmerAccountKeyword', 'farmerAccountCounty', 'farmerAccountVerification', 'farmerAccountStatus'].forEach(id => byId(id).addEventListener(id === 'farmerAccountKeyword' ? 'input' : 'change', renderFarmerTable))
})()
