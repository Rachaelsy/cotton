const db = require('../db/database')

function hourStart(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return null
  date.setMinutes(0, 0, 0)
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

async function saveObservation(plotId, center, weather) {
  if (!plotId || !weather || !weather.current) return
  const observedHour = hourStart(weather.current.time)
  const temperature = Number(weather.current.temperature_2m)
  const precipitation = Number(weather.current.precipitation || 0)
  if (!observedHour || !Number.isFinite(temperature)) return
  await db.query(
    `INSERT INTO weather_observations
      (plot_id,observed_hour,latitude,longitude,temperature,precipitation,provider)
     VALUES (?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE latitude=VALUES(latitude),longitude=VALUES(longitude),
       temperature=VALUES(temperature),precipitation=VALUES(precipitation),provider=VALUES(provider)`,
    [plotId, observedHour, center.latitude, center.longitude, temperature,
      Number.isFinite(precipitation) ? Math.max(0, precipitation) : 0, weather.provider || '']
  )
}

async function getThirtyDayStats(plotId) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS observation_hours,
            COUNT(DISTINCT DATE(observed_hour)) AS coverage_days,
            ROUND(SUM(precipitation),1) AS rainfall_mm,
            ROUND(SUM(GREATEST(temperature-10,0))/24,1) AS growing_degree_days,
            MIN(observed_hour) AS first_observed_at,MAX(observed_hour) AS last_observed_at
       FROM weather_observations
      WHERE plot_id=? AND observed_hour >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [plotId]
  )
  return {
    periodDays: 30,
    observationHours: Number(row && row.observation_hours || 0),
    coverageDays: Number(row && row.coverage_days || 0),
    rainfallMm: Number(row && row.rainfall_mm || 0),
    growingDegreeDays: Number(row && row.growing_degree_days || 0),
    baseTemperature: 10,
    firstObservedAt: row && row.first_observed_at || null,
    lastObservedAt: row && row.last_observed_at || null,
    complete: Number(row && row.observation_hours || 0) >= 24 * 30
  }
}

module.exports = { saveObservation, getThirtyDayStats, hourStart }
