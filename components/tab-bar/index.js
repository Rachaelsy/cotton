Component({
  properties: {
    selected: { type: Number, value: 0 }
  },
  methods: {
    onTab(e) {
      const index = e.currentTarget.dataset.index
      const urls = ['/pages/index/index', '/pages/ai/index', '/pages/my/index']
      wx.switchTab({ url: urls[index] })
    }
  }
})
