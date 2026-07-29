const crypto = require('crypto')
const db = require('../db/database')

const RULES = Object.freeze({
  pointsPerYuan: 100,
  minRedeemPoints: 100,
  maxRedeemPointsPerOrder: 2000,
  maxOrderRate: 0.10,
  dailyCourseCap: 100,
  courseRewards: Object.freeze({ intro: 20, intermediate: 30, advanced: 40 })
})

function fen(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100))
}

function toYuan(value) {
  return Number((Math.max(0, Number(value || 0)) / 100).toFixed(2))
}

function publicRules() {
  return {
    points_per_yuan: RULES.pointsPerYuan,
    min_redeem_points: RULES.minRedeemPoints,
    max_redeem_points_per_order: RULES.maxRedeemPointsPerOrder,
    max_order_rate: RULES.maxOrderRate,
    daily_course_cap: RULES.dailyCourseCap,
    course_rewards: RULES.courseRewards,
    explanation: '积分由平台承担，仅抵扣平台服务费，不减少商户应结算金额'
  }
}

async function ensureAccount(executor, userId) {
  if (!userId) return null
  await executor.query(
    `INSERT IGNORE INTO farmer_points_accounts (user_id)
     SELECT user_id FROM farmers WHERE user_id=?`,
    [userId]
  )
  return userId
}

async function getAccount(userId, executor = db, lock = false) {
  if (!userId) return null
  await ensureAccount(executor, userId)
  const [[row]] = await executor.query(
    `SELECT user_id,balance,locked_points,total_earned,total_used,created_at,updated_at
       FROM farmer_points_accounts WHERE user_id=?${lock ? ' FOR UPDATE' : ''}`,
    [userId]
  )
  return row ? {
    userId: Number(row.user_id),
    balance: Number(row.balance || 0),
    lockedPoints: Number(row.locked_points || 0),
    totalEarned: Number(row.total_earned || 0),
    totalUsed: Number(row.total_used || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } : null
}

async function getSummary(userId, limit = 30, executor = db) {
  const account = await getAccount(userId, executor)
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30))
  const [rows] = await executor.query(
    `SELECT id,type,points,status,order_id,content_id,balance_after,description,
            settled_at,cancelled_at,created_at
       FROM farmer_points_transactions
      WHERE user_id=? ORDER BY id DESC LIMIT ${safeLimit}`,
    [userId]
  )
  return {
    account,
    rules: publicRules(),
    transactions: rows.map(row => ({
      id: Number(row.id),
      type: row.type,
      points: Number(row.points),
      status: row.status,
      orderId: row.order_id == null ? null : Number(row.order_id),
      contentId: row.content_id == null ? null : Number(row.content_id),
      balanceAfter: Number(row.balance_after || 0),
      description: row.description || '',
      settledAt: row.settled_at,
      cancelledAt: row.cancelled_at,
      createdAt: row.created_at
    }))
  }
}

function rawCommissionFen(pricing) {
  const base = Number(pricing.commissionBaseFen == null
    ? pricing.originalSubtotalFen
    : pricing.commissionBaseFen)
  const rate = Number(pricing.merchant && pricing.merchant.commission_rate || 0)
  return Math.max(0, Math.round(base * rate / 100))
}

async function quoteRedemption(executor, {
  userId,
  pricing,
  usePoints = true,
  requestedPoints = null,
  lock = false
}) {
  const payableBeforePointsFen = Math.max(0, Number(pricing.payableFen || 0))
  const empty = {
    pointsBalance: 0,
    maxPointsUsable: 0,
    pointsUsed: 0,
    pointsDiscountFen: 0,
    payableBeforePointsFen,
    payableFen: payableBeforePointsFen,
    pointsApplied: false,
    pointsReason: userId ? '当前暂无可用积分' : '登录农户账号后可使用积分'
  }
  if (!userId) return empty

  const account = await getAccount(userId, executor, lock)
  if (!account) {
    return { ...empty, pointsReason: '仅已注册农户身份的账号可使用积分' }
  }
  const commissionFen = rawCommissionFen(pricing)
  let maxPoints = Math.min(
    account.balance,
    RULES.maxRedeemPointsPerOrder,
    Math.floor(payableBeforePointsFen * RULES.maxOrderRate),
    commissionFen,
    Math.max(0, payableBeforePointsFen - 1)
  )
  if (maxPoints < RULES.minRedeemPoints) maxPoints = 0

  let pointsUsed = 0
  if (usePoints && maxPoints > 0) {
    const requested = requestedPoints == null || requestedPoints === ''
      ? maxPoints
      : Math.max(0, Math.floor(Number(requestedPoints) || 0))
    pointsUsed = Math.min(maxPoints, requested)
    if (pointsUsed < RULES.minRedeemPoints) pointsUsed = 0
  }

  let reason = ''
  if (!usePoints) reason = '未启用积分抵扣'
  else if (!account.balance) reason = '当前暂无可用积分'
  else if (!commissionFen) reason = '该订单暂无平台服务费可供抵扣'
  else if (!maxPoints) reason = `本单可抵扣额度未达到${RULES.minRedeemPoints}积分`

  return {
    pointsBalance: account.balance,
    maxPointsUsable: maxPoints,
    pointsUsed,
    pointsDiscountFen: pointsUsed,
    payableBeforePointsFen,
    payableFen: payableBeforePointsFen - pointsUsed,
    pointsApplied: pointsUsed > 0,
    pointsReason: reason
  }
}

