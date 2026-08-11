const auth=require('../../utils/auth')
const FAQ=[
  {q:'为什么地块或学习数据没有显示？',a:'请先确认已经登录正确账号，并检查网络。地块来自账号后端数据，课程进度保存在当前设备。'},
  {q:'天气预报与实际情况不一致怎么办？',a:'天气数据用于生产参考，局地天气变化较快，重要农事请结合当地气象部门预警和现场观察。'},
  {q:'如何提交使用建议？',a:'进入“收藏与评价”，切换到“意见与评价”即可提交，管理员回复后可在原页面查看。'},
  {q:'平台可以直接办理贷款或保险吗？',a:'不可以。平台只提供公益科普和官方入口指引，不办理金融业务、不收取资金，也不承诺收益。'}
]
Page({
  data:{statusBarHeight:20,loggedIn:false,faq:FAQ,openFaq:-1},
  onLoad(){const info=wx.getSystemInfoSync();this.setData({statusBarHeight:info.statusBarHeight||20})},
  onShow(){this.setData({loggedIn:auth.isLoggedIn()})},
  toggleFaq(e){const index=Number(e.currentTarget.dataset.index);this.setData({openFaq:this.data.openFaq===index?-1:index})},
  openSettings(){wx.openSetting({fail:()=>wx.showToast({title:'请在手机系统设置中管理权限',icon:'none'})})},
  openFeedback(){wx.navigateTo({url:'/pages/collection/index?tab=feedback'})},
  clearCache(){wx.showModal({title:'清理临时缓存',content:'将清理天气页面等临时状态，不会删除登录、课程进度和收藏。',confirmColor:'#187554',success:r=>{if(!r.confirm)return;['weather_last_location','weather_last_result','pest_draft'].forEach(key=>wx.removeStorageSync(key));wx.showToast({title:'已清理',icon:'success'})}})},
  login(){wx.navigateTo({url:'/pages/login/index'})},
  logout(){wx.showModal({title:'退出登录',content:'确定退出当前账号吗？',confirmColor:'#b34e45',success:r=>r.confirm&&auth.logout()})},
  back(){if(getCurrentPages().length>1)wx.navigateBack();else wx.switchTab({url:'/pages/my/index'})}
})
