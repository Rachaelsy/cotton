const { normalizeCoordinates, calculateCenter } = require('./plot-geometry')
const { locateService } = require('./regions')

function parseCoordinates(value) {
  if (Array.isArray(value)) return normalizeCoordinates(value)
  if (!value) return []
  try {
    return normalizeCoordinates(JSON.parse(value))
  } catch (error) {
    return []
  }
}

function hashString(input) {
  let hash = 2166136261
  const text = String(input || '')
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1)
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61)
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDayLabel(baseDate, offset) {
  if (offset === 0) return '今天'
  if (offset === 1) return '明天'
  if (offset === 2) return '后天'
  const next = new Date(baseDate)
  next.setDate(next.getDate() + offset)
  return `${next.getMonth() + 1}月${next.getDate()}日`
}

function formatArea(area) {
  const value = Number(area || 0)
  return value.toFixed(value % 1 === 0 ? 0 : 1)
}

function pickWeatherDescriptor(temp, humidity, windLevel, rainChance, randomValue) {
  if (rainChance >= 45) return { desc: '阵雨', icon: '🌧' }
  if (rainChance >= 25) return { desc: '多云有雨', icon: '⛅' }
  if (windLevel >= 5) return { desc: '大风', icon: '🌬' }
  if (temp >= 36) return { desc: '高温晴热', icon: '☀️' }
  if (humidity <= 28) return { desc: '晴热干燥', icon: '🌤' }
  if (humidity >= 62 || randomValue > 0.7) return { desc: '多云', icon: '⛅' }
  return { desc: '晴转多云', icon: '🌤' }
}

function stageAdvice(plot, weather) {
  const area = Number(plot.area || 0)
  const baseIrrigation = Math.max(20, Math.round(area * 30))
  const sowDate = plot.sow_date ? new Date(`${String(plot.sow_date).slice(0, 10)}T00:00:00`) : null
  const daysSinceSow = sowDate && !Number.isNaN(sowDate.getTime())
    ? Math.max(0, Math.floor((Date.now() - sowDate.getTime()) / 86400000))
    : null

  const advice = []

  if (weather.rain >= 6 || weather.windLevel >= 5) {
    advice.push({
      icon: '🚫',
      bg: '#FFF3E6',
      title: '打药预警',
      sub: weather.rain >= 6
        ? '未来两天有降雨迹象，喷药尽量安排在今天上午，雨前作业要留出安全窗口。'
        : '风力偏大，不适合喷药和无人机作业，建议等待风力减弱后再安排。'
    })
  }

  advice.push({
    icon: '💧',
    bg: '#E3F2FD',
    title: '灌溉建议',
    sub: weather.temp >= 34 || weather.humidity <= 30
      ? `当前地表温度偏高，建议分次滴灌保墒，参考用水约 ${formatArea(baseIrrigation)} 立方米。`
      : `土壤蒸散压力适中，保持轻量滴灌即可，参考每亩 25-30 立方米。`
  })

  advice.push({
    icon: '🌿',
    bg: '#E8F5E9',
    title: '施肥时机',
    sub: daysSinceSow === null
      ? '请结合地块生育期安排追肥，蕾期到花期是棉田追肥的关键窗口。'
      : daysSinceSow < 35
        ? '当前处于苗期/返青阶段，优先稳苗促根，后续再安排追肥。'
        : '进入追肥窗口，可在清晨或傍晚少量多次补充氮磷钾复合肥。'
  })

  advice.push({
    icon: '🧭',
    bg: '#FFF9C4',
    title: '田间作业',
    sub: weather.windLevel >= 4
      ? '今天风力略大，建议把巡田、机械作业放在上午，减少扬尘和蒸发。'
      : '当前适合巡田、整枝和补苗等轻作业，优先处理需要关注的地块。'
  })

  return advice.slice(0, 3)
}

function buildForecast(baseDate, seed, baseTemp, season, humidity, windLevel, rainChance) {
  return Array.from({ length: 5 }, (_, offset) => {
    const rand = createRandom(seed + offset * 97)
    const tempShift = Math.round((rand() - 0.5) * 6)
    const high = baseTemp + tempShift + (season === 'summer' ? 1 : 0) + Math.round(rand() * 2)
    const low = high - (7 + Math.round(rand() * 5))
    const nextHumidity = clamp(Math.round(humidity + (rand() - 0.5) * 18), 18, 82)
    const nextWind = clamp(Math.round(windLevel + (rand() - 0.5) * 2), 1, 7)
    const nextRain = clamp(Math.round(rainChance + (rand() - 0.5) * 12), 0, 100)
    const descriptor = pickWeatherDescriptor(high, nextHumidity, nextWind, nextRain, rand())
    const windNames = ['无风', '1级', '2级', '3级', '4级', '5级', '6级', '7级']

    return {
      day: formatDayLabel(baseDate, offset),
      icon: descriptor.icon,
      high,
      low,
      wind: nextWind >= 7 ? '西北风7级' : `西北风${windNames[nextWind] || `${nextWind}级`}`
    }
  })
}

