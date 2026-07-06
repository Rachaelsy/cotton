const assert = require('assert')
const fs = require('fs')
const path = require('path')

const serverDir = path.join(__dirname, '..')
const indexSource = fs.readFileSync(path.join(serverDir, 'index.js'), 'utf8')

function run() {
  assert.ok(
    fs.existsSync(path.join(serverDir, 'public', 'admin', 'login.html')),
    'admin login page should exist'
  )
  assert.ok(indexSource.includes("app.get(['/', '/index.html']"), 'server should define root and index routes')
  assert.ok(
    /res\.redirect\(\s*['"]\/admin\/login\.html['"]\s*\)/.test(indexSource),
    'root route should redirect to admin login page'
  )

  console.log('root redirect tests passed')
}

run()
