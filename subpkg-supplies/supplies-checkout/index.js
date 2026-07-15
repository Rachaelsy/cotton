// pages/supplies-checkout/index.js — 确认订单 & 支付
const app = getApp()
const layout = require('../../utils/layout')
const i18n = require('../../utils/i18n')

const COPY = {
  zh: { title:'确认订单',shipping:'收货信息',fill:'请填写收货信息',edit:'编辑',fillAddress:'+ 填写地址',name:'收货人姓名',phone:'手机号',address:'省市区乡镇 详细地址',confirm:'确定',goods:'订单商品',delivery:'配送方式',deliveryWay:'送货到地头',payment:'支付方式',wechat:'微信支付',safe:'快捷安全',remark:'订单备注',remarkPh:'如有特殊要求请填写…',subtotal:'商品合计',fee:'运费',submit:'提交订单',submitting:'提交中…',needName:'请填写收货人姓名',needPhone:'请填写手机号',needAddress:'请填写收货地址',orderFail:'下单失败',orderFailDesc:'提交订单失败，请重试',network:'网络异常，请重试' },
  ug: { title:'زاكازنى جەزملەش',shipping:'تاپشۇرۇۋېلىش ئۇچۇرى',fill:'تاپشۇرۇۋېلىش ئۇچۇرىنى تولدۇرۇڭ',edit:'تەھرىرلەش',fillAddress:'+ ئادرېس تولدۇرۇش',name:'تاپشۇرۇۋالغۇچى نامى',phone:'تېلېفون نومۇرى',address:'رايون، يېزا ۋە تەپسىلىي ئادرېس',confirm:'جەزملەش',goods:'زاكاز مەھسۇلاتى',delivery:'يەتكۈزۈش ئۇسۇلى',deliveryWay:'ئېتىز بېشىغىچە يەتكۈزۈش',payment:'تۆلەش ئۇسۇلى',wechat:'WeChat تۆلەش',safe:'تېز ۋە بىخەتەر',remark:'زاكاز ئىزاھى',remarkPh:'ئالاھىدە تەلەپ بولسا يېزىڭ…',subtotal:'مەھسۇلات جەمئىي',fee:'توشۇش ھەققى',submit:'زاكاز تاپشۇرۇش',submitting:'تاپشۇرۇۋاتىدۇ…',needName:'تاپشۇرۇۋالغۇچى نامىنى تولدۇرۇڭ',needPhone:'تېلېفوننى تولدۇرۇڭ',needAddress:'ئادرېسنى تولدۇرۇڭ',orderFail:'زاكاز مەغلۇپ',orderFailDesc:'زاكاز تاپشۇرۇلمىدى، قايتا سىناڭ',network:'تور نورمال ئەمەس، قايتا سىناڭ' }
}

const DELIVERY_FEE = 0

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: COPY[i18n.getLanguage()],
    capsuleSafeRight: 0,
    cartItems: [],
    cartTotal: '0',
    deliveryFee: DELIVERY_FEE,
    totalWithFee: '0',
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
      cartTotal: cartTotal.toFixed(2),
      deliveryFee: DELIVERY_FEE,
      totalWithFee: (cartTotal + DELIVERY_FEE).toFixed(2),
      receiverName:  saved.receiverName  || '',
      receiverPhone: saved.receiverPhone || '',
      address:       saved.address       || '',
      // 若没有保存过地址，直接进入编辑模式
      editingAddr: !saved.receiverName
    })
  },

  onShow() {
    const lang = i18n.getLanguage()
    if (lang !== this.data.lang) this.setData({ lang, copy: COPY[lang] })
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
    if (!receiverName.trim())  { wx.showToast({ title: this.data.copy.needName, icon: 'none' }); return }
    if (!receiverPhone.trim()) { wx.showToast({ title: this.data.copy.needPhone, icon: 'none' }); return }
    if (!address.trim())       { wx.showToast({ title: this.data.copy.needAddress, icon: 'none' }); return }
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
    if (!receiverName.trim()) { wx.showToast({ title: this.data.copy.needName, icon: 'none' }); return }
    if (!receiverPhone.trim()) { wx.showToast({ title: this.data.copy.needPhone, icon: 'none' }); return }
    if (!address.trim()) { wx.showToast({ title: this.data.copy.needAddress, icon: 'none' }); return }
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
      const deliveryFee = DELIVERY_FEE
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
          orderObj.subtotal = res.data.subtotal !== undefined ? res.data.subtotal : orderObj.subtotal
          orderObj.deliveryFee = res.data.deliveryFee !== undefined ? res.data.deliveryFee : orderObj.deliveryFee
          orderObj.total = res.data.total !== undefined ? res.data.total : orderObj.total
        } else {
          this.setData({ submitting: false })
          wx.showModal({ title: this.data.copy.orderFail, content: res.msg || this.data.copy.orderFailDesc, showCancel: false })
          return
        }
      } catch (e) {
        this.setData({ submitting: false })
        wx.showToast({ title: this.data.copy.network, icon: 'none' })
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
