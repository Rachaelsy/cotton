const auth=require('../../utils/auth')
const {policies:demoPolicies}=require('../../utils/policy-data')

function formatTime(value){ return value?String(value).replace('T',' ').slice(0,16):'' }

Page({
  data:{statusBarHeight:20,tab:'favorites',policies:[],feedbacks:[],loading:false,content:'',submitting:false,loggedIn:false},
  onLoad(options){const info=wx.getSystemInfoSync();this.setData({statusBarHeight:info.statusBarHeight||20,tab:options.tab==='feedback'?'feedback':'favorites'})},
  onShow(){this.setData({loggedIn:auth.isLoggedIn()});this.loadFavorites();if(auth.isLoggedIn())this.loadFeedbacks()},
  switchTab(e){this.setData({tab:e.currentTarget.dataset.tab})},
  async loadFavorites(){
    let policies=demoPolicies
    try{const res=await auth.request('GET','/api/policies');if(res.code===200&&Array.isArray(res.data))policies=res.data}catch{}
    const keys=wx.getStorageInfoSync().keys||[];const ids=new Set(keys.filter(key=>key.indexOf('policy_collected_')===0&&wx.getStorageSync(key)).map(key=>key.replace('policy_collected_','')))
    this.setData({policies:policies.filter(item=>ids.has(String(item.id)))})
  },
  async loadFeedbacks(){this.setData({loading:true});try{const res=await auth.request('GET','/api/feedback');if(res.code!==200)throw new Error(res.msg);this.setData({feedbacks:(res.data||[]).map(item=>({...item,createdText:formatTime(item.created_at),statusText:item.admin_reply?'已回复':item.status==='closed'?'已处理':'待回复'}))})}catch(error){wx.showToast({title:error.message||'反馈记录加载失败',icon:'none'})}finally{this.setData({loading:false});wx.stopPullDownRefresh()}},
  openPolicy(e){wx.navigateTo({url:`/pages/policy/detail?id=${e.currentTarget.dataset.id}`})},
  removeFavorite(e){wx.removeStorageSync(`policy_collected_${e.currentTarget.dataset.id}`);this.loadFavorites();wx.showToast({title:'已取消收藏',icon:'none'})},
  onInput(e){this.setData({content:e.detail.value})},
  login(){wx.navigateTo({url:'/pages/login/index'})},
  async submit(){if(!auth.isLoggedIn())return this.login();const content=this.data.content.trim();if(content.length<5)return wx.showToast({title:'请至少填写5个字',icon:'none'});this.setData({submitting:true});try{const res=await auth.request('POST','/api/feedback',{content,contact:'',images:[]});if(res.code!==200)throw new Error(res.msg);this.setData({content:''});wx.showToast({title:'感谢你的评价',icon:'success'});await this.loadFeedbacks()}catch(error){wx.showToast({title:error.message||'提交失败',icon:'none'})}finally{this.setData({submitting:false})}},
  onPullDownRefresh(){this.loadFavorites();if(auth.isLoggedIn())this.loadFeedbacks();else wx.stopPullDownRefresh()},
  back(){if(getCurrentPages().length>1)wx.navigateBack();else wx.switchTab({url:'/pages/my/index'})}
})
