const auth = require('../../utils/auth')

Page({
  data: {
    url: '',
    loading: true,
    error: ''
  },

  async onLoad(options) {
    const next = options.next === 'courses' ? '/public/courses' : '/public/'
    if (!auth.isLoggedIn()) {
      this.setData({ url: `${auth.COMMUNITY_URL}/`, loading: false })
      return
    }
    try {
      const result = await auth.request('POST', '/api/auth/community-ticket')
      if (result.code !== 200 || !result.data.ticket) throw new Error(result.msg || '账号同步失败')
      const params = `ticket=${encodeURIComponent(result.data.ticket)}&next=${encodeURIComponent(next)}`
      this.setData({ url: `${auth.COMMUNITY_URL}/login?${params}`, loading: false })
    } catch (error) {
      this.setData({ loading: false, error: error.message || '暂时无法打开公益平台' })
    }
  },

  onRetry() {
    this.setData({ error: '', loading: true })
    this.onLoad({ next: 'courses' })
  }
})
