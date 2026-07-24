const express = require('express')
const db = require('../db/database')
const { authMiddleware, roleGuard } = require('../middleware/auth')
const supportMessages = require('../utils/support-messages')
const supportRealtime = require('../utils/support-realtime')

const router = express.Router()
const farmerOnly = [authMiddleware, roleGuard('farmer')]

function ok(res, data, msg = 'ok') {
  return res.json({ code: 200, msg, data })
}

function fail(res, msg, status = 400) {
  return res.status(status).json({ code: status, msg, data: null })
}

router.get('/', ...farmerOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,content,contact,images_json,status,admin_reply,replied_at,user_read_at,created_at,updated_at
         FROM feedbacks
        WHERE user_id=?
        ORDER BY created_at DESC
        LIMIT 50`,
      [req.user.id]
    )
    await db.query(
      `UPDATE feedbacks
          SET user_read_at=NOW()
        WHERE user_id=? AND admin_reply IS NOT NULL AND user_read_at IS NULL`,
      [req.user.id]
    )
    return ok(res, rows.map(row => ({
      ...row,
      images: supportMessages.normalizeImages(row.images_json),
      images_json: undefined
    })))
  } catch (error) {
    console.error('[feedback-list]', error)
    return fail(res, '反馈记录加载失败', 500)
  }
})

router.post('/', ...farmerOnly, async (req, res) => {
  const content = String(req.body.content || '').trim()
  const contact = String(req.body.contact || '').trim()
  const images = supportMessages.normalizeImages(req.body.images)
  if (content.length < 5) return fail(res, '请至少填写5个字的问题描述')
  if (content.length > 1000) return fail(res, '问题描述不能超过1000字')
  if (contact.length > 100) return fail(res, '联系方式不能超过100字')

  try {
    const [result] = await db.query(
      'INSERT INTO feedbacks (user_id,content,contact,images_json) VALUES (?,?,?,?)',
      [req.user.id, content, contact, JSON.stringify(images)]
    )
    return ok(res, { id: result.insertId, status: 'pending' }, '反馈已提交')
  } catch (error) {
    console.error('[feedback-create]', error)
    return fail(res, '反馈提交失败，请稍后重试', 500)
  }
})

router.get('/unread', ...farmerOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM feedbacks
          WHERE user_id=? AND admin_reply IS NOT NULL AND user_read_at IS NULL) AS feedback_count,
        (SELECT COUNT(*) FROM support_messages
          WHERE user_id=? AND sender_type='admin' AND read_at IS NULL
            AND hidden_for_farmer=0) AS chat_count`,
      [req.user.id, req.user.id]
    )
    const feedbackCount = Number(rows[0].feedback_count || 0)
    const chatCount = Number(rows[0].chat_count || 0)
    return ok(res, { feedback_count: feedbackCount, chat_count: chatCount, total: feedbackCount + chatCount })
  } catch (error) {
    console.error('[support-unread]', error)
    return fail(res, '未读消息加载失败', 500)
  }
})

router.get('/chat/messages', ...farmerOnly, async (req, res) => {
  try {
    const messages = await supportMessages.listMessages(req.user.id, req.query.after)
    const readCount = await supportMessages.markRead(req.user.id, 'farmer')
    if (readCount) {
      supportRealtime.notifyAdmins({ type: 'support_read', userId: Number(req.user.id) })
    }
    return ok(res, messages)
  } catch (error) {
    console.error('[support-chat-list]', error)
    return fail(res, '聊天记录加载失败', 500)
  }
})

router.post('/chat/messages', ...farmerOnly, async (req, res) => {
  try {
    const message = await supportMessages.createMessage({
      userId: req.user.id,
      senderType: 'farmer',
      senderId: req.user.id,
      content: req.body.content,
      imageUrl: req.body.image_url,
      replyToId: req.body.reply_to_id
    })
    supportRealtime.notifyAdmins({
      type: 'support_message',
      userId: Number(req.user.id),
      messageId: message.id,
      senderType: 'farmer'
    })
    return ok(res, message, '消息已发送')
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error('[support-chat-create]', error)
    return fail(res, error.message || '消息发送失败', error.statusCode || 500)
  }
})

router.patch('/chat/messages/:id/recall', ...farmerOnly, async (req, res) => {
  const messageId = Number(req.params.id)
  if (!Number.isInteger(messageId) || messageId <= 0) return fail(res, '消息编号无效')
  try {
    const message = await supportMessages.recallMessage({
      userId: req.user.id,
      messageId,
      actorType: 'farmer',
      actorId: req.user.id
    })
    const payload = { type: 'support_message_changed', userId: Number(req.user.id), messageId }
    supportRealtime.notifyFarmer(req.user.id, payload)
    supportRealtime.notifyAdmins(payload)
    return ok(res, message, '消息已撤回')
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error('[support-chat-recall]', error)
    return fail(res, error.message || '消息撤回失败', error.statusCode || 500)
  }
})

router.delete('/chat/messages/:id', ...farmerOnly, async (req, res) => {
  const messageId = Number(req.params.id)
  if (!Number.isInteger(messageId) || messageId <= 0) return fail(res, '消息编号无效')
  try {
    const result = await supportMessages.hideMessage({
      userId: req.user.id,
      messageId,
      viewerType: 'farmer'
    })
    supportRealtime.notifyFarmer(req.user.id, {
      type: 'support_message_deleted',
      userId: Number(req.user.id),
      messageId,
      viewerType: 'farmer'
    })
    return ok(res, result, '消息已从当前会话删除')
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error('[support-chat-delete]', error)
    return fail(res, error.message || '消息删除失败', error.statusCode || 500)
  }
})

module.exports = router
