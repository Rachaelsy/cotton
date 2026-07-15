// pages/supplies-order/index.js — 订单详情
const app  = getApp()
const auth = require('../../utils/auth')
const layout = require('../../utils/layout')
const i18n = require('../../utils/i18n')

const COPY = {
  zh: {
    title: '订单详情', address: '收货信息', goods: '订单商品', info: '订单信息', orderNo: '订单编号', copy: '复制',
    payMethod: '支付方式', logisticsNo: '物流单号', subtotal: '商品合计', freight: '运费', paid: '实付金额',
    logistics: '物流动态', querying: '查询中', refresh: '刷新', waitingPickup: '等待揽收', arrivalPrefix: '预计 ',
    arrivalSuffix: ' 送达', shippedWaiting: '商家已发货，等待快递公司揽收', updatedAt: '更新于 ',
    logisticsDisabled: '物流查询服务尚未配置，当前仅显示商家填写的发货信息。', queryingTrack: '正在查询真实物流轨迹...',
    noTrack: '快递公司暂未返回轨迹，请稍后再看', collapseTrack: '收起物流轨迹', expandTrack: '查看全部物流轨迹',
    aftersaleDetail: '售后申请详情', aftersaleType: '售后类型', reason: '申请原因', description: '问题描述',
    handleStatus: '处理状态', merchantReply: '商家回复', reviewed: '已评价', review: '去评价', contactMerchant: '联系商家',
    applyAftersale: '申请售后', confirmReceipt: '确认收货', contactSeller: '联系卖家', refundAftersale: '退款/售后',
    viewLogistics: '查看物流', notShipped: '未发货', receiptSuccess: '收货成功', receiptThanks: '交易已完成，感谢您的购买！',
    finish: '完成', wechatPay: '微信支付', alipay: '支付宝', bank: '银行卡', copied: '已复制', loadLogisticsFail: '物流加载失败',
    logisticsUpdated: '物流已更新', noNewTrack: '暂无新轨迹', logisticsUnavailable: '物流服务暂时不可用',
    merchantWechatCopied: '商家微信已复制，请打开微信添加', noMerchantContact: '暂无商家联系方式', confirmTitle: '确认收货',
    confirmContent: '确认已收到商品？确认后订单将完成，无法申请退款。', wait: '再等等', operationFail: '操作失败',
    networkError: '网络异常，请重试', alreadyReviewed: '已评价过该订单', merchantNotShipped: '商家尚未发货',
    noLogisticsNo: '商家暂未填写物流单号', steps: ['已下单', '待发货', '已发货', '已完成'],
    aftersale: { pending: '待处理', approved: '已同意', rejected: '已拒绝', refunded: '退款成功' }
  },
  ug: {
    title: 'زاكاز تەپسىلاتى', address: 'تاپشۇرۇۋېلىش ئۇچۇرى', goods: 'زاكاز ماللىرى', info: 'زاكاز ئۇچۇرى', orderNo: 'زاكاز نومۇرى', copy: 'كۆچۈرۈش',
    payMethod: 'تۆلەش ئۇسۇلى', logisticsNo: 'يەتكۈزۈش نومۇرى', subtotal: 'مال سوممىسى', freight: 'توشۇش ھەققى', paid: 'تۆلەنگەن پۇل',
    logistics: 'يەتكۈزۈش ئەھۋالى', querying: 'سۈرۈشتۈرۈۋاتىدۇ', refresh: 'يېڭىلاش', waitingPickup: 'قوبۇل قىلىشنى كۈتۈۋاتىدۇ', arrivalPrefix: 'مۆلچەر ',
    arrivalSuffix: ' يېتىپ بارىدۇ', shippedWaiting: 'ساتقۇچى ئەۋەتتى، تېز يوللانمىنىڭ قوبۇل قىلىشىنى كۈتۈۋاتىدۇ', updatedAt: 'يېڭىلانغان ۋاقىت: ',
    logisticsDisabled: 'يەتكۈزۈش سۈرۈشتۈرۈش مۇلازىمىتى سەپلەنمىگەن، ھازىر پەقەت ساتقۇچى كىرگۈزگەن ئۇچۇر كۆرسىتىلىدۇ.', queryingTrack: 'ھەقىقىي يەتكۈزۈش يولى سۈرۈشتۈرۈلۈۋاتىدۇ...',
    noTrack: 'تېز يوللانما شىركىتى تېخى يول ئۇچۇرى قايتۇرمىدى', collapseTrack: 'يول ئۇچۇرىنى يىغىش', expandTrack: 'بارلىق يول ئۇچۇرىنى كۆرۈش',
    aftersaleDetail: 'سېتىشتىن كېيىنكى ئىلتىماس', aftersaleType: 'ئىلتىماس تۈرى', reason: 'ئىلتىماس سەۋەبى', description: 'مەسىلە چۈشەندۈرۈشى',
    handleStatus: 'بىر تەرەپ قىلىش ھالىتى', merchantReply: 'ساتقۇچى جاۋابى', reviewed: 'باھالاندى', review: 'باھالاش', contactMerchant: 'ساتقۇچى بىلەن ئالاقىلىشىش',
    applyAftersale: 'سېتىشتىن كېيىنكى مۇلازىمەت', confirmReceipt: 'تاپشۇرۇۋالغاننى جەزملەش', contactSeller: 'ساتقۇچى بىلەن ئالاقىلىشىش', refundAftersale: 'پۇل قايتۇرۇش',
    viewLogistics: 'يەتكۈزۈشنى كۆرۈش', notShipped: 'ئەۋەتىلمىدى', receiptSuccess: 'تاپشۇرۇۋېلىندى', receiptThanks: 'سودا تاماملاندى، سېتىۋالغانلىقىڭىزغا رەھمەت!',
    finish: 'تامام', wechatPay: 'ۋېيشىن تۆلىمى', alipay: 'جىفۇباۋ', bank: 'بانكا كارتىسى', copied: 'كۆچۈرۈلدى', loadLogisticsFail: 'يەتكۈزۈش ئۇچۇرى يۈكلەنمىدى',
    logisticsUpdated: 'يەتكۈزۈش ئۇچۇرى يېڭىلاندى', noNewTrack: 'يېڭى يول ئۇچۇرى يوق', logisticsUnavailable: 'يەتكۈزۈش مۇلازىمىتى ۋاقىتلىق ئىشلىمەيدۇ',
    merchantWechatCopied: 'ساتقۇچىنىڭ ۋېيشىنى كۆچۈرۈلدى', noMerchantContact: 'ساتقۇچىنىڭ ئالاقە ئۇچۇرى يوق', confirmTitle: 'تاپشۇرۇۋېلىشنى جەزملەش',
    confirmContent: 'مالنى تاپشۇرۇۋالدىڭىزمۇ؟ جەزملەشتۈرگەندىن كېيىن زاكاز تاماملىنىدۇ.', wait: 'سەل كۈتۈش', operationFail: 'مەشغۇلات مەغلۇپ بولدى',
    networkError: 'تور نورمال ئەمەس، قايتا سىناڭ', alreadyReviewed: 'بۇ زاكاز باھالانغان', merchantNotShipped: 'ساتقۇچى تېخى ئەۋەتمىدى',
    noLogisticsNo: 'ساتقۇچى يەتكۈزۈش نومۇرىنى تېخى كىرگۈزمىدى', steps: ['زاكاز قىلىندى', 'ئەۋەتىشنى كۈتۈش', 'ئەۋەتىلدى', 'تاماملاندى'],
    aftersale: { pending: 'بىر تەرەپ قىلىشنى كۈتۈۋاتىدۇ', approved: 'ماقۇللاندى', rejected: 'رەت قىلىندى', refunded: 'پۇل قايتۇرۇلدى' }
  }
}

