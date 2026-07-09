const i18n = require('../../utils/i18n')

Component({
  properties: {
    selected: {
      type: Number,
      value: 0
    }
  },

  data: {
    copy: {}
  },

  lifetimes: {
    attached() {
      this.setData({
        copy: i18n.getCopy('tab')
      })
    }
  },

  pageLifetimes: {
    show() {
      this.setData({
        copy: i18n.getCopy('tab')
      })
    }
  },

  methods: {
    onTab(e) {
      const index = e.currentTarget.dataset.index

      if (index === this.data.selected) return

      const urls = [
        '/pages/index/index',
        '/pages/ai/index',
        '/pages/my/index'
      ]

      if (!urls[index]) return

      wx.switchTab({
        url: urls[index]
      })
    }
  }
})