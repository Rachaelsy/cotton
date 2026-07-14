// server/routes/wechat-applyment.js - WeChat Pay service-provider applyment
const express = require('express')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const db = require('../db/database')
const wxpay = require('../utils/wechat-pay')

const router = express.Router()
const ok = (res, data, msg = 'ok') => res.json({ code: 200, msg, data })
const fail = (res, msg, code = 400) => res.status(code).json({ code, msg, data: null })
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/bmp'])
    if (allowed.has(file.mimetype)) return cb(null, true)
    cb(new Error('仅支持 JPG、PNG、BMP 图片，且单张不超过 5MB'))
  }
})

const ACTOR_META = {
  merchant: {
    table: 'merchants',
    payloadId: 'merchant_id',
    label: '商户',
    nameField: 'company_name',
    loadSql: `
      SELECT m.id, m.user_id, m.company_name, m.business_license, m.product_category,
             m.sub_mchid, m.wechat_applyment_id, m.wechat_business_code,
             m.wechat_applyment_state, m.wechat_applyment_msg,
             m.wechat_applyment_payload, m.wechat_applyment_updated_at
      FROM merchants m WHERE m.id=?`
  },
  operator: {
    table: 'operators',
    payloadId: 'operator_id',
    label: '农机手',
    nameField: 'org_name',
    loadSql: `
      SELECT o.id, o.user_id, o.org_name AS company_name, o.id_card AS business_license,
             '农机服务' AS product_category,
             o.sub_mchid, o.wechat_applyment_id, o.wechat_business_code,
             o.wechat_applyment_state, o.wechat_applyment_msg,
             o.wechat_applyment_payload, o.wechat_applyment_updated_at
      FROM operators o WHERE o.id=?`
  }
}

const SENSITIVE_PATHS = new Set([
  'contact_info.contact_name',
  'contact_info.contact_id_number',
  'contact_info.mobile_phone',
  'contact_info.contact_email',
  'subject_info.identity_info.id_card_info.id_card_name',
  'subject_info.identity_info.id_card_info.id_card_number',
  'subject_info.identity_info.id_doc_info.id_doc_name',
  'subject_info.identity_info.id_doc_info.id_doc_number',
  'bank_account_info.account_name',
  'bank_account_info.account_number'
])

function applymentAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ code: 401, msg: '请先登录' })
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    if (payload.role === 'merchant') {
      req.applymentActor = { role: 'merchant', id: payload.merchant_id }
    } else if (payload.role === 'operator') {
      req.applymentActor = { role: 'operator', id: payload.operator_id }
    } else {
      return res.status(403).json({ code: 403, msg: '仅商户或农机手可访问微信支付入驻' })
    }
    if (!req.applymentActor.id) return res.status(403).json({ code: 403, msg: '账号未关联入驻主体' })
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

function makeBusinessCode(actor, ownerId) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `COTTON_${actor.role.toUpperCase()}_${ownerId}_${stamp}_${Math.floor(Math.random() * 9000 + 1000)}`
}

async function loadOwner(actor) {
  const meta = ACTOR_META[actor.role]
  if (!meta) return null
  const [[row]] = await db.query(meta.loadSql, [actor.id])
  return row || null
}

function publicApplyment(actor, owner) {
  const payload = parsePayload(owner.wechat_applyment_payload)
  return {
    actor_type: actor.role,
    actor_label: ACTOR_META[actor.role].label,
    owner_id: owner.id,
    merchant_id: actor.role === 'merchant' ? owner.id : undefined,
    operator_id: actor.role === 'operator' ? owner.id : undefined,
    company_name: owner.company_name || '',
    business_license: owner.business_license || '',
    product_category: owner.product_category || '',
    sub_mchid: owner.sub_mchid || '',
    payment_enabled: !!owner.sub_mchid,
    applyment_id: owner.wechat_applyment_id || '',
    business_code: owner.wechat_business_code || '',
    state: owner.wechat_applyment_state || '',
    state_label: stateLabel(owner.wechat_applyment_state),
    message: owner.wechat_applyment_msg || '',
    updated_at: owner.wechat_applyment_updated_at || null,
    draft: payload || {}
  }
}

