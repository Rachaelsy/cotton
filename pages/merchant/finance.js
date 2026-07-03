const auth = require('../../utils/auth')

function money(value) {
  return Number(value || 0).toFixed(2)
}

function settlementRecord(item) {
  const isFrozen = item.fund_status === 'frozen'
  const isWithdrawing = item.fund_status === 'withdrawing'
  return {
    id: item.id,
    type: isFrozen ? 'pending' : isWithdrawing ? 'withdraw' : 'income',
    typeLabel: isFrozen ? '待结算' : isWithdrawing ? '提现中订单' : item.fund_status === 'withdrawn' ? '已提现订单' : '交易收入',
    desc: `${item.order_no} · ${item.prod || '商品'}`,
    amount: `+${money(item.actual)}`,
    time: item.date || '',
    balance: money(item.actual)
  }
}

function withdrawalRecord(item) {
  return {
    id: item.id,
    type: 'withdraw',
    typeLabel: `提现${item.status}`,
    desc: item.note || `申请日期 ${item.apply_date}`,
    amount: `-${money(item.amount)}`,
    time: item.arrive_date || item.apply_date || '',
    balance: '—'
  }
}

Page({
  data: {
    statusBarHeight: 20,
    loading: true,
    summary: {
      pending: '0.00',
      settled: '0.00',
      frozen: '0.00'
    },
    availableAmount: 0,
    records: []
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.loadFinance()
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadFinance()
  },

  async loadFinance() {
    this.setData({ loading: true })
    try {
      const res = await auth.request('GET', '/api/merchant/finance')
      if (res.code !== 200 || !res.data) throw new Error(res.msg || '加载失败')
      const data = res.data
      const records = [
        ...(data.settlements || []).map(settlementRecord),
        ...(data.withdrawals || []).map(withdrawalRecord)
      ]
      this.setData({
        loading: false,
        availableAmount: Number(data.available_balance || 0),
        summary: {
          pending: money(data.monthly_sales),
          settled: money(data.available_balance),
          frozen: money(data.frozen_balance)
        },
        records
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  onWithdraw() {
    const amount = Number(this.data.availableAmount || 0)
    if (amount < 1) {
      wx.showToast({ title: '可提现余额不足', icon: 'none' })
      return
    }
    wx.showModal({
      title: '申请提现',
      content: `本次申请提现 ¥${money(amount)}，审核通过后预计 1-3 个工作日到账。`,
      confirmText: '确认提现',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const result = await auth.request('POST', '/api/merchant/withdraw', { amount })
          if (result.code !== 200) throw new Error(result.msg || '提现失败')
          wx.showToast({ title: '提现申请已提交', icon: 'success' })
          this.loadFinance()
        } catch (error) {
          wx.showToast({ title: error.message || '提现失败', icon: 'none' })
        }
      }
    })
  }
})
