// pages/supplies-checkout/index.js — 确认订单 & 支付
const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
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
    if (!receiverName.trim() || !receiverPhone.trim() || !address.trim()) {
      wx.showToast({ title: '请先填写收货信息', icon: 'none' }); return
    }
    this.setData({ submitting: true })

    const order = {
      items: this.data.cartItems.map(ci => ({
        id: ci.id,
        name: ci.name,
        spec: ci.spec,
        price: ci.price,
        qty: ci.qty,
        icon: ci.icon,
        store: ci.store,
        merchant_id: ci.merchant_id
      })),
      subtotal: parseFloat(this.data.cartTotal),
      deliveryFee: 10,
      total: parseFloat(this.data.totalWithFee),
      payMethod: 'wechat',
      status: '待发货',
      address: address.trim(),
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      createTime: Date.now()
    }

    // 提交订单到后端数据库
    const auth = require('../../utils/auth')
    try {
      const res = await auth.request('POST', '/api/orders', {
        items: order.items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        payMethod: order.payMethod,
        receiverName: order.receiverName,
        receiverPhone: order.receiverPhone,
        address: order.address
      })
      if (res.code === 200) {
        order.orderId = res.data.orderId
        order.orderNo = res.data.orderNo
      } else {
        console.warn('订单保存失败:', res.msg)
      }
    } catch (e) {
      console.warn('订单保存异常:', e.message)
    }

    // 将订单存入 globalData 供追踪页使用
    app.globalData.currentOrder = order

    // 清空购物车
    app.clearCart()

    wx.redirectTo({ url: '/pages/supplies-pay-success/index' })
  }
})
