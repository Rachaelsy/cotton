const auth = require('../../utils/auth')
const layout = require('../../utils/layout')

const TYPE_LABELS = {
  course_reward: '完成课程',
  order_redeem: '农资订单抵扣',
  order_return: '订单积分返还',
  admin_adjustment: '平台调整'
}

function transactionLabel(item) {
  if (item.type !== 'order_redeem') return TYPE_LABELS[item.type] || '积分变动'
  if (item.status === 'locked') return '订单积分冻结'
  if (item.status === 'cancelled') return '已取消的积分抵扣'
  return TYPE_LABELS.order_redeem
}

Page({
  data: {
    statusBarHeight: 20,
    capsuleSafeRight: 0,
    loading: true,
    account: { balance: 0, lockedPoints: 0, totalEarned: 0, totalUsed: 0 },
    accountYuan: '0.00',
    transactions: [],
    rules: null
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      capsuleSafeRight: layout.getCapsuleSafeRight()
    })
  },

  onShow() {
    if (!auth.isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/index' })
      return
    }
    this.loadPoints()
  },

  async loadPoints() {
    this.setData({ loading: true })
    try {
      const result = await auth.request('GET', '/api/points/me?limit=50')
      if (result.code !== 200) throw new Error(result.msg || '积分加载失败')
      const transactions = (result.data.transactions || []).map(item => ({
        ...item,
        label: transactionLabel(item),
        sign: Number(item.points) > 0 ? '+' : '',
        time: this.formatTime(item.createdAt)
      }))
      this.setData({
        account: result.data.account,
        accountYuan: (Number(result.data.account.balance || 0) / 100).toFixed(2),
        transactions,
        rules: result.data.rules,
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '积分加载失败', icon: 'none' })
    }
  },

  formatTime(value) {
    if (!value) return ''
    const date = new Date(String(value).replace(' ', 'T'))
    const pad = number => String(number).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  },

  onBack() {
    wx.navigateBack()
  },

  onLearn() {
    wx.navigateTo({ url: '/pages/community/index?next=courses' })
  },

  onSupplies() {
    wx.navigateTo({ url: '/subpkg-supplies/supplies/index' })
  }
})
