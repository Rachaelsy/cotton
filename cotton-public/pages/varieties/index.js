const auth = require('../../utils/auth')

const SORTS = [
  { id: 'overall', label: '综合优选' },
  { id: 'yield', label: '产量表现' },
  { id: 'quality', label: '纤维品质' },
  { id: 'lint', label: '衣分表现' }
]

const SORT_META = {
  overall: {
    rankLabel: '综合名次',
    valueLabel: '综合加权值',
    methodTitle: '如何理解综合排名',
    methodDescription: '综合值按原统计表的指标名次和权重计算，数值越低、综合名次越靠前。排名仅反映本次对比试验，不等同于审定结论或购买推荐。'
  },
  yield: {
    rankLabel: '产量名次',
    valueLabel: '籽棉产量 kg/亩',
    methodTitle: '按籽棉产量单项排名',
    methodDescription: '按照原统计表中的籽棉产量名次从前到后排列，卡片左侧只显示产量名次，不显示综合名次。'
  },
  quality: {
    rankLabel: '品质名次',
    valueLabel: '品质专项值',
    methodTitle: '按纤维品质专项排名',
    methodDescription: '根据纤维长度、断裂比强度、马克隆值和整齐度四项原表加权值汇总排序，专项值越低、品质名次越靠前。'
  },
  lint: {
    rankLabel: '衣分名次',
    valueLabel: '衣分',
    valueUnit: '%',
    methodTitle: '按衣分单项排名',
    methodDescription: '按照原统计表中的衣分名次从前到后排列，卡片左侧只显示衣分名次，不显示综合名次。'
  }
}

function coverUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return url.startsWith('/') ? `${auth.BASE_URL}${url}` : ''
}

function numberText(value, digits = 1) {
  if (value === null || value === undefined || value === '') return '--'
  return Number(value).toFixed(digits).replace(/\.?0+$/, '')
}

function qualityScore(item) {
  const values = [item.fiberLengthWeighted, item.fiberStrengthWeighted, item.micronaireWeighted, item.uniformityWeighted]
  return values.every(value => value !== null && value !== undefined && Number.isFinite(Number(value)))
    ? values.reduce((sum, value) => sum + Number(value), 0)
    : null
}

function decorateForSort(items, sort) {
  const meta = SORT_META[sort] || SORT_META.overall
  let lastQualityScore = null
  let qualityRank = 0
  return items.map(item => {
    const score = qualityScore(item)
    if (sort === 'quality' && score !== null && (lastQualityScore === null || Math.abs(score - lastQualityScore) > 0.000001)) {
      qualityRank += 1
      lastQualityScore = score
    }
    const selectedRank = sort === 'yield'
      ? item.yieldRank
      : sort === 'lint'
        ? item.lintRank
        : sort === 'quality'
          ? (score === null ? null : qualityRank)
          : item.overallRank
    const selectedValue = sort === 'yield'
      ? item.seedCottonYieldKgMu
      : sort === 'lint'
        ? item.lintPercent
        : sort === 'quality'
          ? score
          : item.weightedTotal
    return {
      ...item,
      displayRank: selectedRank || '—',
      rankLabel: meta.rankLabel,
      displayValueLabel: meta.valueLabel,
      displayValue: numberText(selectedValue, sort === 'quality' || sort === 'overall' ? 2 : 1),
      displayValueUnit: meta.valueUnit || '',
      highlight: Number(selectedRank || 999) <= 3
    }
  })
}

function normalize(item) {
  return {
    ...item,
    coverUrl: coverUrl(item.coverUrl),
    weightedText: numberText(item.weightedTotal, 2),
    lintText: numberText(item.lintPercent),
    lengthText: numberText(item.fiberLengthMm),
    strengthText: numberText(item.fiberStrengthCnTex),
    uniformityText: numberText(item.uniformityPercent),
    micronaireText: numberText(item.micronaireValue),
    yieldText: numberText(item.seedCottonYieldKgMu),
    strengths: Array.isArray(item.strengths) ? item.strengths : [],
    recommendedCounties: Array.isArray(item.recommendedCounties) ? item.recommendedCounties : []
  }
}

Page({
  data: {
    statusBarHeight: 20,
    sorts: SORTS,
    activeSort: 'overall',
    keyword: '',
    allVarieties: [],
    varieties: [],
    trialYear: 2025,
    trialArea: '喀什地区',
    methodTitle: SORT_META.overall.methodTitle,
    methodDescription: SORT_META.overall.methodDescription,
    loading: true,
    errorText: ''
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this.loadVarieties()
  },

  onPullDownRefresh() { this.loadVarieties().finally(() => wx.stopPullDownRefresh()) },

  async loadVarieties() {
    this.setData({ loading: true, errorText: '' })
    try {
      const res = await auth.request('GET', `/api/cotton-varieties?sort=${this.data.activeSort}`)
      if (res.code !== 200) throw new Error(res.msg || '品种试验数据加载失败')
      const meta = SORT_META[this.data.activeSort] || SORT_META.overall
      const allVarieties = decorateForSort((res.data || []).map(normalize), this.data.activeSort)
      const first = allVarieties[0]
      this.setData({
        allVarieties,
        trialYear: first ? first.trialYear : 2025,
        trialArea: first ? first.trialArea : '喀什地区',
        methodTitle: meta.methodTitle,
        methodDescription: meta.methodDescription,
        loading: false
      }, () => this.applyFilter())
    } catch (error) {
      this.setData({ allVarieties: [], varieties: [], loading: false, errorText: error.message || '品种试验数据加载失败' })
    }
  },

  selectSort(e) {
    const activeSort = e.currentTarget.dataset.id
    if (!activeSort || activeSort === this.data.activeSort) return
    this.setData({ activeSort }, () => this.loadVarieties())
  },

  inputKeyword(e) { this.setData({ keyword: e.detail.value || '' }, () => this.applyFilter()) },

  applyFilter() {
    const keyword = String(this.data.keyword || '').trim().toLowerCase()
    const varieties = keyword
      ? this.data.allVarieties.filter(item => String(item.name || '').toLowerCase().includes(keyword))
      : this.data.allVarieties
    this.setData({ varieties })
  },

  openDetail(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (id) wx.navigateTo({ url: `/pages/varieties/detail?id=${id}` })
  },

  retry() { this.loadVarieties() },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) }) }
})
