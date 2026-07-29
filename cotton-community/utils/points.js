const RULES = Object.freeze({
  dailyCourseCap: 100,
  courseRewards: Object.freeze({ intro: 20, intermediate: 30, advanced: 40 })
})

async function ensureAccount(executor, userId) {
  await executor.query(
    `INSERT IGNORE INTO farmer_points_accounts (user_id)
     SELECT user_id FROM farmers WHERE user_id=?`,
    [userId]
  )
}

async function awardCourseCompletion(executor, userId, content) {
  const referenceKey = `course:${userId}:${content.id}:complete`
  await ensureAccount(executor, userId)
  const [[before]] = await executor.query(
    'SELECT balance FROM farmer_points_accounts WHERE user_id=? FOR UPDATE',
    [userId]
  )
  if (!before) {
    return {
      awarded: false,
      points: 0,
      balance: 0,
      reason: '仅已注册农户身份的账号参与学习积分'
    }
  }
  const [[existing]] = await executor.query(
    'SELECT id,points FROM farmer_points_transactions WHERE reference_key=?',
    [referenceKey]
  )
  if (existing) {
    return {
      awarded: false,
      points: 0,
      balance: Number(before && before.balance || 0),
      reason: '该课程的完成积分已经发放'
    }
  }

  const [[daily]] = await executor.query(
    `SELECT COALESCE(SUM(points),0) AS earned
       FROM farmer_points_transactions
      WHERE user_id=? AND type='course_reward' AND status='completed'
        AND created_at>=CURDATE() AND created_at<DATE_ADD(CURDATE(),INTERVAL 1 DAY)`,
    [userId]
  )
  const baseReward = Number(RULES.courseRewards[content.difficulty] || RULES.courseRewards.intro)
  const remaining = Math.max(0, RULES.dailyCourseCap - Number(daily.earned || 0))
  const reward = Math.min(baseReward, remaining)
  if (!reward) {
    return {
      awarded: false,
      points: 0,
      balance: Number(before.balance || 0),
      reason: `今日课程积分已达${RULES.dailyCourseCap}分上限`
    }
  }

  await executor.query(
    `UPDATE farmer_points_accounts
        SET balance=balance+?,total_earned=total_earned+?
      WHERE user_id=?`,
    [reward, reward, userId]
  )
  const balance = Number(before.balance || 0) + reward
  await executor.query(
    `INSERT INTO farmer_points_transactions
      (user_id,type,points,status,content_id,reference_key,balance_after,description,settled_at)
     VALUES (?,'course_reward',?,'completed',?,?,?, ?,NOW())`,
    [userId, reward, content.id, referenceKey, balance, `完成课程《${String(content.title || '').slice(0, 80)}》`]
  )
  return {
    awarded: true,
    points: reward,
    balance,
    reason: ''
  }
}

async function getSummary(executor, userId, limit = 30) {
  await ensureAccount(executor, userId)
  const [[account]] = await executor.query(
    'SELECT balance,locked_points,total_earned,total_used,updated_at FROM farmer_points_accounts WHERE user_id=?',
    [userId]
  )
  if (!account) {
    return {
      eligible: false,
      account: { balance: 0, lockedPoints: 0, totalEarned: 0, totalUsed: 0, updatedAt: null },
      rules: {
        dailyCourseCap: RULES.dailyCourseCap,
        courseRewards: RULES.courseRewards,
        pointsPerYuan: 100,
        minRedeemPoints: 100,
        maxRedeemPointsPerOrder: 2000,
        maxOrderRate: 0.10
      },
      transactions: []
    }
  }
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30))
  const [transactions] = await executor.query(
    `SELECT id,type,points,status,order_id,content_id,balance_after,description,created_at
       FROM farmer_points_transactions WHERE user_id=? ORDER BY id DESC LIMIT ${safeLimit}`,
    [userId]
  )
  return {
    eligible: true,
    account: {
      balance: Number(account.balance || 0),
      lockedPoints: Number(account.locked_points || 0),
      totalEarned: Number(account.total_earned || 0),
      totalUsed: Number(account.total_used || 0),
      updatedAt: account.updated_at
    },
    rules: {
      dailyCourseCap: RULES.dailyCourseCap,
      courseRewards: RULES.courseRewards,
      pointsPerYuan: 100,
      minRedeemPoints: 100,
      maxRedeemPointsPerOrder: 2000,
      maxOrderRate: 0.10
    },
    transactions: transactions.map(row => ({
      id: Number(row.id),
      type: row.type,
      points: Number(row.points),
      status: row.status,
      orderId: row.order_id == null ? null : Number(row.order_id),
      contentId: row.content_id == null ? null : Number(row.content_id),
      balanceAfter: Number(row.balance_after || 0),
      description: row.description || '',
      createdAt: row.created_at
    }))
  }
}

module.exports = { RULES, awardCourseCompletion, getSummary }
