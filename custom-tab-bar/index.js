// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页' },
      { pagePath: '/pages/ai/index', text: 'AI问答' },
      { pagePath: '/pages/my/index', text: '我的' }
    ]
  },
  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const item = this.data.list[index]
      wx.switchTab({ url: item.pagePath })
      this.setData({ selected: index })
    }
  }
})
