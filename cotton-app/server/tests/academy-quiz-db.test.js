// Opt-in database smoke test; creates a uniquely named temporary series and removes only its own records.
require('dotenv').config()
const assert=require('assert/strict')
const crypto=require('crypto')
const express=require('express')
const db=require('../db/database')
const register=require('../routes/academy-quiz')
async function run(){
 const key='quiz-smoke-'+crypto.randomBytes(10).toString('hex')
 const app=express();app.use(express.json());const router=express.Router()
 register(router,{db,adminAuth:(req,res,next)=>next(),academyViewer:()=>null,requireLevelAccess:(req,res,level)=>{if(level==='basic')return true;res.status(401).json({code:401});return false},ok:(res,data)=>res.json({code:200,data}),fail:(res,msg,status=400)=>res.status(status).json({code:status,msg})});app.use(router)
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve))
 const request=async(path,body,method='POST')=>{const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json()}
 try{
  await db.query("INSERT INTO academy_series(series_key,title,level,status) VALUES (?,?,'basic','published')",[key,key])
  const body={seriesKey:key,title:'临时测验',passScore:60,status:'draft',questions:[{type:'single',title:'选A',options:['A','B'],answer:[0],explanation:'解析'}]}
  const created=await request('/admin/quizzes',body);assert.equal(created.code,200)
  const [[course]]=await db.query('SELECT course_key FROM academy_courses WHERE id=?',[created.data.id])
  assert.equal((await request(`/quizzes/${course.course_key}/start`,{})).code,404)
  assert.equal((await request(`/admin/quizzes/${created.data.id}`,{...body,version:1,status:'published'},'PUT')).code,200)
  const started=await request(`/quizzes/${course.course_key}/start`,{});assert.equal(started.code,200);assert.equal(started.data.questions[0].answer,undefined)
  assert.equal((await request(`/admin/quizzes/${created.data.id}`,{...body,version:1},'PUT')).code,409)
  const result=await request(`/quiz-attempts/${started.data.id}/submit`,{answers:[[0]]});assert.equal(result.data.score,100)
  assert.equal((await request(`/quiz-attempts/${started.data.id}/submit`,{answers:[[1]]})).data.score,100)
  console.log('Database smoke passed: create, draft visibility, publish, version conflict, start, grade and repeated submit')
 }finally{
  await db.query('DELETE a FROM academy_quiz_attempts a JOIN academy_courses c ON c.course_key=a.course_key WHERE c.series_key=?',[key])
  await db.query('DELETE FROM academy_courses WHERE series_key=?',[key])
  await db.query('DELETE FROM academy_series WHERE series_key=?',[key])
  server.close();await db.end()
 }
}
if(process.env.RUN_QUIZ_DB_TEST==='1')run().catch(e=>{console.error(e);process.exitCode=1})
else console.log('Set RUN_QUIZ_DB_TEST=1 to run the isolated database smoke test')
