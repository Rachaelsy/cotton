const assert = require('assert')
const express = require('express')
const fs = require('fs')
const http = require('http')
const jwt = require('jsonwebtoken')
const path = require('path')
const WebSocket = require('ws')

process.env.JWT_SECRET = 'feedback-route-test-secret'

const dbPath = require.resolve('../db/database')
const records = []
const messages = []
let nextId = 51
let nextMessageId = 201

const mockDb = {
  async query(sql, params = []) {
    const compact = sql.replace(/\s+/g, ' ').trim()

    if (/INSERT INTO feedbacks/i.test(compact)) {
      const item = {
        id: nextId++,
        user_id: params[0],
        content: params[1],
        contact: params[2],
        images_json: params[3],
        status: 'pending',
        admin_reply: null,
        replied_at: null,
        user_read_at: null,
        created_at: '2026-07-20T08:00:00.000Z',
        updated_at: '2026-07-20T08:00:00.000Z'
      }
      records.unshift(item)
      return [{ insertId: item.id }, []]
    }

    if (/SELECT id,content,contact,images_json,status,admin_reply/i.test(compact)) {
      return [records.filter(item => item.user_id === params[0]).map(item => ({ ...item })), []]
    }

    if (/SET user_read_at=NOW\(\)/i.test(compact)) {
      records.forEach(item => {
        if (item.user_id === params[0] && item.admin_reply && !item.user_read_at) {
          item.user_read_at = '2026-07-20T08:10:00.000Z'
        }
      })
      return [{ affectedRows: 1 }, []]
    }

    if (/FROM feedbacks f JOIN users u/i.test(compact)) {
      const status = params[0]
      const rows = records
        .filter(item => !status || item.status === status)
        .map(item => ({ ...item, real_name: '测试农户', phone: '13800000000' }))
      return [rows, []]
    }

    if (/UPDATE feedbacks SET admin_reply=/i.test(compact)) {
      const [reply, status, repliedBy, id] = params
      const item = records.find(row => row.id === id)
      if (!item) return [{ affectedRows: 0 }, []]
      Object.assign(item, {
        admin_reply: reply,
        status,
        replied_by: repliedBy,
        replied_at: '2026-07-20T08:05:00.000Z',
        user_read_at: null
      })
      return [{ affectedRows: 1 }, []]
    }

    if (/AS feedback_count/i.test(compact) && /AS chat_count/i.test(compact)) {
      return [[{
        feedback_count: records.filter(item => item.user_id === Number(params[0]) && item.admin_reply && !item.user_read_at).length,
        chat_count: messages.filter(item => item.user_id === Number(params[1]) && item.sender_type === 'admin' && !item.read_at && !item.hidden_for_farmer).length
      }], []]
    }

    if (/INSERT INTO support_messages/i.test(compact)) {
      const message = {
        id: nextMessageId++,
        user_id: Number(params[0]),
        sender_type: params[1],
        sender_id: Number(params[2]),
        content: params[3],
        image_url: params[4],
        reply_to_id: params[5] || null,
        reply_to_json: params[6] || null,
        recalled_at: null,
        hidden_for_farmer: 0,
        hidden_for_admin: 0,
        read_at: null,
        created_at: `2026-07-20T08:${String(messages.length).padStart(2, '0')}:00.000Z`
      }
      messages.push(message)
      return [{ insertId: message.id }, []]
    }

    if (/FROM support_messages WHERE id=\?/i.test(compact)) {
      const item = messages.find(message => message.id === Number(params[0]))
      if (!item) return [[], []]
      if (/AND user_id=\?/i.test(compact) && item.user_id !== Number(params[1])) return [[], []]
      if (/hidden_for_admin=0/i.test(compact) && item.hidden_for_admin) return [[], []]
      if (/hidden_for_farmer=0/i.test(compact) && item.hidden_for_farmer) return [[], []]
      return [[{ ...item }], []]
    }

    if (/SET content='',image_url='',recalled_at=NOW\(\)/i.test(compact)) {
      const [messageId, userId, senderType, senderId] = params
      const item = messages.find(message => message.id === Number(messageId) &&
        message.user_id === Number(userId) && message.sender_type === senderType &&
        message.sender_id === Number(senderId) && !message.recalled_at)
      if (!item) return [{ affectedRows: 0 }, []]
      item.content = ''
      item.image_url = ''
      item.recalled_at = '2026-07-20T08:20:00.000Z'
      return [{ affectedRows: 1 }, []]
    }

    if (/SET hidden_for_admin=1 WHERE user_id=\? AND hidden_for_admin=0/i.test(compact)) {
      let affectedRows = 0
      messages.forEach(item => {
        if (item.user_id === Number(params[0]) && !item.hidden_for_admin) {
          item.hidden_for_admin = 1
          affectedRows += 1
        }
      })
      return [{ affectedRows }, []]
    }

    if (/SET hidden_for_(farmer|admin)=1/i.test(compact)) {
      const viewer = compact.match(/SET hidden_for_(farmer|admin)=1/i)[1]
      const item = messages.find(message => message.id === Number(params[0]) && message.user_id === Number(params[1]))
      if (!item || item[`hidden_for_${viewer}`]) return [{ affectedRows: 0 }, []]
      item[`hidden_for_${viewer}`] = 1
      return [{ affectedRows: 1 }, []]
    }

    if (/FROM users u JOIN support_messages last_message/i.test(compact)) {
      if (!messages.length) return [[], []]
      const visibleMessages = messages.filter(item => !item.hidden_for_admin)
      if (!visibleMessages.length) return [[], []]
      const last = visibleMessages[visibleMessages.length - 1]
      return [[{
        user_id: 42,
        real_name: '测试农户',
        phone: '13800000000',
        last_content: last.content,
        image_url: last.image_url,
        recalled_at: last.recalled_at,
        sender_type: last.sender_type,
        created_at: last.created_at,
        unread_count: visibleMessages.filter(item => item.sender_type === 'farmer' && !item.read_at).length
      }], []]
    }

    if (/FROM support_messages/i.test(compact) && /WHERE user_id=\?/i.test(compact)) {
      const userId = Number(params[0])
      const afterId = Number(params[1] || 0)
      const hiddenField = /hidden_for_admin=0/i.test(compact) ? 'hidden_for_admin' : 'hidden_for_farmer'
      return [messages.filter(item => item.user_id === userId && item.id > afterId && !item[hiddenField]).map(item => ({ ...item })), []]
    }

    if (/UPDATE support_messages SET read_at=NOW\(\)/i.test(compact)) {
      const [userId, senderType] = params
      let affectedRows = 0
      messages.forEach(item => {
        const hiddenField = /hidden_for_admin=0/i.test(compact) ? 'hidden_for_admin' : 'hidden_for_farmer'
        if (item.user_id === Number(userId) && item.sender_type === senderType && !item.read_at && !item[hiddenField]) {
          item.read_at = '2026-07-20T08:30:00.000Z'
          affectedRows += 1
        }
      })
      return [{ affectedRows }, []]
    }

    if (/SELECT id FROM users WHERE id=\? AND role='farmer'/i.test(compact)) {
      return [Number(params[0]) === 42 ? [{ id: 42 }] : [], []]
    }

    throw new Error(`Unexpected SQL in feedback test: ${compact}`)
  }
}

