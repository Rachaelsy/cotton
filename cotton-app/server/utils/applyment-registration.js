const fs = require('fs')
const path = require('path')
const wxpay = require('./wechat-pay')

const SENSITIVE_PATHS = [
  ['contact_info', 'contact_name'],
  ['contact_info', 'mobile_phone'],
  ['contact_info', 'contact_email'],
  ['subject_info', 'identity_info', 'id_card_info', 'id_card_name'],
  ['subject_info', 'identity_info', 'id_card_info', 'id_card_number'],
  ['bank_account_info', 'account_name'],
  ['bank_account_info', 'account_number']
]

function clean(value) { return String(value == null ? '' : value).trim() }

const DEFAULT_SETTLEMENT_IDS = {
  SUBJECT_TYPE_INDIVIDUAL: '719',
  SUBJECT_TYPE_ENTERPRISE: '716',
  SUBJECT_TYPE_OTHERS: '727'
}

function resolveSettlementId(input, defaults = {}) {
  const explicitId = clean(input.settlement_id)
  if (explicitId) return explicitId
  const subjectType = clean(input.subject_type) || 'SUBJECT_TYPE_INDIVIDUAL'
  return clean(defaults.settlementIds?.[subjectType]) || DEFAULT_SETTLEMENT_IDS[subjectType] || '719'
}

function stripEmpty(value) {
  if (Array.isArray(value)) {
    const result = value.map(stripEmpty).filter(item => item !== undefined)
    return result.length ? result : undefined
  }
  if (value && typeof value === 'object') {
    const result = {}
    Object.entries(value).forEach(([key, child]) => {
      const normalized = stripEmpty(child)
      if (normalized !== undefined) result[key] = normalized
    })
    return Object.keys(result).length ? result : undefined
  }
  return value === '' || value == null ? undefined : value
}

function buildRegistrationDraft(input, defaults = {}) {
  const realName = clean(input.real_name || input.contact || defaults.realName)
  const companyName = clean(input.company_name || input.org_name || defaults.companyName)
  const phone = clean(input.contact_mobile || input.phone)
  const businessLicense = clean(input.business_license || defaults.businessLicense)
  const appid = clean(process.env.WX_APPID || process.env.WECHAT_PAY_SP_APPID)
  return {
    source: 'portal_register',
    attachments: {
      license_copy_url: clean(input.license_copy_url),
      id_card_copy_url: clean(input.id_card_copy_url),
      id_card_national_url: clean(input.id_card_national_url),
      mini_program_pic_url: clean(input.mini_program_pic_url)
    },
    raw_applyment: stripEmpty({
      contact_info: {
        contact_type: 'LEGAL',
        contact_name: realName,
        mobile_phone: phone,
        contact_email: clean(input.contact_email)
      },
      subject_info: {
        subject_type: clean(input.subject_type) || 'SUBJECT_TYPE_INDIVIDUAL',
        business_license_info: {
          license_number: businessLicense,
          merchant_name: companyName,
          legal_person: clean(input.legal_person) || realName
        },
        identity_info: {
          id_card_info: {
            id_card_name: clean(input.id_card_name) || realName,
            id_card_number: clean(input.id_card_number || input.id_card),
            card_period_begin: clean(input.card_period_begin),
            card_period_end: clean(input.card_period_end)
          }
        }
      },
      business_info: {
        merchant_shortname: clean(input.merchant_shortname) || companyName,
        service_phone: clean(input.service_phone) || phone,
        sales_info: {
          sales_scenes_type: ['SALES_SCENES_MINI_PROGRAM'],
          mini_program_info: { mini_program_appid: appid }
        }
      },
      settlement_info: {
        settlement_id: resolveSettlementId(input, defaults),
        qualification_type: clean(input.qualification_type || defaults.qualificationType)
      },
      bank_account_info: {
        bank_account_type: clean(input.bank_account_type) || 'BANK_ACCOUNT_TYPE_PERSONAL',
        account_bank: clean(input.account_bank),
        bank_address_code: clean(input.bank_address_code),
        bank_branch_id: clean(input.bank_branch_id),
        bank_name: clean(input.bank_name),
        account_name: clean(input.account_name),
        account_number: clean(input.account_number)
      }
    })
  }
}

