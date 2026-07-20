const assert = require('assert')
const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath))
}

function run() {
  const appConfig = JSON.parse(read('app.json'))
  const loginSource = read('pages/login/index.js')
  const mySource = read('pages/my/index.js')
  const authSource = read('utils/auth.js')

  assert(!appConfig.pages.some(page => page.startsWith('pages/merchant/')), 'mini program should not register merchant pages')
  assert(!exists('pages/merchant'), 'mini program merchant pages should be removed')
  assert(!exists('components/merchant-tab-bar'), 'mini program merchant tab bar should be removed')
  assert(!loginSource.includes('/pages/merchant/'), 'login page should not route to merchant mini pages')
  assert(loginSource.includes('_showWebOnlyAccount'), 'login page should show web-only guidance for non-farmers')
  assert(mySource.includes('webOnlyContent'), 'profile page WeChat login should show web-only guidance for non-farmers')
  assert(authSource.includes('function isFarmerUser'), 'auth helper should expose farmer-only role guard')

  console.log('miniapp farmer-only tests passed')
}

run()
