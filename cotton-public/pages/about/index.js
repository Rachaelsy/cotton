Page({
  data:{statusBarHeight:20,version:'1.0.0'},
  onLoad(){const info=wx.getSystemInfoSync();let version='1.0.0';try{version=wx.getAccountInfoSync().miniProgram.version||version}catch{}this.setData({statusBarHeight:info.statusBarHeight||20,version})},
  openPolicy(){wx.navigateTo({url:'/pages/policy/index'})},
  openAcademy(){wx.showToast({title:'正在开发中',icon:'none'})},
  back(){if(getCurrentPages().length>1)wx.navigateBack();else wx.switchTab({url:'/pages/my/index'})},
  onShareAppMessage(){return{title:'喀什优棉公共服务平台',path:'/pages/index/index'}}
})
