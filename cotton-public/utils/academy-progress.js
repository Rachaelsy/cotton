const auth = require('./auth')

function storageKey() {
  const user = auth.getUser()
  return `academy_completion_v1_${user && user.id || 'guest'}`
}

function read() {
  return wx.getStorageSync(storageKey()) || {}
}

function percentages() {
  const rows = read()
  const result = {}
  Object.keys(rows).forEach(id => { result[id] = rows[id].completed ? 100 : 0 })
  return result
}

async function complete(id) {
  if (!auth.isLoggedIn()) throw new Error('请先登录后标记完成')
  const result = await auth.request('POST', `/api/miniapp-academy/courses/${encodeURIComponent(id)}/complete`)
  if (!result || result.code !== 200) throw new Error(result && result.msg || '完成状态保存失败')
  const key = storageKey()
  const rows = wx.getStorageSync(key) || {}
  rows[id] = { completed: true, completedAt: new Date().toISOString() }
  wx.setStorageSync(key, rows)
  return result.data
}

async function sync() {
  if (!auth.isLoggedIn()) return
  const key = storageKey()
  try {
    const result = await auth.request('GET', '/api/miniapp-academy/progress')
    if (storageKey() !== key || !result || result.code !== 200 || !Array.isArray(result.data)) return
    const rows = {}
    result.data.forEach(item => {
      rows[item.course_key] = { completed: true, completedAt: item.completed_at || item.updated_at || '' }
    })
    wx.setStorageSync(key, rows)
  } catch (_) {}
}

module.exports = { read, percentages, complete, sync }
