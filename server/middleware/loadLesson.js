export default function loadLesson(req, res, next) {
  const section = req.course.sections.id(req.params.sectionId);
  if (!section) {
    return res.status(404).json({ message: "Section not found" });
  }
  const lesson = section.lessons.id(req.params.lessonId);
  if (!lesson) {
    return res.status(404).json({ message: "Lesson not found" });
  }
  req.section = section;
  req.lesson = lesson;
  next();
}