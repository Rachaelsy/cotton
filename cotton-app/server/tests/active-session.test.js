const assert = require('assert')
const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const { createActiveSessionGuard } = require('../middleware/active-session')

const secret = 'active-session-test-secret-at-least-32-characters'

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

async function runGuard(payload, database) {
  const token = payload ? jwt.sign(payload, secret) : ''
  const req = { headers: { authorization: token ? `Bearer ${token}` : '' } }
  const res = response()
  let nextCalled = false
  const guard = createActiveSessionGuard({
    database,
    secret,
    logger: { error() {} }
  })
  await guard(req, res, () => { nextCalled = true })
  return { req, res, nextCalled }
}

async function run() {
  let result = await runGuard(null, { query: async () => assert.fail('anonymous requests should not query accounts') })
  assert(result.nextCalled)

  result = await runGuard(
    { id: 7, role: 'farmer' },
    { query: async () => [[{ id: 7, is_active: 1 }]] }
  )
  assert(result.nextCalled)
  assert.equal(result.req.activeAccount.id, 7)

  result = await runGuard(
    { id: 8, role: 'merchant' },
    { query: async () => [[{ id: 8, is_active: 0 }]] }
  )
  assert.equal(result.nextCalled, false)
  assert.equal(result.res.statusCode, 401)

  let communityAdminQuery = ''
  result = await runGuard(
    { id: 3, role: 'community_admin', is_community_admin: true, permission: 'public_admin', auth_version: 4 },
    {
      query: async sql => {
        communityAdminQuery = sql
        return [[{ id: 3, is_active: 1, auth_version: 4 }]]
      }
    }
  )
  assert(result.nextCalled)
  assert.match(communityAdminQuery, /FROM community_admins/)

  let expertQuery = ''
  result = await runGuard(
    { id: 9, role: 'expert', is_expert: true },
    {
      query: async sql => {
        expertQuery = sql
        return [[{ id: 9, is_active: 1 }]]
      }
    }
  )
  assert(result.nextCalled)
  assert.match(expertQuery, /FROM experts/)

  result = await runGuard(
    { id: 10, role: 'farmer' },
    { query: async () => { throw new Error('database unavailable') } }
  )
  assert.equal(result.res.statusCode, 503)

  let adminQueries = 0
  result = await runGuard(
    { id: 1, role: 'admin', is_admin: true, auth_version: 2 },
    {
      query: async sql => {
        adminQueries += 1
        assert.match(sql, /is_admin,admin_auth_version/)
        return [[{ id: 1, is_active: 1, is_admin: 1, admin_auth_version: 2 }]]
      }
    }
  )
  assert(result.nextCalled)
  assert.equal(adminQueries, 1)

  result = await runGuard(
    { id: 1, role: 'admin', is_admin: true, auth_version: 1 },
    { query: async () => [[{ id: 1, is_active: 1, is_admin: 1, admin_auth_version: 2 }]] }
  )
  assert.equal(result.nextCalled, false)
  assert.equal(result.res.statusCode, 401)

  const communityGuard = fs.readFileSync(
    path.join(__dirname, '../../..', 'cotton-community/middleware/active-session.js'),
    'utf8'
  )
  const communityServer = fs.readFileSync(
    path.join(__dirname, '../../..', 'cotton-community/server.js'),
    'utf8'
  )
  assert(communityGuard.includes("? 'community_admins'"))
  assert(communityGuard.includes('is_admin,admin_auth_version'))
  assert(communityServer.includes("app.use('/api', createActiveSessionGuard())"))

  console.log('active session tests passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
