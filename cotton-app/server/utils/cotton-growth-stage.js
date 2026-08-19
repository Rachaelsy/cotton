const GROWTH_STAGES = Object.freeze([
  '播种出苗期',
  '苗期',
  '蕾期',
  '花铃期',
  '吐絮收获期'
])

function normalizeGrowthStage(value) {
  const stage = String(value || '').trim()
  return GROWTH_STAGES.includes(stage) ? stage : ''
}

function inferGrowthStage(sowDate, now = new Date()) {
  if (!sowDate) return '未设置播期'
  const raw = String(sowDate).slice(0, 10)
  const sow = new Date(`${raw}T00:00:00`)
  const today = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(sow.getTime()) || Number.isNaN(today.getTime())) return '未设置播期'

  const days = Math.floor((today.getTime() - sow.getTime()) / 86400000)
  if (days < 0) return '待播种'
  if (days <= 10) return GROWTH_STAGES[0]
  if (days <= 65) return GROWTH_STAGES[1]
  if (days <= 95) return GROWTH_STAGES[2]
  if (days <= 145) return GROWTH_STAGES[3]
  return GROWTH_STAGES[4]
}

function resolveGrowthStage(explicitStage, sowDate, plantingStatus, now = new Date()) {
  const normalized = normalizeGrowthStage(explicitStage)
  if (normalized) return { value: normalized, source: 'manual' }
  if (['计划播种', '未播种'].includes(String(plantingStatus || '').trim())) {
    return { value: '待播种', source: 'automatic' }
  }
  return { value: inferGrowthStage(sowDate, now), source: 'automatic' }
}

module.exports = {
  GROWTH_STAGES,
  normalizeGrowthStage,
  inferGrowthStage,
  resolveGrowthStage
}
