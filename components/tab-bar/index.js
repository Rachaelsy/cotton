const i18n = require('../../utils/i18n')

Component({
  properties: {
    selected: { type: Number, value: 0 }
  },
  data: {
    copy: i18n.getCopy('tab')
  },
  lifetimes: {
    attached() {
      this.setData({ copy: i18n.getCopy('tab') })
    }
  },
  methods: {
    onTab(e) {
      const index = e.currentTarget.dataset.index
      const urls = ['/pages/index/index', '/pages/ai/index', '/pages/my/index']
      wx.switchTab({ url: urls[index] })
    }
  }
})
