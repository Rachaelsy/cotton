require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')
const wxpay = require('../utils/wechat-pay')
const { supplyOutTradeNo, machineOutTradeNo } = require('../utils/payment-order-no')

const execute = process.argv.includes('--execute')
const paidStates = new Set(['SUCCESS', 'REFUND'])

function isMissingTransaction(error) {
  const detail = error && error.wxpay || {}
  const text = `${detail.code || ''} ${detail.message || ''} ${error && error.message || ''}`.toUpperCase()
  return text.includes('ORDER_NOT_EXIST') || text.includes('ORDERNOTEXIST') ||
    text.includes('TRANSACTION_NOT_EXIST') || text.includes('RESOURCE_NOT_EXISTS') ||
    text.includes('不存在')
}

function mysqlDate(value) {
  const source = String(value || '')
  const wechatTime = source.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/)
  if (wechatTime) return `${wechatTime[1]} ${wechatTime[2]}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function placeholders(values) {
  return values.map(() => '?').join(',')
}

async function queryWechatTransaction(cfg, outTradeNo, subMchid) {
  try {
    return await wxpay.queryPartnerTransaction({ cfg, outTradeNo, subMchid })
  } catch (error) {
    if (isMissingTransaction(error)) return null
    throw error
  }
}

async function auditSupplyOrders(cfg) {
  const [rows] = await db.query(`
    SELECT o.id,o.order_no,o.status,o.total,o.wechat_out_trade_no,o.wechat_transaction_id,
           MIN(m.sub_mchid) AS sub_mchid
      FROM orders o
      JOIN order_items oi ON oi.order_id=o.id
      JOIN merchants m ON m.id=oi.merchant_id
     GROUP BY o.id ORDER BY o.id
  `)
  const keep = []
  const remove = []
  for (const order of rows) {
    if (!order.sub_mchid) {
      remove.push(order)
      continue
    }
    const outTradeNo = supplyOutTradeNo(order)
    const transaction = await queryWechatTransaction(cfg, outTradeNo, order.sub_mchid)
    if (transaction && paidStates.has(String(transaction.trade_state || '').toUpperCase()) && transaction.transaction_id) {
      keep.push({ order, outTradeNo, transaction })
    } else {
      remove.push(order)
    }
  }
  return { keep, remove }
}

async function auditMachineOrders(cfg) {
  const [rows] = await db.query(`
    SELECT mo.*,op.sub_mchid
      FROM machine_orders mo JOIN operators op ON op.id=mo.operator_id
     ORDER BY mo.id
  `)
  const keep = []
  const remove = []
  for (const order of rows) {
    let realTransaction = null
    if (order.sub_mchid) {
      for (const stage of ['deposit', 'balance', 'full']) {
        const outTradeNo = machineOutTradeNo(order, stage)
        const transaction = await queryWechatTransaction(cfg, outTradeNo, order.sub_mchid)
        if (transaction && paidStates.has(String(transaction.trade_state || '').toUpperCase()) && transaction.transaction_id) {
          realTransaction = { stage, outTradeNo, transaction }
          break
        }
      }
    }
    if (realTransaction) keep.push({ order, ...realTransaction })
    else remove.push(order)
  }
  return { keep, remove }
}

async function cleanData(supplyAudit, machineAudit) {
  const supplyIds = supplyAudit.remove.map(item => Number(item.id))
  const machineIds = machineAudit.remove.map(item => Number(item.id))
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    for (const item of supplyAudit.keep) {
      const paidAt = mysqlDate(item.transaction.success_time)
      await conn.query(
        `UPDATE orders
            SET wechat_out_trade_no=?,wechat_transaction_id=?,payment_mode='wechat',paid_at=?
          WHERE id=?`,
        [item.outTradeNo, item.transaction.transaction_id, paidAt, item.order.id]
      )
    }

    if (supplyIds.length) {
      const marks = placeholders(supplyIds)
      const [inventory] = await conn.query(
        `SELECT oi.product_id,SUM(oi.qty) AS qty
           FROM order_items oi JOIN orders o ON o.id=oi.order_id
          WHERE o.id IN (${marks}) AND o.status NOT IN ('cancelled','refunded') AND oi.product_id IS NOT NULL
          GROUP BY oi.product_id`,
        supplyIds
      )
      for (const item of inventory) {
        await conn.query('UPDATE products SET stock=stock+? WHERE id=?', [Number(item.qty), item.product_id])
      }
      await conn.query(`DELETE FROM messages WHERE type='order' AND related_id IN (${marks})`, supplyIds)
      await conn.query(`DELETE FROM reviews WHERE order_id IN (${marks})`, supplyIds)
      await conn.query(`DELETE FROM wechat_refunds WHERE order_type='supply' AND order_id IN (${marks})`, supplyIds)
      await conn.query(`DELETE FROM wechat_profit_sharing_orders WHERE order_type='supply' AND order_id IN (${marks})`, supplyIds)
      await conn.query(`DELETE FROM aftersale_requests WHERE order_id IN (${marks})`, supplyIds)
      await conn.query(`DELETE FROM orders WHERE id IN (${marks})`, supplyIds)
    }

    if (machineIds.length) {
      const marks = placeholders(machineIds)
      await conn.query(`DELETE FROM machine_reviews WHERE order_id IN (${marks})`, machineIds)
      await conn.query(`DELETE FROM wechat_refunds WHERE order_type='machine' AND order_id IN (${marks})`, machineIds)
      await conn.query(`DELETE FROM wechat_profit_sharing_orders WHERE order_type='machine' AND order_id IN (${marks})`, machineIds)
      await conn.query(`DELETE FROM machine_orders WHERE id IN (${marks})`, machineIds)
    }

    await conn.query('UPDATE orders SET user_coupon_id=NULL WHERE user_coupon_id IS NOT NULL')
    await conn.query('UPDATE order_promotions SET user_coupon_id=NULL WHERE user_coupon_id IS NOT NULL')
    await conn.query('DELETE FROM user_coupons')
    await conn.query(`
      UPDATE marketing_campaigns c
      LEFT JOIN (
        SELECT campaign_id,COUNT(DISTINCT order_id) AS used_count
          FROM order_promotions WHERE status='used' GROUP BY campaign_id
      ) used ON used.campaign_id=c.id
         SET c.claimed_count=0,c.used_count=COALESCE(used.used_count,0)
    `)
    await conn.query(`
      UPDATE marketing_campaign_products cp
      LEFT JOIN (
        SELECT campaign_id,product_id,SUM(quantity) AS reserved_count,
               SUM(CASE WHEN status='used' THEN quantity ELSE 0 END) AS sold_count
          FROM order_promotions
         WHERE type='flash_sale' AND status IN ('locked','used') AND product_id IS NOT NULL
         GROUP BY campaign_id,product_id
      ) usage_data ON usage_data.campaign_id=cp.campaign_id AND usage_data.product_id=cp.product_id
         SET cp.available_stock=IF(cp.quota IS NULL,cp.available_stock,
               GREATEST(0,cp.quota-COALESCE(usage_data.reserved_count,0))),
             cp.sold_count=COALESCE(usage_data.sold_count,0)
    `)
    await conn.query(`
      UPDATE machines m
      LEFT JOIN (
        SELECT machine_id,COUNT(*) AS order_count
          FROM machine_orders WHERE status IN ('accepted','in_progress','completed') GROUP BY machine_id
      ) real_orders ON real_orders.machine_id=m.id
         SET m.order_count=COALESCE(real_orders.order_count,0)
    `)

    await conn.commit()
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function run() {
  const cfg = wxpay.getServiceProviderConfig()
  if (!cfg) throw new Error('微信支付服务商配置不完整，不能安全核验并清理订单')

  const supplyAudit = await auditSupplyOrders(cfg)
  const machineAudit = await auditMachineOrders(cfg)
  const report = {
    execute,
    keepSupplyOrders: supplyAudit.keep.map(item => ({
      id: item.order.id,
      orderNo: item.order.order_no,
      transactionId: item.transaction.transaction_id,
      state: item.transaction.trade_state
    })),
    removeSupplyOrders: supplyAudit.remove.map(item => ({ id: item.id, orderNo: item.order_no })),
    keepMachineOrders: machineAudit.keep.map(item => ({
      id: item.order.id,
      orderNo: item.order.order_no,
      transactionId: item.transaction.transaction_id,
      state: item.transaction.trade_state
    })),
    removeMachineOrders: machineAudit.remove.map(item => ({ id: item.id, orderNo: item.order_no }))
  }
  console.log(JSON.stringify(report, null, 2))

  if (!execute) {
    console.log('Dry run only. Re-run with --execute to apply the cleanup.')
    return
  }
  await cleanData(supplyAudit, machineAudit)
  console.log('[cleanup] non-WeChat test orders removed and farmer coupon claims cleared')
}

run()
  .then(() => db.end())
  .catch(async error => {
    console.error('[cleanup-mock-test-data]', error)
    try { await db.end() } catch {}
    process.exitCode = 1
  })
