require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const bcrypt = require('bcryptjs')
const db = require('./database')
const { upsertSelfOperatedMerchant } = require('../utils/merchant-account')

function readInput() {
  return {
    phone: process.env.SELF_MERCHANT_PHONE || '13900000010',
    password: process.env.SELF_MERCHANT_PASSWORD || 'test123',
    realName: process.env.SELF_MERCHANT_REAL_NAME || 'Cotton平台自营',
    companyName: process.env.SELF_MERCHANT_COMPANY_NAME || 'Cotton平台自营店',
    businessLicense: process.env.SELF_MERCHANT_BUSINESS_LICENSE || 'SELFOPERATED001',
    productCategory: process.env.SELF_MERCHANT_PRODUCT_CATEGORY || '化肥、农药'
  }
}

async function run() {
  const input = readInput()
  const result = await upsertSelfOperatedMerchant({ db, bcrypt, input })
  console.log('Self-operated merchant account ready:')
  console.log(`  phone: ${input.phone}`)
  console.log(`  password: ${input.password}`)
  console.log(`  user_id: ${result.userId}`)
  console.log(`  merchant_id: ${result.merchantId}`)
  console.log(`  self_operated: ${result.selfOperated}`)
  await db.end()
}

run().catch(async error => {
  console.error('Failed to create self-operated merchant account:', error.message)
  if (db.end) await db.end().catch(() => {})
  process.exit(1)
})