require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb }
const feedbackRouter = require('../routes/feedback')
const adminRouter = require('../routes/admin')
const { attachSupportRealtime } = require('../utils/support-realtime')

async function request(baseUrl, token, method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  return { status: response.status, json: await response.json() }
}

function verifyUiFiles() {
  const root = path.join(__dirname, '..', '..')
  const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
  const profileWxml = fs.readFileSync(path.join(root, 'pages/my/index.wxml'), 'utf8')
  const profileJs = fs.readFileSync(path.join(root, 'pages/my/index.js'), 'utf8')
  const dashboard = fs.readFileSync(path.join(root, 'server/public/admin/dashboard.html'), 'utf8')
  const schema = fs.readFileSync(path.join(root, 'server/db/schema.sql'), 'utf8')
  const feedbackWxml = fs.readFileSync(path.join(root, 'pages/feedback/index.wxml'), 'utf8')
  const supportChatJs = fs.readFileSync(path.join(root, 'pages/support-chat/index.js'), 'utf8')
  const supportChatWxml = fs.readFileSync(path.join(root, 'pages/support-chat/index.wxml'), 'utf8')
  const supportChatWxss = fs.readFileSync(path.join(root, 'pages/support-chat/index.wxss'), 'utf8')

  assert(appConfig.pages.includes('pages/feedback/index'), 'mini app should register the feedback page')
  assert(appConfig.pages.includes('pages/support-chat/index'), 'mini app should register the support chat page')
  assert(profileWxml.includes('bindtap="onFeedback"'), 'profile should link to platform feedback')
  assert(profileWxml.includes('supportUnread'), 'profile should show only database-backed support unread counts')
  assert(profileJs.includes('/api/feedback/unread'), 'profile unread badge should use the support unread API')
  assert(!profileWxml.includes('open-type="contact"'), 'profile should not use native WeChat customer service')
  assert(dashboard.includes('id="panel-feedbacks"'), 'admin dashboard should include the feedback panel')
  assert(dashboard.includes('submitFeedbackReply()'), 'admin dashboard should support replies')
  assert(dashboard.includes('id="panel-supportChats"'), 'admin dashboard should include live support conversations')
  assert(dashboard.includes('.support-chat-pane { min-width: 0; min-height: 0; height: 100%;'), 'admin chat pane should stay inside the support workspace')
  assert(dashboard.includes('.support-chat-messages { flex: 1 1 0; min-height: 0;'), 'only the admin message list should consume and scroll remaining height')
  assert(dashboard.includes('grid-template-columns: 38px minmax(0, 1fr) auto'), 'admin chat composer should reserve stable control widths')
  assert(feedbackWxml.includes('bindtap="chooseImages"'), 'feedback form should support image uploads')
  assert(feedbackWxml.includes('bindtap="onOpenChat"'), 'feedback page should link to live support')
  assert(supportChatJs.includes('wx.connectSocket'), 'support chat should use realtime socket notifications')
  assert(supportChatJs.includes('setInterval'), 'support chat should retain a polling fallback')
  assert(supportChatJs.includes('openMessageActions'), 'farmer chat should expose long-press message actions')
  assert(supportChatJs.includes('/recall'), 'farmer chat should call the recall endpoint')
  assert(supportChatWxml.includes('bindlongpress="openMessageActions"'), 'farmer messages should support long-press actions')
  assert(dashboard.includes('recallSupportMessage'), 'admin chat should expose message recall')
  assert(dashboard.includes('deleteSupportMessage'), 'admin chat should expose message deletion')
  assert(dashboard.includes('deleteSupportConversation'), 'admin should be able to clear a conversation from the admin view')
  assert(dashboard.includes('sendSupportChatImage'), 'admin chat should support image messages')
  assert(dashboard.includes('setSupportReply'), 'admin chat should support quoted replies')
  assert(supportChatJs.includes('quoteMessage'), 'farmer chat should support quoted replies')
  assert(supportChatWxml.includes('class="input-shell"'), 'support chat input should have its own constrained layout cell')
  assert(!supportChatWxml.includes('<button class="image-button"'), 'native buttons should not squeeze the chat input on real devices')
  assert(supportChatWxss.includes('grid-template-columns: 76rpx minmax(0, 1fr) 112rpx'), 'chat composer should reserve stable control widths')
  assert(supportChatWxss.includes('.message-input { width: 100%; min-width: 0;'), 'chat input should fill the remaining middle column')
  assert(schema.includes('CREATE TABLE IF NOT EXISTS feedbacks'), 'database schema should include feedbacks')
  assert(schema.includes('CREATE TABLE IF NOT EXISTS support_messages'), 'database schema should include support messages')
  assert(schema.includes('recalled_at'), 'support messages should persist recall state')
  assert(schema.includes('hidden_for_farmer'), 'support messages should persist farmer-side deletion')
  assert(schema.includes('hidden_for_admin'), 'support messages should persist admin-side deletion')
  assert(schema.includes('reply_to_json'), 'support messages should persist quoted reply snapshots')
  assert(fs.existsSync(path.join(root, 'server/db/migrate_feedbacks.js')), 'feedback migration should exist')
}

