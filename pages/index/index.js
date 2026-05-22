// pages/index/index.js — 首页
const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    name: '古丽巴哈尔',
    location: '喀什 · 疏附县棉田主',
    today: '',
    modules: [
      { id: 1,  name: '地块管理',   icon: '🗺',  bg: '#E8F5E9', action: 'fields' },
      { id: 2,  name: '遥感监测',   icon: '🛰',  bg: '#E3F2FD', newTag: true, action: 'remote' },
      { id: 3,  name: '病虫害识别', icon: '🔬',  bg: '#FCE4EC', action: 'pest' },
      { id: 4,  name: '地块气象',   icon: '⛅',  bg: '#E3F2FD', action: 'weather' },
      { id: 5,  name: '农事记录',   icon: '📝',  bg: '#EDE7F6', action: 'records' },
      { id: 6,  name: '农机租赁',   icon: '🚜',  bg: '#E0F7FA', action: 'machine' },
      { id: 7,  name: '农资供应',   icon: '🌾',  bg: '#FFF3E0', action: 'supplies' },
      { id: 8,  name: '棉花交易',   icon: '💰',  bg: '#FFEBEE', action: 'trade' },
      { id: 9,  name: '农业贷款',   icon: '🏦',  bg: '#E0F2F1', action: 'loans' },
      { id: 10, name: '农业保险',   icon: '🛡',  bg: '#E8EAF6', action: 'insurance' },
      { id: 11, name: '专家讲堂',   icon: '🎓',  bg: '#EFEBE9', action: 'expert' }
    ]
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    this._setToday()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  _setToday() {
    const d = new Date()
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    this.setData({
      today: `${d.getMonth() + 1}月${d.getDate()}日 ${week[d.getDay()]}`
    })
  },

  onModule(e) {
    const action = e.currentTarget.dataset.action
    const routes = {
      fields:    '/pages/fields/index',
      remote:    '/pages/remote/index',
      pest:      '/pages/pest/index',
      weather:   '/pages/weather/index',
      records:   '/pages/records/index',
      machine:   '/pages/machine/index',
      supplies:  '/pages/supplies/index',
      trade:     '/pages/trade/index',
      loans:     '/pages/loans/index',
      insurance: '/pages/insurance/index',
      expert:    '/pages/expert/index'
    }
    const url = routes[action]
    if (url) {
      wx.navigateTo({ url })
    } else {
      wx.showToast({ title: '该功能开发中', icon: 'none' })
    }
  },

  onGoFields() {
    wx.showToast({ title: '地块管理开发中', icon: 'none' })
  },

  onPhotoBanner() {
    wx.showToast({ title: '拍照识别开发中', icon: 'none' })
  },

  onLang() {
    wx.showActionSheet({
      itemList: ['中文', 'ئۇيغۇرچە'],
      success(res) {
        wx.showToast({ title: res.tapIndex === 0 ? '已切换为中文' : 'تىل ئۆزگەرتىلدى', icon: 'none' })
      }
    })
  },

  onNotification() {
    wx.showToast({ title: '暂无新通知', icon: 'none' })
  }
})
