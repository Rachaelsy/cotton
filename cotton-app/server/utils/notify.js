// server/utils/notify.js — 向商户写入消息通知
const db = require('../db/database')

/**
 * 向单个商户写一条消息
 */
async function notifyMerchant(merchantId, type, title, content, relatedId = null) {
  await db.query(
    'INSERT INTO messages (merchant_id, type, title, content, related_id) VALUES (?,?,?,?,?)',
    [merchantId, type, title, content, relatedId]
  )
}

/**
 * 新订单：找出订单涉及的所有商户并通知
 */
async function notifyNewOrder(orderId, orderNo, items) {
  const merchantIds = [...new Set(items.map(i => parseInt(i.merchant_id)).filter(Boolean))]
  for (const mid of merchantIds) {
    await notifyMerchant(
      mid, 'order',
      '新订单通知',
      `您有新的订单（${orderNo}）待处理，请尽快安排发货。`,
      orderId
    )
  }
}

/**
 * 新售后申请：通知对应商户
 */
async function notifyAftersale(merchantId, orderNo, aftersaleId) {
  await notifyMerchant(
    merchantId, 'aftersale',
    '售后申请通知',
    `买家对订单（${orderNo}）提交了售后申请，请前往"售后管理"处理。`,
    aftersaleId
  )
}

/**
 * 平台公告：写入全部已批准商户的消息列表
 */
async function broadcastAnnouncement(announcementId, title, content) {
  const [merchants] = await db.query(
    `SELECT id FROM merchants WHERE apply_status='approved'`
  )
  for (const m of merchants) {
    await notifyMerchant(m.id, 'announcement', `📢 ${title}`, content, announcementId)
  }
  return merchants.length
}

module.exports = { notifyMerchant, notifyNewOrder, notifyAftersale, broadcastAnnouncement }
