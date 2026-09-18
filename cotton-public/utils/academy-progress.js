const auth = require('./auth')
function mergeRanges(source) {
  const rows = (source || []).filter(item => Array.isArray(item) && item.length === 2 && item[1] > item[0]).sort((a,b) => a[0] - b[0])
  const merged = []
  rows.forEach(item => {
    const previous = merged[merged.length - 1]
    if (previous && item[0] <= previous[1] + 0.5) previous[1] = Math.max(previous[1], item[1])
    else merged.push([item[0], item[1]])
  })
  const split = []
  merged.forEach(item => {
    for (let start = item[0]; start < item[1]; start += 10) split.push([start, Math.min(item[1], start + 10)])
  })
  return split
}
function storageKey() { const user = auth.getUser(); return `academy_progress_v2_${user && user.id || 'guest'}` }
function read() { return wx.getStorageSync(storageKey()) || {} }
function percentages() { const rows = read(); const result = {}; Object.keys(rows).forEach(id => { result[id] = rows[id].completed ? 100 : Math.min(89, rows[id].percent || 0) }); return result }
function save(id, position, percent, ranges = []) {
  const rows = read()
  const current = rows[id] || {}
  rows[id] = {
    ...current,
    position: Math.max(0, position || 0),
    percent: Math.max(current.percent || 0, Math.min(100, Math.round(percent || 0))),
    pendingRanges: mergeRanges([...(current.pendingRanges || []), ...ranges]),
    updatedAt: Date.now(), dirty: true
  }
  wx.setStorageSync(storageKey(), rows)
  return rows[id]
}
async function flush(id) {
  if (!auth.isLoggedIn()) return
  const key = storageKey(); const rows = wx.getStorageSync(key) || {}; const entry = rows[id]
  if (!entry || !entry.dirty) return
  try {
    const sentRanges = (entry.pendingRanges || []).slice(0, 120)
    rows[id].pendingRanges = (entry.pendingRanges || []).slice(sentRanges.length)
    rows[id].dirty = rows[id].pendingRanges.length > 0
    wx.setStorageSync(key, rows)
    const result = await auth.request('PUT', `/api/miniapp-academy/courses/${encodeURIComponent(id)}/progress`, { position: entry.position, ranges: sentRanges })
    const latest = wx.getStorageSync(key) || {}
    if (result.code === 200 && latest[id]) {
      latest[id].position = result.data.position
      latest[id].percent = result.data.percent
      latest[id].completed = result.data.completed
      latest[id].dirty = (latest[id].pendingRanges || []).length > 0
      wx.setStorageSync(key, latest)
      return result.data
    }
  } catch (_) {
    const latest = wx.getStorageSync(key) || {}
    if (latest[id]) {
      latest[id].pendingRanges = mergeRanges([...(entry.pendingRanges || []), ...(latest[id].pendingRanges || [])])
      latest[id].dirty = true
      wx.setStorageSync(key, latest)
    }
  }
}
async function sync() {
  if (!auth.isLoggedIn()) return
  const key = storageKey()
  const pending = read()
  for (const id of Object.keys(pending).filter(id => pending[id].dirty)) { if (storageKey() !== key) return; await flush(id) }
  try {
    const result = await auth.request('GET', '/api/miniapp-academy/progress')
    if (storageKey() !== key || result.code !== 200 || !Array.isArray(result.data)) return
    const rows = read()
    result.data.forEach(item => {
      if (rows[item.course_key] && rows[item.course_key].dirty) return
      rows[item.course_key] = { position: item.position_seconds, percent: item.percent, completed: Boolean(item.completed_at), pendingRanges: [], dirty: false }
    })
    wx.setStorageSync(key, rows)
  } catch (_) {}
}
module.exports = { read, percentages, save, flush, sync }
