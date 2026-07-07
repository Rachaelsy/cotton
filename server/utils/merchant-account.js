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

async function upsertBoundMerchant({ db, bcrypt, input }) {
  const data = normalizeInput(input)
  validateInput(data)

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
    await db.query(
      `UPDATE merchants
          SET company_name=?, business_license=?, product_category=?,
              apply_status='approved', reject_reason=NULL, sub_mchid=?,
              wechat_applyment_state='FINISH',
              wechat_applyment_msg='Bound existing sub_mchid for WeChat Pay test',
              wechat_applyment_updated_at=NOW(), commission_rate=?
        WHERE id=?`,
      [
        data.companyName,
        data.businessLicense,
        data.productCategory,
        data.subMchid,
        data.commissionRate,
        merchantId
      ]
    )
  } else {
    const [result] = await db.query(
      `INSERT INTO merchants
        (user_id, company_name, business_license, product_category, apply_status,
         sub_mchid, wechat_applyment_state, wechat_applyment_msg,
         wechat_applyment_updated_at, commission_rate)
       VALUES (?, ?, ?, ?, 'approved', ?, 'FINISH',
         'Bound existing sub_mchid for WeChat Pay test', NOW(), ?)`,
      [
        userId,
        data.companyName,
        data.businessLicense,
        data.productCategory,
        data.subMchid,
        data.commissionRate
      ]
    )
    merchantId = result.insertId
    createdMerchant = true
  }

  return {
    userId,
    merchantId,
    createdUser,
    createdMerchant,
    subMchid: data.subMchid
  }
}

module.exports = {
  normalizeInput,
  validateInput,
  upsertBoundMerchant
}
