require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const wxpay = require('../utils/wechat-pay')
const profitSharing = require('../utils/profit-sharing')

let db = null

function maskMchid(value) {
  const text = String(value || '')
  if (text.length <= 6) return text || '(empty)'
  return `${text.slice(0, 3)}***${text.slice(-3)}`
}

async function loadReceiverSubMchids() {
  const [rows] = await db.query(`
    SELECT DISTINCT sub_mchid
      FROM merchants
     WHERE sub_mchid IS NOT NULL
       AND sub_mchid <> ''
       AND COALESCE(commission_rate, 0) > 0
       AND COALESCE(wechat_applyment_state, '') <> 'SELF_OPERATED'
     ORDER BY sub_mchid ASC
  `)
  return rows.map(row => String(row.sub_mchid || '').trim()).filter(Boolean)
}

async function run() {
  if (String(process.env.WECHAT_PAY_PROFIT_SHARING_ENABLED || 'true') === 'false') {
    console.log('Profit sharing is disabled by WECHAT_PAY_PROFIT_SHARING_ENABLED=false')
    return
  }

  const cfg = wxpay.getNotifyConfig() || wxpay.getServiceProviderConfig()
  if (!cfg) throw new Error('WeChat Pay service-provider config is missing')

  const receiverAccount = profitSharing.getPlatformReceiverAccount(cfg)
  if (!receiverAccount) throw new Error('Profit sharing receiver account is missing')
  if (!profitSharing.getPlatformReceiverName()) {
    throw new Error('WECHAT_PAY_PROFIT_SHARING_RECEIVER_NAME is missing; fill the exact receiver merchant full name first')
  }

  db = require('./database')
  const subMchids = await loadReceiverSubMchids()
  if (!subMchids.length) {
    console.log('No bound merchants need profit-sharing receiver registration')
    return
  }

  console.log(`Profit-sharing receiver account: ${maskMchid(receiverAccount)}`)
  for (const subMchid of subMchids) {
    const config = await wxpay.queryProfitSharingMerchantConfig(cfg, subMchid)
    if (config && config.max_ratio != null) {
      console.log(`  sub_mchid ${maskMchid(subMchid)} max_ratio: ${config.max_ratio}`)
    }
    const result = await profitSharing.ensurePlatformReceiver(cfg, subMchid)
    const status = result && result.existed ? 'already exists' : 'ok'
    console.log(`  sub_mchid ${maskMchid(subMchid)} -> ${status}`)
  }
}

run()
  .catch(error => {
    console.error('Failed to ensure profit-sharing receivers:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (db && db.end) await db.end().catch(() => {})
  })
