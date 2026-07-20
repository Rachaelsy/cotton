const db = require('../db/database')

const IMAGE_URL_RE = /^\/uploads\/[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp|gif|bmp)$/i

function normalizeImageUrl(value) {
  const url = String(value || '').trim()
  if (!url || url.includes('..') || !IMAGE_URL_RE.test(url)) return ''
  return url
}

function normalizeImages(value, max = 4) {
  let source = value
  if (typeof source === 'string') {
    try { source = JSON.parse(source) } catch { source = [] }
  }
  if (!Array.isArray(source)) return []
  return [...new Set(source.map(normalizeImageUrl).filter(Boolean))].slice(0, max)
}

function normalizeMessage(row) {
  let replyTo = null
  if (row.reply_to_id && row.reply_to_json) {
    try {
      const snapshot = typeof row.reply_to_json === 'string' ? JSON.parse(row.reply_to_json) : row.reply_to_json
      replyTo = {
        id: Number(row.reply_to_id),
        sender_type: snapshot.sender_type === 'admin' ? 'admin' : 'farmer',
        content: String(snapshot.content || ''),
        image_url: normalizeImageUrl(snapshot.image_url)
      }
    } catch {}
  }
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    sender_type: row.sender_type,
    sender_id: Number(row.sender_id),
    content: row.content || '',
    image_url: normalizeImageUrl(row.image_url),
    reply_to: replyTo,
    recalled_at: row.recalled_at || null,
    is_recalled: !!row.recalled_at,
    read_at: row.read_at || null,
    created_at: row.created_at
  }
}

async function listMessages(userId, afterId = 0, viewerType = 'farmer') {
  const id = Number(userId)
  const after = Math.max(0, Number(afterId) || 0)
  const visibilityColumn = viewerType === 'admin' ? 'hidden_for_admin' : 'hidden_for_farmer'
  let rows
  if (after) {
    ;[rows] = await db.query(
      `SELECT id,user_id,sender_type,sender_id,content,image_url,reply_to_id,reply_to_json,recalled_at,read_at,created_at
         FROM support_messages
        WHERE user_id=? AND id>? AND ${visibilityColumn}=0
        ORDER BY id ASC
        LIMIT 100`,
      [id, after]
    )
  } else {
    ;[rows] = await db.query(
      `SELECT * FROM (
         SELECT id,user_id,sender_type,sender_id,content,image_url,reply_to_id,reply_to_json,recalled_at,read_at,created_at
           FROM support_messages
          WHERE user_id=? AND ${visibilityColumn}=0
          ORDER BY id DESC
          LIMIT 100
       ) recent
       ORDER BY id ASC`,
      [id]
    )
  }
  return rows.map(normalizeMessage)
}

async function createMessage({ userId, senderType, senderId, content, imageUrl, replyToId }) {
  const text = String(content || '').trim()
  const image = normalizeImageUrl(imageUrl)
  if (!text && !image) {
    const error = new Error('请输入消息或选择图片')
    error.statusCode = 400
    throw error
  }
  if (text.length > 1000) {
    const error = new Error('消息不能超过1000字')
    error.statusCode = 400
    throw error
  }
  const type = senderType === 'admin' ? 'admin' : 'farmer'
  const referencedId = Math.max(0, Number(replyToId) || 0)
  let replySnapshot = null
  if (referencedId) {
    const visibilityColumn = type === 'admin' ? 'hidden_for_admin' : 'hidden_for_farmer'
    const [replyRows] = await db.query(
      `SELECT id,sender_type,content,image_url,recalled_at
         FROM support_messages
        WHERE id=? AND user_id=? AND ${visibilityColumn}=0
        LIMIT 1`,
      [referencedId, Number(userId)]
    )
    const target = replyRows[0]
    if (!target || target.recalled_at) {
      const error = new Error('引用的消息不存在或已撤回')
      error.statusCode = 400
      throw error
    }
    replySnapshot = JSON.stringify({
      sender_type: target.sender_type,
      content: String(target.content || '').slice(0, 200),
      image_url: normalizeImageUrl(target.image_url)
    })
  }
  const [result] = await db.query(
    `INSERT INTO support_messages (user_id,sender_type,sender_id,content,image_url,reply_to_id,reply_to_json)
     VALUES (?,?,?,?,?,?,?)`,
    [Number(userId), type, Number(senderId), text, image, referencedId || null, replySnapshot]
  )
  const [rows] = await db.query(
    `SELECT id,user_id,sender_type,sender_id,content,image_url,reply_to_id,reply_to_json,recalled_at,read_at,created_at
       FROM support_messages WHERE id=?`,
    [result.insertId]
  )
  return normalizeMessage(rows[0])
}

