const auth = require('../../utils/auth')
const API = '/api/miniapp-academy'
Page({
  data: { loading:true, error:'', quiz:null, index:0, options:[], result:null, submitting:false, onlyWrong:false },
  onLoad(options) { this.key=String(options.id||''); this.start() },
  async start() {
    this.setData({loading:true,error:'',result:null,onlyWrong:false})
    try {
      const r=await auth.request('POST',`${API}/quizzes/${encodeURIComponent(this.key)}/start`)
      if(r.code!==200) throw Error(r.msg)
      this.answers=r.data.questions.map(()=>[])
      this.setData({quiz:r.data,index:0,loading:false}); this.render()
    } catch(e) { this.setData({loading:false,error:e.message,needsLogin:e.statusCode===401}) }
  },
  render() {
    const q=this.data.quiz.questions[this.data.index]
    this.setData({question:q,typeName:{single:'单选题',multiple:'多选题',boolean:'判断题'}[q.type],options:q.options.map((text,i)=>({text,index:i,selected:this.answers[this.data.index].includes(i)}))})
  },
  select(e) {
    const i=Number(e.currentTarget.dataset.index), at=this.data.index
    if(this.data.submitting) return
    if(this.data.question.type==='multiple') this.answers[at]=this.answers[at].includes(i)?this.answers[at].filter(n=>n!==i):[...this.answers[at],i]
    else this.answers[at]=[i]
    this.render()
  },
  previous() { if(this.data.index>0) {this.setData({index:this.data.index-1});this.render()} },
  next() { if(this.data.index<this.data.quiz.questions.length-1) {this.setData({index:this.data.index+1});this.render()} },
  async submit() {
    if(this.data.submitting) return
    const missing=this.answers.findIndex(a=>!a.length)
    if(missing>=0) {this.setData({index:missing});this.render();return wx.showToast({title:'请完成这道题',icon:'none'})}
    this.setData({submitting:true})
    try {
      const r=await auth.request('POST',`${API}/quiz-attempts/${this.data.quiz.id}/submit`,{answers:this.answers})
      if(r.code!==200) throw Error(r.msg)
      const rows=r.data.results.map((q,i)=>({...q,number:i+1,answerText:q.answer.map(n=>q.options[n]).join('、'),selectedText:q.selected.map(n=>q.options[n]).join('、')}))
      this.setData({result:r.data,reviews:rows,visibleReviews:rows})
    }catch(e){wx.showToast({title:e.message||'提交失败，请重试',icon:'none'})}finally{this.setData({submitting:false})}
  },
  toggleWrong(){const onlyWrong=!this.data.onlyWrong;this.setData({onlyWrong,visibleReviews:onlyWrong?this.data.reviews.filter(q=>!q.correct):this.data.reviews})},
  async continueLearning(){
    try {const r=await auth.request('GET',`${API}/series/${encodeURIComponent(this.data.quiz.seriesKey)}`);if(r.code!==200)throw Error(r.msg);const rows=r.data.lessons;const at=rows.findIndex(q=>q.id===this.key);if(at>=0&&rows[at+1])return wx.redirectTo({url:`/pages/academy/course?id=${encodeURIComponent(rows[at+1].id)}`});this.directory()}catch(e){wx.showToast({title:e.message,icon:'none'})}
  },
  directory(){wx.redirectTo({url:`/pages/academy/series?id=${encodeURIComponent(this.data.quiz.seriesKey)}`})},
  login(){this.waitLogin=true;wx.navigateTo({url:'/pages/login/index'})},
  onShow(){if(this.waitLogin&&auth.isLoggedIn()){this.waitLogin=false;this.start()} }
})
