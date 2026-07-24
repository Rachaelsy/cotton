// pages/supplies-cart/index.js — 购物车
const app = getApp()
const layout = require('../../utils/layout')
const i18n = require('../../utils/i18n')
const auth = require('../../utils/auth')

const COPY = {
  zh: { title:'购物车',piece:'件',done:'完成',manage:'管理',empty:'购物车是空的',browse:'去逛逛',verified:'认证',all:'全选',discount:'已优惠',checkout:'去结算',toggleAll:'全选/取消',delete:'删除',other:'其他商家',max:'最多购买',deleted:'已删除' },
  ug: { title:'ھارۋا',piece:'دانە',done:'تامام',manage:'باشقۇرۇش',empty:'ھارۋا بوش',browse:'مال كۆرۈش',verified:'دەلىللەنگەن',all:'ھەممىنى تاللاش',discount:'ئېتىبار',checkout:'ھېسابلاش',toggleAll:'ھەممىنى تاللاش/بىكار',delete:'ئۆچۈرۈش',other:'باشقا ساتقۇچى',max:'ئەڭ كۆپ سېتىۋالغىلى بولىدۇ',deleted:'ئۆچۈرۈلدى' }
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    cartItems: [],
    cartGroups: [],
    cartCount: 0,
    cartTotal: '0',
    cartDiscount: '0.00',
    quoteError: '',
    manage: false,
    selectedIds: [],
    lang: 'zh',
    copy: COPY.zh,
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })
  },

  onShow() {
    const lang = i18n.getLanguage()
    this.setData({ lang, copy: COPY[lang] || COPY.zh })
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
      const k = item.store || this.data.copy.other
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

    this.setData({
      cartItems: cart,
      cartGroups: Object.values(groupMap),
      cartCount,
      cartTotal,
      cartDiscount: '0.00'
    })
    const quoteVersion = (this._quoteVersion || 0) + 1
    this._quoteVersion = quoteVersion
    this._loadQuote(Object.values(groupMap), quoteVersion)
  },

  async _loadQuote(groups, quoteVersion) {
    let payable = 0
    let discount = 0
    let quoteError = ''
    const quotedGroups = []
    for (const group of groups) {
      try {
        const res = await auth.request('POST', '/api/marketing/quote/best', {
          items: group.items.map(item => ({ id: item.id, qty: item.qty }))
        })
        if (res.code !== 200) throw new Error(res.msg)
        payable += Number(res.data.payable_total || 0)
        discount += Number(res.data.merchant_discount || 0)
        const byId = new Map((res.data.items || []).map(item => [String(item.product_id), item]))
        quotedGroups.push({
          ...group,
          items: group.items.map(item => {
            const line = byId.get(String(item.id))
            return line ? { ...item, estimated_price: (Number(line.subtotal) / Number(item.qty)).toFixed(2), promotion_discount: line.promotion_discount } : item
          })
        })
      } catch (error) {
        if (!quoteError) quoteError = error.message || '优惠价格暂时无法计算'
        quotedGroups.push(group)
        payable += group.items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0)
      }
    }
    if (groups.length && quoteVersion === this._quoteVersion) {
      this.setData({ cartGroups: quotedGroups, cartTotal: payable.toFixed(2), cartDiscount: discount.toFixed(2), quoteError })
    }
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

  // 增加数量（不超过库存上限）
  onQtyPlus(e) {
    const id = e.currentTarget.dataset.id
    const cart = app.globalData.cart
    const item = cart.find(c => c.id === id)
    if (!item) return
    const maxStock = item.stock != null ? item.stock : 9999
    if (item.qty >= maxStock) {
      wx.showToast({ title: `${this.data.copy.max} ${maxStock} ${item.unit || this.data.copy.piece}`, icon: 'none' })
      return
    }
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
    wx.showToast({ title: `${this.data.copy.deleted}${n}${this.data.copy.piece}`, icon: 'none' })
  },

  // 去结算
  onCheckout() {
    if (this.data.cartItems.length === 0) return
    wx.navigateTo({ url: '/subpkg-supplies/supplies-checkout/index' })
  },

})
