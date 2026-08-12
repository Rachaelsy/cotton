(() => {
  const token = localStorage.getItem('admin_token') || ''
  const runtime = window.CottonRuntime
  const $ = id => document.getElementById(id)
  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
  const state = { factories: [] }

  function unauthorized() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    location.replace('/admin/login.html?role=admin')
  }

  async function api(path, options = {}) {
    const result = await runtime.requestJson(`/api/processing-factories${path}`, options, { token, onUnauthorized: unauthorized })
    return result.data
  }

  function statusName(status) { return status === 'published' ? '已发布' : status === 'offline' ? '已下线' : '草稿' }
  function hidePanels() { ['listPanel', 'editorPanel', 'productPanel', 'securityPanel', 'farmerPanel'].forEach(id => $(id).classList.add('hidden')) }

  function render() {
    $('factoryTable').innerHTML = state.factories.length ? state.factories.map(item => `
      <tr><td>${item.id}</td><td><strong>${esc(item.name)}</strong><br><span class="question-excerpt">公示代码：${esc(item.publicCode || '—')}</span></td>
      <td>${esc(item.county)}<br><span class="question-excerpt">${esc(item.address)}</span></td><td>${item.longitude}<br>${item.latitude}</td>
      <td>${esc(item.managerName || '—')}<br><span class="question-excerpt">${esc(item.contactPhone || '—')}</span></td><td>${item.annualCapacityTons == null ? '未填写' : `${Number(item.annualCapacityTons).toLocaleString()} 吨`}</td>
      <td><span class="status-pill ${item.status === 'published' ? 'published' : ''}">${statusName(item.status)}</span></td><td>${item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '—'}</td>
      <td><div class="product-actions"><button class="small-btn primary" data-factory-edit="${item.id}">编辑</button>${item.status === 'published' ? `<button class="small-btn" data-factory-status="${item.id}" data-status="offline">下线</button>` : `<button class="small-btn primary" data-factory-status="${item.id}" data-status="published">发布</button>`}<button class="small-btn danger" data-factory-delete="${item.id}">删除</button></div></td></tr>`).join('') : '<tr><td colspan="9">暂无加工厂，点击右上角“新增加工厂”开始录入。</td></tr>'
    document.querySelectorAll('[data-factory-edit]').forEach(button => { button.onclick = () => openModal(Number(button.dataset.factoryEdit)) })
    document.querySelectorAll('[data-factory-status]').forEach(button => { button.onclick = () => updateStatus(Number(button.dataset.factoryStatus), button.dataset.status) })
    document.querySelectorAll('[data-factory-delete]').forEach(button => { button.onclick = () => remove(Number(button.dataset.factoryDelete)) })
  }

  async function load() { state.factories = await api('/admin/list'); render() }
  function show() {
    hidePanels(); $('factoryPanel').classList.remove('hidden'); $('pageTitle').textContent = '加工服务'
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === 'factories'))
    load().catch(error => runtime.notify(error.message, 'error'))
  }
  function lines(value) { return String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean) }
  function openModal(id = 0) {
    const item = state.factories.find(row => Number(row.id) === Number(id))
    $('factoryId').value = item ? item.id : ''; $('factoryModalTitle').textContent = item ? '编辑加工厂' : '新增加工厂'
    $('factoryName').value = item ? item.name : ''; $('factoryShortName').value = item ? item.shortName : ''; $('factoryCounty').value = item ? item.county : ''
    $('factoryAddress').value = item ? item.address : ''; $('factoryLongitude').value = item ? item.longitude : ''; $('factoryLatitude').value = item ? item.latitude : ''
    $('factoryCapacity').value = item && item.annualCapacityTons != null ? item.annualCapacityTons : ''; $('factoryManager').value = item ? item.managerName : ''; $('factoryPhone').value = item ? item.contactPhone : ''
    $('factoryPublicCode').value = item ? item.publicCode : ''; $('factoryRating').value = item ? item.rating : ''; $('factoryVerifiedAt').value = item && item.verifiedAt ? String(item.verifiedAt).slice(0, 10) : ''
    $('factoryIntro').value = item ? item.intro : ''; $('factoryImages').value = item ? (item.imageUrls || []).join('\n') : ''; $('factoryServices').value = item ? (item.services || []).join('\n') : ''
    $('factoryOfficialAddress').value = item ? item.officialAddress : ''; $('factoryMapName').value = item ? item.mapName : ''; $('factoryMapSource').value = item ? item.mapSource : ''; $('factoryOfficialSource').value = item ? item.officialSource : ''
    $('factoryStatus').value = item ? item.status : 'draft'; $('factorySort').value = item ? item.sortOrder : 0; $('factoryFeatured').checked = item ? item.isFeatured : false; $('factoryMessage').textContent = ''
    $('factoryModal').classList.remove('hidden')
  }
  function closeModal() { $('factoryModal').classList.add('hidden') }
  async function save(event) {
    event.preventDefault(); const id = $('factoryId').value
    const body = { name: $('factoryName').value.trim(), short_name: $('factoryShortName').value.trim(), county: $('factoryCounty').value.trim(), address: $('factoryAddress').value.trim(), longitude: $('factoryLongitude').value, latitude: $('factoryLatitude').value, annual_capacity_tons: $('factoryCapacity').value, manager_name: $('factoryManager').value.trim(), contact_phone: $('factoryPhone').value.trim(), public_code: $('factoryPublicCode').value.trim(), rating: $('factoryRating').value.trim(), verified_at: $('factoryVerifiedAt').value, intro: $('factoryIntro').value.trim(), image_urls: lines($('factoryImages').value), services: lines($('factoryServices').value), official_address: $('factoryOfficialAddress').value.trim(), map_name: $('factoryMapName').value.trim(), map_source: $('factoryMapSource').value.trim(), official_source: $('factoryOfficialSource').value.trim(), status: $('factoryStatus').value, sort_order: $('factorySort').value, is_featured: $('factoryFeatured').checked }
    if (!body.name || !body.county || !body.address || body.longitude === '' || body.latitude === '' || !body.intro) { $('factoryMessage').textContent = '名称、县市、地址、经纬度和简介不能为空'; return }
    $('factoryMessage').textContent = '正在保存...'
    try { await api(`/admin${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); closeModal(); await load(); runtime.notify(body.status === 'published' ? '加工厂已发布到小程序' : '加工厂已保存', 'success') } catch (error) { $('factoryMessage').textContent = error.message }
  }
  async function updateStatus(id, status) { if (!confirm(status === 'published' ? '确定发布这条加工厂信息？' : '确定下线这条加工厂信息？')) return; try { await api(`/admin/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); await load(); runtime.notify(status === 'published' ? '加工厂已发布' : '加工厂已下线', 'success') } catch (error) { runtime.notify(error.message, 'error') } }
  async function remove(id) { if (!confirm('确定删除这条加工厂信息？此操作不可恢复。')) return; try { await api(`/admin/${id}`, { method: 'DELETE' }); await load(); runtime.notify('加工厂已删除', 'success') } catch (error) { runtime.notify(error.message, 'error') } }

  document.querySelector('[data-view="factories"]').onclick = show
  document.querySelectorAll('[data-view]:not([data-view="factories"])').forEach(item => item.addEventListener('click', () => $('factoryPanel').classList.add('hidden')))
  $('addFactoryBtn').onclick = () => openModal(); $('closeFactoryModal').onclick = closeModal; $('cancelFactoryBtn').onclick = closeModal; $('factoryForm').addEventListener('submit', save)
})()
