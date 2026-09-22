const assert = require('assert/strict')
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const source = fs.readFileSync(path.resolve(__dirname, '../../../cotton-public/pages/learning/index.js'), 'utf8')
let page
const navigations = []
const response = {
  code: 200,
  data: {
    summary: { totalPoints: 13, completedCount: 2, quizPassedCount: 1 },
    series: [
      { id: 'offline', title: '已下架系列', level: 'basic', totalCount: 0, completedCount: 1, points: 5, progress: 100, updatedAt: '2026-09-19T10:00:00', currentCourse: null },
      { id: 'a', title: '播种', level: 'basic', totalCount: 2, completedCount: 1, points: 5, progress: 50, updatedAt: '2026-09-18T10:00:00', currentCourse: { id: 'a2', title: '第二课' } },
      { id: 'b', title: '蕾期', level: 'intermediate', totalCount: 1, completedCount: 1, points: 8, progress: 100, updatedAt: '2026-09-18T11:00:00', currentCourse: { id: 'b1', title: '第一课' } }
    ],
    pointRecords: [{ title: '第一课', level: 'basic', points: 5, reason: '首次完成课时', created_at: '2026-09-18T10:00:00' }]
  }
}
const auth = { isLoggedIn: () => true, request: async () => response }
const wx = { getSystemInfoSync: () => ({ statusBarHeight: 30 }), navigateTo: value => navigations.push(value.url), switchTab: value => navigations.push(value.url) }
vm.runInNewContext(source, { require: name => name.includes('academy-watch') ? { flushQueue: async () => {} } : auth, Page: value => { page = value }, wx, getCurrentPages: () => [{}], console, Date, encodeURIComponent })
page.setData = function(value) { Object.assign(this.data, value) }
async function run() {
  page.onLoad(); await page.load()
  assert.equal(page.data.summary.totalPoints, 13)
  assert.equal(page.data.summary.quizPassedCount, 1)
  assert.equal(page.data.visibleSeries.length, 3)
  page.filterSeries('completed')
  assert.deepEqual(page.data.visibleSeries.map(item => item.id), ['b'])
  page.openRecent(); assert.match(navigations[0], /academy\/course\?id=a2/)
  page.openPoints(); assert.equal(page.data.showPoints, true)
  page.closePoints(); assert.equal(page.data.showPoints, false)
  console.log('Learning center summary/filter/navigation tests passed')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