function buildWeatherForPlot(plot, { today = new Date(), fieldCount = 0, selectedIndex = 0 } = {}) {
  const coordinates = parseCoordinates(plot && plot.coordinates)
  const center = coordinates.length ? calculateCenter(coordinates) : null
  const location = center ? locateService(center.latitude, center.longitude) : null
  const dateKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const seed = hashString(`${plot && plot.id ? plot.id : plot && plot.name ? plot.name : 'plot'}|${dateKey}`)
  const rand = createRandom(seed)
  const month = today.getMonth() + 1
  const season = month >= 6 && month <= 8 ? 'summer' : month >= 3 && month <= 5 ? 'spring' : month >= 9 && month <= 10 ? 'autumn' : 'winter'

  const baseTemp = {
    spring: 24,
    summer: 33,
    autumn: 22,
    winter: 9
  }[season]

  const temp = clamp(Math.round(baseTemp + (rand() - 0.5) * 6), -10, 45)
  const humidity = clamp(Math.round((season === 'summer' ? 28 : 40) + (rand() - 0.5) * 20), 10, 95)
  const windLevel = clamp(Math.round((season === 'summer' ? 3 : 2) + rand() * 4), 1, 7)
  const rainChance = clamp(Math.round((season === 'summer' ? 20 : 12) + rand() * 45), 0, 100)
  const descriptor = pickWeatherDescriptor(temp, humidity, windLevel, rainChance, rand())
  const low = temp - (6 + Math.round(rand() * 4))
  const high = temp + (4 + Math.round(rand() * 4))
  const groundTemp = clamp(temp + (season === 'summer' ? 5 : 3) + Math.round((rand() - 0.5) * 2), -10, 55)
  const uv = clamp(Math.round((season === 'summer' ? 7 : 5) + (rand() - 0.5) * 4), 1, 11)
  const rain = rainChance >= 35 ? Number((rand() * 4 + 1).toFixed(1)) : 0
  const windNames = ['无风', '1级', '2级', '3级', '4级', '5级', '6级', '7级']
  const alert = weatherAlert({ temp, humidity, windLevel, rainChance })
  const forecast = buildForecast(today, seed, temp, season, humidity, windLevel, rainChance)
  const fieldName = plot && plot.name ? plot.name : '全部地块'
  const areaText = plot ? formatArea(plot.area) : '0'
  const locationLabel = location && location.inService
    ? `${location.name} · ${fieldName}`
    : `${location ? location.name : '喀什地区'} · ${fieldName}`

  const summary = alert
    ? alert.summary
    : `当前地表温度 ${groundTemp}°C，适合在上午完成巡田和滴灌。`

  return {
    fieldCount,
    selectedIndex,
    selectedFieldLabel: fieldName,
    locationLabel,
    regionLabel: location ? (location.inService ? `${location.name}` : `${location.name}附近`) : '喀什地区',
    weather: {
      temp,
      desc: descriptor.desc,
      icon: descriptor.icon,
      high,
      low,
      wind: `西北风${windNames[windLevel] || `${windLevel}级`}`,
      humidity,
      groundTemp,
      rain,
      uv
    },
    forecast,
    alert,
    advices: stageAdvice(plot || {}, {
      temp,
      humidity,
      windLevel,
      rain
    }),
    summary,
    tipText: alert
      ? alert.sub
      : `地表温度稳定，建议优先处理 ${fieldName}${plot && plot.area ? `（${areaText}亩）` : ''} 的巡田和滴灌。`
  }
}

