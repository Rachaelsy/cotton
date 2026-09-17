const LEVELS = [
  { key: 'basic', name: '初级课程', shortName: '初级', eyebrow: '基础入门', description: '初级视频课程', color: 'green' },
  { key: 'intermediate', name: '中级课程', shortName: '中级', eyebrow: '进阶提升', description: '中级视频课程', color: 'gold' },
  { key: 'advanced', name: '高级课程', shortName: '高级', eyebrow: '专业进阶', description: '高级视频课程', color: 'blue' }
]

// 课程与系列均由后台发布。这里不保留演示或兜底内容，避免真实课程为空时展示虚假数据。
const COURSES = []
const SERIES = []

const emptyCourse = { id: '', level: 'basic', type: '视频', title: '', summary: '', teacher: '', cover: '', videoUrl: '', objectives: [] }
const emptySeries = { id: '', level: 'basic', title: '', summary: '', teacher: '', cover: '', lessonIds: [] }

const getLevel = key => LEVELS.find(item => item.key === key) || LEVELS[0]
const getCourse = id => COURSES.find(item => item.id === id) || emptyCourse
const getSeries = id => SERIES.find(item => item.id === id) || emptySeries
const getSeriesLessons = id => {
  const series = getSeries(id)
  return (series.lessonIds || []).map(courseId => getCourse(courseId)).filter(item => item.id)
}

module.exports = { LEVELS, SERIES, COURSES, getLevel, getCourse, getSeries, getSeriesLessons }