const STATUS_COPY = {
  zh: {
    '待付款': ['待付款', '订单尚未完成支付'], '待发货': ['待发货', '商家正在备货，请耐心等待'],
    '已发货': ['配送中', '商品已发出，预计近日送达'], '已完成': ['已完成', '订单已完成，感谢您的购买'],
    '售后中': ['售后中', '退款/售后处理中，请耐心等待'], '售后完成': ['售后完成', '售后已处理完毕'],
    '已取消': ['已取消', '订单已取消']
  },
  ug: {
    '待付款': ['تۆلەم كۈتۈۋاتىدۇ', 'زاكاز تېخى تۆلەنمىدى'], '待发货': ['ئەۋەتىشنى كۈتۈۋاتىدۇ', 'ساتقۇچى مال تەييارلاۋاتىدۇ'],
    '已发货': ['يەتكۈزۈلۈۋاتىدۇ', 'مال ئەۋەتىلدى'], '已完成': ['تاماملاندى', 'زاكاز تاماملاندى'],
    '售后中': ['بىر تەرەپ قىلىنىۋاتىدۇ', 'پۇل قايتۇرۇش ئىلتىماسى بىر تەرەپ قىلىنىۋاتىدۇ'],
    '售后完成': ['بىر تەرەپ قىلىندى', 'سېتىشتىن كېيىنكى مۇلازىمەت تاماملاندى'], '已取消': ['بىكار قىلىندى', 'زاكاز بىكار قىلىندى']
  }
}

