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

function formatHourLabel(value, fallbackDate, offset) {
  if (offset === 0) return '现在'
  const date = value ? new Date(value) : new Date(fallbackDate)
  if (!value) date.setHours(date.getHours() + offset)
  if (Number.isNaN(date.getTime())) return `${offset}小时后`
  return `${pad(date.getHours())}:00`
}

function formatArea(area) {
  const value = Number(area || 0)
  return value.toFixed(value % 1 === 0 ? 0 : 1)
}

function formatVisibility(value) {
  const meters = Number(value)
  if (!Number.isFinite(meters) || meters <= 0) return '--'
  if (meters >= 1000) return `${Number((meters / 1000).toFixed(meters >= 10000 ? 0 : 1))}km`
  return `${Math.round(meters)}m`
}

function normalizeWindDirection(direction, degree) {
  const numericDegree = Number(degree)
  if (Number.isFinite(numericDegree)) {
    return directionFromDegrees(numericDegree)
  }

  const text = String(direction || '')
  if (/东北/.test(text)) return '东北'
  if (/东南/.test(text)) return '东南'
  if (/西南/.test(text)) return '西南'
  if (/西北/.test(text)) return '西北'
  if (/正东|东/.test(text)) return '东'
  if (/正西|西/.test(text)) return '西'
  if (/正南|南/.test(text)) return '南'
  if (/正北|北/.test(text)) return '北'
  return '风'
}

function estimateCmaUvIndex({ temp = 0, humidity = 0, rainChance = 0, risk = 'clear', month = 7 }) {
  let uv = month >= 5 && month <= 8 ? 8 : 5
  if (risk === 'storm' || risk === 'rain') uv -= 4
  else if (risk === 'snow' || risk === 'fog') uv -= 5
  else if (risk === 'cloudy') uv -= 2

  if (temp >= 35) uv += 1
  if (humidity >= 70) uv -= 1
  if (rainChance >= 50) uv -= 1

  return clamp(Math.round(uv), 0, 11)
}

function estimateCmaVisibility({ humidity = 0, rainChance = 0, risk = 'clear' }) {
  let visibility = 18000

  if (risk === 'storm') visibility = 4000
  else if (risk === 'rain') visibility = 8000
  else if (risk === 'snow') visibility = 6000
  else if (risk === 'fog') visibility = 3000
  else if (risk === 'wind') visibility = 12000
  else if (risk === 'cloudy') visibility = 16000

  visibility -= Math.max(0, humidity - 40) * 120
  visibility -= Math.max(0, rainChance - 10) * 60

  return clamp(Math.round(visibility), 1000, 25000)
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
  } else {
    advice.push({
      icon: '🧴',
      bg: '#E8F5E9',
      title: weather.windLevel <= 3 && weather.rain <= 0 ? '适合打药' : '谨慎打药',
      sub: weather.windLevel <= 3 && weather.rain <= 0
        ? '未来数小时风力和降水条件较稳，可优先安排病虫害防治作业。'
        : '当前天气尚可，但需避开午后高温和阵风时段，喷药前再次查看风力。'
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
    title: daysSinceSow === null || daysSinceSow < 20 ? '播种出苗' : '棉苗管理',
    sub: daysSinceSow === null
      ? '请结合地块生育期安排管理，地温稳定时优先关注出苗和补苗。'
      : daysSinceSow < 35
        ? '当前处于苗期/返青阶段，优先稳苗促根，后续再安排追肥。'
        : '进入追肥窗口，可在清晨或傍晚少量多次补充氮磷钾复合肥。'
  })

  advice.push({
    icon: '🚁',
    bg: '#FFF9C4',
    title: '无人机作业',
    sub: weather.windLevel >= 4
      ? '风力偏大时不建议飞防和航拍，先安排人工巡田或地面机械作业。'
      : '风力适中，可安排无人机巡田或飞防，但仍需避开正午高温。'
  })

  return advice.slice(0, 4)
}

