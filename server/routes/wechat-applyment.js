// server/routes/wechat-applyment.js — 微信支付服务商进件/子商户号状态
const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const wxpay = require('../utils/wechat-pay')

const router = express.Router()
const ok = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })

function merchantAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ code: 401, msg: '请先登录' })
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    if (payload.role !== 'merchant') return res.status(403).json({ code: 403, msg: '权限不足，仅商户可访问' })
    req.merchant = payload
    next()
  } catch {
    res.status(401).json({ code: 401, msg: '登录已过期，请重新登录' })
  }
}

function parsePayload(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return null }
}

function stripEmpty(value) {
  if (Array.isArray(value)) {
    const arr = value.map(stripEmpty).filter(item => item !== undefined)
    return arr.length ? arr : undefined
  }
  if (value && typeof value === 'object') {
    const out = {}
    Object.entries(value).forEach(([key, val]) => {
      const cleaned = stripEmpty(val)
      if (cleaned !== undefined) out[key] = cleaned
    })
    return Object.keys(out).length ? out : undefined
  }
  if (value == null || value === '') return undefined
  return value
}

function makeBusinessCode(merchantId) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `COTTON_${merchantId}_${stamp}_${Math.floor(Math.random() * 9000 + 1000)}`
}

async function loadMerchant(merchantId) {
  const [[merchant]] = await db.query(`
    SELECT m.id, m.user_id, m.company_name, m.business_license, m.product_category,
           m.sub_mchid, m.wechat_applyment_id, m.wechat_business_code,
           m.wechat_applyment_state, m.wechat_applyment_msg,
           m.wechat_applyment_payload, m.wechat_applyment_updated_at
    FROM merchants m WHERE m.id=?
  `, [merchantId])
  return merchant || null
}

function stateLabel(state) {
  const map = {
    DRAFT: '资料草稿',
    APPLYMENT_STATE_EDITTING: '编辑中',
    APPLYMENT_STATE_AUDITING: '审核中',
    APPLYMENT_STATE_REJECTED: '已驳回',
    APPLYMENT_STATE_TO_BE_CONFIRMED: '待商户确认',
    APPLYMENT_STATE_TO_BE_SIGNED: '待签约',
    APPLYMENT_STATE_SIGNING: '签约中',
    APPLYMENT_STATE_FINISHED: '已完成',
    FINISH: '已完成'
  }
  return map[state] || state || '未提交'
}

function publicApplyment(merchant) {
  const payload = parsePayload(merchant.wechat_applyment_payload)
  return {
    merchant_id: merchant.id,
    company_name: merchant.company_name || '',
    business_license: merchant.business_license || '',
    product_category: merchant.product_category || '',
    sub_mchid: merchant.sub_mchid || '',
    payment_enabled: !!merchant.sub_mchid,
    applyment_id: merchant.wechat_applyment_id || '',
    business_code: merchant.wechat_business_code || '',
    state: merchant.wechat_applyment_state || '',
    state_label: stateLabel(merchant.wechat_applyment_state),
    message: merchant.wechat_applyment_msg || '',
    updated_at: merchant.wechat_applyment_updated_at || null,
    draft: payload || {}
  }
}

function encryptIfPresent(value, cfg) {
  return value ? wxpay.encryptSensitive(value, cfg) : ''
}

function buildApplymentPayload(merchant, cfg) {
  const draft = parsePayload(merchant.wechat_applyment_payload) || {}
  if (draft.raw_applyment && typeof draft.raw_applyment === 'object') {
    return {
      business_code: merchant.wechat_business_code || draft.business_code || makeBusinessCode(merchant.id),
      ...draft.raw_applyment
    }
  }

  const contact = draft.contact || {}
  const subject = draft.subject || {}
  const business = draft.business || {}
  const settlement = draft.settlement || {}
  const bank = draft.bank || {}
  const sales = business.sales_info || {}

  const payload = {
    business_code: merchant.wechat_business_code || draft.business_code || makeBusinessCode(merchant.id),
    contact_info: {
      contact_type: contact.contact_type || 'LEGAL',
      contact_name: encryptIfPresent(contact.name || contact.contact_name, cfg),
      mobile_phone: encryptIfPresent(contact.mobile || contact.mobile_phone, cfg),
      contact_email: encryptIfPresent(contact.email || contact.contact_email, cfg)
    },
    subject_info: {
      subject_type: subject.subject_type || 'SUBJECT_TYPE_INDIVIDUAL',
      business_license_info: {
        license_number: subject.license_number || merchant.business_license || '',
        merchant_name: subject.merchant_name || merchant.company_name || '',
        legal_person: subject.legal_person || contact.name || ''
      },
      identity_info: subject.identity_info || undefined
    },
    business_info: {
      merchant_shortname: business.merchant_shortname || merchant.company_name || '',
      service_phone: business.service_phone || contact.mobile || '',
      sales_info: {
        sales_scenes_type: sales.sales_scenes_type || ['SALES_SCENES_MINI_PROGRAM'],
        mini_program_info: sales.mini_program_info || undefined,
        store_info: sales.store_info || undefined
      }
    },
    settlement_info: {
      settlement_id: settlement.settlement_id || '',
      qualification_type: settlement.qualification_type || ''
    },
    bank_account_info: {
      bank_account_type: bank.bank_account_type || '',
      account_bank: bank.account_bank || '',
      account_name: encryptIfPresent(bank.account_name, cfg),
      bank_address_code: bank.bank_address_code || '',
      bank_name: bank.bank_name || '',
      account_number: encryptIfPresent(bank.account_number, cfg)
    },
    addition_info: draft.addition_info || undefined
  }

  return stripEmpty(payload) || payload
}

