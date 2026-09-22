const auth = require('./auth')

function storageKey() {
  const user = auth.getUser()
  return `academy_completion_v1_${user && user.id || 'guest'}`
}

function viewedStorageKey() {
  const user = auth.getUser()
  return `academy_last_viewed_v1_${user && user.id || 'guest'}`
}

function read() {
  return wx.getStorageSync(storageKey()) || {}
}

function percentages() {
  const rows = read()
  const result = {}
  Object.keys(rows).forEach(id => { result[id] = rows[id].completed ? 100 : Number(rows[id].percent || 0) })
  return result
}


async function sync() {
  if (!auth.isLoggedIn()) return
  const key = storageKey()
  try {
    const result = await auth.request('GET', '/api/miniapp-academy/progress')
    if (storageKey() !== key || !result || result.code !== 200 || !Array.isArray(result.data)) return
    const rows = {}
    result.data.forEach(item => {
      rows[item.course_key] = { completed: Boolean(item.completed), completedAt: item.completedAt || '', percent: item.percent, position: item.position, version: item.version, completionSource: item.completionSource }
    })
    wx.setStorageSync(key, rows)
    const viewed = wx.getStorageSync(viewedStorageKey()) || {}
    result.data.forEach(item => {
      const previous = viewed[item.series_key]
      if (item.series_key && (!previous || new Date(item.updated_at).getTime() > new Date(previous.viewedAt).getTime())) {
        viewed[item.series_key] = { courseId: item.course_key, viewedAt: item.updated_at }
      }
    })
    wx.setStorageSync(viewedStorageKey(), viewed)
  } catch (_) {}
}

function markViewed(courseId, seriesKey) {
  const id = String(courseId || '')
  const series = String(seriesKey || '')
  if (!id || !series) return
  const key = viewedStorageKey()
  const rows = wx.getStorageSync(key) || {}
  rows[series] = { courseId: id, viewedAt: new Date().toISOString() }
  wx.setStorageSync(key, rows)
}

function lastViewed(seriesKey) {
  const rows = wx.getStorageSync(viewedStorageKey()) || {}
  const record = rows[String(seriesKey || '')]
  return record && String(record.courseId || '') || ''
}

function save(id, value) {
  const rows=read(); rows[id]={...rows[id],...value}; wx.setStorageSync(storageKey(),rows)
}
module.exports = { read, percentages, sync, save, markViewed, lastViewed }
