// pages/ai/index.js — AI问答
Page({
  data: {
    statusBarHeight: 20,
    timeStr: '',
    voiceMode: false,
    inputText: '',
    typing: false,
    scrollToId: 'bottom',
    messages: [],
    quickList: [
      { i: '🌧', t: '今天能打药吗' },
      { i: '🌡', t: '地温适合播种吗' },
      { i: '🐛', t: '棉蚜怎么防治' },
      { i: '💰', t: '今日棉花收购价' }
    ],
    chips: ['施肥建议', '病虫害预警', '灌溉时机', '天气查询', '卖棉咨询']
  },

  _msgId: 0,

  onLoad() {
    const info = wx.getSystemInfoSync()
    const d = new Date()
    const h = d.getHours(), m = d.getMinutes()
    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  onQuick(e) {
    const q = e.currentTarget.dataset.q
    this.setData({ inputText: q })
    this._doSend(q)
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  onSend() {
    const text = this.data.inputText.trim()
    if (!text) return
    this._doSend(text)
    this.setData({ inputText: '' })
  },

  _doSend(text) {
    const id = ++this._msgId
    const msgs = this.data.messages.concat({ id, role: 'user', text })
    this.setData({ messages: msgs, typing: true, scrollToId: 'bottom' })
    setTimeout(() => {
      const reply = this._mockReply(text)
      const rid = ++this._msgId
      const d = new Date()
      const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      this.setData({
        typing: false,
        messages: this.data.messages.concat({ id: rid, role: 'ai', text: reply, time: timeStr }),
        scrollToId: 'bottom'
      })
    }, 1200)
  },

  _mockReply(q) {
    if (q.includes('打药') || q.includes('施药')) return '根据今日天气预报，上午10点前风力较小、湿度适中，是打药的好时机。建议选用高效氯氟氰菊酯，避开午后高温时段。'
    if (q.includes('播种') || q.includes('地温')) return '当前地温约14.5°C，已达棉花播种最低要求。今明两天气温稳定，建议尽快完成2号地块播种，预计三天内完成最佳。'
    if (q.includes('棉蚜') || q.includes('病虫')) return '棉蚜防治建议：1. 黄板诱杀成虫；2. 用10%吡虫啉1500倍液喷雾；3. 保护天敌（草蛉、瓢虫）。发现点片发生时及时处理。'
    if (q.includes('价格') || q.includes('收购') || q.includes('卖棉')) return '今日喀什地区皮棉收购参考价：手摘棉 6.8元/公斤，机采棉 6.2元/公斤。建议关注官方发布价格，有收购需求可联系合作社。'
    if (q.includes('施肥')) return '当前棉花处于蕾期，建议追施氮磷钾复合肥，每亩15公斤。结合滴灌施肥效果更佳，注意不要过量以免徒长。'
    if (q.includes('灌溉')) return '根据近期降水和土壤墒情，建议本周三前完成一次滴灌，每亩灌水量约30立方米。蕾期需水量较大，保持土壤相对含水量在70%以上。'
    return '您的问题已收到！小棉正在为您查询最新的农业信息，稍后会给您详细解答。您也可以直接说「今天天气」「施肥建议」等关键词快速获取答案。'
  },

  onToggleInput() {
    this.setData({ voiceMode: !this.data.voiceMode })
  },

  onVoice() {
    wx.showToast({ title: '语音识别功能开发中', icon: 'none' })
  },

  onMore() {
    wx.showActionSheet({ itemList: ['清空对话', '联系客服', '使用帮助'] })
  }
})
