// Explicit opt-in. Creates a unique temporary course and removes only its own records.
const assert=require('assert/strict')
async function run() {
  const express=require('express'),crypto=require('crypto'),db=require('../db/database')
  const register=require('../routes/academy-watch')
  const key='watch-test-'+crypto.randomBytes(10).toString('hex')
  const app=express();app.use(express.json());const router=express.Router()
  register(router,{db,farmerAuth:(req,res,next)=>{req.viewer={id:Number(req.headers['x-test-user']||4000000001)};next()},
    ok:(res,data)=>res.json({code:200,data}),fail:(res,msg,status=400)=>res.status(status).json({code:status,msg})})
  app.use(router)
  app.use('/full',require('../routes/academy'))
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve))
  const request=async(suffix,payload={},user=4000000001)=>{
    const res=await fetch(`http://127.0.0.1:${server.address().port}/courses/${key}/watch${suffix}`,{method:'POST',headers:{'Content-Type':'application/json','x-test-user':String(user)},body:JSON.stringify(payload)})
    return res.json()
  }
  const full=async suffix=>{
    const token=require('jsonwebtoken').sign({id:4000000001,role:'farmer'},process.env.JWT_SECRET,{expiresIn:'1m'})
    return (await fetch(`http://127.0.0.1:${server.address().port}/full/${suffix}`,{headers:{authorization:`Bearer ${token}`}})).json()
  }
  try {
    await db.query("INSERT INTO academy_series(series_key,title,level,status) VALUES (?,?,'basic','published')",[key,key])
    await db.query("INSERT INTO academy_courses(course_key,series_key,title,level,type,status,duration_seconds,video_url) VALUES (?,?,?,'basic','video','published',100,'https://example.com/watch-test.mp4')",[key,key,key])
    const start=await request('/start');assert.equal(start.code,200,JSON.stringify(start))
    const payload={sessionId:start.data.sessionId,sequence:1,position:95,ranges:[[0,95]]}
    assert.equal((await request('',payload)).code,400,'instant completion rejected')
    assert.equal((await request('',payload,4000000002)).code,409,'session is user-bound')
    await db.query('UPDATE academy_watch_sessions SET created_at=DATE_SUB(NOW(),INTERVAL 100 SECOND) WHERE id=?',[payload.sessionId])
    const complete=await request('',payload);assert.equal(complete.code,200,JSON.stringify(complete));assert.equal(complete.data.completed,true);assert.equal(complete.data.awardedPoints,5)
    await db.query("INSERT INTO academy_courses(course_key,series_key,title,level,type,status,lesson_no,quiz_json) VALUES (?,?,?,'basic','quiz','published',2,?)",[key+'-quiz',key,'临时测验',JSON.stringify({questions:[]})])
    const learning=await full('learning');assert.equal(learning.code,200,JSON.stringify(learning))
    const group=learning.data.series.find(row=>row.id===key)
    assert.equal(group.progress,50);assert.equal(group.currentCourse.rawType,'quiz');assert.equal(group.currentCourse.id,key+'-quiz')
    const recorded=await full('progress');assert.equal(recorded.data.find(row=>row.course_key===key).percent,100)
    const duplicate=await request('',{...payload,position:10});assert.equal(duplicate.data.position,95);assert.equal(duplicate.data.awardedPoints,0)
    const replay=await request('',{...payload,sequence:2,ranges:[[0,80],[70,95]]});assert.equal(replay.data.watchedSeconds,95);assert.equal(replay.data.awardedPoints,0)
    await db.query("UPDATE academy_courses SET status='offline' WHERE course_key=?",[key])
    assert.equal((await request('',{...payload,sequence:3})).code,404)
    await db.query("UPDATE academy_series SET status='offline' WHERE series_key=?",[key])
    assert.equal((await full('learning')).data.series.find(row=>row.id===key).currentCourse,null)
    await db.query("UPDATE academy_series SET status='published' WHERE series_key=?",[key])
    await db.query("UPDATE academy_courses SET status='published',video_url='https://example.com/replacement.mp4' WHERE course_key=?",[key])
    assert.equal((await request('',{...payload,sequence:3})).code,409)
    const replacement=await request('/start');assert.equal(replacement.data.completed,false);assert.equal(replacement.data.percent,0)
    await db.query('UPDATE academy_watch_sessions SET created_at=DATE_SUB(NOW(),INTERVAL 100 SECOND) WHERE id=?',[replacement.data.sessionId])
    const again=await request('',{...payload,sessionId:replacement.data.sessionId});assert.equal(again.data.completed,true);assert.equal(again.data.awardedPoints,0)
    const [[points]]=await db.query('SELECT COUNT(*) total FROM academy_learning_points WHERE course_key=?',[key]);assert.equal(points.total,1)
    // Legacy manual completions are not erased or awarded again.
    await db.query('INSERT INTO academy_progress(user_id,course_key,completed_at) VALUES (4000000002,?,NOW())',[key])
    const legacy=await request('/start',{},4000000002);assert.equal(legacy.data.completed,true);assert.equal(legacy.data.completionSource,'legacy')
    console.log('Academy watch DB: timing, user binding, idempotency, merged coverage, offline courses, version reset and legacy records passed')
  } finally {
    for(const table of ['academy_watch_sessions','academy_learning_points','academy_progress','academy_courses'])await db.query(`DELETE FROM ${table} WHERE course_key IN (?,?)`,[key,key+'-quiz'])
    await db.query('DELETE FROM academy_series WHERE series_key=?',[key])
    await new Promise(resolve=>server.close(resolve));await db.end()
  }
}
if(process.env.RUN_ACADEMY_WATCH_DB_TEST==='1')run().catch(error=>{console.error(error);process.exitCode=1})
else console.log('Set RUN_ACADEMY_WATCH_DB_TEST=1 to run isolated DB tests')
