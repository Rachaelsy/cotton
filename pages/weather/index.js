Page({
  data: {
    statusBarHeight: 20,
    selField: '3号地',
    fields: ['1号地', '2号地', '3号地', '4号地', '5号地'],
    weather: {
      temp: 22, desc: '晴转多云', icon: '🌤',
      high: 24, low: 8, wind: '西北风3级',
      humidity: 45, groundTemp: 14.5, rain: 0, uv: 6
    },
    forecast: [
      { day:'明天', icon:'⛅', high:20, low:6, wind:'北风2级' },
      { day:'后天', icon:'🌧', high:15, low:4, wind:'东风4级' },
      { day:'4月25', icon:'☀️', high:23, low:8, wind:'西南风2级' },
      { day:'4月26', icon:'🌤', high:25, low:10, wind:'南风1级' },
      { day:'4月27', icon:'☀️', high:27, low:12, wind:'无风' }
    ],
    advices: [
      { icon:'💧', bg:'#E3F2FD', title:'灌溉建议', sub:'当前土壤墒情适中，本周三前完成一次滴灌，每亩30立方米' },
      { icon:'🌿', bg:'#E8F5E9', title:'施肥时机', sub:'蕾期追肥窗口，建议本周追施氮磷钾复合肥15公斤/亩' },
      { icon:'🚫', bg:'#FFF3E6', title:'打药预警', sub:'后天降雨，施药需在明天上午10点前完成，雨后重喷' }
    ]
  },
  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 20 })
  },
  onBack() { wx.navigateBack() },
  onSelField(e) { this.setData({ selField: e.currentTarget.dataset.f }) }
})
