// pages/supplies-checkout/index.js — 确认订单 & 支付
const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    cartItems: [],
    cartTotal: '0',
    totalWithFee: '10',
    payMethod: 'wechat',
    submitting: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const cart = app.globalData.cart
    const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      cartItems: cart,
      cartTotal: cartTotal.toFixed(0),
      totalWithFee: (cartTotal + 10).toFixed(0)
    })
  },

  onBack() {
    wx.navigateBack()
  },

  onPayMethod(e) {
    this.setData({ payMethod: e.currentTarget.dataset.method })
  },

  onChangeAddr() {
    wx.showToast({ title: '地址管理开发中', icon: 'none' })
  },

  async onPay() {
    if (this.data.submitting) return
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
      payMethod: this.data.payMethod,
      status: '待发货',
      address: '新疆喀什地区疏附县疏附乡 3号棉田',
      receiverName: '古丽巴哈尔',
      receiverPhone: '138****5678',
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
