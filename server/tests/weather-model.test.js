const assert = require('assert')
const { buildWeatherFromApi, buildWeatherModelFromCma, buildWeatherModelFromCurrent } = require('../../utils/weather')
const i18n = require('../../utils/i18n')

function run() {
  const zhWeatherCopy = i18n.getPageCopy('weatherPage', 'zh')
  const ugWeatherCopy = i18n.getPageCopy('weatherPage', 'ug')
  assert.strictEqual(zhWeatherCopy.aiAdvice, '农事气象建议')
  assert.strictEqual(ugWeatherCopy.aiAdvice, 'ھاۋارايى دېھقانچىلىق تەۋسىيەسى')
  assert(!zhWeatherCopy.aiAdvice.includes('AI'))
  assert(!ugWeatherCopy.aiAdvice.includes('AI'))

  const model = buildWeatherModelFromCma({
    id: 6,
    name: '测试地块',
    area: 20,
    coordinates: JSON.stringify([
      { latitude: 39.47, longitude: 75.99 },
      { latitude: 39.47, longitude: 75.991 },
      { latitude: 39.471, longitude: 75.991 }
    ])
  }, {
    provider: 'cma',
    station: { id: 'Y9199', name: '喀什' },
    current: {
      now: {
        temperature: 27,
        humidity: 40,
        windDirection: '北风',
        windDirectionDegree: 0,
        windScale: '2级',
        precipitation: 0,
        feelst: 28,
        pressure: 860
      }
    },
    forecast: {
      daily: [
        {
          date: '2026/07/05',
          high: 35,
          low: 21,
          dayText: '晴',
          dayCode: 0,
          dayWindDirection: '北风',
          dayWindScale: '2级'
        },
        {
          date: '2026/07/06',
          high: 32,
          low: 22,
          dayText: '多云',
          dayCode: 1,
          dayWindDirection: '东风',
          dayWindScale: '3级'
        },
        {
          date: '2026/07/07',
          high: 31,
          low: 20,
          dayText: '小雨',
          dayCode: 7,
          dayWindDirection: '东风',
          dayWindScale: '3级'
        }
      ]
    },
    hourly: {
      provider: 'open-meteo-cma',
      source: 'api.open-meteo.com/v1/cma',
      model: 'CMA GFS GRAPES',
      hourly: {
        time: [
          '2026-07-06T10:00',
          '2026-07-06T11:00',
          '2026-07-06T12:00',
          '2026-07-06T13:00',
          '2026-07-06T14:00'
        ],
        temperature_2m: [27, 28, 29, 30, 31],
        relative_humidity_2m: [40, 39, 38, 37, 36],
        precipitation: [0, 0, 0.2, 0, 0],
        weather_code: [1, 1, 3, 3, 0],
        wind_speed_10m: [7.2, 8.1, 9.3, 10.1, 11.2],
        wind_direction_10m: [0, 45, 90, 135, 180],
        visibility: [18000, 17000, 16000, 15000, 14000],
        surface_pressure: [860, 861, 862, 863, 864],
        soil_temperature_0_to_10cm: [29, 30, 31, 32, 33]
      },
      daily: {
        time: ['2026-07-06'],
        uv_index_max: [7.4]
      }
    }
  }, { today: new Date('2026-07-06T10:00:00+08:00') })

  assert.strictEqual(model.weather.temp, 27)
  assert.strictEqual(model.weather.high, 32)
  assert.strictEqual(model.weather.low, 22)
  assert.strictEqual(model.weather.desc, '多云')
  assert.strictEqual(model.forecast[0].day, '今天')
  assert.strictEqual(model.forecast[0].high, 32)
  assert.strictEqual(model.forecast[1].day, '明天')
  assert.strictEqual(model.forecast[1].high, 31)
  assert.strictEqual(model.hourly.length, 3)
  assert.strictEqual(model.hourly[0].time, '现在')
  assert.strictEqual(model.hourly[0].temp, 27)
  assert.strictEqual(model.hourly[0].rainText, '0mm')
  assert.strictEqual(model.hourly[1].time, '12:00')
  assert.strictEqual(model.hourly[1].temp, 29)
  assert.strictEqual(model.hourly[1].rainText, '0.2mm')
  assert.strictEqual(model.weather.groundTemp, 29)
  assert.strictEqual(model.weather.groundTempLabel, '地温')
  assert.strictEqual(model.weather.uv, 7)
  assert.strictEqual(model.weather.visibilityText, '18km')

  const missingHourly = buildWeatherModelFromCma({
    id: 6,
    name: '测试地块',
    area: 20,
    coordinates: '[]'
  }, {
    provider: 'cma',
    station: { id: 'Y9199', name: '喀什' },
    current: { now: { temperature: 27, humidity: 40, precipitation: 0 } },
    forecast: { daily: [{ date: '2026/07/06', high: 32, low: 22, dayText: '多云', dayCode: 1 }] }
  }, { today: new Date('2026-07-06T10:00:00+08:00') })

  assert.deepStrictEqual(missingHourly.hourly, [])
  assert.strictEqual(missingHourly.weather.uv, '--')
  assert.strictEqual(missingHourly.weather.visibilityText, '--')
  assert.strictEqual(missingHourly.alert, null)

  const noOfficialStormAlert = buildWeatherModelFromCma({
    id: 7,
    name: '测试地块',
    area: 20,
    coordinates: '[]'
  }, {
    provider: 'cma',
    station: { id: 'Y9199', name: '喀什' },
    current: { now: { temperature: 27, humidity: 40, precipitation: 0 }, alarm: [] },
    forecast: { daily: [{ date: '2026/07/06', high: 32, low: 22, dayText: '雷阵雨', dayCode: 4 }], alarm: [] }
  }, { today: new Date('2026-07-06T10:00:00+08:00') })

  assert.strictEqual(noOfficialStormAlert.alert, null)

  const missingGenericHourly = buildWeatherModelFromCurrent(
    { id: 8, name: '测试地块', area: 20, coordinates: '[]' },
    { time: '2026-07-06T10:00', temperature_2m: 27, relative_humidity_2m: 40, weather_code: 1 },
    { time: ['2026-07-06'], temperature_2m_max: [32], temperature_2m_min: [22], weather_code: [1] },
    {},
    { today: new Date('2026-07-06T10:00:00+08:00') }
  )

  assert.deepStrictEqual(missingGenericHourly.hourly, [])
  assert.throws(
    () => buildWeatherFromApi({ id: 9, name: '测试地块', area: 20 }, null),
    /真实天气数据缺失/
  )

  const cmaModelOnly = buildWeatherFromApi({
    id: 10,
    name: '筠连县',
    area: 42,
    coordinates: '[]'
  }, {
    provider: 'open-meteo-cma',
    source: 'api.open-meteo.com/v1/cma',
    model: 'CMA GFS GRAPES',
    hourly: {
      time: ['2026-07-06T10:00', '2026-07-06T11:00', '2026-07-06T12:00'],
      temperature_2m: [27, 28, 29],
      relative_humidity_2m: [40, 39, 38],
      precipitation: [0, 0, 0.2],
      weather_code: [1, 1, 3],
      wind_speed_10m: [7.2, 8.1, 9.3],
      wind_direction_10m: [0, 45, 90],
      visibility: [18000, 17000, 16000],
      surface_pressure: [860, 861, 862],
      soil_temperature_0_to_10cm: [29, 30, 31]
    },
    daily: {
      time: ['2026-07-06'],
      weather_code: [1],
      temperature_2m_max: [32],
      temperature_2m_min: [22],
      uv_index_max: [7.4],
      precipitation_sum: [0.2],
      wind_speed_10m_max: [9.3],
      wind_direction_10m_dominant: [90]
    }
  }, { today: new Date('2026-07-06T10:00:00+08:00') })

  assert.strictEqual(cmaModelOnly.weather.temp, 27)
  assert.strictEqual(cmaModelOnly.weather.high, 32)
  assert.strictEqual(cmaModelOnly.weather.low, 22)
  assert.strictEqual(cmaModelOnly.hourly[1].rainText, '0.2mm')
  assert.strictEqual(cmaModelOnly.sourceInfo.label, 'CMA GRAPES')

  const cmaModelRisk = buildWeatherFromApi({
    id: 11,
    name: '测试地块',
    area: 42,
    coordinates: '[]'
  }, {
    provider: 'open-meteo-cma',
    source: 'api.open-meteo.com/v1/cma',
    model: 'CMA GFS GRAPES',
    hourly: {
      time: ['2026-07-06T10:00', '2026-07-06T11:00', '2026-07-06T12:00'],
      temperature_2m: [27, 28, 29],
      relative_humidity_2m: [80, 82, 83],
      precipitation: [0, 8, 12],
      weather_code: [3, 95, 95],
      wind_speed_10m: [7.2, 31, 35],
      wind_direction_10m: [0, 45, 90],
      visibility: [18000, 8000, 5000],
      surface_pressure: [860, 861, 862],
      soil_temperature_0_to_10cm: [29, 30, 31]
    },
    daily: {
      time: ['2026-07-06'],
      weather_code: [95],
      temperature_2m_max: [32],
      temperature_2m_min: [22],
      uv_index_max: [3],
      precipitation_sum: [20],
      wind_speed_10m_max: [35],
      wind_direction_10m_dominant: [90]
    }
  }, { today: new Date('2026-07-06T10:00:00+08:00') })

  assert(cmaModelRisk.alert)
  assert.strictEqual(cmaModelRisk.alert.agency, 'CMA GRAPES模型风险提示')
  assert.strictEqual(cmaModelRisk.alert.title, '雷暴风险')

  const hotDryAdvice = buildWeatherFromApi({
    id: 12,
    name: '花铃期棉田',
    area: 50,
    sow_date: '2026-04-25',
    irrigation: '滴灌',
    soil_type: '壤土',
    planting_status: '已播种',
    coordinates: '[]'
  }, {
    provider: 'open-meteo-cma',
    source: 'api.open-meteo.com/v1/cma',
    model: 'CMA GFS GRAPES',
    hourly: {
      time: ['2026-07-06T10:00', '2026-07-06T11:00', '2026-07-06T12:00'],
      temperature_2m: [36, 37, 38],
      relative_humidity_2m: [24, 23, 22],
      precipitation: [0, 0, 0],
      weather_code: [1, 1, 0],
      wind_speed_10m: [12, 13, 14],
      wind_direction_10m: [270, 270, 270],
      visibility: [22000, 22000, 22000],
      surface_pressure: [860, 861, 862],
      soil_temperature_0_to_10cm: [34, 35, 36]
    },
    daily: {
      time: ['2026-07-06'],
      weather_code: [1],
      temperature_2m_max: [39],
      temperature_2m_min: [24],
      uv_index_max: [9],
      precipitation_sum: [0],
      wind_speed_10m_max: [14],
      wind_direction_10m_dominant: [270]
    }
  }, { today: new Date('2026-07-06T10:00:00+08:00') })

  assert.deepStrictEqual(
    hotDryAdvice.advices.map(item => item.title),
    ['高温错峰作业', '滴灌保墒', '红蜘蛛巡查', '花铃期追肥窗口']
  )
  assert(hotDryAdvice.advices[1].sub.includes('分次滴灌'))
  assert(hotDryAdvice.advices[2].sub.includes('叶背'))
  const localizedHotDryAdvice = i18n.localizeDeep(hotDryAdvice.advices, 'ug')
  const localizedText = JSON.stringify(localizedHotDryAdvice)
  assert(!localizedText.includes('高温错峰作业'))
  assert(!localizedText.includes('滴灌保墒'))
  assert(!localizedText.includes('红蜘蛛巡查'))
  assert(!localizedText.includes('花铃期追肥窗口'))
  assert(!localizedText.includes('分次滴灌'))

  console.log('weather model tests passed')
}

try {
  run()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