function buildForecast(baseDate, seed, baseTemp, season, humidity, windLevel, rainChance, days = 7) {
  return Array.from({ length: days }, (_, offset) => {
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

function buildHourlyForecast(baseDate, seed, baseTemp, humidity, windLevel, rainChance) {
  const now = new Date(baseDate)
  return Array.from({ length: 24 }, (_, offset) => {
    const rand = createRandom(seed + 3000 + offset * 31)
    const hourDate = new Date(now)
    hourDate.setHours(now.getHours() + offset)
    const hour = hourDate.getHours()
    const diurnal = Math.sin(((hour - 6) / 24) * Math.PI * 2)
    const temp = clamp(Math.round(baseTemp + diurnal * 4 + (rand() - 0.5) * 3), -10, 45)
    const nextHumidity = clamp(Math.round(humidity + (rand() - 0.5) * 14), 10, 95)
    const nextWind = clamp(Math.round(windLevel + (rand() - 0.5) * 2), 0, 7)
    const nextRain = clamp(Math.round(rainChance + (rand() - 0.5) * 18), 0, 100)
    const descriptor = pickWeatherDescriptor(temp, nextHumidity, nextWind, nextRain, rand())

    return {
      time: formatHourLabel(null, now, offset),
      icon: descriptor.icon,
      temp,
      wind: `${nextWind}级`,
      rainChance: nextRain,
      rainText: `${nextRain}%`,
      now: offset === 0
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
  const hourly = buildHourlyForecast(today, seed, temp, humidity, windLevel, rainChance)
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
    sourceInfo: {
      type: 'simulated',
      label: '模拟数据',
      desc: '天气接口不可用或未选择有效地块时，由本地模型按地块生成，仅供参考。'
    },
    weather: {
      temp,
      desc: descriptor.desc,
      icon: descriptor.icon,
      high,
      low,
      wind: `西北风${windNames[windLevel] || `${windLevel}级`}`,
      windLevel,
      humidity,
      groundTemp,
      groundTempLabel: '地温',
      rain,
      uv,
      pressure: 0,
      visibility: 0,
      visibilityText: '--'
    },
    forecast,
    hourly,
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

function weatherAlert({ temp, humidity, windLevel, rainChance, risk }) {
  if (risk === 'storm') {
    return {
      icon: '⛈',
      title: '雷暴预警',
      level: '黄色',
      sub: '当前或未来预报存在雷暴天气，暂停喷药、无人机和金属高架作业。',
      summary: '雷暴风险较高，建议避开露天作业。',
      agency: '棉管家气象助手',
      impactTime: '未来 24 小时',
      impactArea: '当前地块及周边棉田',
      actions: ['暂停无人机飞防和高杆作业', '检查排水沟渠，避免短时强降雨积水', '雷暴结束后再补做喷药和施肥']
    }
  }
  if (windLevel >= 5) {
    return {
      icon: '⚠️',
      title: '大风预警',
      level: windLevel >= 7 ? '橙色' : '黄色',
      sub: '预计风力 5-6 级，喷药、无人机和高杆作业需避开强风时段。',
      summary: '今天风力偏大，优先安排巡田和低风险作业。',
      agency: '棉管家气象助手',
      impactTime: '未来 24 小时',
      impactArea: '当前地块及周边棉田',
      actions: ['停止无人机飞防和航拍', '暂缓喷药，避免药液漂移', '加固棚膜、滴灌首部和临时设施']
    }
  }
  if (rainChance >= 45 || risk === 'rain' || risk === 'snow') {
    return {
      icon: '🌧',
      title: '降雨提醒',
      level: rainChance >= 70 ? '橙色' : '蓝色',
      sub: '未来 48 小时内有降雨概率，露天喷药和施肥建议提前完成。',
      summary: '天气转湿，建议把喷药作业安排在降雨前。',
      agency: '棉管家气象助手',
      impactTime: '未来 48 小时',
      impactArea: '当前地块及周边棉田',
      actions: ['雨前完成必要喷药，留出药效吸收时间', '检查低洼地块排水', '雨后再评估补肥和病害风险']
    }
  }
  if (temp >= 36) {
    return {
      icon: '🌡',
      title: '高温预警',
      level: temp >= 40 ? '橙色' : '黄色',
      sub: '午后高温明显，注意滴灌保墒并避开正午长时间作业。',
      summary: '高温持续，建议分次滴灌并减少中午田间作业。',
      agency: '棉管家气象助手',
      impactTime: '今日 12:00-18:00',
      impactArea: '当前地块及周边棉田',
      actions: ['将巡田和打药安排在清晨或傍晚', '采用小水勤灌保持墒情', '关注棉苗萎蔫和落蕾迹象']
    }
  }
  if (humidity <= 24) {
    return {
      icon: '💧',
      title: '干旱提醒',
      level: '提示',
      sub: '空气湿度偏低，棉田蒸散较快，建议适当提前灌溉。',
      summary: '当前空气偏干，优先查看墒情并安排保墒。',
      agency: '棉管家气象助手',
      impactTime: '未来 24 小时',
      impactArea: '当前地块及周边棉田',
      actions: ['优先查看墒情较差地块', '适当提前滴灌并减少单次水量', '覆盖或中耕保墒，降低蒸发']
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

function pickArrayValue(list, index, fallback) {
  return Array.isArray(list) && index >= 0 && index < list.length ? list[index] : fallback
}

function buildHourlyFromApi(hourly, current, fallback) {
  const times = Array.isArray(hourly && hourly.time) ? hourly.time : []
  if (!times.length) {
    return buildHourlyForecast(
      fallback.today || new Date(),
      fallback.seed || 1,
      fallback.temp || 0,
      fallback.humidity || 45,
      fallback.windLevel || 2,
      fallback.rainChance || 0
    )
  }

  const currentTime = current && current.time ? new Date(current.time).getTime() : Date.now()
  let startIndex = times.findIndex(time => {
    const value = new Date(time).getTime()
    return Number.isFinite(value) && value >= currentTime - 30 * 60 * 1000
  })
  if (startIndex < 0) startIndex = 0

  return times.slice(startIndex, startIndex + 24).map((time, offset) => {
    const sourceIndex = startIndex + offset
    const temp = clampRound(pickArrayValue(hourly.temperature_2m, sourceIndex, fallback.temp), fallback.temp || 0)
    const humidity = clampRound(pickArrayValue(hourly.relative_humidity_2m, sourceIndex, fallback.humidity), fallback.humidity || 45)
    const code = clampRound(pickArrayValue(hourly.weather_code, sourceIndex, current && current.weather_code), current && current.weather_code)
    const rainChance = clampRound(pickArrayValue(hourly.precipitation_probability, sourceIndex, fallback.rainChance), fallback.rainChance || 0)
    const windSpeed = Number(pickArrayValue(hourly.wind_speed_10m, sourceIndex, 0))
    const windLevel = windLevelFromSpeed(windSpeed)
    const windDirection = directionFromDegrees(pickArrayValue(hourly.wind_direction_10m, sourceIndex, current && current.wind_direction_10m))
    const meta = weatherCodeMeta(code)

    return {
      time: formatHourLabel(time, fallback.today || new Date(), offset),
      icon: meta.icon || pickWeatherDescriptor(temp, humidity, windLevel, rainChance, 0.5).icon,
      temp,
      wind: `${windDirection}${windLevel}级`,
      rainChance,
      rainText: `${rainChance}%`,
      now: offset === 0
    }
  })
}

function buildWeatherModelFromCurrent(plot, current, daily, hourly = {}, options = {}) {
  if (hourly && !Array.isArray(hourly.time) && (
    Object.prototype.hasOwnProperty.call(hourly, 'fieldCount') ||
    Object.prototype.hasOwnProperty.call(hourly, 'selectedIndex') ||
    Object.prototype.hasOwnProperty.call(hourly, 'today')
  )) {
    options = hourly
    hourly = {}
  }
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
  const soilTemperature = Number.isFinite(Number(current && current.soil_temperature_0cm))
    ? Number(current.soil_temperature_0cm)
    : (Number.isFinite(Number(current && current.apparent_temperature)) ? Number(current.apparent_temperature) : temp + 3)
  const pressure = clampRound(current && current.surface_pressure, 0)
  const visibility = clampRound(current && current.visibility, 0)
  const high = clampRound(daily && daily.temperature_2m_max ? daily.temperature_2m_max[0] : temp + 4, temp + 4)
  const low = clampRound(daily && daily.temperature_2m_min ? daily.temperature_2m_min[0] : temp - 4, temp - 4)
  const uv = clampRound(current && current.uv_index, daily && daily.uv_index_max ? daily.uv_index_max[0] : 0)
  const forecast = Array.isArray(daily && daily.time) ? daily.time.slice(0, 7).map((day, index) => {
    const code = clampRound(daily.weather_code && daily.weather_code[index], currentCode)
    const dayMeta = weatherCodeMeta(code)
    const dayHigh = clampRound(daily.temperature_2m_max && daily.temperature_2m_max[index], high)
    const dayLow = clampRound(daily.temperature_2m_min && daily.temperature_2m_min[index], low)
    const dayWind = clampRound(daily.wind_speed_10m_max && daily.wind_speed_10m_max[index], windSpeed || 0)
    const dayRain = clampRound(daily.precipitation_probability_max && daily.precipitation_probability_max[index], rainChance)
    return {
      day: index === 0 ? '今天' : index === 1 ? '明天' : index === 2 ? '后天' : `${new Date(day).getMonth() + 1}月${new Date(day).getDate()}日`,
      icon: forecastIcon(code, dayHigh, humidity, dayRain),
      high: dayHigh,
      low: dayLow,
      wind: `${windDirection}风${windLevelFromSpeed(dayWind)}级`
    }
  }) : []
  const hourlyForecast = buildHourlyFromApi(hourly || {}, current || {}, {
    today,
    seed: hashString(`${plot && plot.id ? plot.id : plot && plot.name ? plot.name : 'plot'}|api-hourly`),
    temp,
    humidity,
    windLevel,
    rainChance
  })

  const alert = weatherAlert({ temp, humidity, windLevel, rainChance, risk: meta.risk })

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
    sourceInfo: {
      type: 'real',
      label: '实时数据',
      desc: '来自后端实时天气接口，按当前地块中心坐标获取。'
    },
    weather: {
      temp,
      desc: meta.desc,
      icon: meta.icon,
      high,
      low,
      wind: `${windDirection}风${windLevel}级`,
      windLevel,
      humidity,
      groundTemp: clampRound(soilTemperature, temp),
      groundTempLabel: '地温',
      rain,
      uv,
      pressure,
      visibility,
      visibilityText: formatVisibility(visibility)
    },
    forecast,
    hourly: hourlyForecast,
    alert,
    advices: stageAdvice(plot || {}, {
      temp,
      humidity,
      windLevel,
      rain
    }),
    summary: alert ? alert.summary : `当前地温 ${clampRound(soilTemperature, temp)}°C，适合在上午完成巡田和滴灌。`,
    tipText: alert
      ? alert.sub
      : `地温稳定，建议优先处理 ${fieldName}${plot && plot.area ? `（${areaText}亩）` : ''} 的巡田和滴灌。`
  }

  return model
}

function pickFirstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '')
}

function cmaWeatherMeta(code, text = '') {
  const known = {
    0: { desc: '晴', icon: '☀️', risk: 'clear' },
    1: { desc: '多云', icon: '🌤', risk: 'cloudy' },
    2: { desc: '阴', icon: '☁️', risk: 'cloudy' },
    3: { desc: '阵雨', icon: '🌦', risk: 'rain' },
    4: { desc: '雷阵雨', icon: '⛈', risk: 'storm' },
    5: { desc: '雷阵雨伴有冰雹', icon: '⛈', risk: 'storm' },
    6: { desc: '雨夹雪', icon: '🌧', risk: 'rain' },
    7: { desc: '小雨', icon: '🌧', risk: 'rain' },
    8: { desc: '中雨', icon: '🌧', risk: 'rain' },
    9: { desc: '大雨', icon: '🌧', risk: 'rain' },
    10: { desc: '暴雨', icon: '🌧', risk: 'rain' },
    11: { desc: '大暴雨', icon: '🌧', risk: 'rain' },
    12: { desc: '特大暴雨', icon: '🌧', risk: 'rain' },
    13: { desc: '阵雪', icon: '🌨', risk: 'snow' },
    14: { desc: '小雪', icon: '❄️', risk: 'snow' },
    15: { desc: '中雪', icon: '❄️', risk: 'snow' },
    16: { desc: '大雪', icon: '❄️', risk: 'snow' },
    17: { desc: '暴雪', icon: '❄️', risk: 'snow' },
    18: { desc: '雾', icon: '🌫', risk: 'fog' },
    19: { desc: '冻雨', icon: '🌧', risk: 'rain' },
    20: { desc: '沙尘暴', icon: '🌫', risk: 'wind' },
    21: { desc: '小到中雨', icon: '🌧', risk: 'rain' },
    22: { desc: '中到大雨', icon: '🌧', risk: 'rain' },
    23: { desc: '大到暴雨', icon: '🌧', risk: 'rain' },
    24: { desc: '暴雨到大暴雨', icon: '🌧', risk: 'rain' },
    25: { desc: '大暴雨到特大暴雨', icon: '🌧', risk: 'rain' },
    26: { desc: '小到中雪', icon: '❄️', risk: 'snow' },
    27: { desc: '中到大雪', icon: '❄️', risk: 'snow' },
    28: { desc: '大到暴雪', icon: '❄️', risk: 'snow' },
    29: { desc: '浮尘', icon: '🌫', risk: 'fog' },
    30: { desc: '扬沙', icon: '🌫', risk: 'wind' },
    31: { desc: '强沙尘暴', icon: '🌫', risk: 'wind' },
    53: { desc: '霾', icon: '🌫', risk: 'fog' }
  }
  const fallback = known[Number(code)] || { desc: '天气', icon: '🌤', risk: 'clear' }
  const desc = String(text || fallback.desc || '天气')
  if (/雷|冰雹/.test(desc)) return { desc, icon: '⛈', risk: 'storm' }
  if (/雪/.test(desc)) return { desc, icon: '❄️', risk: 'snow' }
  if (/雨/.test(desc)) return { desc, icon: '🌧', risk: 'rain' }
  if (/沙|尘/.test(desc)) return { desc, icon: '🌫', risk: 'wind' }
  if (/雾|霾/.test(desc)) return { desc, icon: '🌫', risk: 'fog' }
  if (/阴/.test(desc)) return { desc, icon: '☁️', risk: 'cloudy' }
  if (/云/.test(desc)) return { desc, icon: '🌤', risk: 'cloudy' }
  if (/晴/.test(desc)) return { desc, icon: '☀️', risk: 'clear' }
  return { desc, icon: fallback.icon, risk: fallback.risk }
}

function parseWindScale(value) {
  const text = String(value || '')
  if (/微风/.test(text)) return null
  const matched = text.match(/\d+/g)
  if (!matched) return null
  return clamp(Math.max(...matched.map(Number)), 0, 12)
}

function windLevelFromCma(now) {
  const fromScale = parseWindScale(now && now.windScale)
  if (fromScale !== null) return fromScale
  const speed = Number(now && now.windSpeed)
  if (Number.isFinite(speed)) return windLevelFromSpeed(speed * 3.6)
  return 0
}

function formatCmaWind(direction, scale, fallbackLevel) {
  const dir = String(direction || '')
  const scaleText = String(scale || '').trim()
  if (scaleText) {
    if (scaleText === '微风') {
      return `${dir ? `${dir}风` : '风力'}${fallbackLevel || 0}级`
    }
    if (scaleText.includes('级')) {
      return `${dir ? `${dir}风` : ''}${scaleText}`
    }
    return `${dir ? `${dir}风` : '风力'}${scaleText}级`
  }
  return `${dir ? `${dir}风` : '风力'}${fallbackLevel || 0}级`
}

function parseCmaDate(value) {
  const text = String(value || '').replace(/\//g, '-')
  const date = text ? new Date(`${text}T00:00:00`) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function formatCmaDayLabel(value, index, today) {
  if (index <= 2) return formatDayLabel(today, index)
  const date = parseCmaDate(value)
  if (!date) return formatDayLabel(today, index)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function cmaRainChance(meta, rain) {
  if (Number(rain) > 0) return 80
  if (meta.risk === 'storm') return 70
  if (meta.risk === 'rain') return 48
  if (meta.risk === 'snow') return 42
  return meta.risk === 'cloudy' ? 18 : 8
}

function cmaAlertIcon(type) {
  const text = String(type || '')
  if (/高温/.test(text)) return '🌡'
  if (/雷|暴雨|冰雹/.test(text)) return '⛈'
  if (/大风|沙|尘/.test(text)) return '⚠️'
  if (/寒|雪|冻/.test(text)) return '❄️'
  return '⚠️'
}

function cmaAlertActions(type) {
  const text = String(type || '')
  if (/高温/.test(text)) {
    return ['避开正午高温时段巡田和喷药', '检查滴灌首部和田间墒情', '关注棉苗萎蔫、落蕾和日灼风险']
  }
  if (/大风|沙|尘/.test(text)) {
    return ['暂停无人机、喷药和高架作业', '加固棚膜、滴灌首部和临时设施', '大风结束后再检查倒伏和机械损伤']
  }
  if (/雷|暴雨|冰雹/.test(text)) {
    return ['暂停露天喷药、无人机和金属高架作业', '提前检查排水沟渠和低洼地块', '强对流结束后再评估补肥和病虫害风险']
  }
  if (/寒|雪|冻/.test(text)) {
    return ['关注低温对苗情和花铃期的影响', '必要时提前完成保温和排水准备', '低温结束后再安排追肥和喷药']
  }
  return ['根据预警级别调整露天农事作业', '喷药和无人机作业前复核风力与降水', '关注田间排水、设施加固和人员安全']
}

function sanitizeCmaTitle(value) {
  return String(value || '').replace(/\[[^\]]+\]/g, '').trim()
}

function buildCmaOfficialAlert(alarm, station) {
  if (!alarm) return null
  const signalType = alarm.signaltype || alarm.eventType || ''
  const title = signalType ? `${signalType}预警` : sanitizeCmaTitle(alarm.title) || '气象预警'
  const level = alarm.signallevel || alarm.severity || ''
  const sub = sanitizeCmaTitle(alarm.title) || `${station && station.name ? station.name : '当地'}发布气象预警`
  return {
    icon: cmaAlertIcon(`${signalType}${sub}`),
    title,
    level,
    sub,
    summary: `${title}${level ? `·${level}` : ''}，请及时调整田间作业安排。`,
    agency: '中国气象局',
    impactTime: alarm.effective || '当前',
    impactArea: station && station.name ? `${station.name}站周边` : '当前地块周边',
    actions: cmaAlertActions(`${signalType}${sub}`)
  }
}

function buildWeatherModelFromCma(plot, payload, options = {}) {
  const today = options.today || new Date()
  const currentData = payload.current || {}
  const forecastData = payload.forecast || {}
  const now = currentData.now || forecastData.now || {}
  const daily = Array.isArray(forecastData.daily) ? forecastData.daily : []
  const firstDay = daily[0] || {}
  const station = payload.station || {}
  const meta = cmaWeatherMeta(pickFirstDefined(firstDay.dayCode, firstDay.nightCode), firstDay.dayText || firstDay.nightText)
  const temp = clampRound(now.temperature, clampRound((Number(firstDay.high) + Number(firstDay.low)) / 2, 0))
  const humidity = clampRound(now.humidity, 45)
  const windLevel = windLevelFromCma(now)
  const windDirection = normalizeWindDirection(now.windDirection || firstDay.dayWindDirection || '', now.windDirectionDegree)
  const wind = formatCmaWind(windDirection, now.windScale, windLevel)
  const rain = Number.isFinite(Number(now.precipitation)) ? Number(Number(now.precipitation).toFixed(1)) : 0
  const rainChance = cmaRainChance(meta, rain)
  const high = clampRound(firstDay.high, temp + 4)
  const low = clampRound(firstDay.low, temp - 4)
  const feelsLike = clampRound(now.feelst, temp)
  const pressure = clampRound(now.pressure, 0)
  const uv = estimateCmaUvIndex({
    temp,
    humidity,
    rainChance,
    risk: meta.risk,
    month: today.getMonth() + 1
  })
  const visibility = estimateCmaVisibility({
    humidity,
    rainChance,
    risk: meta.risk
  })
  const forecast = daily.slice(0, 7).map((day, index) => {
    const dayMeta = cmaWeatherMeta(pickFirstDefined(day.dayCode, day.nightCode), day.dayText || day.nightText)
    const dayHigh = clampRound(day.high, high)
    const dayLow = clampRound(day.low, low)
    const dayWindScale = day.dayWindScale || day.nightWindScale || ''
    const dayWindDirection = day.dayWindDirection || day.nightWindDirection || ''
    const dayWindLevel = parseWindScale(dayWindScale)
    return {
      day: formatCmaDayLabel(day.date, index, today),
      icon: dayMeta.icon,
      high: dayHigh,
      low: dayLow,
      wind: formatCmaWind(normalizeWindDirection(dayWindDirection, null), dayWindScale, dayWindLevel === null ? windLevel : dayWindLevel)
    }
  })

  const seed = hashString(`${plot && plot.id ? plot.id : plot && plot.name ? plot.name : 'plot'}|cma-hourly|${station.id || ''}`)
  const hourly = buildHourlyForecast(today, seed, temp, humidity, windLevel, rainChance)
  if (hourly.length) {
    hourly[0] = {
      ...hourly[0],
      icon: meta.icon,
      temp,
      wind,
      rainChance,
      rainText: `${rainChance}%`
    }
  }

  const officialAlarms = [
    ...(Array.isArray(currentData.alarm) ? currentData.alarm : []),
    ...(Array.isArray(forecastData.alarm) ? forecastData.alarm : [])
  ]
  const alert = buildCmaOfficialAlert(officialAlarms[0], station) ||
    weatherAlert({ temp, humidity, windLevel, rainChance, risk: meta.risk })

  const fieldName = plot && plot.name ? plot.name : '全部地块'
  const areaText = plot ? formatArea(plot.area) : '0'
  const stationName = station.name ? `${station.name}站` : '中国气象局站点'
  const locationLabel = `${stationName} · ${fieldName}`

  return {
    fieldCount: options.fieldCount || 0,
    selectedIndex: options.selectedIndex || 0,
    selectedFieldLabel: fieldName,
    locationLabel,
    regionLabel: stationName,
    sourceInfo: {
      type: 'real',
      label: '中国气象局',
      desc: `实况、预警和7日预报来自中国气象局${station.name ? ` ${station.name}站` : ''}；逐小时趋势为本地估算。`
    },
    weather: {
      temp,
      desc: meta.desc,
      icon: meta.icon,
      high,
      low,
      wind,
      windLevel,
      humidity,
      groundTemp: feelsLike,
      groundTempLabel: '体感',
      rain,
      uv,
      pressure,
      visibility,
      visibilityText: formatVisibility(visibility)
    },
    forecast,
    hourly,
    alert,
    advices: stageAdvice(plot || {}, {
      temp,
      humidity,
      windLevel,
      rain
    }),
    summary: alert ? alert.summary : `当前体感温度 ${feelsLike}°C，适合在上午完成巡田和滴灌。`,
    tipText: alert
      ? alert.sub
      : `天气相对稳定，建议优先处理 ${fieldName}${plot && plot.area ? `（${areaText}亩）` : ''} 的巡田和滴灌。`
  }
}

function buildWeatherFromApi(plot, payload, options = {}) {
  if (!payload) return buildWeatherForPlot(plot, options)
  if (payload.provider === 'cma') return buildWeatherModelFromCma(plot, payload, options)
  const current = payload.current || payload.current_weather || {}
  const daily = payload.daily || {}
  const hourly = payload.hourly || {}
  return buildWeatherModelFromCurrent(plot, current, daily, hourly, options)
}

module.exports = { buildWeatherForPlot, buildWeatherFromApi, buildWeatherModelFromCurrent, buildWeatherModelFromCma }
