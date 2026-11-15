const LESSON_FIELDS = ["title", "type", "content", "durationMinutes"];

// submitted course edit nahi ho sakta; rejected edit ho to wapas draft
function canEdit(course, res) {
  if (course.status === "submitted") {
    res
      .status(409)
      .json({ message: "Course is under review and cannot be edited" });
    return false;
  }
  if (course.status === "rejected") {
    course.status = "draft";
    course.rejectionReason = "";
  }
  return true;
}

function findSection(course, sectionId, res) {
  const section = course.sections.id(sectionId);
  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return null;
  }
  return section;
}

function findLesson(section, lessonId, res) {
  const lesson = section.lessons.id(lessonId);
  if (!lesson) {
    res.status(404).json({ message: "Lesson not found" });
    return null;
  }
  return lesson;
}

// ---------- Sections ----------
export async function addSection(req, res) {
  const course = req.course;
  if (!canEdit(course, res)) return;

  course.sections.push({
    title: req.body.title,
    order: course.sections.length,
  });
  await course.save();

  const section = course.sections[course.sections.length - 1];
  res.status(201).json({ section });
}

export async function updateSection(req, res) {
  const course = req.course;
  if (!canEdit(course, res)) return;

  const section = findSection(course, req.params.sectionId, res);
  if (!section) return;

  section.title = req.body.title;
  await course.save();
  res.json({ section });
}

export async function deleteSection(req, res) {
  const course = req.course;
  if (!canEdit(course, res)) return;

  const section = findSection(course, req.params.sectionId, res);
  if (!section) return;

  course.sections.pull(section._id);
  await course.save();
  res.json({ message: "Section deleted" });
}

// ---------- Lessons ----------
export async function addLesson(req, res) {
  const course = req.course;
  if (!canEdit(course, res)) return;

  const section = findSection(course, req.params.sectionId, res);
  if (!section) return;

  const { title, type, content, durationMinutes } = req.body;
  section.lessons.push({
    title,
    type,
    content,
    durationMinutes,
    order: section.lessons.length,
  });
  await course.save();

  const lesson = section.lessons[section.lessons.length - 1];
  res.status(201).json({ lesson });
}

export async function updateLesson(req, res) {
  const course = req.course;
  if (!canEdit(course, res)) return;

  const section = findSection(course, req.params.sectionId, res);
  if (!section) return;

  const lesson = findLesson(section, req.params.lessonId, res);
  if (!lesson) return;

  for (const field of LESSON_FIELDS) {
    if (req.body[field] !== undefined) {
      lesson[field] = req.body[field];
    }
  }
  await course.save();
  res.json({ lesson });
}

export async function deleteLesson(req, res) {
  const course = req.course;
  if (!canEdit(course, res)) return;

  const section = findSection(course, req.params.sectionId, res);
  if (!section) return;

  const lesson = findLesson(section, req.params.lessonId, res);
  if (!lesson) return;

  section.lessons.pull(lesson._id);
  await course.save();
  res.json({ message: "Lesson deleted" });
}