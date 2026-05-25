Component({
  properties: {
    selected: { type: Number, value: 0 }
  },
  methods: {
    onTab(e) {
      const index = e.currentTarget.dataset.index
      const urls = [
        '/pages/merchant/index',
        '/pages/merchant/products',
        '/pages/merchant/orders',
        '/pages/merchant/finance',
        '/pages/merchant/profile'
      ]
      if (index === this.data.selected) return
      wx.reLaunch({ url: urls[index] })
    }
  }
})
