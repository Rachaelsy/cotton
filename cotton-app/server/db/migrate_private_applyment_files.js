require('dotenv').config()

const fs = require('fs')
const path = require('path')
const db = require('./database')

const PUBLIC_UPLOAD_ROOT = path.resolve(__dirname, '../public/uploads')
const PRIVATE_UPLOAD_ROOT = path.resolve(__dirname, '../private/applyments')
const ATTACHMENT_KEYS = [
  'license_copy_url',
  'id_card_copy_url',
  'id_card_national_url',
  'mini_program_pic_url'
]

function parsePayload(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}

function legacyFilename(value) {
  let pathname = String(value || '').trim()
  if (!pathname) return ''
  try {
    if (/^https?:\/\//i.test(pathname)) pathname = new URL(pathname).pathname
    pathname = decodeURIComponent(pathname.split('?')[0])
  } catch {
    return ''
  }
  const match = pathname.match(/^\/uploads\/([A-Za-z0-9][A-Za-z0-9._-]*)$/)
  return match ? match[1] : ''
}

async function stageLegacyFile(filename) {
  const source = path.join(PUBLIC_UPLOAD_ROOT, filename)
  const target = path.join(PRIVATE_UPLOAD_ROOT, filename)
  try {
    await fs.promises.access(target)
    return { source, available: true }
  } catch {}
  try {
    await fs.promises.copyFile(source, target)
    await fs.promises.chmod(target, 0o600)
    return { source, available: true }
  } catch (error) {
    if (error.code === 'ENOENT') return { source, available: false }
    throw error
  }
}

async function migrateTable(tableName) {
  const [rows] = await db.query(
    `SELECT id,wechat_applyment_payload FROM ${tableName} WHERE wechat_applyment_payload IS NOT NULL`
  )
  let updatedRows = 0
  let movedFiles = 0

  for (const row of rows) {
    const payload = parsePayload(row.wechat_applyment_payload)
    const attachments = payload?.attachments
    if (!attachments || typeof attachments !== 'object') continue

    let changed = false
    const sourcesToRemove = new Set()
    for (const key of ATTACHMENT_KEYS) {
      const filename = legacyFilename(attachments[key])
      if (!filename) continue
      const staged = await stageLegacyFile(filename)
      if (!staged.available) continue
      attachments[key] = `/private/applyments/${filename}`
      sourcesToRemove.add(staged.source)
      changed = true
    }
    if (!changed) continue

    await db.query(
      `UPDATE ${tableName} SET wechat_applyment_payload=? WHERE id=?`,
      [JSON.stringify(payload), row.id]
    )
    updatedRows += 1
    for (const source of sourcesToRemove) {
      try {
        await fs.promises.unlink(source)
        movedFiles += 1
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`[migrate-private-applyments] cleanup failed: ${error.message}`)
        }
      }
    }
  }
  return { updatedRows, movedFiles }
}

async function run() {
  await fs.promises.mkdir(PRIVATE_UPLOAD_ROOT, { recursive: true })
  const merchant = await migrateTable('merchants')
  const operator = await migrateTable('operators')
  console.log(
    `[migrate-private-applyments] rows=${merchant.updatedRows + operator.updatedRows}, ` +
    `files=${merchant.movedFiles + operator.movedFiles}`
  )
}

run()
  .catch(error => {
    console.error('[migrate-private-applyments]', error)
    process.exitCode = 1
  })
  .finally(() => db.end())