router.get('/config', (_req, res) => {
  return ok(res, {
    mini_program_appid: process.env.WECHAT_PAY_SP_APPID || process.env.WECHAT_APPID || process.env.WX_APPID || '',
    settlement_id: '719'
  })
})

function stateLabel(state) {
  const map = {
    DRAFT: '资料草稿',
    SUBMIT_FAILED: '提交微信失败',
    FINISH: '已完成',
    APPLYMENT_STATE_EDITTING: '编辑中',
    APPLYMENT_STATE_AUDITING: '审核中',
    APPLYMENT_STATE_REJECTED: '已驳回',
    APPLYMENT_STATE_TO_BE_CONFIRMED: '待商户确认',
    APPLYMENT_STATE_TO_BE_SIGNED: '待签约',
    APPLYMENT_STATE_SIGNING: '签约中',
    APPLYMENT_STATE_FINISHED: '已完成',
    APPLYMENT_STATE_UNKNOWN: '未知状态',
    APPLYMENT_STATE_UNSUBMITTED: '未提交',
    APPLYMENT_STATE_WAITING_VALIDATE: '待主体意愿确认',
    APPLYMENT_STATE_WAITING_AUDIT: '资料审核中',
    APPLYMENT_STATE_WAITING_AUTH: '待授权确认',
    APPLYMENT_STATE_OPEN_ACCOUNT: '开户中',
    APPLYMENT_STATE_FINISH: '入驻完成',
    APPLYMENT_STATE_AUDIT_REJECTED: '审核驳回',
    APPLYMENT_STATE_CANCELED: '已撤销'
  }
  return map[state] || state || '未提交'
}

function encryptSensitivePaths(value, cfg, prefix = '') {
  if (Array.isArray(value)) return value.map((item, index) => encryptSensitivePaths(item, cfg, `${prefix}.${index}`))
  if (!value || typeof value !== 'object') return value
  const out = {}
  Object.entries(value).forEach(([key, val]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (SENSITIVE_PATHS.has(path) && val !== undefined && val !== null && val !== '') {
      out[key] = wxpay.encryptSensitive(String(val), cfg)
    } else {
      out[key] = encryptSensitivePaths(val, cfg, path)
    }
  })
  return out
}

function buildApplymentPayload(actor, owner, cfg) {
  const draft = parsePayload(owner.wechat_applyment_payload) || {}
  const businessCode = owner.wechat_business_code || draft.business_code || makeBusinessCode(actor, owner.id)

  if (draft.raw_applyment && typeof draft.raw_applyment === 'object') {
    const raw = { business_code: businessCode, ...draft.raw_applyment }
    return draft.raw_applyment_encrypted ? raw : encryptSensitivePaths(raw, cfg)
  }

  const contact = draft.contact || {}
  const subject = draft.subject || {}
  const identity = subject.identity_info || {}
  const business = draft.business || {}
  const settlement = draft.settlement || {}
  const bank = draft.bank || {}
  const sales = business.sales_info || {}

  const payload = {
    business_code: businessCode,
    contact_info: {
      contact_type: contact.contact_type || 'LEGAL',
      contact_name: contact.name || contact.contact_name,
      contact_id_doc_type: contact.contact_id_doc_type,
      contact_id_number: contact.contact_id_number,
      contact_id_doc_copy: contact.contact_id_doc_copy,
      contact_id_doc_copy_back: contact.contact_id_doc_copy_back,
      contact_period_begin: contact.contact_period_begin,
      contact_period_end: contact.contact_period_end,
      mobile_phone: contact.mobile || contact.mobile_phone,
      contact_email: contact.email || contact.contact_email,
      openid: contact.openid
    },
    subject_info: {
      subject_type: subject.subject_type || 'SUBJECT_TYPE_INDIVIDUAL',
      finance_institution: subject.finance_institution,
      business_license_info: {
        license_copy: subject.license_copy,
        license_number: subject.license_number || owner.business_license || '',
        merchant_name: subject.merchant_name || owner.company_name || '',
        legal_person: subject.legal_person || contact.name || contact.contact_name || ''
      },
      certificate_info: subject.certificate_info,
      identity_info: identity
    },
    business_info: {
      merchant_shortname: business.merchant_shortname || owner.company_name || '',
      service_phone: business.service_phone || contact.mobile || contact.mobile_phone || '',
      sales_info: {
        sales_scenes_type: sales.sales_scenes_type || ['SALES_SCENES_MINI_PROGRAM'],
        mini_program_info: sales.mini_program_info,
        mp_info: sales.mp_info,
        app_info: sales.app_info,
        web_info: sales.web_info,
        wework_info: sales.wework_info,
        store_info: sales.store_info
      }
    },
    settlement_info: {
      settlement_id: settlement.settlement_id,
      qualification_type: settlement.qualification_type,
      qualifications: settlement.qualifications,
      activities_id: settlement.activities_id,
      activities_rate: settlement.activities_rate,
      activities_additions: settlement.activities_additions,
      debit_activities_rate: settlement.debit_activities_rate,
      credit_activities_rate: settlement.credit_activities_rate
    },
    bank_account_info: {
      bank_account_type: bank.bank_account_type,
      account_bank: bank.account_bank,
      account_name: bank.account_name,
      bank_address_code: bank.bank_address_code,
      bank_branch_id: bank.bank_branch_id,
      bank_name: bank.bank_name,
      account_number: bank.account_number
    },
    addition_info: draft.addition_info
  }

  return encryptSensitivePaths(stripEmpty(payload) || payload, cfg)
}

