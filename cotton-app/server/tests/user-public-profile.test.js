const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '../..', '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

function run() {
  const authRoute = read('cotton-app/server/routes/auth.js')
  const migration = read('cotton-app/server/db/migrate_user_public_profile.js')
  const entrypoint = read('cotton-app/server/docker-entrypoint.sh')
  const appJson = JSON.parse(read('cotton-public/app.json'))
  const page = read('cotton-public/pages/profile/index.wxml')
  const pageLogic = read('cotton-public/pages/profile/index.js')
  const home = read('cotton-public/pages/index/index.js')

  assert.match(authRoute, /router\.put\('\/public-profile', authMiddleware/)
  assert.match(authRoute, /UPDATE users SET nickname=\? WHERE id=\?/)
  assert.match(authRoute, /nickname: user\.nickname \|\| ''/)
  assert.match(migration, /ADD COLUMN nickname VARCHAR\(32\)/)
  assert.match(entrypoint, /run_migration db\/migrate_user_public_profile\.js/)
  assert.ok(appJson.pages.includes('pages/profile/index'))
  assert.match(page, /type="nickname"/)
  assert.doesNotMatch(page, /chooseAvatar|头像/)
  assert.match(pageLogic, /\/api\/auth\/public-profile/)
  assert.match(home, /user\.nickname \|\| user\.real_name \|\| '棉农朋友'/)
  console.log('user public profile tests passed')
}

run()
