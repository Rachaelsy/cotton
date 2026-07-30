const identityData = require('./identity-data')

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
  'bank_account_info.account_number',
  'contact.name',
  'contact.mobile',
  'contact.email',
  'contact.contact_name',
  'contact.contact_id_number',
  'contact.mobile_phone',
  'contact.contact_email',
  'subject.identity_info.id_card_info.id_card_name',
  'subject.identity_info.id_card_info.id_card_number',
  'subject.identity_info.id_doc_info.id_doc_name',
  'subject.identity_info.id_doc_info.id_doc_number',
  'bank.account_name',
  'bank.account_number'
])

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function normalizedPath(pathName) {
  return pathName.replace(/^raw_applyment\./, '')
}

function transform(value, mode, prefix = '') {
  if (Array.isArray(value)) {
    return value.map((item, index) => transform(item, mode, `${prefix}.${index}`))
  }
  if (!value || typeof value !== 'object') return value

  const output = {}
  Object.entries(value).forEach(([key, child]) => {
    const pathName = prefix ? `${prefix}.${key}` : key
    if (SENSITIVE_PATHS.has(normalizedPath(pathName)) && child !== '' && child != null) {
      const text = String(child)
      if (mode === 'encrypt') {
        output[key] = text.startsWith('v1:') ? text : identityData.encrypt(text)
      } else {
        output[key] = text.startsWith('v1:') ? identityData.decrypt(text) : text
      }
    } else {
      output[key] = transform(child, mode, pathName)
    }
  })
  return output
}

function protectDraft(draft) {
  const protectedDraft = transform(clone(draft), 'encrypt')
  protectedDraft._storage_encryption = 'v1'
  return protectedDraft
}

function revealDraft(draft) {
  const revealed = transform(clone(draft), 'decrypt')
  delete revealed._storage_encryption
  return revealed
}

function isProtectedDraft(draft) {
  return Boolean(draft && draft._storage_encryption === 'v1')
}

module.exports = { protectDraft, revealDraft, isProtectedDraft }