function weatherAlert({ temp, humidity, windLevel, rainChance }) {
  if (windLevel >= 5) {
    return {
      icon: '⚠️',
      title: '大风预警',
      sub: '预计风力 5-6 级，喷药、无人机和高杆作业需避开强风时段。',
      summary: '今天风力偏大，优先安排巡田和低风险作业。'
    }
  }
  if (rainChance >= 45) {
    return {
      icon: '🌧',
      title: '降雨提醒',
      sub: '未来 48 小时内有降雨概率，露天喷药和施肥建议提前完成。',
      summary: '天气转湿，建议把喷药作业安排在降雨前。'
    }
  }
  if (temp >= 36) {
    return {
      icon: '🌡',
      title: '高温预警',
      sub: '午后高温明显，注意滴灌保墒并避开正午长时间作业。',
      summary: '高温持续，建议分次滴灌并减少中午田间作业。'
    }
  }
  if (humidity <= 24) {
    return {
      icon: '💧',
      title: '干旱提醒',
      sub: '空气湿度偏低，棉田蒸散较快，建议适当提前灌溉。',
      summary: '当前空气偏干，优先查看墒情并安排保墒。'
    }
  }
  return null
}

function clampRound(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? Math.round(num) : fallback
}

function directionFromDegrees(degrees) {
  const value = Number(degrees)
  if (!Number.isFinite(value)) return '西北'
  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  const index = Math.round((((value % 360) + 360) % 360) / 45) % 8
  return directions[index]
}

function windLevelFromSpeed(speed) {
  const kmh = Number(speed)
  if (!Number.isFinite(kmh) || kmh <= 0) return 0
  if (kmh < 1) return 0
  if (kmh < 6) return 1
  if (kmh < 12) return 2
  if (kmh < 20) return 3
  if (kmh < 29) return 4
  if (kmh < 39) return 5
  if (kmh < 50) return 6
  return 7
}

function weatherCodeMeta(code) {
  const value = Number(code)
  if ([0].includes(value)) return { desc: '晴', icon: '☀️', risk: 'clear' }
  if ([1].includes(value)) return { desc: '大部晴朗', icon: '🌤', risk: 'clear' }
  if ([2].includes(value)) return { desc: '晴间多云', icon: '⛅', risk: 'cloudy' }
  if ([3].includes(value)) return { desc: '多云', icon: '☁️', risk: 'cloudy' }
  if ([45, 48].includes(value)) return { desc: '有雾', icon: '🌫', risk: 'fog' }
  if ([51, 53, 55].includes(value)) return { desc: '毛毛雨', icon: '🌦', risk: 'rain' }
  if ([56, 57].includes(value)) return { desc: '冻毛毛雨', icon: '🌧', risk: 'rain' }
  if ([61, 63, 65].includes(value)) return { desc: '有雨', icon: '🌧', risk: 'rain' }
  if ([66, 67].includes(value)) return { desc: '冻雨', icon: '🌧', risk: 'rain' }
  if ([71, 73, 75, 77].includes(value)) return { desc: '降雪', icon: '❄️', risk: 'snow' }
  if ([80, 81, 82].includes(value)) return { desc: '阵雨', icon: '🌦', risk: 'rain' }
  if ([85, 86].includes(value)) return { desc: '阵雪', icon: '🌨', risk: 'snow' }
  if ([95, 96, 99].includes(value)) return { desc: '雷暴', icon: '⛈', risk: 'storm' }
  return { desc: '天气', icon: '🌤', risk: 'clear' }
}

function forecastIcon(code, temp, humidity, rainChance) {
  const meta = weatherCodeMeta(code)
  if (meta.icon) return meta.icon
  return pickWeatherDescriptor(temp, humidity, 2, rainChance, 0.5).icon
}