async function run() {
  verifyUiFiles()

  const app = express()
  app.use(express.json())
  app.use('/api/feedback', feedbackRouter)
  app.use('/api/admin', adminRouter)
  const httpServer = http.createServer(app)
  attachSupportRealtime(httpServer)
  const server = await new Promise(resolve => {
    httpServer.listen(0, '127.0.0.1', () => resolve(httpServer))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const farmerToken = jwt.sign({ id: 42, role: 'farmer' }, process.env.JWT_SECRET)
  const merchantToken = jwt.sign({ id: 8, role: 'merchant' }, process.env.JWT_SECRET)
  const adminToken = jwt.sign({ id: 1, is_admin: true }, process.env.JWT_SECRET)
  const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/api/support/socket?token=${encodeURIComponent(adminToken)}`)

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('support websocket connection timed out')), 2000)
      socket.once('open', () => { clearTimeout(timeout); resolve() })
      socket.once('error', reject)
    })

    const unauthorized = await request(baseUrl, '', 'GET', '/api/feedback')
    assert.strictEqual(unauthorized.status, 401)

    const merchantDenied = await request(baseUrl, merchantToken, 'GET', '/api/feedback')
    assert.strictEqual(merchantDenied.status, 403)

    const tooShort = await request(baseUrl, farmerToken, 'POST', '/api/feedback', { content: '不好' })
    assert.strictEqual(tooShort.status, 400)

    const created = await request(baseUrl, farmerToken, 'POST', '/api/feedback', {
      content: '天气页面定位后无法刷新',
      contact: '13800000000',
      images: ['/uploads/feedback-a.jpg', 'https://invalid.example/a.jpg', '/uploads/feedback-b.png']
    })
    assert.strictEqual(created.status, 200)
    assert.strictEqual(created.json.data.status, 'pending')

    const farmerList = await request(baseUrl, farmerToken, 'GET', '/api/feedback')
    assert.strictEqual(farmerList.status, 200)
    assert.strictEqual(farmerList.json.data.length, 1)
    assert.deepStrictEqual(farmerList.json.data[0].images, ['/uploads/feedback-a.jpg', '/uploads/feedback-b.png'])

    const adminDenied = await request(baseUrl, '', 'GET', '/api/admin/feedbacks')
    assert.strictEqual(adminDenied.status, 401)

    const adminList = await request(baseUrl, adminToken, 'GET', '/api/admin/feedbacks?status=pending')
    assert.strictEqual(adminList.status, 200)
    assert.strictEqual(adminList.json.data.length, 1)
    assert.strictEqual(adminList.json.data[0].real_name, '测试农户')
    assert.strictEqual(adminList.json.data[0].images.length, 2)

    const socketMessage = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('support websocket notification timed out')), 2000)
      const handler = raw => {
        const payload = JSON.parse(raw.toString())
        if (payload.type !== 'support_message') return
        clearTimeout(timeout)
        socket.off('message', handler)
        resolve(payload)
      }
      socket.on('message', handler)
    })
    const farmerMessage = await request(baseUrl, farmerToken, 'POST', '/api/feedback/chat/messages', {
      content: '我想咨询天气定位问题'
    })
    assert.strictEqual(farmerMessage.status, 200)
    assert.strictEqual((await socketMessage).userId, 42)

    const recallSocketMessage = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('support recall notification timed out')), 2000)
      const handler = raw => {
        const payload = JSON.parse(raw.toString())
        if (payload.type !== 'support_message_changed') return
        clearTimeout(timeout)
        socket.off('message', handler)
        resolve(payload)
      }
      socket.on('message', handler)
    })
    const farmerRecall = await request(baseUrl, farmerToken, 'PATCH', `/api/feedback/chat/messages/${farmerMessage.json.data.id}/recall`)
    assert.strictEqual(farmerRecall.status, 200)
    assert.strictEqual(farmerRecall.json.data.is_recalled, true)
    assert.strictEqual(farmerRecall.json.data.content, '')
    assert.strictEqual((await recallSocketMessage).messageId, farmerMessage.json.data.id)

    const quoteRecalledMessage = await request(baseUrl, farmerToken, 'POST', '/api/feedback/chat/messages', {
      content: '不能引用已撤回消息',
      reply_to_id: farmerMessage.json.data.id
    })
    assert.strictEqual(quoteRecalledMessage.status, 400)

    const invalidChatImage = await request(baseUrl, farmerToken, 'POST', '/api/feedback/chat/messages', {
      image_url: 'https://invalid.example/chat.jpg'
    })
    assert.strictEqual(invalidChatImage.status, 400)

    const farmerImage = await request(baseUrl, farmerToken, 'POST', '/api/feedback/chat/messages', {
      image_url: '/uploads/chat-photo.webp'
    })
    assert.strictEqual(farmerImage.status, 200)

    const supportChats = await request(baseUrl, adminToken, 'GET', '/api/admin/support-chats')
    assert.strictEqual(supportChats.status, 200)
    assert.strictEqual(supportChats.json.data[0].unread_count, 2)

    const adminMessages = await request(baseUrl, adminToken, 'GET', '/api/admin/support-chats/42/messages')
    assert.strictEqual(adminMessages.status, 200)
    assert.strictEqual(adminMessages.json.data.length, 2)
    assert.strictEqual(adminMessages.json.data[0].is_recalled, true)

    const adminMessage = await request(baseUrl, adminToken, 'POST', '/api/admin/support-chats/42/messages', {
      content: '您好，已经收到，请重新打开定位权限。',
      reply_to_id: farmerImage.json.data.id
    })
    assert.strictEqual(adminMessage.status, 200)
    assert.strictEqual(adminMessage.json.data.reply_to.id, farmerImage.json.data.id)
    assert.strictEqual(adminMessage.json.data.reply_to.image_url, '/uploads/chat-photo.webp')

    const farmerMessages = await request(baseUrl, farmerToken, 'GET', `/api/feedback/chat/messages?after=${farmerImage.json.data.id}`)
    assert.strictEqual(farmerMessages.status, 200)
    assert.strictEqual(farmerMessages.json.data[0].sender_type, 'admin')
    assert.strictEqual(farmerMessages.json.data[0].reply_to.id, farmerImage.json.data.id)

    const farmerQuotedReply = await request(baseUrl, farmerToken, 'POST', '/api/feedback/chat/messages', {
      content: '我已经重新开启定位权限。',
      reply_to_id: adminMessage.json.data.id
    })
    assert.strictEqual(farmerQuotedReply.status, 200)
    assert.strictEqual(farmerQuotedReply.json.data.reply_to.id, adminMessage.json.data.id)

    const farmerCannotRecallAdmin = await request(baseUrl, farmerToken, 'PATCH', `/api/feedback/chat/messages/${adminMessage.json.data.id}/recall`)
    assert.strictEqual(farmerCannotRecallAdmin.status, 409)

    const adminRecall = await request(baseUrl, adminToken, 'PATCH', `/api/admin/support-chats/42/messages/${adminMessage.json.data.id}/recall`)
    assert.strictEqual(adminRecall.status, 200)
    assert.strictEqual(adminRecall.json.data.is_recalled, true)

    const secondAdminMessage = await request(baseUrl, adminToken, 'POST', '/api/admin/support-chats/42/messages', {
      content: '这是一条用于验证单方删除的消息。'
    })
    assert.strictEqual(secondAdminMessage.status, 200)
    const farmerDelete = await request(baseUrl, farmerToken, 'DELETE', `/api/feedback/chat/messages/${secondAdminMessage.json.data.id}`)
    assert.strictEqual(farmerDelete.status, 200)
    const farmerAfterDelete = await request(baseUrl, farmerToken, 'GET', '/api/feedback/chat/messages')
    assert(!farmerAfterDelete.json.data.some(item => item.id === secondAdminMessage.json.data.id), 'farmer-side delete should hide only that view')
    const adminAfterFarmerDelete = await request(baseUrl, adminToken, 'GET', '/api/admin/support-chats/42/messages')
    assert(adminAfterFarmerDelete.json.data.some(item => item.id === secondAdminMessage.json.data.id), 'farmer-side delete must preserve the admin view')

    const adminDelete = await request(baseUrl, adminToken, 'DELETE', `/api/admin/support-chats/42/messages/${farmerImage.json.data.id}`)
    assert.strictEqual(adminDelete.status, 200)
    const adminAfterDelete = await request(baseUrl, adminToken, 'GET', '/api/admin/support-chats/42/messages')
    assert(!adminAfterDelete.json.data.some(item => item.id === farmerImage.json.data.id), 'admin-side delete should hide the admin view')
    const farmerAfterAdminDelete = await request(baseUrl, farmerToken, 'GET', '/api/feedback/chat/messages')
    assert(farmerAfterAdminDelete.json.data.some(item => item.id === farmerImage.json.data.id), 'admin-side delete must preserve the farmer view')

    const farmerHistoryBeforeConversationDelete = farmerAfterAdminDelete.json.data.map(item => item.id)
    const conversationDeletedSocket = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('conversation delete notification timed out')), 2000)
      const handler = raw => {
        const payload = JSON.parse(raw.toString())
        if (payload.type !== 'support_conversation_deleted') return
        clearTimeout(timeout)
        socket.off('message', handler)
        resolve(payload)
      }
      socket.on('message', handler)
    })
    const deletedConversation = await request(baseUrl, adminToken, 'DELETE', '/api/admin/support-chats/42')
    assert.strictEqual(deletedConversation.status, 200)
    assert.strictEqual((await conversationDeletedSocket).viewerType, 'admin')
    const chatsAfterConversationDelete = await request(baseUrl, adminToken, 'GET', '/api/admin/support-chats')
    assert.strictEqual(chatsAfterConversationDelete.json.data.length, 0)
    const adminHistoryAfterConversationDelete = await request(baseUrl, adminToken, 'GET', '/api/admin/support-chats/42/messages')
    assert.strictEqual(adminHistoryAfterConversationDelete.json.data.length, 0)
    const farmerHistoryAfterConversationDelete = await request(baseUrl, farmerToken, 'GET', '/api/feedback/chat/messages')
    assert.deepStrictEqual(farmerHistoryAfterConversationDelete.json.data.map(item => item.id), farmerHistoryBeforeConversationDelete)

    const restartedConversation = await request(baseUrl, farmerToken, 'POST', '/api/feedback/chat/messages', {
      content: '这是清空后重新发起的新会话。'
    })
    assert.strictEqual(restartedConversation.status, 200)
    const restartedChats = await request(baseUrl, adminToken, 'GET', '/api/admin/support-chats')
    assert.strictEqual(restartedChats.json.data.length, 1)
    const restartedAdminHistory = await request(baseUrl, adminToken, 'GET', '/api/admin/support-chats/42/messages')
    assert.deepStrictEqual(restartedAdminHistory.json.data.map(item => item.id), [restartedConversation.json.data.id])

    const shortReply = await request(baseUrl, adminToken, 'PATCH', `/api/admin/feedbacks/${created.json.data.id}/reply`, { reply: '好' })
    assert.strictEqual(shortReply.status, 400)

    const replied = await request(baseUrl, adminToken, 'PATCH', `/api/admin/feedbacks/${created.json.data.id}/reply`, {
      reply: '已收到，我们会检查定位刷新接口。',
      status: 'closed'
    })
    assert.strictEqual(replied.status, 200)
    assert.strictEqual(replied.json.data.status, 'closed')

    const unread = await request(baseUrl, farmerToken, 'GET', '/api/feedback/unread')
    assert.strictEqual(unread.status, 200)
    assert.strictEqual(unread.json.data.feedback_count, 1)
    assert.strictEqual(unread.json.data.total, 1)

    const updatedList = await request(baseUrl, farmerToken, 'GET', '/api/feedback')
    assert.strictEqual(updatedList.json.data[0].admin_reply, '已收到，我们会检查定位刷新接口。')
    assert.strictEqual(updatedList.json.data[0].status, 'closed')

    console.log('feedback and customer service tests passed')
  } finally {
    socket.close()
    await new Promise(resolve => server.close(resolve))
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
