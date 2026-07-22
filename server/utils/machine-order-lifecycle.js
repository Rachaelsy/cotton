const defaultDb = require('../db/database')

function paymentWindowMinutes(env = process.env) {
  const value = Number(env.MACHINE_PAYMENT_WINDOW_MINUTES || 30)
  return Number.isFinite(value) && value >= 5 ? Math.min(Math.floor(value), 1440) : 30
}

function isPast(value, now = Date.now()) {
  if (!value) return false
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) && timestamp <= now
}

async function expireUnpaidMachineOrders(filters = {}, database = defaultDb) {
  const params = []
  let sql = `UPDATE machine_orders
                SET status='cancelled',reject_reason='支付超时自动取消'
              WHERE status='pending' AND pay_status='unpaid'
                AND pay_expires_at IS NOT NULL AND pay_expires_at<=NOW()`
  if (filters.farmerId) {
    sql += ' AND farmer_id=?'
    params.push(filters.farmerId)
  }
  if (filters.operatorId) {
    sql += ' AND operator_id=?'
    params.push(filters.operatorId)
  }
  if (filters.orderId) {
    sql += ' AND id=?'
    params.push(filters.orderId)
  }
  const [result] = await database.query(sql, params)
  return Number(result.affectedRows || 0)
}

module.exports = { paymentWindowMinutes, isPast, expireUnpaidMachineOrders }
