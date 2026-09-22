const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const { selectPublishedCurrentCourse } = require('../utils/academy-learning')

const group = {
  courses: [
    { id: 'offline-course', title: '已下架课程' },
    { id: 'published-finished', title: '仍上架的已完成课程' }
  ]
}

assert.deepEqual(
  selectPublishedCurrentCourse(group, [
    { id: 'published-finished', title: '仍上架的已完成课程' },
    { id: 'published-next', title: '下一节' }
  ]),
  { id: 'published-next', title: '下一节' },
  '应优先推荐仍上架且未完成的课时'
)

assert.deepEqual(
  selectPublishedCurrentCourse(group, [
    { id: 'published-finished', title: '仍上架的已完成课程' }
  ]),
  { id: 'published-finished', title: '仍上架的已完成课程' },
  '全部学完时只能回到仍上架的课时'
)

assert.equal(
  selectPublishedCurrentCourse(group, []),
  null,
  '系列没有上架课时时不得推荐历史下架课程'
)

const routeSource = fs.readFileSync(path.resolve(__dirname, '../routes/academy.js'), 'utf8')
assert.ok(
  routeSource.includes("JOIN academy_series s ON s.series_key=c.series_key AND s.status='published'"),
  '系列下架后，即使课时自身仍标记为 published，也不得进入推荐候选'
)

console.log('Academy published course recommendation tests passed')
