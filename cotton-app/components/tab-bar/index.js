const i18n = require('../../utils/i18n')

Component({
  properties: {
    selected: {
      type: Number,
      value: 0
    },
    copy: {
      type: Object,
      value: null,
      observer(nextCopy) {
        if (nextCopy && Object.keys(nextCopy).length) {
          this.setData({ copy: nextCopy })
        }
      }
    }
  },

  data: {
    copy: i18n.getCopy('tab')
  },

  lifetimes: {
    attached() {
      this.setData({ copy: this.properties.copy || i18n.getCopy('tab') })
    }
  },

  pageLifetimes: {
    show() {
      this.setData({ copy: this.properties.copy || i18n.getCopy('tab') })
    }
  },

  methods: {
    onTab(e) {
      const index = e.currentTarget.dataset.index
      if (index === this.properties.selected) return

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
