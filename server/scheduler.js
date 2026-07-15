// server/scheduler.js — 定时任务：自动确认收货 + 售后冻结期解冻
const db = require('./db/database')
const profitSharing = require('./utils/profit-sharing')
const { fetchQweatherWeather } = require('./utils/qweather')
const { normalizeCoordinates, calculateCenter } = require('./utils/plot-geometry')
const weatherObservations = require('./utils/weather-observations')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

function observationCollectorEnabled() {
  return String(process.env.WEATHER_OBSERVATION_COLLECTOR_ENABLED || 'true').toLowerCase() !== 'false'
}

function parsePlotCoordinates(value) {
  try {
    return normalizeCoordinates(Array.isArray(value) ? value : JSON.parse(value || '[]'))
  } catch (error) {
    return []
  }
}

// 按地块中心每小时采集一次真实实况，为积温和近 30 天降水建立连续样本。
async function collectWeatherObservations() {
  if (!observationCollectorEnabled()) return
  if (!['qweather', 'heweather'].includes(String(process.env.WEATHER_PROVIDER || 'qweather').toLowerCase())) return
  const limit = Math.max(1, Math.min(Number(process.env.WEATHER_OBSERVATION_MAX_PLOTS || 100), 500))
  try {
    const [plots] = await db.query(
      'SELECT id,name,area,coordinates FROM plots WHERE coordinates IS NOT NULL ORDER BY id ASC LIMIT ?',
      [limit]
    )
    let saved = 0
    for (const plot of plots) {
      const coordinates = parsePlotCoordinates(plot.coordinates)
      if (!coordinates.length) continue
      try {
        const center = calculateCenter(coordinates)
        const weather = await fetchQweatherWeather(center, plot)
        await weatherObservations.saveObservation(plot.id, center, weather)
        saved += 1
      } catch (error) {
        console.error(`[weather-collector] plot ${plot.id}:`, error.message)
      }
      await wait(250)
    }
    if (plots.length) console.log(`[weather-collector] 已采集 ${saved}/${plots.length} 个地块实况`)
  } catch (error) {
    console.error('[weather-collector]', error.message)
  }
}

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

// 确认收货并经过配置的冻结期后，且无未拒绝的售后申请 → 资金解冻为可提现
async function releaseFunds() {
  try {
    const sharing = await profitSharing.releaseEligibleProfitSharing()
    if (sharing.total) {
      console.log(`[scheduler] profit sharing release: ${sharing.success}/${sharing.total}`)
    }

    const [rows] = await db.query(`
      SELECT o.id FROM orders o
      WHERE o.fund_status = 'frozen'
        AND o.confirmed_at IS NOT NULL
        AND o.confirmed_at <= ?
        AND NOT EXISTS (
          SELECT 1 FROM aftersale_requests a
          WHERE a.order_id = o.id AND a.status != 'rejected'
        )
        AND NOT EXISTS (
          SELECT 1 FROM wechat_profit_sharing_orders ps
          WHERE ps.order_type='supply'
            AND ps.order_id=o.id
            AND ps.state IN ('PENDING', 'FAILED', 'PROCESSING')
        )
        AND NOT EXISTS (
          SELECT 1 FROM order_items oi
          JOIN merchants m ON m.id=oi.merchant_id
          WHERE oi.order_id=o.id
            AND COALESCE(m.sub_mchid, '') <> ''
            AND COALESCE(m.wechat_applyment_state, '') <> 'SELF_OPERATED'
            AND COALESCE(m.commission_rate, 0) > 0
        )
    `, [profitSharing.getProfitSharingCutoffDate()])
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

// 30 分钟未付款 → 自动关闭订单 + 释放库存
async function autoExpireOrders() {
  try {
    const [rows] = await db.query(`
      SELECT o.id FROM orders o
      WHERE o.status = 'pending_payment'
        AND o.pay_expires_at IS NOT NULL
        AND o.pay_expires_at <= NOW()
    `)
    if (!rows.length) return
    for (const row of rows) {
      const [items] = await db.query(
        'SELECT product_id, qty FROM order_items WHERE order_id=?', [row.id]
      )
      for (const item of items) {
        if (!item.product_id) continue
        await db.query('UPDATE products SET stock=stock+? WHERE id=?', [item.qty, item.product_id])
      }
      await db.query(
        `UPDATE orders SET status='cancelled', pay_expires_at=NULL WHERE id=?`, [row.id]
      )
    }
    console.log(`[scheduler] 超时关单: ${rows.length} 笔`)
  } catch (e) {
    console.error('[scheduler] autoExpireOrders:', e.message)
  }
}

function startScheduler() {
  autoConfirmReceipt()
  releaseFunds()
  autoExpireOrders()
  setInterval(autoConfirmReceipt, 60 * 60 * 1000)
  setInterval(releaseFunds,       60 * 60 * 1000)
  setInterval(autoExpireOrders,   5  * 60 * 1000)   // 每 5 分钟扫一次
  setTimeout(collectWeatherObservations, 15 * 1000)
  setInterval(collectWeatherObservations, 60 * 60 * 1000)
  console.log('[scheduler] 已启动（自动确认收货 + 资金解冻 + 超时关单 + 地块气象采集）')
}

module.exports = { startScheduler, collectWeatherObservations }
