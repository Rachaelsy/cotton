const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

const route = read('routes/knowledge.js')
const migration = read('db/migrate.js')
const indexHtml = read('public/knowledge/index.html')
const indexJs = read('public/knowledge/index.js')
const detailHtml = read('public/knowledge/detail.html')
const detailJs = read('public/knowledge/detail.js')
const forumHtml = read('public/knowledge/forum.html')
const adminHtml = read('public/knowledge/admin.html')
const adminJs = read('public/knowledge/admin.js')
const adminLogin = read('public/knowledge/admin-login.html')
const styles = read('public/knowledge/styles.css')

for (const table of [
  'knowledge_contents', 'knowledge_comments', 'knowledge_progress', 'knowledge_favorites',
  'knowledge_questions', 'knowledge_answers', 'knowledge_answer_votes'
]) {
  assert(migration.includes(table), `migration should manage ${table}`)
}

for (const endpoint of [
  "router.get('/home'", "router.get('/contents/:id'", "router.post('/contents/:id/comments'",
  "router.post('/forum'", "router.post('/forum/:id/answers'", "router.get('/admin/contents'"
]) {
  assert(route.includes(endpoint), `knowledge route should include ${endpoint}`)
}

assert(indexHtml.includes('课程学习') && indexHtml.includes('棉友问答'), 'public page should expose courses and forum')
assert(indexHtml.includes('id="registerForm"') && indexJs.includes('/api/community-auth/register'), 'community should provide independent registration')
assert(detailJs.includes('/api/community-auth/login'), 'course login should use community authentication')
assert(detailJs.includes('/api/community-ai/chat'), 'course detail should retain AI Q&A')
assert(route.includes('parent_nickname') && detailJs.includes('parent_id'), 'comments should support replies')
assert(adminLogin.includes('/api/community-auth/admin/login'), 'community should have an independent admin login')
assert(adminJs.includes('/knowledge/admin-login.html'), 'expired admin sessions should return to community login')
assert(adminHtml.includes('/platform/admin'), 'community admin should link back to cotton-app')
assert(indexHtml.includes('/knowledge/') && detailHtml.includes('/knowledge/') && forumHtml.includes('/knowledge/'), 'learning pages should return to the community service homepage')
assert(styles.includes('/assets/knowledge-hero-v2.webp'), 'community should serve its own hero asset')
assert(!route.includes('/admin/assets/'), 'community API should not depend on cotton-app static assets')
assert(!indexJs.includes('/api/auth/'), 'community client should not call cotton-app authentication routes')

for (const asset of [
  'knowledge-hero-v2.webp', 'course-seedling-v2.webp', 'course-scouting-v2.webp',
  'course-water-v2.webp', 'course-lifecycle-v1.webp'
]) {
  assert(fs.existsSync(path.join(root, 'public', 'assets', asset)), `missing community asset ${asset}`)
}

console.log('knowledge community tests passed')
