const COURSES = [
  { id:'growth', title:'棉花全生育期认识', type:'图文', level:'初级', duration:'8分钟', reward:10 },
  { id:'seed', title:'播种机调试与下种', type:'视频', level:'初级', duration:'18分钟', reward:15 },
  { id:'seedling', title:'苗期管理关键点', type:'图文', level:'初级', duration:'10分钟', reward:15 },
  { id:'scout', title:'第一次田间巡查', type:'视频', level:'初级', duration:'12分钟', reward:15 },
  { id:'water', title:'花铃期精准灌溉', type:'视频', level:'进阶', duration:'20分钟', reward:20 },
  { id:'pest', title:'棉铃虫综合防控', type:'图文', level:'进阶', duration:'12分钟', reward:20 }
]

Page({
  data:{ statusBarHeight:20, courses:[], completed:0, points:0, percent:0, level2Unlocked:false },
  onLoad(){ const info=wx.getSystemInfoSync(); this.setData({statusBarHeight:info.statusBarHeight||20}) },
  onShow(){
    const unlocked=!!wx.getStorageSync('academy_level_2_unlocked')
    const courses=COURSES.map(item=>({...item,done:!!wx.getStorageSync(`course_done_${item.id}`),locked:item.level==='进阶'&&!unlocked}))
    const completed=courses.filter(item=>item.done).length
    const points=courses.reduce((sum,item)=>sum+(item.done?item.reward:0),0)
    this.setData({courses,completed,points,percent:Math.round(completed/courses.length*100),level2Unlocked:unlocked})
  },
  openCourse(e){ if(e.currentTarget.dataset.locked)return wx.showToast({title:'通过初级考试后解锁',icon:'none'}); wx.navigateTo({url:`/pages/academy/course?id=${e.currentTarget.dataset.id}`}) },
  openAcademy(){ wx.navigateTo({url:'/pages/academy/index'}) },
  openExam(){ wx.navigateTo({url:'/pages/academy/exam'}) },
  back(){ if(getCurrentPages().length>1)wx.navigateBack();else wx.switchTab({url:'/pages/my/index'}) }
})
