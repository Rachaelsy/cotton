const auth = require('../../utils/auth')

function coverUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return url.startsWith('/') ? `${auth.BASE_URL}${url}` : ''
}

function metric(label, value, unit, rank, total) {
  const numericRank = Number(rank || 0)
  const width = numericRank && total ? Math.max(8, Math.round((total - numericRank + 1) / total * 100)) : 0
  return { label, value: value == null ? '--' : Number(value).toFixed(1).replace(/\.0$/, ''), unit, rank: numericRank || '—', width }
}

Page({
  data: { statusBarHeight: 20, item: null, metrics: [], loading: true, errorText: '' },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.varietyId = Number(options.id)
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.loadDetail()
  },

  async loadDetail() {
    if (!this.varietyId) { this.setData({ loading: false, errorText: '品种资料不存在' }); return }
    this.setData({ loading: true, errorText: '' })
    try {
      const res = await auth.request('GET', `/api/cotton-varieties/${this.varietyId}`)
      if (res.code !== 200) throw new Error(res.msg || '品种资料加载失败')
      const source = res.data || {}
      const total = Math.max(1, Number(source.trialCount || 0))
      const item = {
        ...source,
        coverUrl: coverUrl(source.coverUrl),
        strengths: Array.isArray(source.strengths) ? source.strengths : [],
        recommendedCounties: Array.isArray(source.recommendedCounties) ? source.recommendedCounties : [],
        weightedText: source.weightedTotal == null ? '--' : Number(source.weightedTotal).toFixed(2).replace(/0$/, '').replace(/\.$/, '')
      }
      const metrics = [
        metric('衣分', item.lintPercent, '%', item.lintRank, total),
        metric('纤维长度', item.fiberLengthMm, 'mm', item.fiberLengthRank, total),
        metric('断裂比强度', item.fiberStrengthCnTex, 'cN/tex', item.fiberStrengthRank, total),
        metric('马克隆值', item.micronaireValue, '', item.micronaireRank, total),
        metric('整齐度', item.uniformityPercent, '%', item.uniformityRank, total),
        metric('籽棉产量', item.seedCottonYieldKgMu, 'kg/亩', item.yieldRank, total)
      ]
      this.setData({ item, metrics, loading: false })
    } catch (error) {
      this.setData({ item: null, metrics: [], loading: false, errorText: error.message || '品种资料加载失败' })
    }
  },

  retry() { this.loadDetail() },
  back() { wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/varieties/index' }) }) }
})
