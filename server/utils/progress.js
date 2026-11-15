export function lessonIds(course) {
  const ids = [];
  for (const section of course.sections || []) {
    for (const lesson of section.lessons || []) {
      ids.push(lesson._id.toString());
    }
  }
  return ids;
}

export function computeProgress(course, enrollment) {
  const all = new Set(lessonIds(course));
  const done = new Set(enrollment.completedLessons.map(String));
  const completedCount = [...done].filter((id) => all.has(id)).length;
  const totalLessons = all.size;
  const progressPercent = totalLessons
    ? Math.round((completedCount / totalLessons) * 100)
    : 0;
  return { totalLessons, completedCount, progressPercent };
}