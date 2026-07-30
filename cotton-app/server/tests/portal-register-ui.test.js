const assert = require('assert')
const fs = require('fs')
const path = require('path')

const serverDir = path.join(__dirname, '..')

function readServerFile(...parts) {
  return fs.readFileSync(path.join(serverDir, ...parts), 'utf8')
}

function run() {
  const register = readServerFile('public', 'portal', 'register.html')
  const legacyLogin = readServerFile('public', 'portal', 'login.html')

  assert.ok(register.includes('申请加入棉花平台'))
  assert.ok(register.includes('/admin/assets/cotton-field-sky.png'))
  assert.ok(register.includes('我是农机手'))
  assert.ok(register.includes('我是商户'))
  assert.ok(register.includes('/api/operator/apply'))
  assert.ok(register.includes('/api/admin/apply'))
  assert.ok(register.includes('/admin/assets/runtime.js'))
  assert.ok(register.includes('image/jpeg,image/png,image/bmp'))
  assert.ok(register.includes('5 * 1024 * 1024'))
  assert.ok(register.includes('URL.createObjectURL(file)'), 'sensitive onboarding documents should preview locally')
  assert.ok(!register.includes('preview.src = data.data.url'), 'private onboarding references must not be fetched as public images')
  assert.ok(register.includes('id="privacyConsent"'))
  assert.ok(register.includes('/public/privacy'))
  assert.ok(register.includes('privacy_consent_version'))
  assert.ok(register.includes('获取当前定位'))
  assert.ok(register.includes('role=merchant') || register.includes("q === 'merchant'"))
  assert.ok(register.includes('href="/"'), 'existing account link should return to unified homepage')
  assert.ok(register.includes("location.replace('/')"), 'successful apply should return to unified homepage')
  assert.ok(!register.includes("location.replace('/portal/login.html')"))
  assert.ok(legacyLogin.includes('location.replace(target)'), 'legacy portal login should redirect to the new homepage')
  assert.ok(legacyLogin.includes('/admin/login.html?role='))
  assert.ok(fs.existsSync(path.join(serverDir, 'public', 'admin', 'assets', 'cotton-field-sky.png')))

  const inlineScripts = [...register.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim())
  assert.ok(inlineScripts.length, 'registration page should contain executable inline logic')
  inlineScripts.forEach((source, index) => {
    assert.doesNotThrow(() => new Function(source), `registration inline script ${index + 1} should parse`)
  })

  console.log('portal register UI tests passed')
}

run()
