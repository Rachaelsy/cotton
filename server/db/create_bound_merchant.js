require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const bcrypt = require('bcryptjs')
const db = require('./database')
const { upsertBoundMerchant } = require('../utils/merchant-account')

function readInput() {
  return {
    phone: process.env.TEST_MERCHANT_PHONE,
    password: process.env.TEST_MERCHANT_PASSWORD,
    subMchid: process.env.TEST_MERCHANT_SUB_MCHID,
    realName: process.env.TEST_MERCHANT_REAL_NAME,
    companyName: process.env.TEST_MERCHANT_COMPANY_NAME,
    businessLicense: process.env.TEST_MERCHANT_BUSINESS_LICENSE,
    productCategory: process.env.TEST_MERCHANT_PRODUCT_CATEGORY,
    commissionRate: process.env.TEST_MERCHANT_COMMISSION_RATE
  }
}

async function run() {
  const result = await upsertBoundMerchant({ db, bcrypt, input: readInput() })
  console.log('Bound merchant account ready:')
  console.log(`  phone: ${process.env.TEST_MERCHANT_PHONE}`)
  console.log(`  user_id: ${result.userId}`)
  console.log(`  merchant_id: ${result.merchantId}`)
  console.log(`  sub_mchid: ${result.subMchid}`)
  console.log(`  created_user: ${result.createdUser}`)
  console.log(`  created_merchant: ${result.createdMerchant}`)
  await db.end()
}

run().catch(async error => {
  console.error('Failed to create bound merchant account:', error.message)
  if (db.end) await db.end().catch(() => {})
  process.exit(1)
})
