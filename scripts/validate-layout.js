const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const exists = relativePath => fs.existsSync(path.join(root, relativePath))

for (const requiredPath of [
  'docker-compose.yml',
  'deploy/nginx.conf',
  'deploy/proxy_params',
  'cotton-app/server/index.js',
  'cotton-app/server/package.json',
  'cotton-app/server/Dockerfile',
  'cotton-community/server.js',
  'cotton-community/package.json',
  'cotton-community/Dockerfile'
]) {
  assert(exists(requiredPath), `missing required project file: ${requiredPath}`)
}

assert(!exists('cotton-app/.git'), 'cotton-app must not contain a nested Git repository')
assert(!exists('cotton-community/.git'), 'cotton-community must not contain a nested Git repository')

const compose = read('docker-compose.yml')
assert(compose.includes('context: ./cotton-app/server'), 'Compose app build context is incorrect')
assert(compose.includes('context: ./cotton-community'), 'Compose community build context is incorrect')
assert(compose.includes('./cotton-app/server/.env'), 'Compose must use the shared app environment file')
assert(compose.includes('name: cotton_mysql_data'), 'Compose must preserve the existing MySQL volume name')

const nginx = read('deploy/nginx.conf')
for (const route of [
  '/knowledge/',
  '/uploads/knowledge/',
  '/api/knowledge/',
  '/api/community-auth/',
  '/api/community-ai/',
  '/api/community-health'
]) {
  assert(nginx.includes(route), `Nginx is missing community route: ${route}`)
}

const appServer = read('cotton-app/server/index.js')
const communityServer = read('cotton-community/server.js')
const detailClient = read('cotton-community/public/knowledge/detail.js')
assert(!appServer.includes("COMMUNITY_BASE_URL || 'http://localhost"), 'app has a cloud-unsafe community redirect default')
assert(!communityServer.includes("PLATFORM_BASE_URL || 'http://localhost"), 'community has a cloud-unsafe platform redirect default')
assert(communityServer.includes("app.use('/api/community-ai'"), 'community AI route is not isolated')
assert(detailClient.includes('/api/community-ai/chat'), 'community client does not use the isolated AI route')

console.log('project layout validation passed')
