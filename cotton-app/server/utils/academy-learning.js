function selectPublishedCurrentCourse(group = {}, availableCourses = []) {
  if (!Array.isArray(availableCourses) || !availableCourses.length) return null

  const completedCourses = Array.isArray(group.courses) ? group.courses : []
  const completedIds = new Set(completedCourses.map(course => String(course.id || '')))
  const nextCourse = availableCourses.find(course => !completedIds.has(String(course.id || '')))
  if (nextCourse) return nextCourse

  // 全部学完时优先回到最近完成且仍然上架的课时。
  const availableById = new Map(availableCourses.map(course => [String(course.id || ''), course]))
  for (const course of completedCourses) {
    const publishedCourse = availableById.get(String(course.id || ''))
    if (publishedCourse) return publishedCourse
  }
  return availableCourses[0] || null
}

module.exports = { selectPublishedCurrentCourse }
