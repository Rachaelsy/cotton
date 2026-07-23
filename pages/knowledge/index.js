const auth = require('../../utils/auth')

Page({
  data: { url: '' },
  async onLoad() {
    let url = `${auth.BASE_URL}/knowledge/?from=miniapp`
    if (auth.isLoggedIn()) {
      try {
        const loginCode = await new Promise((resolve, reject) => {
          wx.login({
            success: result => result.code ? resolve(result.code) : reject(new Error('未获取到微信登录凭证')),
            fail: reject
          })
        })
        const result = await auth.request('POST', '/api/auth/web-bridge', { loginCode })
        if (result.code === 200 && result.data && result.data.ticket) {
          url += `&bridge=${encodeURIComponent(result.data.ticket)}`
        }
      } catch (error) {
        console.warn('[knowledge-web-bridge]', error && error.message || error)
      }
    }
    this.setData({ url })
  },
  onShareAppMessage() {
    return { title: '棉知学堂 · 棉花种植知识与棉友问答', path: '/pages/knowledge/index' }
  }
})
