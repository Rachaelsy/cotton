// pages/machine/review.js — 农机服务评价（分项）
const auth = require('../../utils/auth')
const i18n = require('../../utils/i18n')
const machineI18n = require('../../utils/machine-i18n')

function dimensions(lang) {
  const labels = lang === 'ug' ? ['ۋاقىتچانلىقى', 'ئىش سۈپىتى', 'مۇلازىمەت مۇئامىلىسى', 'باھا مۇۋاپىقلىقى'] : ['及时性', '作业质量', '服务态度', '价格合理']
  return ['score_timely', 'score_quality', 'score_attitude', 'score_price'].map((key, index) => ({ key, label: labels[index], score: 5 }))
}

Page({
  data: {
    statusBarHeight: 20,
    lang: i18n.getLanguage(),
    copy: machineI18n.getCopy('review'),
    orderId: null,
    dims: dimensions(i18n.getLanguage()),
    stars: [1, 2, 3, 4, 5],
    content: '',
    submitting: false
  },

  onLoad(query) {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20, orderId: query.id })
  },

  onShow() {
    const lang = i18n.getLanguage()
    if (lang !== this.data.lang) {
      const old = this.data.dims.reduce((result, item) => { result[item.key] = item.score; return result }, {})
      this.setData({ lang, copy: machineI18n.getCopy('review', lang), dims: dimensions(lang).map(item => ({ ...item, score: old[item.key] || 5 })) })
    }
  },

  onStar(e) {
    const { dim, val } = e.currentTarget.dataset
    const dims = this.data.dims.map(d => d.key === dim ? { ...d, score: Number(val) } : d)
    this.setData({ dims })
  },

  onContent(e) { this.setData({ content: e.detail.value }) },

  async onSubmit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    const body = { content: this.data.content }
    this.data.dims.forEach(d => { body[d.key] = d.score })
    try {
      const res = await auth.request('POST', `/api/machine-orders/${this.data.orderId}/review`, body)
      if (res.code === 200) {
        wx.showToast({ title: this.data.copy.success, icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1200)
      } else {
        this.setData({ submitting: false })
        wx.showToast({ title: res.msg || this.data.copy.fail, icon: 'none' })
      }
    } catch (e) {
      this.setData({ submitting: false })
      wx.showToast({ title: this.data.copy.network, icon: 'none' })
    }
  },

  onBack() { wx.navigateBack() }
})
