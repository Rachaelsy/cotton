// server/scheduler.js — 定时任务：自动确认收货 + 售后冻结期解冻
const db = require('./db/database')

// 发货后 10 天无操作 → 系统自动确认收货，资金进入冻结期
async function autoConfirmReceipt() {
  try {
    const [rows] = await db.query(`
      SELECT id FROM orders
      WHERE status = 'shipped'
        AND shipped_at IS NOT NULL
        AND shipped_at <= DATE_SUB(NOW(), INTERVAL 10 DAY)
    `)
    if (!rows.length) return
    const ids = rows.map(r => r.id)
    const placeholders = ids.map(() => '?').join(',')
    await db.query(
      `UPDATE orders
       SET status='completed', confirmed_at=NOW(), auto_confirmed=1, fund_status='frozen'
       WHERE id IN (${placeholders})`,
      ids
    )
    console.log(`[scheduler] 自动确认收货: ${ids.length} 笔`)
  } catch (e) {
    console.error('[scheduler] autoConfirmReceipt:', e.message)
  }
}

// 确认收货 7 天后，且无未拒绝的售后申请 → 资金解冻为可提现
async function releaseFunds() {
  try {
    const [rows] = await db.query(`
      SELECT o.id FROM orders o
      WHERE o.fund_status = 'frozen'
        AND o.confirmed_at IS NOT NULL
        AND o.confirmed_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND NOT EXISTS (
          SELECT 1 FROM aftersale_requests a
          WHERE a.order_id = o.id AND a.status != 'rejected'
        )
    `)
    if (!rows.length) return
    const ids = rows.map(r => r.id)
    const placeholders = ids.map(() => '?').join(',')
    await db.query(
      `UPDATE orders SET fund_status='available' WHERE id IN (${placeholders})`,
      ids
    )
    console.log(`[scheduler] 资金解冻: ${ids.length} 笔`)
  } catch (e) {
    console.error('[scheduler] releaseFunds:', e.message)
  }
}

function startScheduler() {
  // 启动时立即执行一次
  autoConfirmReceipt()
  releaseFunds()
  // 之后每小时执行
  setInterval(autoConfirmReceipt, 60 * 60 * 1000)
  setInterval(releaseFunds,       60 * 60 * 1000)
  console.log('[scheduler] 已启动，每小时执行（自动确认收货 + 资金解冻）')
}

module.exports = { startScheduler }