function buildWeatherModelFromCurrent(plot, current, daily, options = {}) {
  const today = options.today || new Date()
  const coordinates = parseCoordinates(plot && plot.coordinates)
  const center = coordinates.length ? calculateCenter(coordinates) : null
  const location = center ? locateService(center.latitude, center.longitude) : null
  const currentCode = clampRound(current && current.weather_code, 0)
  const meta = weatherCodeMeta(currentCode)
  const temp = clampRound(current && current.temperature_2m, 0)
  const humidity = clampRound(current && current.relative_humidity_2m, 45)
  const windSpeed = Number(current && current.wind_speed_10m)
  const windLevel = windLevelFromSpeed(windSpeed)
  const windDirection = directionFromDegrees(current && current.wind_direction_10m)
  const rainChance = clampRound(current && current.precipitation_probability, 0)
  const rain = Number.isFinite(Number(current && current.precipitation)) ? Number(current.precipitation) : 0
  const apparentTemperature = Number.isFinite(Number(current && current.apparent_temperature))
    ? Number(current.apparent_temperature)
    : temp
  const high = clampRound(daily && daily.temperature_2m_max ? daily.temperature_2m_max[0] : temp + 4, temp + 4)
  const low = clampRound(daily && daily.temperature_2m_min ? daily.temperature_2m_min[0] : temp - 4, temp - 4)
  const uv = clampRound(current && current.uv_index, 0)
  const forecast = Array.isArray(daily && daily.time) ? daily.time.slice(0, 5).map((day, index) => {
    const code = clampRound(daily.weather_code && daily.weather_code[index], currentCode)
    const dayMeta = weatherCodeMeta(code)
    const dayHigh = clampRound(daily.temperature_2m_max && daily.temperature_2m_max[index], high)
    const dayLow = clampRound(daily.temperature_2m_min && daily.temperature_2m_min[index], low)
    const dayWind = clampRound(daily.wind_speed_10m_max && daily.wind_speed_10m_max[index], windLevel)
    const dayRain = clampRound(daily.precipitation_probability_max && daily.precipitation_probability_max[index], rainChance)
    return {
      day: index === 0 ? '今天' : index === 1 ? '明天' : index === 2 ? '后天' : `${new Date(day).getMonth() + 1}月${new Date(day).getDate()}日`,
      icon: forecastIcon(code, dayHigh, humidity, dayRain),
      high: dayHigh,
      low: dayLow,
      wind: `${windDirection}风${windLevelFromSpeed(dayWind)}级`
    }
  }) : []

  const alert = (() => {
    if (meta.risk === 'storm') {
      return {
        icon: '⛈',
        title: '雷暴预警',
        sub: '当前或未来预报存在雷暴天气，暂停喷药、无人机和金属高架作业。',
        summary: '雷暴风险较高，建议避开露天作业。'
      }
    }
    if (windLevel >= 5) {
      return {
        icon: '⚠️',
        title: '大风预警',
        sub: '风力偏大，喷药、无人机和高杆作业需避开强风时段。',
        summary: '今天风力偏大，优先安排巡田和低风险作业。'
      }
    }
    if (rainChance >= 50 || ['rain', 'snow'].includes(meta.risk)) {
      return {
        icon: '🌧',
        title: '降雨提醒',
        sub: '未来 48 小时存在降水概率，露天喷药和施肥建议提前完成。',
        summary: '天气转湿，建议把喷药作业安排在降雨前。'
      }
    }
    if (temp >= 36) {
      return {
        icon: '🌡',
        title: '高温预警',
        sub: '午后高温明显，注意滴灌保墒并避开正午长时间作业。',
        summary: '高温持续，建议分次滴灌并减少中午田间作业。'
      }
    }
    if (humidity <= 24) {
      return {
        icon: '💧',
        title: '干旱提醒',
        sub: '空气湿度偏低，棉田蒸散较快，建议适当提前灌溉。',
        summary: '当前空气偏干，优先查看墒情并安排保墒。'
      }
    }
    return null
  })()

  const fieldName = plot && plot.name ? plot.name : '全部地块'
  const areaText = plot ? formatArea(plot.area) : '0'
  const locationLabel = location && location.inService
    ? `${location.name} · ${fieldName}`
    : `${location ? location.name : '喀什地区'} · ${fieldName}`

  const model = {
    fieldCount: options.fieldCount || 0,
    selectedIndex: options.selectedIndex || 0,
    selectedFieldLabel: fieldName,
    locationLabel,
    regionLabel: location ? (location.inService ? `${location.name}` : `${location.name}附近`) : '喀什地区',
    weather: {
      temp,
      desc: meta.desc,
      icon: meta.icon,
      high,
      low,
      wind: `${windDirection}风${windLevel}级`,
      humidity,
      groundTemp: clampRound(apparentTemperature, temp),
      rain,
      uv
    },
    forecast,
    alert,
    advices: stageAdvice(plot || {}, {
      temp,
      humidity,
      windLevel,
      rain
    }),
    summary: alert ? alert.summary : `当前体感温度 ${clampRound(apparentTemperature, temp)}°C，适合在上午完成巡田和滴灌。`,
    tipText: alert
      ? alert.sub
      : `体感温度稳定，建议优先处理 ${fieldName}${plot && plot.area ? `（${areaText}亩）` : ''} 的巡田和滴灌。`
  }

  return model
}

function buildWeatherFromApi(plot, payload, options = {}) {
  if (!payload) return buildWeatherForPlot(plot, options)
  const current = payload.current || payload.current_weather || {}
  const daily = payload.daily || {}
  return buildWeatherModelFromCurrent(plot, current, daily, options)
}

module.exports = { buildWeatherForPlot, buildWeatherFromApi, buildWeatherModelFromCurrent }