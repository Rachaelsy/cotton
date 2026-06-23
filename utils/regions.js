// utils/regions.js — 全国主要城市/县中心坐标 + 就近匹配（用于定位显示与地区筛选）
// 覆盖全国，新疆喀什地区细化到县（产品主战场）

const REGIONS = [
  // 直辖市 / 主要城市
  { name: '北京',   lat: 39.9042, lng: 116.4074 },
  { name: '天津',   lat: 39.0842, lng: 117.2009 },
  { name: '上海',   lat: 31.2304, lng: 121.4737 },
  { name: '重庆',   lat: 29.5630, lng: 106.5516 },
  { name: '石家庄', lat: 38.0428, lng: 114.5149 },
  { name: '唐山',   lat: 39.6357, lng: 118.1758 },
  { name: '太原',   lat: 37.8706, lng: 112.5489 },
  { name: '呼和浩特', lat: 40.8424, lng: 111.7490 },
  { name: '包头',   lat: 40.6574, lng: 109.8403 },
  { name: '沈阳',   lat: 41.8057, lng: 123.4315 },
  { name: '大连',   lat: 38.9140, lng: 121.6147 },
  { name: '鞍山',   lat: 41.1085, lng: 122.9946 },
  { name: '长春',   lat: 43.8171, lng: 125.3235 },
  { name: '吉林市', lat: 43.8378, lng: 126.5497 },
  { name: '哈尔滨', lat: 45.8038, lng: 126.5349 },
  { name: '大庆',   lat: 46.5897, lng: 125.1039 },
  { name: '南京',   lat: 32.0603, lng: 118.7969 },
  { name: '苏州',   lat: 31.2989, lng: 120.5853 },
  { name: '无锡',   lat: 31.4912, lng: 120.3119 },
  { name: '常州',   lat: 31.8107, lng: 119.9740 },
  { name: '徐州',   lat: 34.2058, lng: 117.2839 },
  { name: '杭州',   lat: 30.2741, lng: 120.1551 },
  { name: '宁波',   lat: 29.8683, lng: 121.5440 },
  { name: '温州',   lat: 27.9939, lng: 120.6994 },
  { name: '金华',   lat: 29.0784, lng: 119.6474 },
  { name: '嘉兴',   lat: 30.7522, lng: 120.7555 },
  { name: '合肥',   lat: 31.8206, lng: 117.2272 },
  { name: '芜湖',   lat: 31.3526, lng: 118.4331 },
  { name: '福州',   lat: 26.0745, lng: 119.2965 },
  { name: '厦门',   lat: 24.4798, lng: 118.0894 },
  { name: '泉州',   lat: 24.8741, lng: 118.6757 },
  { name: '南昌',   lat: 28.6820, lng: 115.8579 },
  { name: '赣州',   lat: 25.8452, lng: 114.9350 },
  { name: '济南',   lat: 36.6512, lng: 117.1201 },
  { name: '青岛',   lat: 36.0671, lng: 120.3826 },
  { name: '烟台',   lat: 37.4638, lng: 121.4479 },
  { name: '潍坊',   lat: 36.7069, lng: 119.1618 },
  { name: '临沂',   lat: 35.1042, lng: 118.3564 },
  { name: '郑州',   lat: 34.7466, lng: 113.6254 },
  { name: '洛阳',   lat: 34.6197, lng: 112.4540 },
  { name: '南阳',   lat: 32.9909, lng: 112.5283 },
  { name: '武汉',   lat: 30.5928, lng: 114.3055 },
  { name: '宜昌',   lat: 30.6919, lng: 111.2865 },
  { name: '襄阳',   lat: 32.0090, lng: 112.1226 },
  { name: '长沙',   lat: 28.2282, lng: 112.9388 },
  { name: '株洲',   lat: 27.8273, lng: 113.1340 },
  { name: '衡阳',   lat: 26.8932, lng: 112.5719 },
  { name: '广州',   lat: 23.1291, lng: 113.2644 },
  { name: '深圳',   lat: 22.5431, lng: 114.0579 },
  { name: '珠海',   lat: 22.2707, lng: 113.5767 },
  { name: '东莞',   lat: 23.0207, lng: 113.7518 },
  { name: '佛山',   lat: 23.0218, lng: 113.1219 },
  { name: '湛江',   lat: 21.2707, lng: 110.3594 },
  { name: '汕头',   lat: 23.3535, lng: 116.6820 },
  { name: '南宁',   lat: 22.8170, lng: 108.3665 },
  { name: '桂林',   lat: 25.2342, lng: 110.1799 },
  { name: '柳州',   lat: 24.3264, lng: 109.4281 },
  { name: '海口',   lat: 20.0444, lng: 110.1989 },
  { name: '三亚',   lat: 18.2528, lng: 109.5119 },
  { name: '成都',   lat: 30.5728, lng: 104.0668 },
  { name: '绵阳',   lat: 31.4675, lng: 104.6796 },
  { name: '贵阳',   lat: 26.6470, lng: 106.6302 },
  { name: '遵义',   lat: 27.7066, lng: 106.9272 },
  { name: '昆明',   lat: 25.0389, lng: 102.7183 },
  { name: '大理',   lat: 25.6065, lng: 100.2676 },
  { name: '拉萨',   lat: 29.6520, lng: 91.1721 },
  { name: '西安',   lat: 34.3416, lng: 108.9398 },
  { name: '宝鸡',   lat: 34.3614, lng: 107.2370 },
  { name: '榆林',   lat: 38.2853, lng: 109.7341 },
  { name: '兰州',   lat: 36.0611, lng: 103.8343 },
  { name: '西宁',   lat: 36.6171, lng: 101.7782 },
  { name: '银川',   lat: 38.4872, lng: 106.2309 },
  // 新疆
  { name: '乌鲁木齐', lat: 43.8256, lng: 87.6168 },
  { name: '克拉玛依', lat: 45.5800, lng: 84.8892 },
  { name: '昌吉',   lat: 44.0136, lng: 87.3041 },
  { name: '石河子', lat: 44.3060, lng: 86.0807 },
  { name: '吐鲁番', lat: 42.9476, lng: 89.1841 },
  { name: '哈密',   lat: 42.8190, lng: 93.5151 },
  { name: '库尔勒', lat: 41.7259, lng: 86.1746 },
  { name: '阿克苏', lat: 41.1684, lng: 80.2606 },
  { name: '和田',   lat: 37.1107, lng: 79.9253 },
  { name: '伊宁',   lat: 43.9080, lng: 81.2780 },
  { name: '阿勒泰', lat: 47.8456, lng: 88.1411 },
  { name: '塔城',   lat: 46.7463, lng: 82.9857 },
  { name: '博乐',   lat: 44.9053, lng: 82.0668 },
  // 喀什地区（细化到县 —— 产品主战场）
  { name: '喀什市',   lat: 39.4677, lng: 75.9938 },
  { name: '疏附县',   lat: 39.3800, lng: 75.8600 },
  { name: '疏勒县',   lat: 39.4080, lng: 76.0540 },
  { name: '英吉沙县', lat: 38.9300, lng: 76.1750 },
  { name: '岳普湖县', lat: 39.2360, lng: 76.7720 },
  { name: '伽师县',   lat: 39.4900, lng: 76.7240 },
  { name: '麦盖提县', lat: 38.9070, lng: 77.6420 },
  { name: '莎车县',   lat: 38.4160, lng: 77.2400 },
  { name: '泽普县',   lat: 38.1900, lng: 77.2600 },
  { name: '叶城县',   lat: 37.8830, lng: 77.4160 },
  { name: '巴楚县',   lat: 39.7850, lng: 78.5490 },
  { name: '塔什库尔干', lat: 37.7780, lng: 75.2300 }
]

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// 返回 { name, lat, lng, distance }（距最近城市的公里数）
function nearestRegion(lat, lng) {
  let best = REGIONS[0], min = Infinity
  REGIONS.forEach(r => {
    const d = haversine(lat, lng, r.lat, r.lng)
    if (d < min) { min = d; best = r }
  })
  return { ...best, distance: min }
}

module.exports = { REGIONS, haversine, nearestRegion }
