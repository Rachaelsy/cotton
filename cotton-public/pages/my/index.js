const auth = require('../../utils/auth')
Page({
  data: { loggedIn: false, user: null, initial: '棉' },
  onShow() {
    const user = auth.getUser()
    const name = user && (user.real_name || user.phone || '棉')
    this.setData({ loggedIn: auth.isLoggedIn(), user, initial: name ? String(name).charAt(0) : '棉' })
  },
  login() { wx.navigateTo({ url: '/pages/login/index' }) },
  open(e) {
    const routes = { fields: '/pages/fields/index', records: '/pages/records/index', calendar: '/pages/records/calendar' }
    if (routes[e.currentTarget.dataset.key]) wx.navigateTo({ url: routes[e.currentTarget.dataset.key] })
  },
  about() { wx.showModal({ title: '关于平台', content: '喀什优棉公益平台面向棉农提供公益农技学习、权威资讯和田间生产工具。', showCancel: false }) },
  logout() { wx.showModal({ title: '退出登录', content: '确定退出当前账号吗？', success: r => r.confirm && auth.logout() }) }
})
