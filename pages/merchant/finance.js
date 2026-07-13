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
    typeLabel: isFrozen ? '待结算' : isWithdrawing ? '结算中订单' : item.fund_status === 'withdrawn' ? '已结算订单' : '交易收入',
    desc: `${item.order_no} · ${item.prod || '商品'}`,
    amount: `+${money(item.actual)}`,
    time: item.date || '',
    balance: money(item.actual)
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
      const records = (data.settlements || []).map(settlementRecord)
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
  }
})