function publicQuote(quote) {
  return {
    points_balance: quote.pointsBalance,
    max_points_usable: quote.maxPointsUsable,
    points_used: quote.pointsUsed,
    points_discount: toYuan(quote.pointsDiscountFen),
    payable_before_points: toYuan(quote.payableBeforePointsFen),
    payable_total: toYuan(quote.payableFen),
    points_applied: quote.pointsApplied,
    points_reason: quote.pointsReason,
    points_rule: `100积分抵1元，单笔最高抵${RULES.maxRedeemPointsPerOrder / 100}元`
  }
}

async function reserveOrderPoints(executor, { orderId, userId, pointsUsed }) {
  const pointsValue = Math.max(0, Math.floor(Number(pointsUsed) || 0))
  if (!userId || !pointsValue) return false
  const referenceKey = `order:${orderId}:redeem`
  const [[existing]] = await executor.query(
    'SELECT id FROM farmer_points_transactions WHERE reference_key=?',
    [referenceKey]
  )
  if (existing) return false
  await ensureAccount(executor, userId)
  const [updated] = await executor.query(
    `UPDATE farmer_points_accounts
        SET balance=balance-?,locked_points=locked_points+?
      WHERE user_id=? AND balance>=?`,
    [pointsValue, pointsValue, userId, pointsValue]
  )
  if (!updated.affectedRows) {
    const error = new Error('积分余额发生变化，请重新确认订单')
    error.statusCode = 409
    throw error
  }
  const [[account]] = await executor.query(
    'SELECT balance FROM farmer_points_accounts WHERE user_id=?',
    [userId]
  )
  await executor.query(
    `INSERT INTO farmer_points_transactions
      (user_id,type,points,status,order_id,reference_key,balance_after,description)
     VALUES (?,'order_redeem',?,'locked',?,?,?,'农资订单积分抵扣')`,
    [userId, -pointsValue, orderId, referenceKey, Number(account.balance || 0)]
  )
  return true
}

async function settleOrderPoints(orderId, executor = db) {
  const ownsConnection = executor === db && typeof db.getConnection === 'function'
  const conn = ownsConnection ? await db.getConnection() : executor
  try {
    if (ownsConnection) await conn.beginTransaction()
    const [[row]] = await conn.query(
      `SELECT id,user_id,points,status FROM farmer_points_transactions
        WHERE reference_key=? FOR UPDATE`,
      [`order:${orderId}:redeem`]
    )
    if (!row || row.status === 'completed') {
      if (ownsConnection) await conn.commit()
      return false
    }
    if (row.status !== 'locked') {
      if (ownsConnection) await conn.commit()
      return false
    }
    const used = Math.abs(Number(row.points || 0))
    await conn.query(
      `UPDATE farmer_points_accounts
          SET locked_points=GREATEST(locked_points-?,0),total_used=total_used+?
        WHERE user_id=?`,
      [used, used, row.user_id]
    )
    await conn.query(
      "UPDATE farmer_points_transactions SET status='completed',settled_at=NOW() WHERE id=?",
      [row.id]
    )
    if (ownsConnection) await conn.commit()
    return true
  } catch (error) {
    if (ownsConnection) await conn.rollback()
    throw error
  } finally {
    if (ownsConnection) conn.release()
  }
}

async function releaseOrderPoints(orderId, executor = db, reason = '订单取消，积分已返还') {
  const ownsConnection = executor === db && typeof db.getConnection === 'function'
  const conn = ownsConnection ? await db.getConnection() : executor
  try {
    if (ownsConnection) await conn.beginTransaction()
    const [[row]] = await conn.query(
      `SELECT id,user_id,points,status FROM farmer_points_transactions
        WHERE reference_key=? FOR UPDATE`,
      [`order:${orderId}:redeem`]
    )
    if (!row || row.status !== 'locked') {
      if (ownsConnection) await conn.commit()
      return false
    }
    const returned = Math.abs(Number(row.points || 0))
    await conn.query(
      `UPDATE farmer_points_accounts
          SET balance=balance+?,locked_points=GREATEST(locked_points-?,0)
        WHERE user_id=?`,
      [returned, returned, row.user_id]
    )
    const [[account]] = await conn.query(
      'SELECT balance FROM farmer_points_accounts WHERE user_id=?',
      [row.user_id]
    )
    await conn.query(
      "UPDATE farmer_points_transactions SET status='cancelled',cancelled_at=NOW() WHERE id=?",
      [row.id]
    )
    await conn.query(
      `INSERT IGNORE INTO farmer_points_transactions
        (user_id,type,points,status,order_id,reference_key,balance_after,description,settled_at)
       VALUES (?,'order_return',?,'completed',?,?,?, ?,NOW())`,
      [row.user_id, returned, orderId, `order:${orderId}:cancel_return`, Number(account.balance || 0), reason]
    )
    if (ownsConnection) await conn.commit()
    return true
  } catch (error) {
    if (ownsConnection) await conn.rollback()
    throw error
  } finally {
    if (ownsConnection) conn.release()
  }
}

