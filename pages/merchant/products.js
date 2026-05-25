const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    tab: 'on',
    products: [],
    loading: false,
    showAddModal: false,
    editProduct: null,
    form: { name: '', category: '', price: '', unit: '', stock: '', icon: '📦' }
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    if (!auth.requireLogin()) return
    this._loadProducts()
  },

  async _loadProducts() {
    this.setData({ loading: true })
    try {
      const res = await auth.request('GET', `/api/products/mine?status=${this.data.tab}`)
      if (res.code === 200) {
        this.setData({ products: res.data })
      } else {
        wx.showToast({ title: res.msg || '加载失败', icon: 'none' })
      }
    } catch {
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
    this.setData({ loading: false })
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab }, () => this._loadProducts())
  },

  onAdd() {
    this.setData({ showAddModal: true, editProduct: null, form: { name: '', category: '', price: '', unit: '', stock: '', icon: '📦' } })
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id
    const p = this.data.products.find(x => x.id === id)
    if (!p) return
    this.setData({
      showAddModal: true,
      editProduct: p,
      form: { name: p.name, category: p.category || '', price: String(p.price), unit: p.unit || '', stock: String(p.stock), icon: p.icon || '📦' }
    })
  },

  async onToggleStatus(e) {
    const id = e.currentTarget.dataset.id
    const p = this.data.products.find(x => x.id === id)
    if (!p) return
    const next = p.status === 'on' ? 'off' : 'on'
    const label = next === 'on' ? '上架' : '下架'
    wx.showModal({
      title: `确认${label}`,
      content: `确定要${label} "${p.name}" 吗？`,
      confirmText: label,
      success: async (res) => {
        if (!res.confirm) return
        try {
          const r = await auth.request('PATCH', `/api/products/${id}/status`, { status: next })
          if (r.code === 200) {
            wx.showToast({ title: `${label}成功`, icon: 'success' })
            this._loadProducts()
          } else {
            wx.showToast({ title: r.msg || '操作失败', icon: 'none' })
          }
        } catch { wx.showToast({ title: '网络异常', icon: 'none' }) }
      }
    })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定删除该商品？',
      confirmText: '删除',
      confirmColor: '#F5222D',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const r = await auth.request('DELETE', `/api/products/${id}`)
          if (r.code === 200) {
            wx.showToast({ title: '已删除', icon: 'success' })
            this._loadProducts()
          } else {
            wx.showToast({ title: r.msg || '删除失败', icon: 'none' })
          }
        } catch { wx.showToast({ title: '网络异常', icon: 'none' }) }
      }
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  async onSave() {
    const { form, editProduct } = this.data
    if (!form.name.trim()) return wx.showToast({ title: '请填写商品名称', icon: 'none' })
    if (!form.price)       return wx.showToast({ title: '请填写价格', icon: 'none' })
    const body = { name: form.name.trim(), category: form.category, price: parseFloat(form.price), unit: form.unit, stock: parseInt(form.stock) || 0, icon: form.icon || '📦' }
    try {
      let r
      if (editProduct) {
        r = await auth.request('PUT', `/api/products/${editProduct.id}`, body)
      } else {
        r = await auth.request('POST', '/api/products', body)
      }
      if (r.code === 200) {
        wx.showToast({ title: editProduct ? '修改成功' : '上架成功', icon: 'success' })
        this.setData({ showAddModal: false })
        this._loadProducts()
      } else {
        wx.showToast({ title: r.msg || '操作失败', icon: 'none' })
      }
    } catch { wx.showToast({ title: '网络异常', icon: 'none' }) }
  },

  closeModal() { this.setData({ showAddModal: false }) }
})
