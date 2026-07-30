const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  ensureJwtSecret,
  isSecureJwtSecret,
  readEnvValue,
  setEnvValue
} = require('./ensure-runtime-secrets')

assert.equal(isSecureJwtSecret('cotton_jwt_secret_change_in_production'), false)
assert.equal(isSecureJwtSecret('replace-with-a-secret'), false)
assert.equal(isSecureJwtSecret('s'.repeat(48)), true)

const original = 'DB_HOST=db\r\nJWT_SECRET=replace-this\r\nDB_NAME=cotton\r\n'
const updated = setEnvValue(original, 'JWT_SECRET', 'a'.repeat(48))
assert(updated.includes(`JWT_SECRET=${'a'.repeat(48)}\r\n`))
assert.equal(readEnvValue(updated, 'JWT_SECRET'), 'a'.repeat(48))
const malformed = `# JWT secret comment\rJWT_SECRET=${'d'.repeat(48)}\r\nJWT_SECRET=duplicate\r\nDB_NAME=cotton\r\n`
const normalized = setEnvValue(malformed, 'JWT_SECRET', 'd'.repeat(48))
assert(normalized.includes(`# JWT secret comment\r\nJWT_SECRET=${'d'.repeat(48)}\r\n`))
assert.equal((normalized.match(/^JWT_SECRET=/gm) || []).length, 1)

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotton-secret-test-'))
const envPath = path.join(tempDir, '.env')
fs.writeFileSync(envPath, original, 'utf8')
const generated = 'b'.repeat(48)
assert.equal(ensureJwtSecret(envPath, () => generated).changed, true)
assert.equal(readEnvValue(fs.readFileSync(envPath, 'utf8'), 'JWT_SECRET'), generated)
assert.equal(ensureJwtSecret(envPath, () => 'c'.repeat(48)).changed, false)
fs.unlinkSync(envPath)
fs.rmdirSync(tempDir)

const repoRoot = path.join(__dirname, '..')
const updateScript = fs.readFileSync(path.join(repoRoot, 'deploy/update.sh'), 'utf8')
const backupScript = fs.readFileSync(path.join(repoRoot, 'deploy/backup.sh'), 'utf8')
const compose = fs.readFileSync(path.join(repoRoot, 'docker-compose.yml'), 'utf8')
const appEntrypoint = fs.readFileSync(path.join(repoRoot, 'cotton-app/server/docker-entrypoint.sh'), 'utf8')
assert(updateScript.includes('node scripts/ensure-runtime-secrets.js'))
assert(backupScript.includes('mysqldump') && backupScript.includes('mysql.sql.gz'))
assert(backupScript.includes('identity-uploads.tar.gz') && backupScript.includes('applyment-uploads.tar.gz'))
assert(backupScript.includes('community-uploads.tar.gz'))
assert(backupScript.includes('sha256sum') && backupScript.includes('BACKUP_RETENTION_DAYS'))
assert(compose.includes('max-size: "10m"') && compose.includes('max-file: "3"'))
assert(compose.includes('applyment_uploads:/app/private/applyments'))
assert(appEntrypoint.includes('db/migrate_private_applyment_files.js'))

console.log('runtime secret tests passed')
