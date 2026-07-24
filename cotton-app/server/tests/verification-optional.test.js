const assert = require('assert')
const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

function run() {
  const appConfig = JSON.parse(read('app.json'))
  const loginSource = read('pages/login/index.js')
  const mySource = read('pages/my/index.js')
  const verificationSource = read('pages/verification/index.js')
  const verificationRoute = read('server/routes/verification.js')

  assert(!loginSource.includes('/pages/verification/index'), 'login and registration must not force identity verification')
  assert(!/!res\.data\.is_verified[\s\S]{0,160}verification/.test(mySource), 'profile login must not force identity verification')
  assert(!loginSource.includes('/pages/onboarding/index'), 'login and registration must not open onboarding')
  assert(!mySource.includes('/pages/onboarding/index'), 'profile login must not open onboarding')
  assert(!appConfig.pages.includes('pages/onboarding/index'), 'onboarding page must not be registered')
  assert(!fs.existsSync(path.join(rootDir, 'pages/onboarding')), 'onboarding page files should be removed')
  assert(!verificationRoute.includes("router.patch('/onboarding'"), 'obsolete onboarding API should be removed')
  assert(loginSource.includes("wx.reLaunch({ url: '/pages/index/index' })"), 'successful login should enter the home page')
  assert(verificationSource.includes('实名认证为可选服务'), 'verification page should explain that verification is optional')
  console.log('optional verification tests passed')
}

run()
