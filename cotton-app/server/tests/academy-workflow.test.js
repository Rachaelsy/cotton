const assert = require('assert/strict')
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const root = path.resolve(__dirname, '../../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const routes = new Map()
let queries = []
let responder = () => [[]]
const db = { query: async (sql, params) => { queries.push({ sql, params }); return responder(sql, params) } }
const router = {}
;['get','post','put','patch','delete'].forEach(method => { router[method] = (url, ...handlers) => routes.set(`${method} ${url}`, handlers) })
vm.runInNewContext(read('cotton-app/server/routes/academy.js'), {
  require: name => name === './academy-quiz' ? require('../routes/academy-quiz') : name === 'express' ? { Router: () => router } : name === '../db/database' ? db : name === 'jsonwebtoken' ? { verify: () => ({ id: 1, role: 'farmer' }) } : require(name),
  module: { exports: {} }, process: { env: {} }, console, Buffer
})
async function invoke(method, url, req = {}) {
  let result; let status = 200
  const res = { status(code) { status = code; return this }, json(body) { result = body; return body } }
  const handlers = routes.get(`${method} ${url}`)
  await handlers[handlers.length - 1]({ body: {}, params: {}, query: {}, headers: {}, viewer: { id: 1 }, admin: { id: 1 }, ...req }, res)
  return { status, result }
}
async function run() {
  responder = () => [{ insertId: 7 }]
  await invoke('post', '/admin/series', { body: { title: '播种课程' } })
  assert.match(queries.at(-1).params[0], /^series-[a-f0-9]{24}$/)
  queries = []
  responder = sql => sql.startsWith('SELECT series_key') ? [[{ series_key: 'stable-series' }]] : [{ affectedRows: 1 }]
  await invoke('put', '/admin/series/:id', { params: { id: 2 }, body: { title: '修改标题', seriesKey: 'should-not-change' } })
  assert.equal(queries.find(item => item.sql.startsWith('UPDATE academy_series')).params[0], 'stable-series')
  responder = () => [[]]; queries = []
  const missing = await invoke('get', '/courses/:courseId', { params: { courseId: 'hidden' } })
  assert.equal(missing.status, 404)
  assert.match(queries[0].sql, /s.status='published'/)
  assert.match(queries[0].sql, /c.status='published'/)
  queries = []
  responder = () => [[]]
  const guestCourses = await invoke('get', '/courses')
  assert.equal(guestCourses.status, 200)
  assert.match(queries[0].sql, /c\.level='basic'/, 'guests must only receive basic courses')
  queries = []
  await invoke('get', '/courses', { headers: { authorization: 'Bearer valid-user-token' } })
  assert.doesNotMatch(queries[0].sql, /c\.level='basic'/, 'logged-in users should receive every course level')
  const lockedList = await invoke('get', '/series', { query: { level: 'advanced' } })
  assert.equal(lockedList.status, 401, 'advanced series list must require login')
  responder = () => [[{ id: 9, course_key: 'advanced-lesson', level: 'advanced', status: 'published' }]]
  const lockedCourse = await invoke('get', '/courses/:courseId', { params: { courseId: 'advanced-lesson' } })
  assert.equal(lockedCourse.status, 401, 'direct advanced course links must require login')
  let completed = false; let pointAwarded = false
  db.getConnection = async () => ({
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    query: async (sql, params) => {
      if (sql.includes('SELECT c.level')) return [[{ level: 'basic' }]]
      if (sql.startsWith('SELECT completed_at')) return completed ? [[{ completed_at: new Date() }]] : [[]]
      if (sql.startsWith('INSERT IGNORE INTO academy_progress')) { completed = true; return [{ affectedRows: 1 }] }
      if (sql.startsWith('INSERT IGNORE INTO academy_learning_points')) { const affectedRows = pointAwarded ? 0 : 1; pointAwarded = true; return [{ affectedRows }] }
      if (sql.startsWith('SELECT COALESCE(SUM(points)')) return [[{ total: pointAwarded ? 5 : 0 }]]
      return [{ affectedRows: 1 }]
    }
  })
  const firstComplete = await invoke('post', '/courses/:courseId/complete', { params: { courseId: 'lesson' }, viewer: { id: 42 } })
  assert.equal(firstComplete.result.data.completed, true)
  assert.equal(firstComplete.result.data.awardedPoints, 5)
  const repeatedComplete = await invoke('post', '/courses/:courseId/complete', { params: { courseId: 'lesson' }, viewer: { id: 42 } })
  assert.equal(repeatedComplete.result.data.awardedPoints, 0, 'repeated completion must not award points twice')
  let committed = false; let rolledBack = false; const orderUpdates = []
  db.getConnection = async () => ({
    beginTransaction: async () => {}, commit: async () => { committed = true }, rollback: async () => { rolledBack = true }, release: () => {},
    query: async (sql, params) => {
      if (sql.startsWith('SELECT series_key')) return [[{ series_key: 'series' }]]
      if (sql.startsWith('SELECT id')) return [[{ id: 1 }, { id: 2 }]]
      orderUpdates.push(params); return [{ affectedRows: 1 }]
    }
  })
  await invoke('put', '/admin/series/:id/order', { params: { id: 1 }, body: { ids: [2, 1] } })
  assert.equal(committed, true); assert.equal(orderUpdates[0][2], 2)
  assert.equal((await invoke('put', '/admin/series/:id/order', { params: { id: 1 }, body: { ids: [2, 9] } })).status, 400)
  assert.equal(rolledBack, true)

  let page
  const store = {}; let user = { id: 1 }
  const auth = { getUser: () => user, isLoggedIn: () => true, request: async (method, url) => url.endsWith('/complete') ? ({ code: 200, data: { completed: true, awardedPoints: 5 } }) : ({ code: 200, data: [] }) }
  const wx = { getStorageSync: key => store[key], setStorageSync: (key,value) => { store[key] = value } }
  const progressModule = { exports: {} }
  vm.runInNewContext(read('cotton-public/utils/academy-progress.js'), { require: () => auth, module: progressModule, wx, console })
  const progress = progressModule.exports
  await progress.complete('lesson')
  assert.equal(progress.read().lesson.completed, true)
  user = { id: 2 }; assert.equal(progress.read().lesson, undefined)
  user = { id: 1 }; assert.equal(progress.percentages().lesson, 100)
  vm.runInNewContext(read('cotton-public/pages/academy/index.js'), { require: name => name.includes('academy-progress') ? progress : name.includes('academy-data') ? { LEVELS: [], SERIES: [], COURSES: [] } : auth, Page: value => { page = value }, wx, console })
  page.setData = function(value) { Object.assign(this.data, value) }
  page.allSeries = [{ id: 'old', level: 'basic' }]
  await page.loadSeries()
  assert.equal(page.data.series.length, 0, 'empty server response must clear old series')
  assert.equal(page.data.loading, false)
  auth.request = async () => { throw new Error('offline') }
  await page.loadSeries()
  assert.ok(page.data.error, 'network errors must not appear as empty courses')
  console.log('Academy workflow behavior tests passed')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
