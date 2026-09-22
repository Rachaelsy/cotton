const auth = require('./auth')
const progress = require('./academy-progress')
const owner = () => auth.isLoggedIn() && auth.getUser() ? String(auth.getUser().id) : 'guest'
const queueKey = who => `academy_watch_queue_v1_${who}`
const activeFlushes = new Map()
const rejectedSessions = new Map()
function merge(ranges) {
  const result=[]
  ranges.slice().sort((a,b)=>a[0]-b[0]).forEach(pair=>{
    const last=result[result.length-1]
    if(last&&pair[0]<=last[1])last[1]=Math.max(last[1],pair[1]);else result.push(pair.slice())
  })
  return result
}
async function flushQueue(who=owner()) {
  if(who==='guest'||owner()!==who)return
  if(activeFlushes.has(who))return activeFlushes.get(who)
  const task=(async()=>{
    const queue=wx.getStorageSync(queueKey(who))||{}
    for(const [id,entry] of Object.entries(queue)) {
      if(owner()!==who)return
      try {
        const result=await auth.request('POST',`/api/miniapp-academy/courses/${encodeURIComponent(entry.courseId)}/watch`,entry.payload)
        if(owner()!==who)return
        const current=wx.getStorageSync(queueKey(who))||{}
        if(result.code===200) {
          progress.save(entry.courseId,result.data)
          if(current[id]&&current[id].payload.sequence===entry.payload.sequence)delete current[id]
        }else if([400,404,409].includes(result.code)) {
          rejectedSessions.set(`${who}:${id}`, result.msg || '学习记录未被接受，请重新打开课程')
          delete current[id]
        }
        else break
        wx.setStorageSync(queueKey(who),current)
      }catch(_){break}
    }
  })().finally(()=>activeFlushes.delete(who))
  activeFlushes.set(who,task)
  return task
}
class WatchTracker {
  constructor(course,onUpdate) {
    this.course=course;this.owner=owner();this.onUpdate=onUpdate;this.ranges=[];this.position=0
    this.duration=Number(course.durationSeconds)||0;this.sequence=0;this.playing=false;this.last=null;this.lastFlush=0
  }
  valid(){return !this.closed&&owner()===this.owner}
  async start() {
    if(!this.valid()||this.sessionId||this.starting)return
    this.starting=true
    try {
      if(this.owner==='guest'){this.sessionId='guest';return}
      await flushQueue(this.owner)
      if(!this.valid())return
      const result=await auth.request('POST',`/api/miniapp-academy/courses/${encodeURIComponent(this.course.id)}/watch/start`)
      if(!this.valid())return
      if(result.code!==200)throw Error(result.msg||'学习进度暂时无法同步')
      this.sessionId=result.data.sessionId;this.duration=result.data.duration;this.last=null
      progress.save(this.course.id,result.data);this.onUpdate(result.data,'已同步')
    }catch(e){if(this.valid())this.onUpdate(null,e.message||'进度待同步，请检查网络')}
    finally{this.starting=false}
  }
  play(){this.playing=true;this.last=null;this.start()}
  checkDuration(actual) {
    if (Number.isFinite(actual) && actual > 0 && Math.abs(actual-this.duration)>Math.max(2,this.duration*.02)) {
      this.invalidDuration=true
      this.last=null
      this.onUpdate(null,'视频时长与课程配置不一致，暂不计入进度，请联系管理员核对时长')
    }
    return !this.invalidDuration
  }
  tick(position) {
    if(!this.valid()||this.invalidDuration||this.rejected||!Number.isFinite(position))return
    const now=Date.now();this.position=Math.max(0,Math.min(position,this.duration))
    if(this.playing&&this.sessionId&&this.last) {
      const elapsed=(now-this.last.time)/1000,delta=this.position-this.last.position
      // 拖动导致的位置跳跃、缓冲和后台停留不计为连续观看。
      if(elapsed>0&&elapsed<3&&delta>0&&delta<=elapsed*2+.35) this.ranges=merge([...this.ranges,[this.last.position,this.position]])
    }
    this.last=this.playing?{time:now,position:this.position}:null
    if(now-this.lastFlush>=10000){this.lastFlush=now;this.start();this.flush()}
  }
  async flush() {
    if(!this.valid()||this.invalidDuration||this.rejected||!this.sessionId)return
    if(this.owner==='guest') {
      const saved=progress.read()[this.course.id]||{}
      const version=this.course.videoVersion||this.course.videoUrl
      const ranges=merge([...(saved.version===version?saved.ranges||[]:[]),...this.ranges])
      const watched=ranges.reduce((s,p)=>s+p[1]-p[0],0)
      const value={version,ranges,position:this.position,percent:Math.min(99,Math.floor(watched/Math.max(1,this.duration)*100)),completed:false}
      progress.save(this.course.id,value);this.onUpdate(value,'游客进度仅保存在本机，登录后记录学习成果');return
    }
    const queue=wx.getStorageSync(queueKey(this.owner))||{}
    queue[this.sessionId]={courseId:this.course.id,payload:{sessionId:this.sessionId,sequence:++this.sequence,position:this.position,ranges:this.ranges}}
    wx.setStorageSync(queueKey(this.owner),queue)
    await flushQueue(this.owner)
    if(!this.valid())return
    const rejectionKey=`${this.owner}:${this.sessionId}`
    if(rejectedSessions.has(rejectionKey)) {
      this.rejected=true
      this.onUpdate(null,`${rejectedSessions.get(rejectionKey)}，请重新加载课程`)
      rejectedSessions.delete(rejectionKey)
      return
    }
    const pending=(wx.getStorageSync(queueKey(this.owner))||{})[this.sessionId]
    const value=progress.read()[this.course.id]
    this.onUpdate(value,pending?'进度已暂存，联网后自动同步':'已同步')
  }
  pause(){this.playing=false;this.last=null;return this.flush()}
  close(){const pending=this.pause();this.closed=true;return pending}
}
module.exports={WatchTracker,flushQueue}
