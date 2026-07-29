const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const exists = file => fs.existsSync(path.join(root, file))

const route = read('routes/knowledge.js')
const siteRoute = read('routes/site.js')
const migration = read('db/migrate.js')
const siteHtml = read('public/site/index.html')
const siteApp = read('public/site/app.js')
const learningJs = read('public/site/learning.js')
const adminHtml = read('public/knowledge/admin.html')
const adminJs = read('public/knowledge/admin.js')
const adminLogin = read('public/knowledge/admin-login.html')
const styles = read('public/knowledge/styles.css')

for (const table of [
  'knowledge_contents', 'knowledge_comments', 'knowledge_progress', 'knowledge_favorites',
  'knowledge_questions', 'knowledge_answers', 'knowledge_answer_votes', 'community_service_requests'
  , 'farmer_points_accounts', 'farmer_points_transactions', 'community_sso_tickets'
]) {
  assert(migration.includes(table), `migration should manage ${table}`)
}

for (const endpoint of [
  "router.get('/home'", "router.get('/contents/:id'", "router.post('/contents/:id/comments'",
  "router.post('/forum'", "router.post('/forum/:id/answers'", "router.get('/admin/contents'"
]) {
  assert(route.includes(endpoint), `knowledge route should include ${endpoint}`)
}

assert(siteRoute.includes("'/public/courses'") && siteRoute.includes("'/public/forum'") && siteRoute.includes("'/public/login'"), 'public platform should own courses, forum and login routes')
assert(siteApp.includes('data-nav="courses"') && siteApp.includes("action.textContent = account"), 'courses and login should be separate header actions')
assert(siteHtml.includes('/knowledge/site/learning.js'), 'shared public shell should load integrated learning views')
assert(learningJs.includes('/api/community-auth/register') && learningJs.includes('publicRegisterForm'), 'public platform should provide independent registration')
assert(learningJs.includes('/api/community-auth/login') && learningJs.includes('publicLoginForm'), 'course login should use community authentication')
assert(learningJs.includes('/api/community-auth/ticket-login'), 'miniapp users should exchange a one-time ticket on the public platform')
assert(route.includes("router.get('/me/points'") && route.includes('awardCourseCompletion'), 'course completion should award shared farmer points')
assert(route.includes('const duration = canonicalDuration || 300'), 'course completion must use server-owned duration')
assert(route.includes('progress_seconds=GREATEST(progress_seconds,VALUES(progress_seconds))'), 'saved course progress must not move backwards')
assert(learningJs.includes('/api/community-ai/chat'), 'course detail should retain AI Q&A')
assert(route.includes('parent_nickname') && learningJs.includes('parent_id'), 'comments should support replies')
assert(learningJs.includes('/contents/${id}/progress') && learningJs.includes('/contents/${id}/favorite'), 'learning progress and favorites should survive the integration')
assert(learningJs.includes('/forum/${id}/answers') && learningJs.includes('/forum/answers/${button.dataset.voteAnswer}/vote'), 'forum answers and voting should survive the integration')
assert(adminLogin.includes('/api/community-auth/admin/login'), 'community should have an independent admin login')
assert(adminJs.includes('/knowledge/admin-login.html'), 'expired admin sessions should return to community login')
assert(adminHtml.includes('/platform/admin'), 'community admin should link back to cotton-app')
assert(adminJs.includes('/public/courses/'), 'admin comment links should open the integrated public course page')
assert(adminHtml.includes('data-view="requests"') && adminJs.includes("api(`/service-requests"), 'community admin should manage business and activity requests')
assert(route.includes("router.get('/admin/service-requests'") && route.includes("router.patch('/admin/service-requests/:id'"), 'admin API should manage service request status')
assert(siteRoute.includes("router.get('/public/academy'") && siteRoute.includes("res.redirect(301, '/public/courses')"), 'old academy links should permanently redirect to public courses')
for (const removedPage of [
  'public/knowledge/index.html', 'public/knowledge/index.js',
  'public/knowledge/detail.html', 'public/knowledge/detail.js',
  'public/knowledge/forum.html', 'public/knowledge/forum.js'
]) {
  assert(!exists(removedPage), `legacy standalone academy page should be removed: ${removedPage}`)
}
assert(styles.includes('/assets/knowledge-hero-v2.webp'), 'community should serve its own hero asset')
assert(!route.includes('/admin/assets/'), 'community API should not depend on cotton-app static assets')
assert(!learningJs.includes('/api/auth/'), 'community client should not call cotton-app authentication routes')

for (const asset of [
  'knowledge-hero-v2.webp', 'course-seedling-v2.webp', 'course-scouting-v2.webp',
  'course-water-v2.webp', 'course-lifecycle-v1.webp'
]) {
  assert(fs.existsSync(path.join(root, 'public', 'assets', asset)), `missing community asset ${asset}`)
}

console.log('knowledge community tests passed')
