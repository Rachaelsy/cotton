const assert = require('assert/strict')
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const { mergeRanges, coverage, videoVersion, progressView } = require('../utils/academy-watch')

assert.equal(coverage(mergeRanges([[0,20],[10,40],[60,80],[0,20]],100)),60)
for (const ranges of [[[0,200]], [[-1,2]], [[4,3]], [['0',1]], [[0,NaN]]]) assert.throws(()=>mergeRanges(ranges,100))
assert.equal(videoVersion({video_url:'https://example.com/a.mp4?t=1',duration_seconds:60}),videoVersion({video_url:'https://example.com/a.mp4?t=2',duration_seconds:60}))
assert.notEqual(videoVersion({video_url:'https://example.com/a.mp4',duration_seconds:60}),videoVersion({video_url:'https://example.com/b.mp4',duration_seconds:60}))
assert.equal(progressView({watched_seconds:94},100).percent,94)
assert.equal(progressView({watched_seconds:95,completed_at:new Date()},100).percent,100)

async function clientTests() {
  let now=1000,user='a',offline=false,responseCode=200,hold
  const storage={},cache={},calls=[]
  const auth={isLoggedIn:()=>user!=='guest',getUser:()=>user==='guest'?null:{id:user},request:async(method,url,payload)=>{
    calls.push({user,url,payload})
    if(hold)await hold
    if(offline)throw Error('offline')
    if(url.endsWith('/start'))return {code:200,data:{sessionId:'session-'+user,duration:100,percent:0,completed:false}}
    return {code:responseCode,msg:'会话失效',data:{percent:20,completed:false,position:payload.position}}
  }}
  const progress={read:()=>cache[user]||{},save:(id,value)=>{cache[user]={...cache[user],[id]:value}}}
  const context={module:{exports:{}},require:name=>name==='./auth'?auth:progress,Date:{now:()=>now},wx:{
    getStorageSync:key=>storage[key]&&JSON.parse(JSON.stringify(storage[key])),
    setStorageSync:(key,value)=>{storage[key]=JSON.parse(JSON.stringify(value))}
  }}
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../../cotton-public/utils/academy-watch.js'),'utf8'),context)
  const {WatchTracker,flushQueue}=context.module.exports
  const updates=[]
  const tracker=new WatchTracker({id:'course',durationSeconds:100,videoVersion:'v'},(data,message)=>updates.push({data,message}))
  await tracker.start();tracker.play();tracker.tick(0)
  now+=1000;tracker.tick(1)
  now+=1000;tracker.tick(80) // seek must not count 79 seconds
  now+=1000;tracker.tick(81)
  assert.equal(coverage(tracker.ranges),2)
  await tracker.pause();now+=1000;tracker.tick(82)
  assert.equal(coverage(tracker.ranges),2)
  offline=true;await tracker.flush()
  assert.ok(storage.academy_watch_queue_v1_a['session-a'])
  user='b';const count=calls.length;await flushQueue('a');assert.equal(calls.length,count)
  user='a';offline=false;await flushQueue();assert.deepEqual(storage.academy_watch_queue_v1_a,{})
  assert.equal(cache.a.course.percent,20)
  responseCode=409;await tracker.flush();assert.equal(tracker.rejected,true)
  assert.match(updates.at(-1).message,/重新加载/)
  responseCode=200
  const invalid=new WatchTracker({id:'bad',durationSeconds:60},()=>{})
  assert.equal(invalid.checkDuration(85),false)
  await invalid.start();invalid.play();invalid.tick(0);now+=1000;invalid.tick(1)
  assert.equal(invalid.ranges.length,0)
  // In-flight response for account A must not write into account B's progress.
  let release;hold=new Promise(resolve=>{release=resolve})
  const switched=new WatchTracker({id:'other',durationSeconds:100},()=>{})
  const started=switched.start();await Promise.resolve();await Promise.resolve()
  user='b';release();await started;assert.equal(cache.b,undefined);hold=null
  user='guest';const guest=new WatchTracker({id:'g',durationSeconds:100,videoVersion:'g'},()=>{})
  await guest.start();guest.ranges=[[0,100]];guest.position=100;await guest.flush()
  assert.equal(cache.guest.g.completed,false)
  assert.equal(cache.guest.g.percent,99)
  console.log('Academy watch: coverage, seek/pause, retry, identity isolation, duration guard and guest rules passed')
}
clientTests().catch(error=>{console.error(error);process.exitCode=1})
