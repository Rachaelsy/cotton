const assert=require('assert/strict')
const register=require('../routes/academy-quiz')
const {validate,grade}=register
const quiz=validate({title:'播种测验',passScore:60,questions:[
 {type:'single',title:'单选',options:['A','B'],answer:[0]},
 {type:'multiple',title:'多选',options:['A','B','C'],answer:[0,2]},
 {type:'boolean',title:'判断',answer:[1]}
]})
assert.equal(grade(quiz,[[0],[2,0],[1]]).score,100)
assert.equal(grade(quiz,[[0],[0],[0]]).score,33)
assert.equal(grade(quiz,[[0],[0,1,2],[1]]).correctCount,2)
assert.throws(()=>grade(quiz,[[0],[],[1]]))
assert.throws(()=>validate({...quiz,questions:[{type:'single',title:'x',options:['a','b'],answer:[0,1]}]}))
assert.throws(()=>validate({...quiz,questions:[{type:'multiple',title:'x',options:['a','b'],answer:[0]}]}))
const routes={};const router={};for(const method of ['get','post','put'])router[method]=(path,...fn)=>routes[method+' '+path]=fn.at(-1)
let attempt;let writes=0
const db={query:async(sql,args)=>{
 if(sql.startsWith('SELECT c.*'))return [[{course_key:'quiz-1',access_level:'basic',series_key:'series',quiz_version:1,quiz_json:JSON.stringify(quiz)}]]
 if(sql.startsWith('INSERT INTO academy_quiz_attempts')){attempt={id:args[0],user_id:args[2],snapshot:args[4],status:'published',series_status:'published',access_level:'basic'};return [{}]}
 if(sql.startsWith('SELECT a.*'))return [[attempt]]
 if(sql.startsWith('UPDATE academy_quiz_attempts')){writes++;attempt.answers=args[0];attempt.submitted_at=new Date();return [{}]}
 if(sql.startsWith('SELECT answers'))return [[attempt]]
 throw Error(sql)
}}
register(router,{db,adminAuth:()=>{},academyViewer:req=>req.viewer||null,requireLevelAccess:(req,res,level)=>{if(level==='basic'||req.viewer)return true;res.status(401).json({code:401});return false},ok:(res,data)=>res.json({code:200,data}),fail:(res,msg,status=400)=>res.status(status).json({code:status,msg})})
async function call(path,body={},viewer=null){let data;const res={status(){return this},json(value){data=value}};await routes['post '+path]({params:{key:'quiz-1',id:attempt&&attempt.id},body,viewer},res);return data}
async function run(){
 const start=await call('/quizzes/:key/start')
 assert.ok(start.data.id);assert.equal(start.data.questions[0].answer,undefined);assert.equal(start.data.questions[0].explanation,undefined)
 quiz.questions[0].answer=[1]
 const result=await call('/quiz-attempts/:id/submit',{answers:[[0],[0,2],[1]]})
 assert.equal(result.data.score,100,'started attempts must use frozen question versions')
 const repeat=await call('/quiz-attempts/:id/submit',{answers:[[1],[1],[0]]})
 assert.equal(repeat.data.score,100);assert.equal(writes,1)
 attempt.user_id=8
 assert.equal((await call('/quiz-attempts/:id/submit',{}, {id:9})).code,403)
 attempt.access_level='advanced';attempt.user_id=null
 assert.equal((await call('/quiz-attempts/:id/submit')).code,401)
 console.log('Quiz validation, grading, answer secrecy, snapshot, ownership and idempotency tests passed')
}
run().catch(e=>{console.error(e);process.exitCode=1})
