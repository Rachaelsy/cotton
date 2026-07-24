const db = require('../db/database')

function normalizeRate(value) {
  const rate = Number(value)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('佣金比例必须在 0% 到 100% 之间')
  return Number(rate.toFixed(2))
}

function ownerConfig(type) {
  if (type === 'merchant') return { table: 'merchants', name: 'company_name' }
  if (type === 'operator') return { table: 'operators', name: 'org_name' }
  throw new Error('申请人类型无效')
}

async function getSummary(type, applicantId) {
  const cfg = ownerConfig(type)
  const [[owner]] = await db.query(
    `SELECT id, ${cfg.name} AS applicant_name, commission_rate FROM ${cfg.table} WHERE id=?`,
    [applicantId]
  )
  if (!owner) return null
  const [requests] = await db.query(
    `SELECT id,current_rate,requested_rate,reason,status,review_note,reviewed_at,created_at
     FROM commission_change_requests WHERE applicant_type=? AND applicant_id=?
     ORDER BY id DESC LIMIT 20`,
    [type, applicantId]
  )
  const currentRate = Number(owner.commission_rate || 0)
  return {
    ...owner,
    commission_rate: currentRate,
    current_rate: currentRate,
    latest_request: requests[0] || null,
    requests
  }
}

async function submit(type, applicantId, requestedRate, reason) {
  const cfg = ownerConfig(type)
  const rate = normalizeRate(requestedRate)
  const cleanReason = String(reason || '').trim()
  if (cleanReason.length < 5) throw new Error('请填写不少于 5 个字的调整理由')
  const [[owner]] = await db.query(`SELECT commission_rate FROM ${cfg.table} WHERE id=?`, [applicantId])
  if (!owner) throw new Error('申请人不存在')
  const currentRate = Number(owner.commission_rate || 0)
  if (Math.abs(currentRate - rate) < 0.001) throw new Error('申请比例与当前比例相同')
  const [[pending]] = await db.query(
    `SELECT id FROM commission_change_requests
     WHERE applicant_type=? AND applicant_id=? AND status='pending' LIMIT 1`,
    [type, applicantId]
  )
  if (pending) throw new Error('已有待审核的佣金调整申请，请勿重复提交')
  const [result] = await db.query(
    `INSERT INTO commission_change_requests
     (applicant_type,applicant_id,current_rate,requested_rate,reason)
     VALUES (?,?,?,?,?)`,
    [type, applicantId, currentRate, rate, cleanReason.slice(0, 500)]
  )
  return { id: result.insertId, current_rate: currentRate, requested_rate: rate }
}

async function list(status = '') {
  const params = []
  let where = ''
  if (status) { where = 'WHERE r.status=?'; params.push(status) }
  const [rows] = await db.query(
    `SELECT r.*, CASE WHEN r.applicant_type='merchant' THEN m.company_name ELSE o.org_name END AS applicant_name,
            CASE WHEN r.applicant_type='merchant' THEN mu.phone ELSE ou.phone END AS phone
     FROM commission_change_requests r
     LEFT JOIN merchants m ON r.applicant_type='merchant' AND m.id=r.applicant_id
     LEFT JOIN users mu ON mu.id=m.user_id
     LEFT JOIN operators o ON r.applicant_type='operator' AND o.id=r.applicant_id
     LEFT JOIN users ou ON ou.id=o.user_id
     ${where} ORDER BY FIELD(r.status,'pending','approved','rejected','cancelled'), r.id DESC`,
    params
  )
  return rows
}

async function review(requestId, decision, reviewNote, adminId) {
  if (!['approved', 'rejected'].includes(decision)) throw new Error('审核结果无效')
  const note = String(reviewNote || '').trim()
  if (decision === 'rejected' && note.length < 2) throw new Error('拒绝申请时必须填写审核意见')
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [[request]] = await conn.query(
      "SELECT * FROM commission_change_requests WHERE id=? AND status='pending' FOR UPDATE", [requestId]
    )
    if (!request) throw new Error('申请不存在或已审核')
    if (decision === 'approved') {
      const cfg = ownerConfig(request.applicant_type)
      await conn.query(`UPDATE ${cfg.table} SET commission_rate=? WHERE id=?`, [request.requested_rate, request.applicant_id])
    }
    await conn.query(
      `UPDATE commission_change_requests SET status=?,review_note=?,reviewed_by=?,reviewed_at=NOW()
       WHERE id=?`,
      [decision, note.slice(0, 500), adminId || null, requestId]
    )
    await conn.commit()
    return { ...request, status: decision }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

module.exports = { normalizeRate, getSummary, submit, list, review }
