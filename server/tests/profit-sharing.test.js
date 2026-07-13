const assert = require('assert')

const profitSharing = require('../utils/profit-sharing')

async function run() {
  assert.strictEqual(profitSharing.calculateCommissionFen(25.8, 5), 129)
  assert.strictEqual(profitSharing.calculateCommissionFen(25.8, 0), 0)

  const cfg = { spAppid: 'wxspapp', spMchid: '1900000109' }
  const order = {
    orderType: 'supply',
    orderId: 8,
    subMchid: '1700000001',
    transactionId: '4200000000202607070000000001',
    amount: 25.8,
    commissionRate: 5
  }
  const body = profitSharing.buildSupplyProfitSharingBody({ cfg, order })
  assert.strictEqual(body.sub_mchid, '1700000001')
  assert.strictEqual(body.appid, 'wxspapp')
  assert.strictEqual(body.transaction_id, '4200000000202607070000000001')
  assert.strictEqual(body.out_order_no, 'PS_SUPPLY_8')
  assert.strictEqual(body.unfreeze_unsplit, true)
  assert.deepStrictEqual(body.receivers, [{
    type: 'MERCHANT_ID',
    account: '1900000109',
    amount: 129,
    description: 'Cotton platform service fee'
  }])

  const receiver = profitSharing.buildPlatformReceiver({ cfg, subMchid: '1700000001' })
  assert.deepStrictEqual(receiver, {
    sub_mchid: '1700000001',
    appid: 'wxspapp',
    type: 'MERCHANT_ID',
    account: '1900000109',
    relation_type: 'SERVICE_PROVIDER'
  })

  process.env.WECHAT_PAY_PROFIT_SHARING_RECEIVER_MCH_ID = '1900000200'
  assert.strictEqual(profitSharing.getPlatformReceiverAccount(cfg), '1900000200')
  assert.strictEqual(
    profitSharing.buildPlatformReceiver({ cfg, subMchid: '1700000001' }).account,
    '1900000200'
  )
  delete process.env.WECHAT_PAY_PROFIT_SHARING_RECEIVER_MCH_ID

  process.env.WECHAT_PAY_PROFIT_SHARING_FREEZE_DAYS = '0'
  assert.strictEqual(profitSharing.getProfitSharingFreezeDays(), 0)
  delete process.env.WECHAT_PAY_PROFIT_SHARING_FREEZE_DAYS

  assert.strictEqual(profitSharing.normalizeState({ state: 'finished' }), 'FINISHED')
  assert.strictEqual(profitSharing.normalizeState({ status: 'processing' }), 'PROCESSING')
  assert.strictEqual(profitSharing.isFinishedState('SUCCESS'), true)
  assert.strictEqual(profitSharing.isFinishedState('PROCESSING'), false)

  profitSharing.__setDbForTest({
    async query() {
      const error = new Error('table missing')
      error.code = 'ER_NO_SUCH_TABLE'
      throw error
    }
  })
  const skipped = await profitSharing.releaseEligibleSupplyProfitSharing()
  assert.deepStrictEqual(skipped, { total: 0, success: 0, skipped: true })
  profitSharing.__setDbForTest(null)

  console.log('profit sharing utility tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
