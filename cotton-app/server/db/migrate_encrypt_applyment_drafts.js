require('dotenv').config()

const db = require('./database')
const {
  isProtectedDraft,
  protectDraft
} = require('../utils/applyment-draft-security')

function parsePayload(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}

async function migrateTable(tableName) {
  const [rows] = await db.query(
    `SELECT id,wechat_applyment_payload FROM ${tableName} WHERE wechat_applyment_payload IS NOT NULL`
  )
  let updated = 0
  for (const row of rows) {
    const draft = parsePayload(row.wechat_applyment_payload)
    if (!draft || isProtectedDraft(draft)) continue
    await db.query(
      `UPDATE ${tableName} SET wechat_applyment_payload=? WHERE id=?`,
      [JSON.stringify(protectDraft(draft)), row.id]
    )
    updated += 1
  }
  return updated
}

async function run() {
  const merchantCount = await migrateTable('merchants')
  const operatorCount = await migrateTable('operators')
  console.log(`[migrate-encrypt-applyments] encrypted=${merchantCount + operatorCount}`)
}

run()
  .catch(error => {
    console.error('[migrate-encrypt-applyments]', error)
    process.exitCode = 1
  })
  .finally(() => db.end())
