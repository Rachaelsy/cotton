const db = require('../db/database')
const marketing = require('./marketing')

async function cancelPendingSupplyOrder(orderId) {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[order]] = await conn.query('SELECT id,status FROM orders WHERE id=? FOR UPDATE', [orderId])
    if (!order || order.status !== 'pending_payment') {
      await conn.rollback()
      return false
    }
    const [items] = await conn.query('SELECT product_id,qty FROM order_items WHERE order_id=?', [orderId])
    for (const item of items) {
      if (!item.product_id) continue
      await conn.query('UPDATE products SET stock=stock+? WHERE id=?', [item.qty, item.product_id])
    }
    await marketing.releaseOrderMarketing(orderId, conn)
    await conn.query("UPDATE orders SET status='cancelled',pay_expires_at=NULL WHERE id=?", [orderId])
    await conn.commit()
    return true
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

module.exports = { cancelPendingSupplyOrder }