// DB status → 中文状态
const DB_STATUS_MAP = {
  pending_payment: '待付款',
  pending_ship: '待发货',
  shipped:      '已发货',
  completed:    '已完成',
  refund:       '售后中',
  refunded:     '售后完成',
  cancelled:    '已取消'
}

const STATUS_CONFIG = {
  '待付款': {
    icon: '¥',
    label: '待付款',
    sub: '订单尚未完成支付',
    stepIndex: 0,
    shipped: false
  },
  '待发货': {
    icon: '📦',
    label: '待发货',
    sub: '商家正在备货，请耐心等待',
    stepIndex: 1,
    shipped: false
  },
  '已发货': {
    icon: '🚚',
    label: '配送中',
    sub: '商品已发出，预计近日送达',
    stepIndex: 2,
    shipped: true
  },
  '已完成': {
    icon: '✅',
    label: '已完成',
    sub: '订单已完成，感谢您的购买',
    stepIndex: 3,
    shipped: true
  },
  '售后中': {
    icon: '🔄',
    label: '售后中',
    sub: '退款/售后处理中，请耐心等待',
    stepIndex: 1,
    shipped: false
  },
  '售后完成': {
    icon: '🔁',
    label: '售后完成',
    sub: '售后已处理完毕',
    stepIndex: 3,
    shipped: true
  },
  '已取消': {
    icon: '✕',
    label: '已取消',
    sub: '订单已取消',
    stepIndex: 0,
    shipped: false
  }
}

const STEPS = ['已下单', '待发货', '已发货', '已完成']

function normalizeStatus(status) {
  if (!status) return '待发货'
  if (DB_STATUS_MAP[status]) return DB_STATUS_MAP[status]
  if (STATUS_CONFIG[status]) return status
  return '待发货'
}

function aftersaleStatusLabel(aftersaleStatus, orderStatus, copy) {
  if (orderStatus === '售后完成') return copy.aftersale.refunded
  const map = copy.aftersale
  return map[aftersaleStatus] || aftersaleStatus || ''
}

function aftersaleStatusClass(aftersaleStatus, orderStatus) {
  if (orderStatus === '售后完成' || aftersaleStatus === 'approved') return 'approved'
  if (aftersaleStatus === 'rejected') return 'rejected'
  return 'pending'
}