async function markRead(userId, readerType) {
  const senderType = readerType === 'admin' ? 'farmer' : 'admin'
  const visibilityColumn = readerType === 'admin' ? 'hidden_for_admin' : 'hidden_for_farmer'
  const [result] = await db.query(
    `UPDATE support_messages SET read_at=NOW()
      WHERE user_id=? AND sender_type=? AND read_at IS NULL AND ${visibilityColumn}=0`,
    [Number(userId), senderType]
  )
  return Number(result.affectedRows || 0)
}

async function listConversations() {
  const [rows] = await db.query(
    `SELECT u.id AS user_id,u.real_name,u.phone,
            last_message.content AS last_content,last_message.image_url,last_message.recalled_at,
            last_message.sender_type,last_message.created_at,
            (SELECT COUNT(*) FROM support_messages unread
              WHERE unread.user_id=u.id AND unread.sender_type='farmer'
                AND unread.read_at IS NULL AND unread.hidden_for_admin=0) AS unread_count
       FROM users u
       JOIN support_messages last_message ON last_message.id=(
         SELECT MAX(latest.id) FROM support_messages latest
          WHERE latest.user_id=u.id AND latest.hidden_for_admin=0
       )
      WHERE u.role='farmer'
      ORDER BY last_message.id DESC
      LIMIT 200`
  )
  return rows.map(row => ({
    ...row,
    user_id: Number(row.user_id),
    image_url: normalizeImageUrl(row.image_url),
    recalled_at: row.recalled_at || null,
    unread_count: Number(row.unread_count || 0)
  }))
}

async function recallMessage({ userId, messageId, actorType, actorId }) {
  const type = actorType === 'admin' ? 'admin' : 'farmer'
  const [result] = await db.query(
    `UPDATE support_messages
        SET content='',image_url='',recalled_at=NOW()
      WHERE id=? AND user_id=? AND sender_type=? AND sender_id=?
        AND recalled_at IS NULL AND created_at>=DATE_SUB(NOW(), INTERVAL 2 MINUTE)`,
    [Number(messageId), Number(userId), type, Number(actorId)]
  )
  if (!result.affectedRows) {
    const error = new Error('消息已超过2分钟或无权撤回')
    error.statusCode = 409
    throw error
  }
  const [rows] = await db.query(
    `SELECT id,user_id,sender_type,sender_id,content,image_url,reply_to_id,reply_to_json,recalled_at,read_at,created_at
       FROM support_messages WHERE id=?`,
    [Number(messageId)]
  )
  return normalizeMessage(rows[0])
}

async function hideMessage({ userId, messageId, viewerType }) {
  const visibilityColumn = viewerType === 'admin' ? 'hidden_for_admin' : 'hidden_for_farmer'
  const [result] = await db.query(
    `UPDATE support_messages SET ${visibilityColumn}=1 WHERE id=? AND user_id=?`,
    [Number(messageId), Number(userId)]
  )
  if (!result.affectedRows) {
    const error = new Error('消息不存在或已删除')
    error.statusCode = 404
    throw error
  }
  return { id: Number(messageId) }
}

async function hideConversationForAdmin(userId) {
  const id = Number(userId)
  const [result] = await db.query(
    'UPDATE support_messages SET hidden_for_admin=1 WHERE user_id=? AND hidden_for_admin=0',
    [id]
  )
  if (!result.affectedRows) {
    const error = new Error('会话不存在或已删除')
    error.statusCode = 404
    throw error
  }
  return { user_id: id, hidden_count: Number(result.affectedRows) }
}

async function farmerExists(userId) {
  const [rows] = await db.query(
    "SELECT id FROM users WHERE id=? AND role='farmer' AND is_active=1 LIMIT 1",
    [Number(userId)]
  )
  return rows.length > 0
}

module.exports = {
  normalizeImageUrl,
  normalizeImages,
  listMessages,
  createMessage,
  markRead,
  listConversations,
  farmerExists,
  recallMessage,
  hideMessage,
  hideConversationForAdmin
}
