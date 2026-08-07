const { getPolicy } = require('../../utils/policy-data')
const auth = require('../../utils/auth')
const { markdownToRichTextNodes } = require('../../utils/markdown')

Page({
  data: { policy: {}, collected: false, loading: true, demoMode: false, bodyNodes: [] },
  async onLoad(options) {
    const id = options.id
    try {
      const res = await auth.request('GET', `/api/policies/${encodeURIComponent(id)}`)
      if (res.code !== 200 || !res.data) throw new Error(res.msg || '政策详情加载失败')
      const policy = res.data
      this.setData({ policy, loading: false, demoMode: false, bodyNodes: markdownToRichTextNodes(policy.markdown || ''), collected: !!wx.getStorageSync(`policy_collected_${policy.id}`) })
    } catch (error) {
      const policy = getPolicy(id)
      this.setData({ policy, loading: false, demoMode: true, bodyNodes: [], collected: !!wx.getStorageSync(`policy_collected_${policy.id}`) })
    }
  },
  back() { wx.navigateBack({ fail: () => wx.navigateTo({ url: '/pages/policy/index' }) }) },
  toggleCollect() {
    const collected = !this.data.collected
    wx.setStorageSync(`policy_collected_${this.data.policy.id}`, collected)
    this.setData({ collected })
    wx.showToast({ title: collected ? '已收藏政策' : '已取消收藏', icon: 'none' })
  },
  copySource() {
    const policy = this.data.policy
    wx.setClipboardData({ data: policy.originalUrl || `${policy.issuer}（请以发布单位正式原文为准）` })
  },
  onShareAppMessage() { return { title: this.data.policy.title, path: `/pages/policy/detail?id=${this.data.policy.id}` } }
})