Page({
  data: {
    lang: 'zh',
    copy: COPY.zh,
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    order: { merchantPhone: '', merchantWechat: '' },
    orderNo: '',
    payMethodLabel: '微信支付',
    statusIcon: '📦',
    statusLabel: '待发货',
    statusSub: '商家正在备货，请耐心等待',
    steps: [],
    shipped: false,
    canConfirmReceipt: false,
    isCompleted: false,
    hasReviewed: false,
    showSuccessPopup: false,
    aftersale: null,
    logistics: null,
    logisticsLoading: false,
    logisticsExpanded: false
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    const lang = i18n.getLanguage()
    this.setData({ lang, copy: COPY[lang], statusBarHeight: info.statusBarHeight || 20, capsuleSafeRight: layout.getCapsuleSafeRight() })
    this._loadOrder()
  },

  onShow() {
    const lang = i18n.getLanguage()
    this.setData({ lang, copy: COPY[lang] })
    this._loadOrder()
  },

  async _loadOrder() {
    const lang = i18n.getLanguage()
    const copy = COPY[lang]
    const saved = app.globalData.currentOrder || {}
    let order = { ...saved }

    // 每次展示都从 API 刷新最新状态，避免发货后本地缓存仍显示旧值
    if (saved.orderId) {
      try {
        const res = await auth.request('GET', '/api/orders/my')
        if (res.code === 200 && Array.isArray(res.data)) {
          const fresh = res.data.find(o => String(o.id) === String(saved.orderId))
          if (fresh) {
            order.status       = normalizeStatus(fresh.status)
            order.logisticsNo  = fresh.logistics_no || ''
            order.logisticsCompany = fresh.logistics_company || ''
            order.logisticsCompanyName = fresh.logistics_company_name || ''
            order.logisticsStatus = fresh.logistics_status || ''
            order.logisticsLatest = fresh.logistics_latest || ''
            order.logisticsUpdatedAt = fresh.logistics_updated_at || ''
            order.has_reviewed = fresh.has_reviewed
          }
        }
      } catch (e) {
        // 网络异常时保持本地缓存数据，不阻断页面展示
      }
    }

    const payLabels = { alipay: copy.alipay, wechat: copy.wechatPay, bank: copy.bank }
    const no = order.orderNo
      || (order.orderId ? String(order.orderId).slice(-10).toUpperCase()
                        : 'MG' + Date.now().toString().slice(-10))

    const status = normalizeStatus(order.status)
    order.status = status
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['待发货']
    const displayStatus = STATUS_COPY[lang][status] || STATUS_COPY[lang]['待发货']

    const stepIndex = cfg.stepIndex
    const steps = STEPS.map((label, i) => ({
      label: copy.steps[i],
      done: i < stepIndex,
      active: i === stepIndex
    }))

    this.setData({
      order,
      orderNo: no,
      lang,
      copy,
      payMethodLabel: payLabels[order.payMethod] || copy.wechatPay,
      statusIcon: cfg.icon,
      statusLabel: displayStatus[0],
      statusSub: displayStatus[1],
      steps,
      shipped: cfg.shipped,
      canConfirmReceipt: status === '已发货',
      isCompleted:       status === '已完成',
      hasReviewed:       !!(order.has_reviewed)
    })

    // 拉取售后信息（有则显示，不限订单状态——处理完后仍可查看结果）
    if (saved.orderId) {
      try {
        const ar = await auth.request('GET', `/api/orders/${saved.orderId}/aftersale`)
        if (ar.code === 200 && ar.data) {
          this.setData({
            aftersale: {
              ...ar.data,
              aftersale_type_display: i18n.localizeText(ar.data.aftersale_type || '', lang),
              reason_display: i18n.localizeText(ar.data.reason === '其他' ? ar.data.other_reason : ar.data.reason, lang),
              statusLabel: aftersaleStatusLabel(ar.data.status, status, copy),
              displayStatus: aftersaleStatusClass(ar.data.status, status)
            }
          })
        } else {
          this.setData({ aftersale: null })
        }
      } catch {}
    }

    if (order.logisticsNo && cfg.shipped) {
      await this._loadLogistics(false)
    } else {
      this.setData({ logistics: null, logisticsExpanded: false })
    }
  },

  async _loadLogistics(refresh) {
    const orderId = this.data.order.orderId || app.globalData.currentOrder?.orderId
    if (!orderId) return
    this.setData({ logisticsLoading: true })
    try {
      const path = `/api/logistics/orders/${orderId}${refresh ? '?refresh=1' : ''}`
      const result = await auth.request('GET', path)
      if (result.code !== 200) {
        this.setData({ logisticsLoading: false })
        wx.showToast({ title: result.msg || this.data.copy.loadLogisticsFail, icon: 'none' })
        return
      }
      const data = result.data || {}
      const events = (data.events || []).map((event, index) => ({
        ...event,
        current: index === 0,
        timeText: String(event.time || '').replace('T', ' ').slice(0, 16)
      }))
      this.setData({
        logistics: {
          ...data,
          events,
          state_label: i18n.localizeText(data.state_label || '', this.data.lang),
          latestText: i18n.localizeText(data.latest || events[0]?.context || this.data.copy.shippedWaiting, this.data.lang),
          updatedText: String(data.updated_at || data.queried_at || '').replace('T', ' ').slice(0, 16)
        },
        logisticsLoading: false
      })
      if (refresh) wx.showToast({ title: events.length ? this.data.copy.logisticsUpdated : this.data.copy.noNewTrack, icon: 'none' })
    } catch (error) {
      this.setData({ logisticsLoading: false })
      wx.showToast({ title: this.data.copy.logisticsUnavailable, icon: 'none' })
    }
  },

  onBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  onCopyNo() {
    wx.setClipboardData({
      data: this.data.orderNo,
      success: () => wx.showToast({ title: this.data.copy.copied, icon: 'success', duration: 1000 })
    })
  },

  onContact() {
    const phone   = this.data.order.merchantPhone
    const wechat  = this.data.order.merchantWechat
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone })
      return
    }
    if (wechat) {
      wx.setClipboardData({
        data: wechat,
        success: () => wx.showToast({ title: this.data.copy.merchantWechatCopied, icon: 'none', duration: 2500 })
      })
      return
    }
    wx.showToast({ title: this.data.copy.noMerchantContact, icon: 'none' })
  },

  onAfterSale() {
    const orderId = this.data.order.orderId
    wx.navigateTo({ url: `/subpkg-supplies/supplies-aftersale/index?order_id=${orderId}` })
  },

  onConfirmReceipt() {
    wx.showModal({
      title: this.data.copy.confirmTitle,
      content: this.data.copy.confirmContent,
      confirmText: this.data.copy.confirmReceipt,
      confirmColor: '#16A34A',
      cancelText: this.data.copy.wait,
      success: async (res) => {
        if (!res.confirm) return
        const orderId = this.data.order.orderId
        if (!orderId) return
        try {
          const result = await auth.request('PATCH', `/api/orders/${orderId}/confirm`)
          if (result.code === 200) {
            await this._loadOrder()
            this.setData({ showSuccessPopup: true })
          } else {
            wx.showToast({ title: result.msg || this.data.copy.operationFail, icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: this.data.copy.networkError, icon: 'none' })
        }
      }
    })
  },

  onCloseSuccessPopup() {
    this.setData({ showSuccessPopup: false })
  },

  onReview() {
    if (this.data.hasReviewed) {
      wx.showToast({ title: this.data.copy.alreadyReviewed, icon: 'none' }); return
    }
    const order = this.data.order
    const items = encodeURIComponent(JSON.stringify(order.items || []))
    wx.navigateTo({
      url: `/subpkg-supplies/supplies-review/index?order_id=${order.orderId}&order_no=${this.data.orderNo}&items=${items}`
    })
  },

  onLogistics() {
    if (!this.data.shipped) {
      wx.showToast({ title: this.data.copy.merchantNotShipped, icon: 'none', duration: 1500 })
      return
    }
    if (!this.data.order.logisticsNo) {
      wx.showToast({ title: this.data.copy.noLogisticsNo, icon: 'none' })
      return
    }
    this.setData({ logisticsExpanded: !this.data.logisticsExpanded })
    if (!this.data.logistics && !this.data.logisticsLoading) this._loadLogistics(false)
  },

  onRefreshLogistics() {
    if (this.data.logisticsLoading) return
    this._loadLogistics(true)
  },

  onCopyLogisticsNo() {
    const no = this.data.order.logisticsNo
    if (no) wx.setClipboardData({ data: no })
  }
})
