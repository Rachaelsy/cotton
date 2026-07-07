const { normalizeCoordinates, calculateCenter } = require('./plot-geometry')
const { locateService } = require('./regions')
const i18n = require('./i18n')

function parseCoordinates(value) {
  if (Array.isArray(value)) return normalizeCoordinates(value)
  if (!value) return []
  try {
    return normalizeCoordinates(JSON.parse(value))
  } catch (error) {
    return []
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

function stageAdvice(plot, weather) {
  const area = Number(plot.area || 0)
  const baseIrrigation = Math.max(20, Math.round(area * 30))
  const sowDate = plot.sow_date ? new Date(`${String(plot.sow_date).slice(0, 10)}T00:00:00`) : null
  const today = weather.today instanceof Date ? weather.today : new Date()
  const daysSinceSow = sowDate && !Number.isNaN(sowDate.getTime())
    ? Math.max(0, Math.floor((today.getTime() - sowDate.getTime()) / 86400000))
    : null
  const temp = Number(weather.temp)
  const high = Number.isFinite(Number(weather.high)) ? Number(weather.high) : temp
  const humidity = Number(weather.humidity)
  const windLevel = Number(weather.windLevel || 0)
  const rain = Number(weather.rain || 0)
  const groundTemp = Number(weather.groundTemp)
  const uv = Number(weather.uv)
  const alertTitle = weather.alert && weather.alert.title ? String(weather.alert.title) : ''
  const isHot = temp >= 35 || high >= 35 || uv >= 8
  const isDry = humidity <= 32 || groundTemp >= 33
  const isWet = humidity >= 75 || rain >= 5
  const isStrongRain = rain >= 8 || /强降水|雷暴/.test(alertTitle)
  const isWindy = windLevel >= 4 || /大风/.test(alertTitle)
  const isDangerous = isStrongRain || windLevel >= 5 || /雷暴|强降水|大风/.test(alertTitle)
  const growthStage = daysSinceSow === null
    ? { key: 'unknown', title: '生育期巡查' }
    : daysSinceSow < 20
      ? { key: 'emergence', title: '播种出苗' }
      : daysSinceSow < 45
        ? { key: 'seedling', title: '苗期稳苗' }
        : daysSinceSow < 65
          ? { key: 'bud', title: '蕾期管理' }
          : daysSinceSow < 105
            ? { key: 'flowerboll', title: '花铃期管理' }
            : { key: 'bollopen', title: '吐絮期管理' }

  const candidates = []
  let order = 0
  const addAdvice = (priority, item) => {
    candidates.push({ priority, order: order += 1, ...item })
  }

  if (isDangerous) {
    addAdvice(110, {
      icon: '🚫',
      bg: '#FFF3E6',
      title: '暂停露天高风险作业',
      sub: isStrongRain
        ? '地块中心预报存在雷暴或较强降水风险，暂停喷药、无人机、金属高架和露天强体力作业。'
        : '风力偏大时喷药易漂移、无人机飞防风险高，等待风力减弱后再安排。'
    })
  }

  if (isHot) {
    addAdvice(100, {
      icon: '🌡',
      bg: '#FFF3E6',
      title: '高温错峰作业',
      sub: '高温或强紫外线时段尽量避开正午作业，巡田、打药和追肥安排在清晨或傍晚。'
    })
  }

  if (isStrongRain) {
    addAdvice(95, {
      icon: '🌧',
      bg: '#E3F2FD',
      title: '排水巡田',
      sub: '降水偏强时先检查低洼地、排水沟和田埂，雨后再评估补肥、补苗和病害风险。'
    })
  } else if (isHot || isDry) {
    addAdvice(90, {
      icon: '💧',
      bg: '#E3F2FD',
      title: '滴灌保墒',
      sub: `温度偏高或空气偏干，建议分次滴灌保墒，参考用水约 ${formatArea(baseIrrigation)} 立方米，并观察棉苗萎蔫。`
    })
  } else {
    addAdvice(70, {
      icon: '💧',
      bg: '#E3F2FD',
      title: '墒情巡查',
      sub: '当前蒸散压力不高，保持既有滴灌节奏，巡田时重点查看膜下湿度和沟边积水。'
    })
  }

  if (isHot && isDry) {
    addAdvice(80, {
      icon: '🔍',
      bg: '#FFF9C4',
      title: '红蜘蛛巡查',
      sub: '高温干燥容易加重红蜘蛛和蚜虫发生，巡田时翻看叶背，重点查田边、路边和弱苗区域。'
    })
  } else if (isWet) {
    addAdvice(80, {
      icon: '🦠',
      bg: '#E8F5E9',
      title: '病害巡查',
      sub: '湿度或降水偏高时注意枯黄萎蔫、叶斑和烂铃迹象，雨后优先查看通风差和低洼地块。'
    })
  } else {
    addAdvice(50, {
      icon: '🔍',
      bg: '#E8F5E9',
      title: '病虫害巡查',
      sub: '天气条件总体平稳，按常规巡查蚜虫、红蜘蛛和棉铃虫，发现中心株后及时处理。'
    })
  }

  if (growthStage.key === 'bud' || growthStage.key === 'flowerboll') {
    addAdvice(75, {
      icon: '🌿',
      bg: '#E8F5E9',
      title: growthStage.key === 'flowerboll' ? '花铃期追肥窗口' : '蕾期追肥窗口',
      sub: isDangerous
        ? '当前有高风险天气，追肥和化控暂缓，待降水、风力或雷暴风险结束后再随水少量多次追施。'
        : '处于需肥关键期，可在清晨或傍晚随水少量多次追施氮钾肥，避免正午高温集中作业。'
    })
  } else {
    addAdvice(60, {
      icon: '🌿',
      bg: '#E8F5E9',
      title: growthStage.title,
      sub: growthStage.key === 'unknown'
        ? '请补充播种日期，系统可按生育期给出更精确的水肥和植保窗口。'
        : growthStage.key === 'emergence'
          ? '重点关注出苗整齐度、缺苗断垄和低温地温变化，地温稳定后再安排补苗。'
          : growthStage.key === 'seedling'
            ? '苗期以稳苗促根为主，避免大水漫灌和过早重追肥。'
            : '吐絮期以控水、防烂铃和采收窗口为主，降雨前后加强通风和排水。'
    })
  }

  addAdvice(isWindy || rain > 0.5 ? 45 : 65, {
    icon: '🧴',
    bg: '#E8F5E9',
    title: isWindy || rain > 0.5 ? '植保作业暂缓' : '植保作业窗口',
    sub: isWindy || rain > 0.5
      ? '喷药前需再次确认风力和降水，避免药液漂移、雨水冲刷和药效下降。'
      : '风力和降水条件较稳，可优先安排病虫害防治，但仍需避开正午高温。'
  })

  addAdvice(isWindy ? 35 : 55, {
    icon: '🚁',
    bg: '#FFF9C4',
    title: isWindy ? '无人机飞防暂缓' : '无人机巡田窗口',
    sub: isWindy
      ? '风力偏大时不建议飞防和航拍，先安排人工巡田或地面机械作业。'
      : '风力适中，可安排无人机巡田或飞防，作业前仍需确认地块周边障碍物。'
  })

  return candidates
    .sort((a, b) => b.priority - a.priority || a.order - b.order)
    .slice(0, 4)
    .map(({ priority, order: itemOrder, ...item }) => item)
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

function forecastIcon(code) {
  const meta = weatherCodeMeta(code)
  return meta.icon
}

function pickArrayValue(list, index, fallback) {
  return Array.isArray(list) && index >= 0 && index < list.length ? list[index] : fallback
}

function buildHourlyFromApi(hourly, current, fallback) {
  const times = Array.isArray(hourly && hourly.time) ? hourly.time : []
  if (!times.length) {
    return []
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
      icon: meta.icon,
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
    temp,
    humidity,
    windLevel,
    rainChance
  })

  const alert = null

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
      high,
      low,
      humidity,
      windLevel,
      rain,
      groundTemp: clampRound(soilTemperature, temp),
      uv,
      alert,
      today
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
  const matched = String(value || '').match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (!matched) return null
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function localDateStart(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function cmaDateOffset(baseDate, targetDate) {
  const base = localDateStart(baseDate)
  const target = localDateStart(targetDate)
  if (!base || !target) return null
  return Math.round((target.getTime() - base.getTime()) / 86400000)
}

function alignCmaDailyForecast(daily, today) {
  if (!Array.isArray(daily) || !daily.length) return []
  const entries = daily.map(day => ({
    day,
    offset: cmaDateOffset(today, parseCmaDate(day && day.date))
  }))
  const firstTodayOrFuture = entries.findIndex(entry => entry.offset !== null && entry.offset >= 0)
  if (firstTodayOrFuture === -1) return daily
  return entries.slice(firstTodayOrFuture).map(entry => entry.day)
}

function formatCmaDayLabel(value, index, today) {
  const date = parseCmaDate(value)
  if (!date) return formatDayLabel(today, index)
  const offset = cmaDateOffset(today, date)
  if (offset !== null && offset >= 0 && offset <= 2) return formatDayLabel(today, offset)
  if (offset !== null && offset < 0) return formatDayLabel(today, index)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function parseLocalDateTime(value) {
  const matched = String(value || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2})(?::(\d{1,2}))?/)
  if (matched) {
    return new Date(
      Number(matched[1]),
      Number(matched[2]) - 1,
      Number(matched[3]),
      Number(matched[4]),
      Number(matched[5] || 0)
    )
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function roundRealValue(value, digits = 0) {
  const number = finiteNumber(value)
  if (number === null) return '--'
  const fixed = Number(number.toFixed(digits))
  return digits === 0 ? Math.round(fixed) : fixed
}

function formatRainAmount(value) {
  const number = finiteNumber(value)
  if (number === null) return '--'
  return `${Number(number.toFixed(number >= 10 ? 0 : 1))}mm`
}

function cmaModelHourlyData(modelForecast) {
  return modelForecast && modelForecast.hourly && Array.isArray(modelForecast.hourly.time)
    ? modelForecast.hourly
    : null
}

function findHourlyStartIndex(times, today) {
  const currentTime = today instanceof Date ? today.getTime() : new Date(today).getTime()
  const threshold = Number.isFinite(currentTime) ? currentTime - 30 * 60 * 1000 : Date.now() - 30 * 60 * 1000
  const startIndex = times.findIndex(time => {
    const date = parseLocalDateTime(time)
    return date && date.getTime() >= threshold
  })
  return startIndex >= 0 ? startIndex : 0
}

function readCmaModelHour(modelForecast, index) {
  const hourly = cmaModelHourlyData(modelForecast)
  if (!hourly || index < 0 || index >= hourly.time.length) return null
  return {
    time: hourly.time[index],
    temp: finiteNumber(pickArrayValue(hourly.temperature_2m, index, null)),
    humidity: finiteNumber(pickArrayValue(hourly.relative_humidity_2m, index, null)),
    precipitation: finiteNumber(pickArrayValue(hourly.precipitation, index, null)),
    weatherCode: finiteNumber(pickArrayValue(hourly.weather_code, index, null)),
    windSpeed: finiteNumber(pickArrayValue(hourly.wind_speed_10m, index, null)),
    windDirection: finiteNumber(pickArrayValue(hourly.wind_direction_10m, index, null)),
    visibility: finiteNumber(pickArrayValue(hourly.visibility, index, null)),
    pressure: finiteNumber(pickArrayValue(hourly.surface_pressure, index, null)),
    soilTemperature: finiteNumber(
      pickArrayValue(hourly.soil_temperature_0_to_10cm, index,
        pickArrayValue(hourly.soil_temperature_0cm, index, null))
    )
  }
}

function buildCmaModelHourlyForecast(modelForecast, today) {
  const hourly = cmaModelHourlyData(modelForecast)
  if (!hourly) return []
  const startIndex = findHourlyStartIndex(hourly.time, today)
  const forecast = []

  for (let index = startIndex; index < hourly.time.length && forecast.length < 12; index += 2) {
    const item = readCmaModelHour(modelForecast, index)
    if (!item) continue
    const meta = item.weatherCode === null ? { icon: '--' } : weatherCodeMeta(item.weatherCode)
    const windLevel = item.windSpeed === null ? null : windLevelFromSpeed(item.windSpeed)
    const wind = windLevel === null
      ? '--'
      : `${item.windDirection === null ? '' : directionFromDegrees(item.windDirection)}${windLevel}级`

    forecast.push({
      time: forecast.length === 0 ? formatHourLabel(item.time, today, 0) : formatHourLabel(item.time, today, forecast.length * 2),
      icon: meta.icon || '--',
      temp: roundRealValue(item.temp),
      wind,
      rainChance: null,
      rainText: formatRainAmount(item.precipitation),
      now: forecast.length === 0
    })
  }

  return forecast
}

function cmaModelDailyUv(modelForecast, today) {
  const daily = modelForecast && modelForecast.daily
  const times = Array.isArray(daily && daily.time) ? daily.time : []
  const values = Array.isArray(daily && daily.uv_index_max) ? daily.uv_index_max : []
  if (!times.length || !values.length) return '--'
  const todayKey = localDateStart(today)
  const index = times.findIndex(time => {
    const date = parseCmaDate(time)
    return date && todayKey && date.getTime() === todayKey.getTime()
  })
  const value = values[index >= 0 ? index : 0]
  return roundRealValue(value)
}

function dailyValue(daily, field, index = 0) {
  return finiteNumber(Array.isArray(daily && daily[field]) ? daily[field][index] : null)
}

function hourlyValuesForDate(modelForecast, today, field) {
  const hourly = cmaModelHourlyData(modelForecast)
  const todayStart = localDateStart(today)
  if (!hourly || !todayStart || !Array.isArray(hourly[field])) return []
  return hourly.time
    .map((time, index) => {
      const date = parseLocalDateTime(time)
      const value = finiteNumber(hourly[field][index])
      return date && cmaDateOffset(todayStart, date) === 0 && value !== null ? value : null
    })
    .filter(value => value !== null)
}

function buildOpenMeteoCmaForecast(modelForecast, today, high, low, windLevel) {
  const daily = modelForecast && modelForecast.daily
  const times = Array.isArray(daily && daily.time) ? daily.time : []
  return times.slice(0, 7).map((day, index) => {
    const code = dailyValue(daily, 'weather_code', index)
    const meta = weatherCodeMeta(code)
    const dayHigh = roundRealValue(dailyValue(daily, 'temperature_2m_max', index))
    const dayLow = roundRealValue(dailyValue(daily, 'temperature_2m_min', index))
    const windSpeed = dailyValue(daily, 'wind_speed_10m_max', index)
    const windDirection = dailyValue(daily, 'wind_direction_10m_dominant', index)
    const dayWindLevel = windSpeed === null ? windLevel : windLevelFromSpeed(windSpeed)
    return {
      day: formatCmaDayLabel(day, index, today),
      icon: meta.icon,
      high: dayHigh === '--' ? high : dayHigh,
      low: dayLow === '--' ? low : dayLow,
      wind: `${windDirection === null ? '' : directionFromDegrees(windDirection)}${dayWindLevel}级`
    }
  })
}

function maxFinite(values) {
  const nums = (values || []).map(finiteNumber).filter(value => value !== null)
  return nums.length ? Math.max(...nums) : null
}

function cmaModelRiskAlert(modelForecast, today, fieldName) {
  const hourly = cmaModelHourlyData(modelForecast)
  if (!hourly) return null
  const startIndex = findHourlyStartIndex(hourly.time, today)
  const endIndex = Math.min(startIndex + 24, hourly.time.length)
  const slice = (field) => Array.isArray(hourly[field]) ? hourly[field].slice(startIndex, endIndex) : []
  const codes = slice('weather_code').map(Number).filter(Number.isFinite)
  const maxPrecip = maxFinite(slice('precipitation'))
  const maxWind = maxFinite(slice('wind_speed_10m'))
  const maxTemp = maxFinite(slice('temperature_2m'))
  const dailyPrecip = maxFinite(modelForecast && modelForecast.daily && modelForecast.daily.precipitation_sum)
  const area = `${fieldName}地块中心周边`

  if (codes.some(code => [95, 96, 99].includes(code))) {
    return {
      icon: '⛈',
      title: '雷暴风险',
      level: '模型风险',
      sub: '地块中心坐标预报出现雷暴天气码，暂停喷药、无人机和金属高架作业。',
      summary: '未来 24 小时存在雷暴风险，建议避开露天高风险作业。',
      agency: 'CMA GRAPES模型风险提示',
      impactTime: '未来 24 小时',
      impactArea: area,
      actions: ['暂停无人机飞防和高杆作业', '检查排水沟渠和低洼地块', '雷暴结束后再安排喷药和施肥']
    }
  }

  if ((maxPrecip !== null && maxPrecip >= 10) || (dailyPrecip !== null && dailyPrecip >= 20)) {
    return {
      icon: '🌧',
      title: '强降水风险',
      level: '模型风险',
      sub: '地块中心坐标预报显示降水偏强，露天喷药和追肥需避开降雨窗口。',
      summary: '未来 24 小时存在较强降水风险，注意排水和作业窗口。',
      agency: 'CMA GRAPES模型风险提示',
      impactTime: '未来 24 小时',
      impactArea: area,
      actions: ['雨前暂停喷药', '检查低洼地块排水', '雨后再评估补肥和病害风险']
    }
  }

  if (maxWind !== null && maxWind >= 29) {
    return {
      icon: '⚠️',
      title: '大风风险',
      level: '模型风险',
      sub: '地块中心坐标预报显示风力偏大，喷药、无人机和覆膜作业需调整。',
      summary: '未来 24 小时风力偏大，优先安排低风险作业。',
      agency: 'CMA GRAPES模型风险提示',
      impactTime: '未来 24 小时',
      impactArea: area,
      actions: ['暂停飞防和喷药作业', '加固棚膜和临时设施', '风力减弱后再安排植保']
    }
  }

  if (maxTemp !== null && maxTemp >= 35) {
    return {
      icon: '🌡',
      title: '高温风险',
      level: '模型风险',
      sub: '地块中心坐标预报显示高温，注意滴灌保墒并避开正午长时间作业。',
      summary: '未来 24 小时高温明显，建议分次滴灌并减少中午田间作业。',
      agency: 'CMA GRAPES模型风险提示',
      impactTime: '未来 24 小时',
      impactArea: area,
      actions: ['将巡田和打药安排在清晨或傍晚', '采用小水勤灌保持墒情', '关注棉苗萎蔫和落蕾迹象']
    }
  }

  return null
}

function buildWeatherModelFromOpenMeteoCma(plot, payload, options = {}) {
  const today = options.today || new Date()
  const modelForecast = payload || {}
  const hourly = cmaModelHourlyData(modelForecast)
  if (!hourly) throw new Error('真实小时预报数据缺失')

  const currentIndex = findHourlyStartIndex(hourly.time, today)
  const current = readCmaModelHour(modelForecast, currentIndex)
  if (!(current && current.temp !== null)) throw new Error('真实小时预报缺少气温数据')

  const temp = roundRealValue(current.temp)
  const humidity = roundRealValue(current.humidity)
  const meta = weatherCodeMeta(current.weatherCode)
  const windLevel = current.windSpeed === null ? 0 : windLevelFromSpeed(current.windSpeed)
  const wind = current.windSpeed === null
    ? '--'
    : `${current.windDirection === null ? '' : directionFromDegrees(current.windDirection)}${windLevel}级`
  const todayHighValues = hourlyValuesForDate(modelForecast, today, 'temperature_2m')
  const high = roundRealValue(dailyValue(payload.daily, 'temperature_2m_max', 0) ?? Math.max(...todayHighValues))
  const low = roundRealValue(dailyValue(payload.daily, 'temperature_2m_min', 0) ?? Math.min(...todayHighValues))
  const rain = current.precipitation === null ? 0 : Number(current.precipitation.toFixed(current.precipitation >= 10 ? 0 : 1))
  const groundTemp = current.soilTemperature === null ? '--' : roundRealValue(current.soilTemperature)
  const pressure = current.pressure === null ? '--' : roundRealValue(current.pressure)
  const visibility = current.visibility === null ? null : Math.round(current.visibility)
  const uv = cmaModelDailyUv(modelForecast, today)
  const forecast = buildOpenMeteoCmaForecast(modelForecast, today, high, low, windLevel)
  const hourlyForecast = buildCmaModelHourlyForecast(modelForecast, today)

  const fieldName = plot && plot.name ? plot.name : '全部地块'
  const areaText = plot ? formatArea(plot.area) : '0'
  const alert = cmaModelRiskAlert(modelForecast, today, fieldName)

  return {
    fieldCount: options.fieldCount || 0,
    selectedIndex: options.selectedIndex || 0,
    selectedFieldLabel: fieldName,
    locationLabel: `${payload.model || 'CMA GRAPES'} · ${fieldName}`,
    regionLabel: payload.model || 'CMA GRAPES',
    sourceInfo: {
      type: 'real',
      label: 'CMA GRAPES',
      desc: '中国气象局 CMA GRAPES 模型预报，经 Open-Meteo 坐标接口获取；无本地估算。'
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
      groundTemp,
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
      high,
      low,
      humidity: humidity === '--' ? 45 : humidity,
      windLevel,
      rain,
      groundTemp,
      uv,
      alert,
      today
    }),
    summary: `当前地温 ${groundTemp}°C，逐小时预报来自真实 CMA GRAPES 模型。`,
    tipText: `天气预报来自真实模型数据，建议结合 ${fieldName}${plot && plot.area ? `（${areaText}亩）` : ''} 当前墒情安排作业。`
  }
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
  const daily = alignCmaDailyForecast(forecastData.daily, today)
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
  const modelForecast = payload.hourly || payload.modelForecast || {}
  const modelHourly = cmaModelHourlyData(modelForecast)
  const modelCurrent = modelHourly
    ? readCmaModelHour(modelForecast, findHourlyStartIndex(modelHourly.time, today))
    : null
  const uv = cmaModelDailyUv(modelForecast, today)
  const visibility = modelCurrent && modelCurrent.visibility !== null ? Math.round(modelCurrent.visibility) : null
  const soilTemperature = modelCurrent && modelCurrent.soilTemperature !== null ? clampRound(modelCurrent.soilTemperature, feelsLike) : feelsLike
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

  const hourly = buildCmaModelHourlyForecast(modelForecast, today)

  const officialAlarms = [
    ...(Array.isArray(currentData.alarm) ? currentData.alarm : []),
    ...(Array.isArray(forecastData.alarm) ? forecastData.alarm : [])
  ]
  const alert = buildCmaOfficialAlert(officialAlarms[0], station)

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
      desc: `实况、预警和7日预报来自中国气象局${station.name ? ` ${station.name}站` : ''}；逐小时、地温、紫外线和能见度来自 CMA GRAPES 模型预报。`
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
      groundTemp: soilTemperature,
      groundTempLabel: modelCurrent && modelCurrent.soilTemperature !== null ? '地温' : '体感',
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
      high,
      low,
      humidity,
      windLevel,
      rain,
      groundTemp: soilTemperature,
      uv,
      alert,
      today
    }),
    summary: alert ? alert.summary : `当前体感温度 ${feelsLike}°C，适合在上午完成巡田和滴灌。`,
    tipText: alert
      ? alert.sub
      : `天气相对稳定，建议优先处理 ${fieldName}${plot && plot.area ? `（${areaText}亩）` : ''} 的巡田和滴灌。`
  }
}

function buildWeatherModelFromQweather(plot, payload, options = {}) {
  const model = buildWeatherModelFromCurrent(
    plot,
    payload.current || {},
    payload.daily || {},
    payload.hourly || {},
    options
  )
  const fieldName = plot && plot.name ? plot.name : '全部地块'
  const today = options.today || new Date()

  model.locationLabel = `和风格点天气 · ${fieldName}`
  model.regionLabel = '和风格点天气'
  model.sourceInfo = {
    type: 'real',
    label: '和风天气',
    desc: '来自和风天气 QWeather 格点天气接口，按地块中心经纬度请求；无本地估算。'
  }

  if (payload.current && payload.current.weather_text) {
    model.weather.desc = payload.current.weather_text
  }

  model.weather.groundTemp = '--'
  model.weather.groundTempLabel = '地温'
  model.weather.uv = '--'
  model.weather.visibility = null
  model.weather.visibilityText = '--'

  const precipitation = payload.hourly && Array.isArray(payload.hourly.precipitation)
    ? payload.hourly.precipitation
    : []
  const hourlyTimes = payload.hourly && Array.isArray(payload.hourly.time) ? payload.hourly.time : []
  const currentTime = payload.current && payload.current.time ? new Date(payload.current.time).getTime() : Date.now()
  let startIndex = hourlyTimes.findIndex(time => {
    const value = new Date(time).getTime()
    return Number.isFinite(value) && value >= currentTime - 30 * 60 * 1000
  })
  if (startIndex < 0) startIndex = 0

  model.hourly = (model.hourly || [])
    .filter((item, index) => index % 2 === 0)
    .slice(0, 12)
    .map((item, index) => {
      const rain = finiteNumber(pickArrayValue(precipitation, startIndex + index * 2, null))
      return {
        ...item,
        rainChance: null,
        rainText: rain === null ? '--' : formatRainAmount(rain)
      }
    })

  model.advices = stageAdvice(plot || {}, {
    temp: model.weather.temp,
    high: model.weather.high,
    low: model.weather.low,
    humidity: model.weather.humidity,
    windLevel: model.weather.windLevel,
    rain: model.weather.rain,
    groundTemp: model.weather.temp,
    uv: 0,
    alert: model.alert,
    today
  })
  model.summary = `当前天气 ${model.weather.desc}，温度 ${model.weather.temp}°C，数据来自和风天气格点接口。`
  model.tipText = `天气按 ${fieldName} 的中心经纬度请求和风格点接口；缺失的地温、紫外线和能见度不做本地估算。`

  return model
}

function buildWeatherFromApi(plot, payload, options = {}) {
  if (!payload) throw new Error('真实天气数据缺失')
  if (payload.provider === 'cma') return buildWeatherModelFromCma(plot, payload, options)
  if (payload.provider === 'open-meteo-cma') return buildWeatherModelFromOpenMeteoCma(plot, payload, options)
  if (payload.provider === 'qweather') return buildWeatherModelFromQweather(plot, payload, options)
  const current = payload.current || payload.current_weather || {}
  const daily = payload.daily || {}
  const hourly = payload.hourly || {}
  return buildWeatherModelFromCurrent(plot, current, daily, hourly, options)
}

function localizeWeatherModel(model) {
  return i18n.localizeDeep(model)
}

module.exports = {
  buildWeatherFromApi: (...args) => localizeWeatherModel(buildWeatherFromApi(...args)),
  buildWeatherModelFromCurrent,
  buildWeatherModelFromCma,
  buildWeatherModelFromQweather
}
