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
        store: ci.store
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

    // 保存订单到云数据库
    try {
      if (wx.cloud) {
        const db = wx.cloud.database()
        const res = await db.collection('orders').add({ data: order })
        order.orderId = res._id
      }
    } catch (e) {
      console.warn('订单保存失败:', e.message)
    }

    // 将订单存入 globalData 供追踪页使用
    app.globalData.currentOrder = order

    // 清空购物车
    app.clearCart()

    wx.showToast({ title: '支付成功！', icon: 'success', duration: 1200 })

    setTimeout(() => {
      wx.redirectTo({ url: '/pages/supplies-order/index' })
    }, 1200)
  }
})
