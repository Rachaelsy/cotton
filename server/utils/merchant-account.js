function normalizeInput(input = {}) {
  return {
    phone: String(input.phone || '').trim(),
    password: String(input.password || '').trim(),
    subMchid: String(input.subMchid || '').trim(),
    realName: String(input.realName || '微信支付测试商户').trim(),
    companyName: String(input.companyName || '微信支付测试店铺').trim(),
    businessLicense: String(input.businessLicense || 'TESTBUSINESSLICENSE').trim(),
    productCategory: String(input.productCategory || '农资').trim(),
    commissionRate: Number(input.commissionRate == null ? 5 : input.commissionRate)
  }
}

function validateInput(input) {
  if (!/^1\d{10}$/.test(input.phone)) throw new Error('phone must be an 11-digit mainland China mobile number')
  if (!input.password || input.password.length < 6 || input.password.length > 20) throw new Error('password must be 6-20 characters')
  if (!/^\d{8,32}$/.test(input.subMchid)) throw new Error('sub_mchid must be 8-32 digits')
  if (!Number.isFinite(input.commissionRate) || input.commissionRate < 0 || input.commissionRate > 100) {
    throw new Error('commission_rate must be between 0 and 100')
  }
}

async function upsertMerchantBase({ db, bcrypt, input, merchantMode }) {
  const data = normalizeInput(input)
  if (merchantMode === 'bound') validateInput(data)
  else {
    if (!/^1\d{10}$/.test(data.phone)) throw new Error('phone must be an 11-digit mainland China mobile number')
    if (!data.password || data.password.length < 6 || data.password.length > 20) throw new Error('password must be 6-20 characters')
  }

  const hash = await bcrypt.hash(data.password, 10)
  const [users] = await db.query('SELECT id, role FROM users WHERE phone=?', [data.phone])
  let userId
  let createdUser = false

  if (users.length) {
    const user = users[0]
    if (user.role !== 'merchant') throw new Error(`phone already exists as ${user.role}`)
    userId = user.id
    await db.query(
      'UPDATE users SET password=?, role=?, real_name=?, is_active=1 WHERE id=?',
      [hash, 'merchant', data.realName, userId]
    )
  } else {
    const [result] = await db.query(
      'INSERT INTO users (phone,password,role,real_name,is_active,is_verified) VALUES (?,?,?,?,1,1)',
      [data.phone, hash, 'merchant', data.realName]
    )
    userId = result.insertId
    createdUser = true
  }

  const [merchants] = await db.query('SELECT id FROM merchants WHERE user_id=?', [userId])
  let merchantId
  let createdMerchant = false

  if (merchants.length) {
    merchantId = merchants[0].id
    const isSelfOperated = merchantMode === 'self'
    await db.query(
      `UPDATE merchants
          SET company_name=?, business_license=?, product_category=?,
              apply_status='approved', reject_reason=NULL, sub_mchid=?,
              wechat_applyment_state=?,
              wechat_applyment_msg=?,
              wechat_applyment_updated_at=NOW(), commission_rate=?
        WHERE id=?`,
      [
        data.companyName,
        data.businessLicense,
        data.productCategory,
        isSelfOperated ? null : data.subMchid,
        isSelfOperated ? 'SELF_OPERATED' : 'FINISH',
        isSelfOperated
          ? 'Self-operated store for WeChat Pay direct test'
          : 'Bound existing sub_mchid for WeChat Pay test',
        isSelfOperated ? 0 : data.commissionRate,
        merchantId
      ]
    )
  } else {
    const isSelfOperated = merchantMode === 'self'
    const [result] = await db.query(
      `INSERT INTO merchants
        (user_id, company_name, business_license, product_category, apply_status,
         sub_mchid, wechat_applyment_state, wechat_applyment_msg,
         wechat_applyment_updated_at, commission_rate)
       VALUES (?, ?, ?, ?, 'approved', ?, ?, ?, NOW(), ?)`,
      [
        userId,
        data.companyName,
        data.businessLicense,
        data.productCategory,
        isSelfOperated ? null : data.subMchid,
        isSelfOperated ? 'SELF_OPERATED' : 'FINISH',
        isSelfOperated
          ? 'Self-operated store for WeChat Pay direct test'
          : 'Bound existing sub_mchid for WeChat Pay test',
        isSelfOperated ? 0 : data.commissionRate
      ]
    )
    merchantId = result.insertId
    createdMerchant = true
  }

  const result = {
    userId,
    merchantId,
    createdUser,
    createdMerchant
  }
  if (merchantMode === 'self') result.selfOperated = true
  else result.subMchid = data.subMchid
  return result
}

async function upsertBoundMerchant({ db, bcrypt, input }) {
  return upsertMerchantBase({ db, bcrypt, input, merchantMode: 'bound' })
}

async function upsertSelfOperatedMerchant({ db, bcrypt, input }) {
  return upsertMerchantBase({ db, bcrypt, input, merchantMode: 'self' })
}

module.exports = {
  normalizeInput,
  validateInput,
  upsertBoundMerchant,
  upsertSelfOperatedMerchant
}