function localUploadPath(url) {
  let pathname = clean(url)
  if (/^https?:\/\//i.test(pathname)) pathname = new URL(pathname).pathname
  pathname = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '')
  const publicRoot = path.resolve(__dirname, '../public')
  const filePath = path.resolve(publicRoot, pathname)
  const uploadRoot = path.resolve(publicRoot, 'uploads')
  if (!filePath.startsWith(uploadRoot + path.sep)) throw new Error('进件图片路径不合法')
  return filePath
}

async function uploadAttachment(cfg, url, fieldName) {
  if (!url) throw new Error(`缺少${fieldName}`)
  const filePath = localUploadPath(url)
  const buffer = await fs.promises.readFile(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : ext === '.bmp' ? 'image/bmp' : 'image/jpeg'
  const result = await wxpay.uploadMediaImage(cfg, { filename: path.basename(filePath), buffer, mimeType })
  if (!result?.media_id) throw new Error(`${fieldName}上传微信失败：未返回 media_id`)
  return result.media_id
}

function getAtPath(target, keys) {
  return keys.reduce((value, key) => value && value[key], target)
}

function setAtPath(target, keys, value) {
  let current = target
  keys.slice(0, -1).forEach(key => { current = current[key] || (current[key] = {}) })
  current[keys[keys.length - 1]] = value
}

function validateRaw(raw) {
  const required = [
    ['contact_info.contact_name', '联系人姓名'], ['contact_info.mobile_phone', '联系人手机号'],
    ['subject_info.business_license_info.license_number', '营业执照号'],
    ['subject_info.business_license_info.merchant_name', '营业执照主体名称'],
    ['subject_info.identity_info.id_card_info.id_card_number', '身份证号'],
    ['subject_info.identity_info.id_card_info.card_period_begin', '身份证开始日期'],
    ['subject_info.identity_info.id_card_info.card_period_end', '身份证结束日期'],
    ['business_info.merchant_shortname', '商户简称'], ['business_info.service_phone', '客服电话'],
    ['business_info.sales_info.mini_program_info.mini_program_appid', '小程序 AppID'],
    ['settlement_info.settlement_id', '结算规则'], ['bank_account_info.account_bank', '开户银行'],
    ['bank_account_info.account_name', '开户人姓名'], ['bank_account_info.account_number', '银行卡号']
  ]
  for (const [pathName, label] of required) {
    if (!pathName.split('.').reduce((value, key) => value && value[key], raw)) throw new Error(`进件资料缺少：${label}`)
  }
}

async function prepareApplymentPayload(cfg, draft, businessCode) {
  const raw = JSON.parse(JSON.stringify(draft?.raw_applyment || {}))
  validateRaw(raw)
  const attachments = draft?.attachments || {}
  const [licenseCopy, idCardCopy, idCardNational, miniProgramPic] = await Promise.all([
    uploadAttachment(cfg, attachments.license_copy_url, '营业执照图片'),
    uploadAttachment(cfg, attachments.id_card_copy_url, '身份证人像面'),
    uploadAttachment(cfg, attachments.id_card_national_url, '身份证国徽面'),
    uploadAttachment(cfg, attachments.mini_program_pic_url, '经营页面截图')
  ])
  raw.subject_info.business_license_info.license_copy = licenseCopy
  const idCard = raw.subject_info.identity_info.id_card_info
  idCard.id_card_copy = idCardCopy
  idCard.id_card_national = idCardNational
  raw.business_info.sales_info.mini_program_info.mini_program_pics = [miniProgramPic]
  SENSITIVE_PATHS.forEach(keys => {
    const value = getAtPath(raw, keys)
    if (value) setAtPath(raw, keys, wxpay.encryptSensitive(String(value), cfg))
  })
  return { business_code: businessCode, ...stripEmpty(raw) }
}

module.exports = {
  DEFAULT_SETTLEMENT_IDS,
  resolveSettlementId,
  buildRegistrationDraft,
  prepareApplymentPayload,
  validateRaw,
  localUploadPath
}