async function saveApplymentResult(actor, ownerId, businessCode, result) {
  const meta = ACTOR_META[actor.role]
  const state = result.applyment_state || result.state || (result.sub_mchid ? 'APPLYMENT_STATE_FINISHED' : 'APPLYMENT_STATE_AUDITING')
  const message = result.applyment_state_msg || result.applyment_state_desc || result.reject_reason || result.message || ''
  await db.query(
    `UPDATE ${meta.table} SET wechat_applyment_id=?, wechat_business_code=?,
     wechat_applyment_state=?, wechat_applyment_msg=?, sub_mchid=COALESCE(?, sub_mchid),
     wechat_applyment_updated_at=NOW() WHERE id=?`,
    [
      result.applyment_id || null,
      businessCode || null,
      state,
      message,
      result.sub_mchid || null,
      ownerId
    ]
  )
}

router.get('/mine', applymentAuth, async (req, res) => {
  try {
    const owner = await loadOwner(req.applymentActor)
    if (!owner) return fail(res, `${ACTOR_META[req.applymentActor.role].label}不存在`, 404)
    return ok(res, publicApplyment(req.applymentActor, owner))
  } catch (error) {
    console.error('[wechat-applyment-mine]', error)
    return fail(res, '获取微信支付入驻状态失败', 500)
  }
})

router.post('/draft', applymentAuth, async (req, res) => {
  try {
    const actor = req.applymentActor
    const owner = await loadOwner(actor)
    if (!owner) return fail(res, `${ACTOR_META[actor.role].label}不存在`, 404)
    const businessCode = req.body.business_code || owner.wechat_business_code || makeBusinessCode(actor, owner.id)
    const payload = { ...req.body, business_code: businessCode }
    await db.query(
      `UPDATE ${ACTOR_META[actor.role].table} SET wechat_applyment_payload=?, wechat_business_code=?,
       wechat_applyment_state='DRAFT', wechat_applyment_msg='', wechat_applyment_updated_at=NOW()
       WHERE id=?`,
      [JSON.stringify(payload), businessCode, owner.id]
    )
    return ok(res, { business_code: businessCode }, '入驻资料草稿已保存')
  } catch (error) {
    console.error('[wechat-applyment-draft]', error)
    return fail(res, '保存入驻资料失败', 500)
  }
})

