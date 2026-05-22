// pages/my/index.js — 我的
const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    userInfo: {
      name: '古丽巴哈尔',
      tags: ['🌾 棉田主', '📍 喀什·疏附县']
    },
    userInitial: '古'
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
  },

  onProfile() {
    wx.showToast({ title: '个人资料编辑中', icon: 'none' })
  },

  onSettings() {
    wx.showToast({ title: '设置功能开发中', icon: 'none' })
  },

  onRealName() {
    wx.showToast({ title: '已实名认证', icon: 'success' })
  },

  onFavorites() {
    wx.showToast({ title: '收藏功能开发中', icon: 'none' })
  },

  onMyOrders() {
    wx.navigateTo({ url: '/pages/supplies-cart/index' })
  },

  onAbout() {
    wx.showModal({
      title: '棉管家 v1.2.0',
      content: '专为新疆棉农打造的智能农业管理平台\n\n联系我们：support@cotton.app',
      showCancel: false,
      confirmText: '好的'
    })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#F5222D',
      success(res) {
        if (res.confirm) wx.showToast({ title: '已退出登录', icon: 'none' })
      }
    })
  }
})
