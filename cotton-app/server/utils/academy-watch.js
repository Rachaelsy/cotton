const crypto = require('crypto')

function videoVersion(course) {
  let source = String(course.video_url || '')
  try { const url = new URL(source); source = url.origin + url.pathname } catch (_) {}
  return crypto.createHash('sha256').update(`${source}|${course.duration_seconds}`).digest('hex')
}

function mergeRanges(ranges, duration) {
  if (!Array.isArray(ranges) || ranges.length > 2000) throw Error('观看片段无效')
  const sorted = ranges.map(pair => {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(Number.isFinite) || pair[0] < 0 || pair[1] <= pair[0] || pair[1] > duration + 1) throw Error('观看片段无效')
    return [Math.min(duration, pair[0]), Math.min(duration, pair[1])]
  }).sort((a, b) => a[0] - b[0])
  const merged = []
  for (const pair of sorted) {
    const last = merged[merged.length - 1]
    if (last && pair[0] <= last[1]) last[1] = Math.max(last[1], pair[1])
    else merged.push(pair.slice())
  }
  return merged
}
const coverage = ranges => ranges.reduce((sum, pair) => sum + pair[1] - pair[0], 0)
function decodeRanges(value) { try { return JSON.parse(value || '[]') } catch (_) { return [] } }
function progressView(row, duration) {
  return {
    completed: Boolean(row.completed_at), completedAt: row.completed_at,
    percent: row.completed_at ? 100 : Math.min(94, Math.floor(Number(row.watched_seconds || 0) / Math.max(1, duration) * 100)),
    position: Number(row.last_position || 0), watchedSeconds: Number(row.watched_seconds || 0),
    completionSource: row.completion_source, version: row.video_version
  }
}
module.exports = { videoVersion, mergeRanges, coverage, decodeRanges, progressView }
