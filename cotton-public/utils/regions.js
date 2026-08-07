// utils/regions.js — 地区坐标与距离计算

const REGIONS = [
  { name: '乌鲁木齐市', lat: 43.8256, lng: 87.6168 },
  { name: '阿克苏市', lat: 41.1684, lng: 80.2606 },
  { name: '和田市', lat: 37.1107, lng: 79.9253 },
  { name: '喀什市', lat: 39.4677, lng: 75.9938 },
  { name: '疏附县', lat: 39.3800, lng: 75.8600 },
  { name: '疏勒县', lat: 39.4080, lng: 76.0540 },
  { name: '英吉沙县', lat: 38.9300, lng: 76.1750 },
  { name: '岳普湖县', lat: 39.2360, lng: 76.7720 },
  { name: '伽师县', lat: 39.4900, lng: 76.7240 },
  { name: '麦盖提县', lat: 38.9070, lng: 77.6420 },
  { name: '莎车县', lat: 38.4160, lng: 77.2400 },
  { name: '泽普县', lat: 38.1900, lng: 77.2600 },
  { name: '叶城县', lat: 37.8830, lng: 77.4160 },
  { name: '巴楚县', lat: 39.7850, lng: 78.5490 },
  { name: '塔什库尔干县', lat: 37.7780, lng: 75.2300 }
]

const KASHGAR_REGIONS = [
  { name: '喀什市', lat: 39.4677, lng: 75.9938 },
  { name: '疏附县', lat: 39.3800, lng: 75.8600 },
  { name: '疏勒县', lat: 39.4080, lng: 76.0540 },
  { name: '英吉沙县', lat: 38.9300, lng: 76.1750 },
  { name: '岳普湖县', lat: 39.2360, lng: 76.7720 },
  { name: '伽师县', lat: 39.4900, lng: 76.7240 },
  { name: '麦盖提县', lat: 38.9070, lng: 77.6420 },
  { name: '莎车县', lat: 38.4160, lng: 77.2400 },
  { name: '泽普县', lat: 38.1900, lng: 77.2600 },
  { name: '叶城县', lat: 37.8830, lng: 77.4160 },
  { name: '巴楚县', lat: 39.7850, lng: 78.5490 },
  { name: '塔什库尔干县', lat: 37.7780, lng: 75.2300 }
]

const SERVICE_RANGE_KM = 100

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function nearestInList(list, lat, lng) {
  let best = list[0]
  let min = Infinity
  list.forEach(region => {
    const distance = haversine(lat, lng, region.lat, region.lng)
    if (distance < min) {
      min = distance
      best = region
    }
  })
  return { ...best, distance: min }
}

function nearestRegion(lat, lng) {
  return nearestInList(REGIONS, lat, lng)
}

function locateService(lat, lng) {
  const kashgar = nearestInList(KASHGAR_REGIONS, lat, lng)
  if (kashgar.distance <= SERVICE_RANGE_KM) {
    return { name: kashgar.name, distance: kashgar.distance, inService: true }
  }
  const overall = nearestRegion(lat, lng)
  return { name: overall.name, distance: overall.distance, inService: false }
}

module.exports = { REGIONS, KASHGAR_REGIONS, SERVICE_RANGE_KM, haversine, nearestRegion, locateService }
