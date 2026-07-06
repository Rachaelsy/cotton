const assert = require('assert')
const fs = require('fs')
const path = require('path')

const serverDir = path.join(__dirname, '..')
const indexSource = fs.readFileSync(path.join(serverDir, 'index.js'), 'utf8')

function run() {
  assert.ok(
    fs.existsSync(path.join(serverDir, 'public', 'portal', 'login.html')),
    'portal login page should exist'
  )
  assert.ok(/app\.get\(\s*['"]\/['"]\s*,/.test(indexSource), 'server should define a root route')
  assert.ok(
    /res\.redirect\(\s*['"]\/portal\/login\.html['"]\s*\)/.test(indexSource),
    'root route should redirect to portal login page'
  )

  console.log('root redirect tests passed')
}

run()
