const assert = require('assert')

const dbPath = require.resolve('../db/database')
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { query: async () => [[], []] }
}
const logistics = require('../utils/logistics')

function run() {
  const env = {
    WX_APPID: 'wx-test',
    WX_SECRET: 'secret-test',
    WECHAT_LOGISTICS_SENDER_NAME: '测试商户',
    WECHAT_LOGISTICS_SENDER_MOBILE: '13800000000',
    WECHAT_LOGISTICS_SENDER_ADDRESS: '新疆维吾尔自治区喀什地区喀什市测试路1号'
  }
  assert.strictEqual(logistics.isConfigured(env), true)
  assert.strictEqual(logistics.getConfig(env).appid, 'wx-test')

  const address = logistics.splitAddress('新疆维吾尔自治区喀什地区疏附县测试路1号')
  assert.strictEqual(address.province, '新疆维吾尔自治区')
  assert.strictEqual(address.city, '喀什地区')
  assert.strictEqual(address.area, '疏附县')

  const payload = logistics.buildWaybillPayload({
    id: 8,
    order_no: 'MG202607140001',
    merchant_id: 2,
    openid: 'openid-test',
    receiver_name: '农户',
    receiver_phone: '13900000000',
    address: '新疆维吾尔自治区喀什地区疏附县幸福路2号',
    items: [{ name: '农药', qty: 2 }]
  }, { delivery_id: 'ZTO', biz_id: 'BIZ001' }, { service_type: 0, service_name: '标准快递' }, env)
  assert.strictEqual(payload.delivery_id, 'ZTO')
  assert.strictEqual(payload.biz_id, 'BIZ001')
  assert.strictEqual(payload.openid, 'openid-test')
  assert.strictEqual(payload.shop.goods_count, 2)

  const normalized = logistics.normalizePath({
    delivery_id: 'ZTO',
    waybill_id: 'ZT123',
    path_item_list: [{ action_time: 1784011200, action_type: 300001, action_msg: '快件正在派送中' }]
  })
  assert.strictEqual(normalized.stateLabel, '派送中')
  assert.strictEqual(normalized.latest.context, '快件正在派送中')
  console.log('logistics tests passed')
}

run()
