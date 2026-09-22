const crypto = require('crypto')
const { videoVersion, mergeRanges, coverage, decodeRanges, progressView } = require('../utils/academy-watch')

module.exports = (router, { db, farmerAuth, ok, fail }) => {
  async function transaction(req, res, work) {
    let conn
    try {
      conn = await db.getConnection()
      await conn.beginTransaction()
      const value = await work(conn)
      await conn.commit()
      return ok(res, value)
    } catch (error) {
      if (conn) await conn.rollback()
      console.error('[academy-watch]', error.message)
      return fail(res, error.publicMessage || '学习记录暂时无法同步，请重试', error.status || 500)
    } finally { if (conn) conn.release() }
  }
  function reject(message, status = 400) { const e = new Error(message); e.publicMessage = message; e.status = status; throw e }
  async function courseFor(conn, key) {
    const [[course]] = await conn.query(`SELECT c.* FROM academy_courses c JOIN academy_series s ON s.series_key=c.series_key
      WHERE c.course_key=? AND c.type='video' AND c.status='published' AND s.status='published' FOR UPDATE`, [key])
    if (!course || !course.video_url) reject('课程已下架或不可播放', 404)
    return course
  }
  router.post('/courses/:courseId/watch/start', farmerAuth, (req, res) => transaction(req, res, async conn => {
    const course = await courseFor(conn, req.params.courseId)
    const version = videoVersion(course)
    await conn.query('INSERT IGNORE INTO academy_progress(user_id,course_key) VALUES (?,?)', [req.viewer.id, course.course_key])
    let [[row]] = await conn.query('SELECT * FROM academy_progress WHERE user_id=? AND course_key=? FOR UPDATE', [req.viewer.id, course.course_key])
    if (row.video_version !== version) {
      // 旧手动完成记录保留；已有版本的视频更换后重新记录观看，但不会再次发积分。
      const keepLegacy = !row.video_version && row.completed_at
      await conn.query(`UPDATE academy_progress SET video_version=?,watched_ranges='[]',watched_seconds=0,last_position=0,
        completed_at=?,completion_source=? WHERE user_id=? AND course_key=?`,
      [version, keepLegacy || null, keepLegacy ? 'legacy' : 'auto', req.viewer.id, course.course_key])
      row = { ...row, video_version: version, watched_seconds: 0, last_position: 0, completed_at: keepLegacy || null, completion_source: keepLegacy ? 'legacy' : 'auto' }
    }
    const sessionId = crypto.randomBytes(24).toString('hex')
    await conn.query('INSERT INTO academy_watch_sessions(id,user_id,course_key,video_version) VALUES (?,?,?,?)', [sessionId, req.viewer.id, course.course_key, version])
    await conn.query('UPDATE academy_progress SET updated_at=NOW() WHERE user_id=? AND course_key=?', [req.viewer.id, course.course_key])
    return { sessionId, duration: Number(course.duration_seconds), ...progressView(row, course.duration_seconds) }
  }))

  router.post('/courses/:courseId/watch', farmerAuth, (req, res) => transaction(req, res, async conn => {
    const course = await courseFor(conn, req.params.courseId)
    const [[session]] = await conn.query('SELECT * FROM academy_watch_sessions WHERE id=? AND user_id=? AND course_key=? FOR UPDATE', [String(req.body.sessionId || ''), req.viewer.id, course.course_key])
    if (!session || session.video_version !== videoVersion(course)) reject('学习会话已失效，请重新打开课程', 409)
    const elapsed = Math.max(0, (Date.now() - new Date(session.created_at).getTime()) / 1000)
    if (elapsed > 86400) reject('学习会话已过期，请重新打开课程', 409)
    const sequence = Number(req.body.sequence), position = Number(req.body.position)
    if (!Number.isSafeInteger(sequence) || sequence < 1 || !Number.isFinite(position) || position < 0 || position > Number(course.duration_seconds) + 1) reject('播放进度无效')
    const [[row]] = await conn.query('SELECT * FROM academy_progress WHERE user_id=? AND course_key=? FOR UPDATE', [req.viewer.id, course.course_key])
    if (!row || row.video_version !== session.video_version) reject('视频已更新，请重新打开课程', 409)
    if (sequence <= session.last_sequence) return { ...progressView(row, course.duration_seconds), awardedPoints: 0 }
    let incoming, combined
    try {
      incoming = mergeRanges(req.body.ranges, Number(course.duration_seconds))
      if (coverage(incoming) > elapsed * 2 + 2) reject('观看进度与播放时间不符')
      combined = mergeRanges([...decodeRanges(row.watched_ranges), ...incoming], Number(course.duration_seconds))
    } catch (e) { reject(e.publicMessage || '观看片段无效') }
    const watched = coverage(combined)
    const completed = Boolean(row.completed_at) || watched >= Number(course.duration_seconds) * .95
    let awardedPoints = 0
    if (completed && !row.completed_at) {
      const points = { basic: 5, intermediate: 8, advanced: 10 }[course.level] || 5
      const [award] = await conn.query(`INSERT IGNORE INTO academy_learning_points(user_id,course_key,points,reason) VALUES (?,?,?,'首次有效观看达到95%')`, [req.viewer.id, course.course_key, points])
      if (award.affectedRows) awardedPoints = points
    }
    // 同一用户的多个设备合并片段；重传的旧包不会回退断点。
    await conn.query(`UPDATE academy_progress SET watched_ranges=?,watched_seconds=?,last_position=?,
      completed_at=IF(?,COALESCE(completed_at,NOW()),completed_at),updated_at=NOW() WHERE user_id=? AND course_key=?`,
    [JSON.stringify(combined), watched, Math.min(position, course.duration_seconds), completed, req.viewer.id, course.course_key])
    await conn.query('UPDATE academy_watch_sessions SET last_sequence=? WHERE id=?', [sequence, session.id])
    return { ...progressView({ ...row, watched_seconds: watched, last_position: position, completed_at: row.completed_at || (completed ? new Date().toISOString() : null) }, course.duration_seconds), awardedPoints }
  }))
}
