const assert = require('assert')

process.env.IDENTITY_DATA_KEY = 'applyment-draft-test-key-with-at-least-32-characters'

const {
  isProtectedDraft,
  protectDraft,
  revealDraft
} = require('../utils/applyment-draft-security')

const draft = {
  source: 'portal_register',
  attachments: {
    license_copy_url: '/private/applyments/license.jpg'
  },
  raw_applyment: {
    contact_info: {
      contact_name: '张三',
      mobile_phone: '13800138000',
      contact_email: 'owner@example.com'
    },
    subject_info: {
      identity_info: {
        id_card_info: {
          id_card_name: '张三',
          id_card_number: '650100199001010000'
        }
      }
    },
    bank_account_info: {
      account_bank: '中国农业银行',
      account_name: '张三',
      account_number: '6228000000000000'
    }
  }
}

const protectedDraft = protectDraft(draft)
const serialized = JSON.stringify(protectedDraft)
assert(isProtectedDraft(protectedDraft))
assert(!serialized.includes('650100199001010000'))
assert(!serialized.includes('6228000000000000'))
assert(!serialized.includes('13800138000'))
assert(serialized.includes('中国农业银行'), 'non-sensitive routing fields should remain usable')
assert.strictEqual(protectedDraft.attachments.license_copy_url, '/private/applyments/license.jpg')

const protectedAgain = protectDraft(protectedDraft)
assert.strictEqual(
  protectedAgain.raw_applyment.bank_account_info.account_number,
  protectedDraft.raw_applyment.bank_account_info.account_number,
  'already encrypted fields should not be encrypted twice'
)

const revealed = revealDraft(protectedDraft)
assert(!isProtectedDraft(revealed))
assert.strictEqual(revealed.raw_applyment.contact_info.contact_name, '张三')
assert.strictEqual(revealed.raw_applyment.subject_info.identity_info.id_card_info.id_card_number, '650100199001010000')
assert.strictEqual(revealed.raw_applyment.bank_account_info.account_number, '6228000000000000')

console.log('applyment draft security tests passed')
