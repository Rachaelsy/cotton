(() => {
  const token = localStorage.getItem('admin_token') || ''
  const runtime = window.CottonRuntime
  const $ = id => document.getElementById(id)
  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
  const categories = {
    machinery: ['耕整地', '播种铺膜', '田间管理', '采收运输'],
    supplies: ['种子', '肥料', '农药', '地膜']
  }
  const names = { machinery: '农机服务', supplies: '农资服务' }
  const state = { type: '', products: [] }

  function unauthorized() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    location.replace('/admin/login.html?role=admin')
  }

  async function api(path, options = {}) {
    const result = await runtime.requestJson(`/api/service-products${path}`, options, { token, onUnauthorized: unauthorized })
    return result.data
  }

  function statusName(status) {
    return status === 'published' ? '已上架' : status === 'offline' ? '已下架' : '草稿'
  }

  function render() {
    const body = $('productTable')
    body.innerHTML = state.products.length ? state.products.map(item => `
      <tr>
        <td><div class="product-name">${item.coverUrl ? `<img class="product-thumb" src="${esc(item.coverUrl)}" alt="">` : `<span class="product-thumb product-placeholder">${state.type === 'machinery' ? '机' : '资'}</span>`}<div><strong>${esc(item.name)}</strong>${item.isFeatured ? '<br><span class="status-pill published">优先</span>' : ''}</div></div></td>
        <td>${esc(item.category)}<br><span class="question-excerpt">${esc(item.modelName || '—')}</span></td>
        <td>${esc(item.brand || '—')}<br><span class="question-excerpt">${esc(item.manufacturer || '—')}</span></td>
        <td><span class="status-pill ${item.status === 'published' ? 'published' : ''}">${statusName(item.status)}</span></td>
        <td>${Number(item.sortOrder || 0)}</td>
        <td>${item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '—'}</td>
        <td><div class="product-actions"><button class="small-btn primary" data-product-edit="${item.id}">编辑</button>${item.status === 'published' ? `<button class="small-btn" data-product-status="${item.id}" data-status="offline">下架</button>` : `<button class="small-btn primary" data-product-status="${item.id}" data-status="published">上架</button>`}<button class="small-btn danger" data-product-delete="${item.id}">删除</button></div></td>
      </tr>`).join('') : '<tr><td colspan="7">暂无产品，点击右上角“新增产品”开始录入。</td></tr>'
    document.querySelectorAll('[data-product-edit]').forEach(button => { button.onclick = () => openModal(Number(button.dataset.productEdit)) })
    document.querySelectorAll('[data-product-status]').forEach(button => { button.onclick = () => updateStatus(Number(button.dataset.productStatus), button.dataset.status) })
    document.querySelectorAll('[data-product-delete]').forEach(button => { button.onclick = () => remove(Number(button.dataset.productDelete)) })
  }

  async function load(type) {
    state.type = type
    $('productPanelTitle').textContent = `${names[type]}产品管理`
    $('productPanelIntro').textContent = type === 'machinery'
      ? '上架具体农机、机型及其特点，上架后展示在小程序农机服务。'
      : '上架种子、肥料、农药和地膜产品，上架后展示在小程序农资服务。'
    $('productTable').innerHTML = '<tr><td colspan="7">加载中...</td></tr>'
    state.products = await api(`/admin/list?type=${encodeURIComponent(type)}`)
    render()
  }

  function show(type) {
    $('listPanel').classList.add('hidden')
    $('editorPanel').classList.add('hidden')
    $('securityPanel').classList.add('hidden')
    $('farmerPanel').classList.add('hidden')
    $('factoryPanel').classList.add('hidden')
    $('expertPanel').classList.add('hidden')
    $('productPanel').classList.remove('hidden')
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.productType === type))
    $('pageTitle').textContent = names[type]
    load(type).catch(error => runtime.notify(error.message, 'error'))
  }

  function syncCategories(selected = '') {
    const values = categories[state.type] || []
    $('productCategory').innerHTML = values.map(value => `<option${value === selected ? ' selected' : ''}>${value}</option>`).join('')
  }

  function openModal(id = 0) {
    const item = state.products.find(product => Number(product.id) === Number(id))
    $('productId').value = item ? item.id : ''
    $('productType').value = state.type
    $('productModalTitle').textContent = item ? `编辑${names[state.type]}产品` : `新增${names[state.type]}产品`
    $('productModelLabel').textContent = state.type === 'machinery' ? '机型/规格' : '品种/规格'
    syncCategories(item ? item.category : '')
    $('productName').value = item ? item.name : ''
    $('productModel').value = item ? item.modelName : ''
    $('productBrand').value = item ? item.brand : ''
    $('productManufacturer').value = item ? item.manufacturer : ''
    $('productCover').value = item ? item.coverUrl : ''
    $('productIntro').value = item ? item.intro : ''
    $('productFeatures').value = item ? (item.features || []).join('\n') : ''
    $('productApplicable').value = item ? item.applicable : ''
    $('productRegion').value = item ? item.region : '喀什地区'
    $('productStatus').value = item ? item.status : 'draft'
    $('productSort').value = item ? item.sortOrder : 0
    $('productFeatured').checked = item ? item.isFeatured : false
    $('productMessage').textContent = ''
    $('productModal').classList.remove('hidden')
  }

  function closeModal() { $('productModal').classList.add('hidden') }

  async function save(event) {
    event.preventDefault()
    const id = $('productId').value
    const body = {
      service_type: state.type,
      category: $('productCategory').value,
      name: $('productName').value.trim(),
      model_name: $('productModel').value.trim(),
      brand: $('productBrand').value.trim(),
      manufacturer: $('productManufacturer').value.trim(),
      cover_url: $('productCover').value.trim(),
      intro: $('productIntro').value.trim(),
      features: $('productFeatures').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
      applicable: $('productApplicable').value.trim(),
      region: $('productRegion').value.trim(),
      status: $('productStatus').value,
      sort_order: $('productSort').value,
      is_featured: $('productFeatured').checked
    }
    if (!body.category || !body.name || !body.intro) { $('productMessage').textContent = '分类、产品名称和产品简介不能为空'; return }
    $('productMessage').textContent = '正在保存...'
    try {
      await api(`/admin${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      closeModal()
      await load(state.type)
      runtime.notify(body.status === 'published' ? '产品已上架到小程序' : '产品已保存', 'success')
    } catch (error) { $('productMessage').textContent = error.message }
  }

  async function updateStatus(id, status) {
    if (!confirm(status === 'published' ? '确定上架这个产品？' : '确定下架这个产品？')) return
    try {
      await api(`/admin/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      await load(state.type)
      runtime.notify(status === 'published' ? '产品已上架' : '产品已下架', 'success')
    } catch (error) { runtime.notify(error.message, 'error') }
  }

  async function remove(id) {
    if (!confirm('确定删除这个产品？此操作不可恢复。')) return
    try { await api(`/admin/${id}`, { method: 'DELETE' }); await load(state.type); runtime.notify('产品已删除', 'success') }
    catch (error) { runtime.notify(error.message, 'error') }
  }

  document.querySelectorAll('[data-product-type]').forEach(item => { item.onclick = () => show(item.dataset.productType) })
  document.querySelectorAll('[data-view]:not([data-product-type])').forEach(item => { item.addEventListener('click', () => $('productPanel').classList.add('hidden')) })
  $('addProductBtn').onclick = () => openModal()
  $('closeProductModal').onclick = closeModal
  $('cancelProductBtn').onclick = closeModal
  $('productForm').addEventListener('submit', save)
})()
