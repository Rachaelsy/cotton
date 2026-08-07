const courses = {
  growth: { title: '棉花全生育期认识', type: '图文', level: '初级', duration: '8分钟', reward: 10, cover: '/images/cotton-seedling-inspection-v1.jpg', teacher: '王建民 研究员', intro: '棉花要经历播种出苗、苗期、蕾期、花铃期和吐絮期。认识不同阶段的田间表现，才能把水、肥和植保措施用在关键时候。', points: ['认识五个主要生育阶段', '了解各阶段水肥管理重点', '根据植株状态判断生育进程'] },
  seed: { title: '播种机调试与下种', type: '视频', level: '初级', duration: '18分钟', reward: 15, cover: '/images/course-water-v2.webp', teacher: '陈志强 农技师', intro: '跟随农技师完成播种机检查、行距设置、下种深度调整和播后质量确认。', points: ['检查排种器和滴灌带', '掌握适宜播深与株行距', '检查漏播、重播和覆土质量'] },
  seedling: { title: '苗期管理关键点', type: '图文', level: '初级', duration: '10分钟', reward: 15, cover: '/images/cotton-seedling-inspection-v1.jpg', teacher: '王建民 研究员', intro: '苗期管理以全苗、齐苗、匀苗、壮苗为核心，同时关注低温、盐碱和早期虫害。', points: ['判断缺苗断垄', '区分弱苗和旺苗', '掌握苗期水肥与虫害管理'] },
  scout: { title: '第一次田间巡查', type: '视频', level: '初级', duration: '12分钟', reward: 15, cover: '/images/course-scouting-v2.webp', teacher: '李雪梅 副教授', intro: '用固定路线完成田间巡查，记录苗情、墒情、虫情和异常区域。', points: ['规划 S 形巡田路线', '观察叶片茎秆和生长点', '规范拍照并形成巡田记录'] }
}
Page({
  data: { course: {}, completed: false },
  onLoad(options) { const course = courses[options.id] || courses.growth; this.courseId = options.id || 'growth'; this.setData({ course, completed: !!wx.getStorageSync(`course_done_${this.courseId}`) }) },
  complete() { if (this.data.completed) return wx.showToast({ title: '本课积分已经领取', icon: 'none' }); wx.setStorageSync(`course_done_${this.courseId}`, true); this.setData({ completed: true }); wx.showToast({ title: `获得${this.data.course.reward}积分`, icon: 'success' }) }
})
