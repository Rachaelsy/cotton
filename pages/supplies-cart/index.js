// pages/supplies-cart/index.js — 购物车
const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    cartItems: [],
    cartGroups: [],
    cartCount: 0,
    cartTotal: '0',
    manage: false,
    selectedIds: [],
    recProds: []
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    this._loadCart()
  },

  _loadCart() {
    const cart = app.globalData.cart
    const cartCount = app.globalData.cartCount
    const cartTotal = cart
      .reduce((s, c) => s + c.price * c.qty, 0)
      .toFixed(0)

    // 按店铺分组
    const groupMap = {}
    cart.forEach(item => {
      const k = item.store || '其他商家'
      if (!groupMap[k]) {
        groupMap[k] = {
          store: k,
          verified: item.storeVerified,
          discount: item.discount,
          items: []
        }
      }
      groupMap[k].items.push(item)
    })

    // 推荐商品（取全局商品中排除购物车内的）
    const cartIds = new Set(cart.map(c => c.id))
    const allProds = app.globalData.products || app.globalData.localProducts || []
    const recProds = allProds.filter(p => !cartIds.has(p.id)).slice(0, 6)

    this.setData({
      cartItems: cart,
      cartGroups: Object.values(groupMap),
      cartCount,
      cartTotal,
      recProds
    })
  },

  onBack() {
    wx.navigateBack()
  },

  onGoShopping() {
    wx.navigateBack()
  },

  // 切换管理模式
  onManage() {
    this.setData({ manage: !this.data.manage, selectedIds: [] })
  },

  // 减少数量
  onQtyMinus(e) {
    const id = e.currentTarget.dataset.id
    const cart = app.globalData.cart
    const item = cart.find(c => c.id === id)
    if (!item) return
    if (item.qty > 1) {
      item.qty--
    } else {
      const idx = cart.findIndex(c => c.id === id)
      cart.splice(idx, 1)
    }
    app.saveCart()
    this._loadCart()
  },

  // 增加数量
  onQtyPlus(e) {
    const id = e.currentTarget.dataset.id
    const cart = app.globalData.cart
    const item = cart.find(c => c.id === id)
    if (!item) return
    item.qty++
    app.saveCart()
    this._loadCart()
  },

  // 切换单品选中（管理模式）
  onToggleSel(e) {
    if (!this.data.manage) return
    const id = e.currentTarget.dataset.id
    const selected = [...this.data.selectedIds]
    const idx = selected.indexOf(id)
    if (idx >= 0) selected.splice(idx, 1)
    else selected.push(id)
    this.setData({ selectedIds: selected })
  },

  // 切换店铺全选（管理模式）
  onToggleStore(e) {
    if (!this.data.manage) return
    const store = e.currentTarget.dataset.store
    const group = this.data.cartGroups.find(g => g.store === store)
    if (!group) return
    const groupIds = group.items.map(ci => ci.id)
    const selected = [...this.data.selectedIds]
    const allSelected = groupIds.every(id => selected.includes(id))
    if (allSelected) {
      // 取消全选该店铺
      const newSel = selected.filter(id => !groupIds.includes(id))
      this.setData({ selectedIds: newSel })
    } else {
      // 全选该店铺
      groupIds.forEach(id => {
        if (!selected.includes(id)) selected.push(id)
      })
      this.setData({ selectedIds: selected })
    }
  },

  // 全选/取消全选
  onSelectAll() {
    const allIds = this.data.cartItems.map(c => c.id)
    if (this.data.selectedIds.length === allIds.length) {
      this.setData({ selectedIds: [] })
    } else {
      this.setData({ selectedIds: allIds })
    }
  },

  // 删除选中
  onDeleteSelected() {
    if (this.data.selectedIds.length === 0) return
    const ids = new Set(this.data.selectedIds)
    const n = ids.size
    app.globalData.cart = app.globalData.cart.filter(c => !ids.has(c.id))
    app.saveCart()
    this.setData({ selectedIds: [], manage: false })
    this._loadCart()
    wx.showToast({ title: `已删除${n}件商品`, icon: 'none' })
  },

  // 去结算
  onCheckout() {
    if (this.data.cartItems.length === 0) return
    wx.navigateTo({ url: '/pages/supplies-checkout/index' })
  },

  // 点击推荐商品
  onRecItem(e) {
    const id = e.currentTarget.dataset.id
    const allProds = app.globalData.products || app.globalData.localProducts || []
    const product = allProds.find(p => p.id === id)
    if (!product) return
    app.globalData.selectedProduct = product
    wx.navigateTo({ url: '/pages/supplies-detail/index' })
  }
})
