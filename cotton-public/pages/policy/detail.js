const { getPolicy } = require('../../utils/policy-data')

Page({
  data: { policy: {}, collected: false },
  onLoad(options) {
    const policy = getPolicy(options.id)
    this.setData({ policy, collected: !!wx.getStorageSync(`policy_collected_${policy.id}`) })
  },
  back() { wx.navigateBack({ fail: () => wx.navigateTo({ url: '/pages/policy/index' }) }) },
  toggleCollect() {
    const collected = !this.data.collected
    wx.setStorageSync(`policy_collected_${this.data.policy.id}`, collected)
    this.setData({ collected })
    wx.showToast({ title: collected ? '已收藏政策' : '已取消收藏', icon: 'none' })
  },
  copySource() {
    wx.setClipboardData({ data: `${this.data.policy.issuer}（演示数据，待接入官方原文）` })
  },
  onShareAppMessage() { return { title: this.data.policy.title, path: `/pages/policy/detail?id=${this.data.policy.id}` } }
})
