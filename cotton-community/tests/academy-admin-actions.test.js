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
let failMetadata = false
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
  window, document: { getElementById: node, createElement: () => ({duration:85.3,removeAttribute(){},load(){ if(this.onloadedmetadata) queueMicrotask(()=>failMetadata?this.onerror():this.onloadedmetadata()) }}) }, localStorage: { getItem: () => '' }, console, URL, setTimeout, clearTimeout
})
const actions = window.actions
const submit = { disabled: false }
const event = { preventDefault() {}, target: { querySelector: () => submit } }
async function run() {
  node('academyTitle').value = '真实视频标题'
  node('academySeries').value = 'series-a'
  node('academyVideoUrl').value = 'https://1441518090.vod-qcloud.com/path/video.mp4'
  await actions.saveCourse(event)
  assert.ok(requests.some(r => r.options.method === 'POST' && r.url.endsWith('/courses')), 'new course must reach the API')
  assert.equal(JSON.parse(requests.find(r => r.options.method === 'POST' && r.url.endsWith('/courses')).options.body).videoUrl, node('academyVideoUrl').value, 'VOD 地址必须随保存请求提交')
  assert.equal(JSON.parse(requests.find(r => r.options.method === 'POST' && r.url.endsWith('/courses')).options.body).durationSeconds,85,'必须提交自动读取的实际时长')
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
  failSave=false;failMetadata=true
  const before=requests.length
  await actions.saveCourse(event)
  assert.equal(requests.length,before,'时长识别失败不得保存错误时长')
  assert.match(node('academyCourseMessage').textContent,/无法读取视频时长/)
  assert.equal(submit.disabled,false)
  console.log('Academy admin create/edit/navigation/reorder behavior tests passed')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
