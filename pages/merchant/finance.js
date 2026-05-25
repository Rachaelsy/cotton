const auth = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 20,
    summary: {
      pending: '2,340.00',
      settled: '16,330.00',
      frozen: '62.00'
    },
    records: [
      { id: 1, type: 'income', typeLabel: '交易收入', desc: '订单 DD202505250002 结算', amount: '+114.00', time: '05-25 09:15', balance: '16,330.00' },
      { id: 2, type: 'income', typeLabel: '交易收入', desc: '订单 DD202505240004 结算', amount: '+225.00', time: '05-24 16:20', balance: '16,216.00' },
      { id: 3, type: 'income', typeLabel: '交易收入', desc: '订单 DD202505240005 结算', amount: '+560.00', time: '05-24 14:10', balance: '15,991.00' },
      { id: 4, type: 'refund', typeLabel: '退款扣除', desc: '订单 DD202505230006 退款', amount: '-38.00', time: '05-23 11:30', balance: '15,431.00' },
      { id: 5, type: 'income', typeLabel: '交易收入', desc: '订单 DD202505220007 结算', amount: '+280.00', time: '05-22 15:45', balance: '15,469.00' },
      { id: 6, type: 'withdraw', typeLabel: '提现转账', desc: '提现至银行卡尾号 6789', amount: '-5,000.00', time: '05-20 10:00', balance: '15,189.00' }
    ]
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    if (!auth.requireLogin()) return
  },

  onWithdraw() {
    wx.showModal({
      title: '申请提现',
      content: `待结算金额 ¥${this.data.summary.pending} 将在 1-3 个工作日内到账`,
      confirmText: '确认提现',
      success: (res) => {
        if (res.confirm) wx.showToast({ title: '提现申请已提交', icon: 'success' })
      }
    })
  }
})
