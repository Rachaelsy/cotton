const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

const route = read('server/routes/knowledge.js')
const authRoute = read('server/routes/auth.js')
const migration = read('server/db/migrate_knowledge_hall.js')
const indexHtml = read('server/public/knowledge/index.html')
const detailHtml = read('server/public/knowledge/detail.html')
const forumHtml = read('server/public/knowledge/forum.html')
const adminHtml = read('server/public/knowledge/admin.html')
const portalHtml = read('server/public/admin/login.html')
const indexJs = read('server/public/knowledge/index.js')
const detailJs = read('server/public/knowledge/detail.js')
const adminJs = read('server/public/knowledge/admin.js')
const styles = read('server/public/knowledge/styles.css')
const appJson = JSON.parse(read('app.json'))
const homeJs = read('pages/index/index.js')
const knowledgeMiniJs = read('pages/knowledge/index.js')

for (const table of [
  'knowledge_contents', 'knowledge_comments', 'knowledge_progress', 'knowledge_favorites',
  'knowledge_questions', 'knowledge_answers', 'knowledge_answer_votes'
]) {
  assert(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `migration should create ${table}`)
}

for (const endpoint of [
  "router.get('/home'", "router.get('/contents/:id'", "router.post('/contents/:id/comments'",
  "router.put('/contents/:id/progress'", "router.post('/contents/:id/favorite'",
  "router.get('/forum'", "router.post('/forum'", "router.post('/forum/:id/answers'",
  "router.post('/forum/answers/:id/vote'", "router.patch('/forum/:id/accept/:answerId'",
  "router.post('/admin/upload'", "router.get('/admin/contents'", "router.get('/admin/forum'"
]) {
  assert(route.includes(endpoint), `knowledge route should include ${endpoint}`)
}

assert(route.includes('userAuth'), 'comments, progress and forum writes should require login')
assert(route.includes('adminAuth'), 'content operations should require an administrator')
assert(indexHtml.includes('课程学习') && indexHtml.includes('棉友问答'), 'public page should expose learning and forum views')
assert(detailHtml.includes('小棉 AI 学习助手') && detailHtml.includes('学习讨论'), 'detail page should expose AI and comments')
assert(forumHtml.includes('写下你的回答'), 'forum detail should support answers')
assert(adminHtml.includes('内容管理') && adminHtml.includes('问答社区'), 'admin page should manage content and forum')
assert(adminHtml.includes('commentCategory') && adminHtml.includes('commentContent') && adminHtml.includes('commentQuery'), 'comment moderation should filter by category, content and query')
assert(route.includes("req.query.category_key") && route.includes("req.query.content_id"), 'admin comments API should support category and content filters')
assert(indexHtml.includes('adminPreviewBar') && indexJs.includes('initAdminMode'), 'public knowledge home should expose admin browsing mode')
assert(detailJs.includes('data-admin-comment-delete') && detailJs.includes('data-admin-comment-status'), 'admins should moderate comments in course context')
assert(detailHtml.includes('replyContext') && detailJs.includes('parent_id') && detailJs.includes('data-reply-comment'), 'course comments should support threaded replies')
assert(migration.includes('quiz_json MEDIUMTEXT') && route.includes('normalizeQuiz'), 'knowledge contents should store and validate course quizzes')
assert(migration.includes('棉花苗期14天田间诊断课：查苗、定苗与风险判断'), 'migration should seed the practical cotton seedling course')
assert(detailHtml.includes('id="courseQuiz"') && detailJs.includes('submitQuiz') && detailJs.includes('data-ai-quiz'), 'course detail should support scoring and AI explanations')
assert(detailJs.includes('article-figure') && detailJs.includes('article-callout'), 'article renderer should support structured illustrated lessons')
assert(adminHtml.includes('id="cQuiz"') && adminJs.includes('JSON.parse(raw)'), 'administrators should be able to edit validated quiz JSON')
assert(route.includes('parent_nickname') && route.includes('LEFT JOIN knowledge_comments parent'), 'comment APIs should preserve reply context')
assert(adminJs.includes("view')==='comments") && adminJs.includes("query.get('edit')"), 'admin deep links should open the requested management context')
assert(portalHtml.includes('knowledge-gateway') && portalHtml.includes('进入棉知学堂'), 'root login portal should prominently expose the knowledge hall')
assert(styles.includes('knowledge-hero-v2.webp'), 'knowledge hall should use the dedicated field hero')
assert(adminHtml.includes('COS / OSS / CDN') && route.includes('KNOWLEDGE_LOCAL_UPLOAD_MAX_MB'), 'video management should document external storage and cap local uploads')
assert(indexHtml.includes('id="registerBtn"') && indexHtml.includes('id="registerForm"'), 'knowledge hall should expose user registration')
assert(styles.includes('align-items: center') && styles.includes('justify-content: center'), 'shared buttons should center their labels')
for (const asset of ['knowledge-hero-v2.webp', 'course-seedling-v2.webp', 'course-scouting-v2.webp', 'course-water-v2.webp', 'cotton-seedling-inspection-v1.jpg', 'cotton-seedling-leaf-inspection-v1.jpg']) {
  assert(fs.existsSync(path.join(root, 'server/public/admin/assets', asset)), `visual asset should exist: ${asset}`)
}
assert(!indexHtml.includes('专家') && !detailHtml.includes('专家') && !forumHtml.includes('专家'), 'new knowledge hall should not expose expert features')
assert(styles.includes('@media (max-width: 720px)'), 'knowledge hall should have a mobile layout')
assert(appJson.pages.includes('pages/knowledge/index'), 'mini program should register the knowledge web-view page')
assert(homeJs.includes("key: 'knowledge'") && homeJs.includes("knowledge: '/pages/knowledge/index'"), 'home should expose the knowledge hall entry')
assert(migration.includes('knowledge_web_login_tickets'), 'knowledge migration should create one-time web login tickets')
assert(authRoute.includes("router.post('/web-bridge'") && authRoute.includes("router.post('/web-bridge/exchange'"), 'auth API should bridge mini-program sessions to the web')
assert(authRoute.includes("router.get('/wechat-web/start'") && authRoute.includes("snsapi_login"), 'auth API should support WeChat Open Platform QR login')
assert(knowledgeMiniJs.includes('/api/auth/web-bridge') && knowledgeMiniJs.includes('wx.login'), 'mini-program web-view should request an authenticated one-time ticket')
assert(indexHtml.includes('wechatLoginBtn') && detailHtml.includes('wechatLoginBtn'), 'knowledge login dialogs should expose configured WeChat QR login')

console.log('knowledge hall wiring tests passed')
