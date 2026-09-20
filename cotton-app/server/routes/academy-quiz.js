const crypto = require('crypto')
function validate(body) {
  const title = String(body.title || '').trim().slice(0,160)
  const questions = body.questions
  const passScore = Number(body.passScore)
  if (!title || !Array.isArray(questions) || !questions.length || questions.length > 50 || !Number.isInteger(passScore) || passScore < 1 || passScore > 100) throw Error('请填写标题、1～50 道题和 1～100 的及格线')
  return { title, passScore, questions: questions.map((q,i) => {
    const type = q.type
    const options = type === 'boolean' ? ['正确','错误'] : q.options
    const answer = Array.isArray(q.answer) ? [...new Set(q.answer)] : []
    if (!['single','multiple','boolean'].includes(type) || !String(q.title || '').trim() || !Array.isArray(options) || options.length < 2 || options.length > 6 || options.some(o => !String(o).trim()) || !answer.length || answer.some(a => !Number.isInteger(a) || a < 0 || a >= options.length) || (type !== 'multiple' && answer.length !== 1) || (type === 'multiple' && answer.length < 2)) throw Error(`第 ${i+1} 题的题干、选项或答案不完整`)
    return { type, title: String(q.title).trim().slice(0,2000), options: options.map(o => String(o).slice(0,500)), answer: answer.sort(), explanation: String(q.explanation || '').slice(0,3000) }
  }) }
}
function grade(quiz, answers) {
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) throw Error('请完成全部题目')
  const results = quiz.questions.map((q,i) => {
    const selected = answers[i]
    if (!Array.isArray(selected) || !selected.length || selected.some(a => !Number.isInteger(a) || a<0 || a>=q.options.length) || (q.type !== 'multiple' && selected.length !== 1)) throw Error(`请完成第 ${i+1} 题`)
    const correct = JSON.stringify([...new Set(selected)].sort()) === JSON.stringify(q.answer)
    return { ...q, selected, correct }
  })
  const correctCount = results.filter(r => r.correct).length
  const score = Math.round(correctCount / results.length * 100)
  return { score, passed: score >= quiz.passScore, correctCount, results }
}
module.exports = (router, { db, adminAuth, academyViewer, requireLevelAccess, ok, fail }) => {
  const wrap = fn => async (req,res) => { try { await fn(req,res) } catch(e) { console.error('[academy-quiz]',e.message); fail(res,e.message,400) } }
  router.get('/admin/quizzes/:id', adminAuth, wrap(async(req,res) => {
    const [[row]] = await db.query("SELECT * FROM academy_courses WHERE id=? AND type='quiz'",[req.params.id])
    if (!row) return fail(res,'测验不存在',404)
    ok(res,{ ...JSON.parse(row.quiz_json), id:row.id, version:row.quiz_version, status:row.status })
  }))
  router.post('/admin/quizzes', adminAuth, wrap(async(req,res) => {
    const quiz = validate(req.body)
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      const [[series]] = await conn.query('SELECT * FROM academy_series WHERE series_key=? FOR UPDATE',[req.body.seriesKey])
      if (!series) throw Error('系列不存在')
      const [[last]] = await conn.query('SELECT COALESCE(MAX(lesson_no),0) n FROM academy_courses WHERE series_key=?',[series.series_key])
      const [result] = await conn.query(`INSERT INTO academy_courses(course_key,series_key,level,type,title,lesson_no,sort_order,duration_seconds,quiz_json,quiz_version,status) VALUES (?,?,?,'quiz',?,?,?,0,?,1,?)`,['quiz-'+crypto.randomBytes(12).toString('hex'),series.series_key,series.level,quiz.title,last.n+1,last.n+1,JSON.stringify(quiz),req.body.status==='published'?'published':'draft'])
      await conn.commit(); ok(res,{id:result.insertId})
    } catch(e) { await conn.rollback(); throw e } finally { conn.release() }
  }))
  router.put('/admin/quizzes/:id', adminAuth, wrap(async(req,res) => {
    const quiz = validate(req.body)
    const [result] = await db.query("UPDATE academy_courses SET title=?,quiz_json=?,quiz_version=quiz_version+1,status=? WHERE id=? AND type='quiz' AND quiz_version=?",[quiz.title,JSON.stringify(quiz),req.body.status==='published'?'published':'draft',req.params.id,req.body.version])
    if (!result.affectedRows) return fail(res,'测验已被其他编辑更新，请重新打开后编辑',409)
    ok(res)
  }))
  router.post('/quizzes/:key/start', wrap(async(req,res) => {
    const [[row]] = await db.query("SELECT c.*,s.level access_level FROM academy_courses c JOIN academy_series s ON c.series_key=s.series_key WHERE c.course_key=? AND c.type='quiz' AND c.status='published' AND s.status='published'",[req.params.key])
    if (!row) return fail(res,'测验不存在或已下架',404)
    if (!requireLevelAccess(req,res,row.access_level)) return
    const viewer = academyViewer(req)
    const quiz = JSON.parse(row.quiz_json)
    const id = crypto.randomBytes(24).toString('hex')
    await db.query('INSERT INTO academy_quiz_attempts(id,course_key,user_id,version,snapshot) VALUES (?,?,?,?,?)',[id,row.course_key,viewer ? viewer.id:null,row.quiz_version,JSON.stringify(quiz)])
    ok(res,{ id, title:quiz.title, passScore:quiz.passScore, seriesKey:row.series_key, guest:!viewer, questions:quiz.questions.map(({answer,explanation,...q})=>q) })
  }))
  router.post('/quiz-attempts/:id/submit', wrap(async(req,res) => {
    const [[attempt]] = await db.query('SELECT a.*,c.status,c.level,s.status series_status,s.level access_level FROM academy_quiz_attempts a JOIN academy_courses c ON c.course_key=a.course_key JOIN academy_series s ON s.series_key=c.series_key WHERE a.id=?',[req.params.id])
    if (!attempt || attempt.status!=='published' || attempt.series_status!=='published') return fail(res,'测验不存在或已下架',404)
    if (!requireLevelAccess(req,res,attempt.access_level)) return
    const viewer = academyViewer(req)
    if (attempt.user_id && (!viewer || Number(viewer.id)!==Number(attempt.user_id))) return fail(res,'无权访问答题记录',403)
    const quiz = JSON.parse(attempt.snapshot)
    if (attempt.submitted_at) return ok(res,grade(quiz,JSON.parse(attempt.answers)))
    const result = grade(quiz,req.body.answers)
    await db.query('UPDATE academy_quiz_attempts SET answers=?,score=?,passed=?,submitted_at=NOW() WHERE id=? AND submitted_at IS NULL',[JSON.stringify(req.body.answers),result.score,result.passed?1:0,attempt.id])
    const [[saved]] = await db.query('SELECT answers FROM academy_quiz_attempts WHERE id=?',[attempt.id])
    ok(res,grade(quiz,JSON.parse(saved.answers)))
  }))
  router.get('/quiz-results', wrap(async(req,res) => {
    const viewer=academyViewer(req)
    if (!viewer) return fail(res,'请先登录',401)
    const [rows]=await db.query('SELECT course_key,MAX(score) score,MAX(passed) passed,COUNT(*) attempts FROM academy_quiz_attempts WHERE user_id=? AND submitted_at IS NOT NULL GROUP BY course_key',[viewer.id])
    ok(res,rows)
  }))
}
module.exports.validate=validate
module.exports.grade=grade