async function returnOrderPointsAfterRefund(orderId, executor = db) {
  const ownsConnection = executor === db && typeof db.getConnection === 'function'
  const conn = ownsConnection ? await db.getConnection() : executor
  try {
    if (ownsConnection) await conn.beginTransaction()
    const [[row]] = await conn.query(
      `SELECT id,user_id,points,status FROM farmer_points_transactions
        WHERE reference_key=? FOR UPDATE`,
      [`order:${orderId}:redeem`]
    )
    if (!row) {
      if (ownsConnection) await conn.commit()
      return false
    }
    if (row.status === 'locked') {
      const released = await releaseOrderPoints(orderId, conn, '订单退款，积分已返还')
      if (ownsConnection) await conn.commit()
      return released
    }
    if (row.status !== 'completed') {
      if (ownsConnection) await conn.commit()
      return false
    }
    const referenceKey = `order:${orderId}:refund_return`
    const [[existing]] = await conn.query(
      'SELECT id FROM farmer_points_transactions WHERE reference_key=?',
      [referenceKey]
    )
    if (existing) {
      if (ownsConnection) await conn.commit()
      return false
    }
    const returned = Math.abs(Number(row.points || 0))
    await conn.query(
      `UPDATE farmer_points_accounts
          SET balance=balance+?,total_used=GREATEST(total_used-?,0)
        WHERE user_id=?`,
      [returned, returned, row.user_id]
    )
    const [[account]] = await conn.query(
      'SELECT balance FROM farmer_points_accounts WHERE user_id=?',
      [row.user_id]
    )
    await conn.query(
      `INSERT INTO farmer_points_transactions
        (user_id,type,points,status,order_id,reference_key,balance_after,description,settled_at)
       VALUES (?,'order_return',?,'completed',?,?,?,'订单退款，积分已返还',NOW())`,
      [row.user_id, returned, orderId, referenceKey, Number(account.balance || 0)]
    )
    if (ownsConnection) await conn.commit()
    return true
  } catch (error) {
    if (ownsConnection) await conn.rollback()
    throw error
  } finally {
    if (ownsConnection) conn.release()
  }
}

async function reconcileLockedOrderPoints(limit = 200, executor = db) {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200))
  const [rows] = await executor.query(
    `SELECT t.order_id,o.status
       FROM farmer_points_transactions t
       JOIN orders o ON o.id=t.order_id
      WHERE t.type='order_redeem' AND t.status='locked'
      ORDER BY t.id ASC LIMIT ${safeLimit}`
  )
  const result = { checked: rows.length, settled: 0, returned: 0 }
  for (const row of rows) {
    if (['pending_ship', 'shipped', 'completed'].includes(row.status)) {
      if (await settleOrderPoints(row.order_id, executor)) result.settled += 1
    } else if (row.status === 'cancelled') {
      if (await releaseOrderPoints(row.order_id, executor)) result.returned += 1
    } else if (row.status === 'refunded') {
      if (await returnOrderPointsAfterRefund(row.order_id, executor)) result.returned += 1
    }
  }
  return result
}

async function adjustPoints({ userId, points, reason, operatorId }) {
  const amount = Math.trunc(Number(points) || 0)
  const cleanReason = String(reason || '').trim().slice(0, 200)
  if (!amount || Math.abs(amount) > 100000) throw new Error('积分调整值必须在1至100000之间')
  if (!cleanReason) throw new Error('请填写积分调整原因')
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const account = await getAccount(userId, conn, true)
    if (!account) throw new Error('该账号尚未注册农户身份')
    if (amount < 0 && account.balance < Math.abs(amount)) throw new Error('可用积分不足，无法扣减')
    await conn.query(
      `UPDATE farmer_points_accounts
          SET balance=balance+?,total_earned=total_earned+?
        WHERE user_id=?`,
      [amount, amount > 0 ? amount : 0, userId]
    )
    const [[updated]] = await conn.query(
      'SELECT balance FROM farmer_points_accounts WHERE user_id=?',
      [userId]
    )
    const referenceKey = `admin:${operatorId || 0}:${userId}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`
    await conn.query(
      `INSERT INTO farmer_points_transactions
        (user_id,type,points,status,reference_key,balance_after,description,operator_id,settled_at)
       VALUES (?,'admin_adjustment',?,'completed',?,?,?,?,NOW())`,
      [userId, amount, referenceKey, Number(updated.balance || 0), cleanReason, operatorId || null]
    )
    await conn.commit()
    return getAccount(userId)
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

module.exports = {
  RULES,
  publicRules,
  ensureAccount,
  getAccount,
  getSummary,
  quoteRedemption,
  publicQuote,
  reserveOrderPoints,
  settleOrderPoints,
  releaseOrderPoints,
  returnOrderPointsAfterRefund,
  reconcileLockedOrderPoints,
  adjustPoints,
  rawCommissionFen,
  fen,
  toYuan
}