async function saveApplymentResult(merchantId, businessCode, result) {
  const state = result.applyment_state || result.state || (result.sub_mchid ? 'APPLYMENT_STATE_FINISHED' : 'APPLYMENT_STATE_AUDITING')
  const message = result.applyment_state_msg || result.reject_reason || result.message || ''
  await db.query(
    `UPDATE merchants SET wechat_applyment_id=?, wechat_business_code=?,
     wechat_applyment_state=?, wechat_applyment_msg=?, sub_mchid=COALESCE(?, sub_mchid),
     wechat_applyment_updated_at=NOW() WHERE id=?`,
    [
      result.applyment_id || null,
      businessCode || null,
      state,
      message,
      result.sub_mchid || null,
      merchantId
    ]
  )
}

router.get('/mine', merchantAuth, async (req, res) => {
  try {
    const merchant = await loadMerchant(req.merchant.merchant_id)
    if (!merchant) return fail(res, '商户不存在', 404)
    return ok(res, publicApplyment(merchant))
  } catch (e) {
    console.error('[wechat-applyment-mine]', e)
    return fail(res, '获取微信支付入驻状态失败', 500)
  }
})

router.post('/draft', merchantAuth, async (req, res) => {
  try {
    const merchant = await loadMerchant(req.merchant.merchant_id)
    if (!merchant) return fail(res, '商户不存在', 404)
    const businessCode = req.body.business_code || merchant.wechat_business_code || makeBusinessCode(merchant.id)
    const payload = { ...req.body, business_code: businessCode }
    await db.query(
      `UPDATE merchants SET wechat_applyment_payload=?, wechat_business_code=?,
       wechat_applyment_state='DRAFT', wechat_applyment_msg='', wechat_applyment_updated_at=NOW()
       WHERE id=?`,
      [JSON.stringify(payload), businessCode, merchant.id]
    )
    return ok(res, { business_code: businessCode }, '入驻资料草稿已保存')
  } catch (e) {
    console.error('[wechat-applyment-draft]', e)
    return fail(res, '保存入驻资料失败', 500)
  }
})

router.post('/sub-mchid', merchantAuth, async (req, res) => {
  const subMchid = String(req.body.sub_mchid || '').trim()
  if (!/^\d{8,32}$/.test(subMchid)) return fail(res, '请输入正确的微信支付子商户号')
  try {
    const [r] = await db.query(
      `UPDATE merchants SET sub_mchid=?, wechat_applyment_state='FINISH',
       wechat_applyment_msg='已手动绑定子商户号', wechat_applyment_updated_at=NOW()
       WHERE id=?`,
      [subMchid, req.merchant.merchant_id]
    )
    if (r.affectedRows === 0) return fail(res, '商户不存在', 404)
    return ok(res, { sub_mchid: subMchid }, '子商户号已绑定')
  } catch (e) {
    console.error('[wechat-applyment-sub-mchid]', e)
    return fail(res, '绑定子商户号失败', 500)
  }
})

router.post('/submit', merchantAuth, async (req, res) => {
  try {
    const merchant = await loadMerchant(req.merchant.merchant_id)
    if (!merchant) return fail(res, '商户不存在', 404)
    if (!merchant.wechat_applyment_payload) return fail(res, '请先保存入驻资料草稿')

    const cfg = wxpay.getNotifyConfig()
    if (!cfg) return fail(res, '微信支付服务商未配置：请配置服务商 AppID、服务商商户号、证书序列号、私钥、APIv3 密钥、平台证书和回调地址', 501)

    const payload = buildApplymentPayload(merchant, cfg)
    const result = await wxpay.submitApplyment(cfg, payload)
    await saveApplymentResult(merchant.id, payload.business_code, result)
    return ok(res, result, '微信支付入驻申请已提交')
  } catch (e) {
    console.error('[wechat-applyment-submit]', e)
    return fail(res, e.message || '提交微信支付入驻申请失败', 500)
  }
})

router.post('/sync', merchantAuth, async (req, res) => {
  try {
    const merchant = await loadMerchant(req.merchant.merchant_id)
    if (!merchant) return fail(res, '商户不存在', 404)
    const cfg = wxpay.getServiceProviderConfig()
    if (!cfg) return fail(res, '微信支付服务商未配置，无法同步进件状态', 501)

    let result
    if (merchant.wechat_applyment_id) {
      result = await wxpay.queryApplymentById(cfg, merchant.wechat_applyment_id)
    } else if (merchant.wechat_business_code) {
      result = await wxpay.queryApplymentByBusinessCode(cfg, merchant.wechat_business_code)
    } else {
      return fail(res, '暂无微信支付进件申请编号')
    }
    await saveApplymentResult(merchant.id, merchant.wechat_business_code, result)
    return ok(res, result, '微信支付入驻状态已同步')
  } catch (e) {
    console.error('[wechat-applyment-sync]', e)
    return fail(res, e.message || '同步微信支付入驻状态失败', 500)
  }
})

module.exports = router
