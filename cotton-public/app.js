const auth = require('./utils/auth')

App({
  async onLaunch() {
    const user = auth.getUser()
    const token = auth.getToken()
    if (user && token) {
      this.globalData.userInfo = user
      this.globalData.user = user
    }
    if (token) {
      const valid = await auth.verify()
      if (!valid) {
        this.globalData.userInfo = null
        this.globalData.user = null
      } else {
        this.globalData.userInfo = auth.getUser()
        this.globalData.user = auth.getUser()
      }
    }
  },

  globalData: {
    userInfo: null,
    user: null,
    statusBarHeight: 20,
    navBarHeight: 44,
    pendingPhoto: null,
    pestPhoto: '',
    pestResult: null,
    language: 'zh'
  }
})
