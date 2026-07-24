const assert = require('assert')
const fs = require('fs')
const path = require('path')

const serverDir = path.join(__dirname, '..')

function readServerFile(...parts) {
  return fs.readFileSync(path.join(serverDir, ...parts), 'utf8')
}

function run() {
  const login = readServerFile('public', 'admin', 'login.html')
  const merchantLogin = readServerFile('public', 'merchant', 'login.html')

  assert.ok(login.includes('Cotton'), 'unified login should keep Cotton branding')
  assert.ok(login.includes('data-role="admin"'), 'admin role card should exist')
  assert.ok(login.includes('data-role="merchant"'), 'merchant role card should exist')
  assert.ok(login.includes('data-role="operator"'), 'operator role card should exist')
  assert.ok(login.includes('./assets/cotton-field-sky.png'), 'cotton field background should be used')
  assert.ok(fs.existsSync(path.join(serverDir, 'public', 'admin', 'assets', 'cotton-field-sky.png')))

  assert.ok(!login.includes('>ID<'), 'admin login should avoid unclear ID abbreviation')
  assert.ok(!login.includes('>PW<'), 'admin login should avoid unclear PW abbreviation')
  assert.ok(login.includes('id="phone"'), 'phone/account input should exist')
  assert.ok(login.includes('id="pwd"'), 'password input should exist')
  assert.ok(login.includes('current-password'), 'password login should remain')

  const removedTerms = [
    ['s', 'ms-auth'].join(''),
    ['send', 'Sms', 'Code'].join(''),
    ['send', '-code'].join(''),
    ['one', '-time', '-code'].join('')
  ]
  for (const term of removedTerms) {
    assert.ok(!login.includes(term), `${term} should not appear on login page`)
  }

  assert.ok(login.includes('/portal/register.html?role=merchant'))
  assert.ok(login.includes('/portal/register.html?role=operator'))
  assert.ok(login.includes('/api/admin/login'))
  assert.ok(login.includes('/api/merchant/login'))
  assert.ok(login.includes('/api/operator/login'))
  assert.ok(login.includes('/admin/dashboard.html'))
  assert.ok(login.includes('/merchant/dashboard.html'))
  assert.ok(login.includes('/operator/dashboard.html'))

  assert.ok(merchantLogin.includes('/admin/login.html?role=merchant'))

  console.log('admin login UI tests passed')
}

run()
