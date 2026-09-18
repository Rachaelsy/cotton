const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const source = fs.readFileSync(path.join(__dirname, '../public/knowledge/academy-admin.js'), 'utf8')
const nodes = new Map()
function node(id) {
  if (!nodes.has(id)) nodes.set(id, {
    value: '', checked: false, disabled: false, textContent: '',
    classList: { add() {}, remove() {}, toggle() {} },
    closest() { return this }, pause() {}, load() {}, removeAttribute() {}, reset() {}
  })
  return nodes.get(id)
}
const requests = []; const notifications = []
const series = [{ id: 'series-a', databaseId: 8, title: '系列', level: 'basic', status: 'draft' }]
const courses = [1,2].map(id => ({ id: `lesson-${id}`, databaseId: id, seriesKey: 'series-a', lessonNo: id }))
let failSave = false
const window = { CottonRuntime: {
  requestJson: async (url, options) => {
    requests.push({ url, options })
    if (options.method && failSave) throw new Error('保存失败测试')
    return { data: url.endsWith('/series') ? series : url.endsWith('/courses') ? courses : [] }
  },
  notify: (message, type) => notifications.push({ message, type })
} }
// Execute the production event handlers with a minimal form DOM and mock HTTP.
vm.runInNewContext(source.slice(0, source.indexOf('  const controls =')) + '\nwindow.actions = { saveCourse, tableAction, state }; })()', {
  window, document: { getElementById: node }, localStorage: { getItem: () => '' }, console
})
const actions = window.actions
const submit = { disabled: false }
const event = { preventDefault() {}, target: { querySelector: () => submit } }
async function run() {
  node('academyVideoUrl').value = 'https://example.com/lesson.mp4'
  node('academyTitle').value = '真实视频标题'
  node('academySeries').value = 'series-a'
  await actions.saveCourse(event)
  assert.ok(requests.some(r => r.options.method === 'POST' && r.url.endsWith('/courses')), 'new course must reach the API')
  assert.equal(notifications.at(-1).type, 'success')
  assert.equal(submit.disabled, false)
  node('academyCourseId').value = '1'
  await actions.saveCourse(event)
  assert.ok(requests.some(r => r.options.method === 'PUT' && r.url.endsWith('/courses/1')), 'edit must reach the API')
  await actions.tableAction({ target: { closest: () => ({ dataset: { manageSeries: 'series-a' } }) } })
  assert.equal(actions.state.selected, 'series-a')
  await actions.tableAction({ target: { closest: () => ({ dataset: { move: '1', direction: '1' } }) } })
  const reorder = requests.find(r => r.url.endsWith('/series/8/order'))
  assert.deepEqual(JSON.parse(reorder.options.body).ids, [2,1])
  failSave = true
  await actions.saveCourse(event)
  assert.equal(node('academyCourseMessage').textContent, '保存失败测试')
  assert.equal(submit.disabled, false, 'failed request must re-enable submit')
  console.log('Academy admin create/edit/navigation/reorder behavior tests passed')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
