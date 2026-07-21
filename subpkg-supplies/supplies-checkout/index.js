// pages/supplies-checkout/index.js — 确认订单 & 支付
const app = getApp()
const layout = require('../../utils/layout')
const i18n = require('../../utils/i18n')

const COPY = {
  zh: { title:'确认订单',shipping:'收货信息',fill:'请填写收货信息',edit:'编辑',fillAddress:'+ 填写地址',name:'收货人姓名',phone:'手机号',address:'省市区乡镇 详细地址',chooseLocation:'地图选择收货位置',locationSelected:'已选择配送位置',confirm:'确定',goods:'订单商品',discount:'优惠',autoPromo:'商品活动优惠',coupon:'优惠券',noCoupon:'不使用优惠券',delivery:'配送方式',deliveryWay:'送货到地头',payment:'支付方式',wechat:'微信支付',safe:'快捷安全',remark:'订单备注',remarkPh:'如有特殊要求请填写…',subtotal:'商品原价',saved:'商户优惠',fee:'运费',submit:'提交订单',submitting:'提交中…',needName:'请填写收货人姓名',needPhone:'请填写手机号',needAddress:'请填写收货地址',locationPermission:'需要位置权限才能选择收货位置',settings:'去设置',orderFail:'下单失败',orderFailDesc:'提交订单失败，请重试',network:'网络异常，请重试' },
  ug: { title:'زاكازنى جەزملەش',shipping:'تاپشۇرۇۋېلىش ئۇچۇرى',fill:'تاپشۇرۇۋېلىش ئۇچۇرىنى تولدۇرۇڭ',edit:'تەھرىرلەش',fillAddress:'+ ئادرېس تولدۇرۇش',name:'تاپشۇرۇۋالغۇچى نامى',phone:'تېلېفون نومۇرى',address:'رايون، يېزا ۋە تەپسىلىي ئادرېس',chooseLocation:'خەرىتىدىن ئادرېس تاللاش',locationSelected:'يەتكۈزۈش ئورنى تاللاندى',confirm:'جەزملەش',goods:'زاكاز مەھسۇلاتى',discount:'ئېتىبار',autoPromo:'مەھسۇلات ئېتىبارى',coupon:'ئېتىبار بېلىتى',noCoupon:'بېلەت ئىشلەتمەسلىك',delivery:'يەتكۈزۈش ئۇسۇلى',deliveryWay:'ئېتىز بېشىغىچە يەتكۈزۈش',payment:'تۆلەش ئۇسۇلى',wechat:'WeChat تۆلەش',safe:'تېز ۋە بىخەتەر',remark:'زاكاز ئىزاھى',remarkPh:'ئالاھىدە تەلەپ بولسا يېزىڭ…',subtotal:'مەھسۇلات ئەسلى باھاسى',saved:'سودىگەر ئېتىبارى',fee:'توشۇش ھەققى',submit:'زاكاز تاپشۇرۇش',submitting:'تاپشۇرۇۋاتىدۇ…',needName:'تاپشۇرۇۋالغۇچى نامىنى تولدۇرۇڭ',needPhone:'تېلېفوننى تولدۇرۇڭ',needAddress:'ئادرېسنى تولدۇرۇڭ',locationPermission:'ئورۇن ئىجازىتى كېرەك',settings:'تەڭشەك',orderFail:'زاكاز مەغلۇپ',orderFailDesc:'زاكاز تاپشۇرۇلمىدى، قايتا سىناڭ',network:'تور نورمال ئەمەس، قايتا سىناڭ' }
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
    orderGroups: [],
    promotionDiscount: '0.00',
    couponDiscount: '0.00',
    merchantDiscount: '0.00',
    marketingLoading: true,
    deliveryFee: DELIVERY_FEE,
    totalWithFee: '0',
    submitting: false,
    editingAddr: false,
    receiverName: '',
    receiverPhone: '',
    address: '',
    addressLatitude: null,
    addressLongitude: null
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const cart = app.globalData.cart
    const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
    // 恢复上次填写的收货信息
    let saved = {}
    try { saved = wx.getStorageSync('shipping_address') || {} } catch (e) {}
    const orderGroups = this._groupCart(cart)
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight(),
      cartItems: cart,
      orderGroups,
      cartTotal: cartTotal.toFixed(2),
      deliveryFee: DELIVERY_FEE,
      totalWithFee: (cartTotal + DELIVERY_FEE).toFixed(2),
      receiverName:  saved.receiverName  || '',
      receiverPhone: saved.receiverPhone || '',
      address:       saved.address       || '',
      addressLatitude: saved.addressLatitude != null && Number.isFinite(Number(saved.addressLatitude)) ? Number(saved.addressLatitude) : null,
      addressLongitude: saved.addressLongitude != null && Number.isFinite(Number(saved.addressLongitude)) ? Number(saved.addressLongitude) : null,
      // 若没有保存过地址，直接进入编辑模式
      editingAddr: !saved.receiverName
    })
    this._loadMarketing(orderGroups)
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
  onAddrInput(e)  { this.setData({ address: e.detail.value, addressLatitude: null, addressLongitude: null }) },

  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        const address = [res.address, res.name].filter(Boolean).join(' ')
        this.setData({
          address: address || this.data.address,
          addressLatitude: Number(res.latitude),
          addressLongitude: Number(res.longitude)
        })
      },
      fail: (error) => {
        if (error.errMsg && error.errMsg.includes('auth')) {
          wx.showModal({
            title: this.data.copy.locationPermission,
            content: this.data.copy.locationPermission,
            confirmText: this.data.copy.settings,
            success: result => { if (result.confirm) wx.openSetting() }
          })
        }
      }
    })
  },

  onEditAddr() {
    this.setData({ editingAddr: true })
  },

  onConfirmAddr() {
    const { receiverName, receiverPhone, address, addressLatitude, addressLongitude } = this.data
    if (!receiverName.trim())  { wx.showToast({ title: this.data.copy.needName, icon: 'none' }); return }
    if (!receiverPhone.trim()) { wx.showToast({ title: this.data.copy.needPhone, icon: 'none' }); return }
    if (!address.trim())       { wx.showToast({ title: this.data.copy.needAddress, icon: 'none' }); return }
    // 持久化，下次进入自动回填
    try {
      wx.setStorageSync('shipping_address', {
        receiverName:  receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        address:       address.trim(),
        addressLatitude,
        addressLongitude
      })
    } catch (e) {}
    this.setData({ editingAddr: false })
  },

  _groupCart(cart) {
    const map = {}
    cart.forEach(item => {
      const key = String(item.merchant_id || item.store || '__unknown__')
      if (!map[key]) map[key] = { key, store: item.store || item.company_name || '认证商户', merchant_id: Number(item.merchant_id) || 0, items: [] }
      map[key].items.push(item)
    })
    return Object.values(map).map(group => {
      const original = group.items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0)
      return {
        ...group,
        original_subtotal: original.toFixed(2),
        promotion_discount: '0.00',
        coupon_discount: '0.00',
        payable_total: original.toFixed(2),
        couponOptions: [{ user_coupon_id: null, label: this.data.copy.noCoupon }],
        selectedCouponIndex: 0,
        selectedCouponLabel: this.data.copy.noCoupon,
        user_coupon_id: null
      }
    })
  },

  async _quoteGroup(group, userCouponId = null) {
    const auth = require('../../utils/auth')
    const res = await auth.request('POST', '/api/marketing/quote', {
      items: group.items.map(item => ({ id: item.id, qty: item.qty })),
      user_coupon_id: userCouponId || undefined
    })
    if (res.code !== 200) throw new Error(res.msg || '优惠计算失败')
    return res.data
  },

  async _loadMarketing(groups) {
    const auth = require('../../utils/auth')
    let coupons = []
    if (auth.isLoggedIn()) {
      try {
        const mine = await auth.request('GET', '/api/marketing/coupons/mine?status=available')
        if (mine.code === 200) coupons = mine.data || []
      } catch { coupons = [] }
    }
    const pricedGroups = []
    for (const group of groups) {
      try {
        const baseQuote = await this._quoteGroup(group)
        const merchantId = Number(baseQuote.merchant_id || group.merchant_id)
        const eligible = coupons.filter(coupon => Number(coupon.merchant_id) === merchantId).slice(0, 20)
        const couponOptions = [{ user_coupon_id: null, label: this.data.copy.noCoupon, quote: baseQuote }]
        const unavailableReasons = []
        let bestIndex = 0
        let bestTotal = Number(baseQuote.payable_total)
        for (const coupon of eligible) {
          try {
            const quote = await this._quoteGroup(group, coupon.user_coupon_id)
            if (!quote.coupon_applied) {
              if (quote.coupon_reason) unavailableReasons.push(`${coupon.name}：${quote.coupon_reason}`)
              continue
            }
            couponOptions.push({
              user_coupon_id: coupon.user_coupon_id,
              label: `${coupon.label} · ${coupon.name}`,
              quote
            })
            if (Number(quote.payable_total) < bestTotal) {
              bestTotal = Number(quote.payable_total)
              bestIndex = couponOptions.length - 1
            }
          } catch (error) {
            unavailableReasons.push(`${coupon.name}：${error.message || '当前不可用'}`)
          }
        }
        const selected = couponOptions[bestIndex]
        pricedGroups.push({ ...group, merchant_id: merchantId, ...selected.quote, items: group.items, couponOptions, selectedCouponIndex: bestIndex, selectedCouponLabel: selected.label, user_coupon_id: selected.user_coupon_id, couponHint: bestIndex === 0 ? (unavailableReasons[0] || '') : '', marketingError: '' })
      } catch (error) {
        pricedGroups.push({ ...group, marketingError: error.message || '优惠价格暂时无法计算' })
      }
    }
    this._applyMarketingGroups(pricedGroups)
  },

  _applyMarketingGroups(groups) {
    const sum = field => groups.reduce((total, group) => total + Number(group[field] || 0), 0)
    const original = sum('original_subtotal')
    const promotion = sum('promotion_discount')
    const coupon = sum('coupon_discount')
    const total = sum('payable_total') + DELIVERY_FEE
    this.setData({
      orderGroups: groups,
      cartTotal: original.toFixed(2),
      promotionDiscount: promotion.toFixed(2),
      couponDiscount: coupon.toFixed(2),
      merchantDiscount: (promotion + coupon).toFixed(2),
      totalWithFee: total.toFixed(2),
      marketingLoading: false
    })
  },

  async onCouponChange(e) {
    if (this.data.marketingLoading) return
    const groupIndex = Number(e.currentTarget.dataset.index)
    const selectedCouponIndex = Number(e.detail.value)
    const groups = this.data.orderGroups.slice()
    const group = groups[groupIndex]
    const option = group && group.couponOptions[selectedCouponIndex]
    if (!group || !option) return
    this.setData({ marketingLoading: true })
    try {
      const quote = option.quote || await this._quoteGroup(group, option.user_coupon_id)
      groups[groupIndex] = { ...group, ...quote, items: group.items, selectedCouponIndex, selectedCouponLabel: option.label, user_coupon_id: option.user_coupon_id }
      this._applyMarketingGroups(groups)
    } catch (error) {
      this.setData({ marketingLoading: false })
      wx.showToast({ title: error.message || '优惠券不可用', icon: 'none' })
    }
  },

  async onPay() {
    if (this.data.submitting) return
    if (this.data.marketingLoading) { wx.showToast({ title: '优惠正在计算，请稍候', icon: 'none' }); return }

    const { receiverName, receiverPhone, address, addressLatitude, addressLongitude } = this.data
    if (!receiverName.trim()) { wx.showToast({ title: this.data.copy.needName, icon: 'none' }); return }
    if (!receiverPhone.trim()) { wx.showToast({ title: this.data.copy.needPhone, icon: 'none' }); return }
    if (!address.trim()) { wx.showToast({ title: this.data.copy.needAddress, icon: 'none' }); return }
    this.setData({ submitting: true })

    const auth = require('../../utils/auth')
    const shippingInfo = {
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      address: address.trim(),
      addressLatitude,
      addressLongitude,
      payMethod: 'wechat',
      createTime: Date.now()
    }

    const groups = this.data.orderGroups

    const createdOrders = []
    for (const group of groups) {
      const subtotal = group.items.reduce((s, c) => s + c.price * c.qty, 0)
      const deliveryFee = DELIVERY_FEE
      const total = subtotal + deliveryFee
      const orderItems = group.items.map(ci => ({
        id: ci.id != null ? ci.id : ci.product_id, name: ci.name, spec: ci.spec,
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
          address: shippingInfo.address,
          receiverLatitude: shippingInfo.addressLatitude,
          receiverLongitude: shippingInfo.addressLongitude,
          user_coupon_id: group.user_coupon_id || undefined
        })
        if (res.code === 200) {
          orderObj.orderId = res.data.orderId
          orderObj.orderNo = res.data.orderNo
          orderObj.subtotal = res.data.subtotal !== undefined ? res.data.subtotal : orderObj.subtotal
          orderObj.deliveryFee = res.data.deliveryFee !== undefined ? res.data.deliveryFee : orderObj.deliveryFee
          orderObj.total = res.data.total !== undefined ? res.data.total : orderObj.total
          orderObj.originalSubtotal = res.data.originalSubtotal
          orderObj.promotionDiscount = res.data.promotionDiscount
          orderObj.couponDiscount = res.data.couponDiscount
          orderObj.merchantDiscount = res.data.merchantDiscount
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
