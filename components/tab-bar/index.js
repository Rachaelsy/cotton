const i18n = require('../../utils/i18n')

Component({
  properties: {
    selected: { type: Number, value: 0 },
    copy: { type: Object, value: null }
  },
  data: {
    copy: i18n.getCopy('tab')
  },
  lifetimes: {
    attached() {
      this.setData({ copy: this.properties.copy || i18n.getCopy('tab') })
    }
  },
  observers: {
    copy(value) {
      if (value) this.setData({ copy: value })
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