router.post('/sub-mchid', applymentAuth, async (req, res) => {
  const subMchid = String(req.body.sub_mchid || '').trim()
  if (!/^\d{8,32}$/.test(subMchid)) return fail(res, '请输入正确的微信支付子商户号')
  try {
    const actor = req.applymentActor
    const [result] = await db.query(
      `UPDATE ${ACTOR_META[actor.role].table} SET sub_mchid=?, wechat_applyment_state='FINISH',
       wechat_applyment_msg='已手动绑定子商户号', wechat_applyment_updated_at=NOW()
       WHERE id=?`,
      [subMchid, actor.id]
    )
    if (result.affectedRows === 0) return fail(res, `${ACTOR_META[actor.role].label}不存在`, 404)
    return ok(res, { sub_mchid: subMchid }, '子商户号已绑定')
  } catch (error) {
    console.error('[wechat-applyment-sub-mchid]', error)
    return fail(res, '绑定子商户号失败', 500)
  }
})

router.post('/media', applymentAuth, (req, res) => {
  imageUpload.single('file')(req, res, async error => {
    if (error) return fail(res, error.message || '图片上传失败')
    if (!req.file) return fail(res, '请选择要上传的图片')
    try {
      const actor = req.applymentActor
      const owner = await loadOwner(actor)
      if (!owner) return fail(res, `${ACTOR_META[actor.role].label}不存在`, 404)
      const cfg = wxpay.getServiceProviderConfig()
      if (!cfg) return fail(res, '微信支付服务商未配置，无法上传微信支付素材', 501)
      const result = await wxpay.uploadMediaImage(cfg, {
        filename: req.file.originalname,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype
      })
      if (!result || !result.media_id) return fail(res, '微信支付未返回 media_id', 502)
      return ok(res, {
        media_id: result.media_id,
        filename: req.file.originalname
      }, '微信支付素材上传成功')
    } catch (uploadError) {
      console.error('[wechat-applyment-media]', uploadError)
      return fail(res, uploadError.message || '微信支付素材上传失败', 500)
    }
  })
})

router.post('/submit', applymentAuth, async (req, res) => {
  try {
    const actor = req.applymentActor
    const owner = await loadOwner(actor)
    if (!owner) return fail(res, `${ACTOR_META[actor.role].label}不存在`, 404)
    if (!owner.wechat_applyment_payload) return fail(res, '请先保存微信支付入驻资料草稿')

    const cfg = wxpay.getNotifyConfig()
    if (!cfg) {
      return fail(res, '微信支付服务商未配置：请配置服务商 AppID、服务商商户号、证书序列号、私钥、APIv3 密钥、微信支付公钥和回调地址', 501)
    }

    const payload = buildApplymentPayload(actor, owner, cfg)
    const result = await wxpay.submitApplyment(cfg, payload)
    await saveApplymentResult(actor, owner.id, payload.business_code, result)
    return ok(res, result, '微信支付入驻申请已提交')
  } catch (error) {
    console.error('[wechat-applyment-submit]', error)
    return fail(res, error.message || '提交微信支付入驻申请失败', 500)
  }
})

router.post('/sync', applymentAuth, async (req, res) => {
  try {
    const actor = req.applymentActor
    const owner = await loadOwner(actor)
    if (!owner) return fail(res, `${ACTOR_META[actor.role].label}不存在`, 404)
    const cfg = wxpay.getServiceProviderConfig()
    if (!cfg) return fail(res, '微信支付服务商未配置，无法同步进件状态', 501)

    let result
    if (owner.wechat_applyment_id) {
      result = await wxpay.queryApplymentById(cfg, owner.wechat_applyment_id)
    } else if (owner.wechat_business_code) {
      result = await wxpay.queryApplymentByBusinessCode(cfg, owner.wechat_business_code)
    } else {
      return fail(res, '暂无微信支付进件申请编号')
    }
    await saveApplymentResult(actor, owner.id, owner.wechat_business_code, result)
    return ok(res, result, '微信支付入驻状态已同步')
  } catch (error) {
    console.error('[wechat-applyment-sync]', error)
    return fail(res, error.message || '同步微信支付入驻状态失败', 500)
  }
})

module.exports = router
