// utils/plot-geometry.js — 地块坐标校验与球面几何计算（小程序 / Node 共用）

const EARTH_RADIUS = 6378137
const SQM_PER_MU = 666.667

function toRadians(value) {
  return value * Math.PI / 180
}

function normalizeCoordinates(points) {
  if (!Array.isArray(points)) return []
  return points
    .map(point => ({
      latitude: Number(point && point.latitude),
      longitude: Number(point && point.longitude)
    }))
    .filter(point => (
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      point.latitude >= -90 && point.latitude <= 90 &&
      point.longitude >= -180 && point.longitude <= 180
    ))
}

function calculateAreaSquareMeters(points) {
  const normalized = normalizeCoordinates(points)
  if (normalized.length < 3) return 0

  let area = 0
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index]
    const next = normalized[(index + 1) % normalized.length]
    const longitudeDelta = toRadians(next.longitude - current.longitude)
    area += longitudeDelta * (
      2 +
      Math.sin(toRadians(current.latitude)) +
      Math.sin(toRadians(next.latitude))
    )
  }
  return Math.abs(area * EARTH_RADIUS * EARTH_RADIUS / 2)
}

function calculateAreaMu(points) {
  return calculateAreaSquareMeters(points) / SQM_PER_MU
}

function calculatePerimeterMeters(points) {
  const normalized = normalizeCoordinates(points)
  if (normalized.length < 2) return 0

  let perimeter = 0
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index]
    const next = normalized[(index + 1) % normalized.length]
    const latitudeDelta = toRadians(next.latitude - current.latitude)
    const longitudeDelta = toRadians(next.longitude - current.longitude)
    const haversine = (
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(toRadians(current.latitude)) *
        Math.cos(toRadians(next.latitude)) *
        Math.sin(longitudeDelta / 2) ** 2
    )
    perimeter += 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(haversine)))
  }
  return perimeter
}

function calculateCenter(points, fallback = { latitude: 39.47, longitude: 75.99 }) {
  const normalized = normalizeCoordinates(points)
  if (!normalized.length) return fallback
  const totals = normalized.reduce((result, point) => ({
    latitude: result.latitude + point.latitude,
    longitude: result.longitude + point.longitude
  }), { latitude: 0, longitude: 0 })
  return {
    latitude: totals.latitude / normalized.length,
    longitude: totals.longitude / normalized.length
  }
}

module.exports = {
  normalizeCoordinates,
  calculateAreaSquareMeters,
  calculateAreaMu,
  calculatePerimeterMeters,
  calculateCenter
}
