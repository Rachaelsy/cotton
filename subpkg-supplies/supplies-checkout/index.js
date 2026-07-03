// pages/supplies-checkout/index.js — 确认订单 & 支付
const app = getApp()
const layout = require('../../utils/layout')

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    cartItems: [],
    cartTotal: '0',
    totalWithFee: '10',
    submitting: false,
    editingAddr: false,
    receiverName: '',
    receiverPhone: '',
    address: ''
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const cart = app.globalData.cart
    const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
    // 恢复上次填写的收货信息
    let saved = {}
    try { saved = wx.getStorageSync('shipping_address') || {} } catch (e) {}
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      cartItems: cart,
      cartTotal: cartTotal.toFixed(0),
      totalWithFee: (cartTotal + 10).toFixed(0),
      receiverName:  saved.receiverName  || '',
      receiverPhone: saved.receiverPhone || '',
      address:       saved.address       || '',
      // 若没有保存过地址，直接进入编辑模式
      editingAddr: !saved.receiverName
    })
  },

  onBack() {
    wx.navigateBack()
  },

  onNameInput(e)  { this.setData({ receiverName:  e.detail.value }) },
  onPhoneInput(e) { this.setData({ receiverPhone: e.detail.value }) },
  onAddrInput(e)  { this.setData({ address:       e.detail.value }) },

  onEditAddr() {
    this.setData({ editingAddr: true })
  },

  onConfirmAddr() {
    const { receiverName, receiverPhone, address } = this.data
    if (!receiverName.trim())  { wx.showToast({ title: '请填写收货人姓名', icon: 'none' }); return }
    if (!receiverPhone.trim()) { wx.showToast({ title: '请填写手机号',     icon: 'none' }); return }
    if (!address.trim())       { wx.showToast({ title: '请填写收货地址',   icon: 'none' }); return }
    // 持久化，下次进入自动回填
    try {
      wx.setStorageSync('shipping_address', {
        receiverName:  receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        address:       address.trim()
      })
    } catch (e) {}
    this.setData({ editingAddr: false })
  },

  async onPay() {
    if (this.data.submitting) return

    const { receiverName, receiverPhone, address } = this.data
    if (!receiverName.trim()) { wx.showToast({ title: '请填写收货人姓名', icon: 'none' }); return }
    if (!receiverPhone.trim()) { wx.showToast({ title: '请填写手机号', icon: 'none' }); return }
    if (!address.trim()) { wx.showToast({ title: '请填写收货地址', icon: 'none' }); return }
    this.setData({ submitting: true })

    const auth = require('../../utils/auth')
    const shippingInfo = {
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      address: address.trim(),
      payMethod: 'wechat',
      createTime: Date.now()
    }

    // 按商家分组
    const groupMap = {}
    this.data.cartItems.forEach(ci => {
      const key = ci.merchant_id || ci.store || '__unknown__'
      if (!groupMap[key]) groupMap[key] = { store: ci.store, merchant_id: ci.merchant_id, items: [] }
      groupMap[key].items.push(ci)
    })
    const groups = Object.values(groupMap)

    const createdOrders = []
    for (const group of groups) {
      const subtotal = group.items.reduce((s, c) => s + c.price * c.qty, 0)
      const deliveryFee = 10
      const total = subtotal + deliveryFee
      const orderItems = group.items.map(ci => ({
        id: ci.id, name: ci.name, spec: ci.spec,
        price: ci.price, qty: ci.qty, icon: ci.icon,
        store: ci.store, merchant_id: ci.merchant_id
      }))
      const orderObj = {
        store: group.store,
        items: orderItems,
        subtotal,
        deliveryFee,
        total,
        ...shippingInfo
      }
      // Bug5: 下单失败时终止流程并提示
      try {
        const res = await auth.request('POST', '/api/orders', {
          items: orderItems,
          subtotal,
          deliveryFee,
          total,
          payMethod: shippingInfo.payMethod,
          receiverName: shippingInfo.receiverName,
          receiverPhone: shippingInfo.receiverPhone,
          address: shippingInfo.address
        })
        if (res.code === 200) {
          orderObj.orderId = res.data.orderId
          orderObj.orderNo = res.data.orderNo
        } else {
          this.setData({ submitting: false })
          wx.showModal({ title: '下单失败', content: res.msg || '提交订单失败，请重试', showCancel: false })
          return
        }
      } catch (e) {
        this.setData({ submitting: false })
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
        return
      }
      createdOrders.push(orderObj)
    }

    // 存入 globalData 供支付成功页使用
    app.globalData.currentOrders = createdOrders
    // 保持旧字段兼容（取第一个）
    app.globalData.currentOrder = createdOrders[0] || null

    // 清空购物车
    app.clearCart()

    wx.redirectTo({ url: '/subpkg-supplies/supplies-pay/index' })
  }
})
