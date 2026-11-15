import crypto from "crypto";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import { lessonIds, computeProgress } from "../utils/progress.js";

function progressPayload(course, enrollment) {
  return {
    ...computeProgress(course, enrollment),
    lastLesson: enrollment.lastLesson || null,
    completedAt: enrollment.completedAt || null,
    certificateId: enrollment.certificateId || null,
  };
}

async function loadEnrollmentAndLesson(req, res, { needLesson = true } = {}) {
  const { courseId } = req.params;
  const lessonId = req.params.lessonId || req.body?.lessonId;

  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: courseId,
  });
  if (!enrollment) {
    res.status(403).json({ message: "You are not enrolled in this course" });
    return null;
  }

  const course = await Course.findById(courseId).select("sections");
  if (!course) {
    res.status(404).json({ message: "Course not found" });
    return null;
  }

  if (needLesson && !lessonIds(course).includes(String(lessonId))) {
    res.status(404).json({ message: "Lesson not found in this course" });
    return null;
  }

  return { enrollment, course, lessonId };
}

// ---------- Poora content (access rules ke saath) ----------
export async function getLearnCourse(req, res) {
  const course = await Course.findById(req.params.id)
    .populate("instructor", "name")
    .lean();
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  const { id: userId, role } = req.user;
  const isOwner =
    role === "instructor" && course.instructor._id.toString() === userId;
  const isAdmin = role === "admin";

  let enrollment = null;

  if (!isOwner && !isAdmin) {
    if (course.status !== "approved") {
      return res.status(404).json({ message: "Course not found" });
    }
    if (role !== "student") {
      return res
        .status(403)
        .json({ message: "You do not have access to this course content" });
    }
    enrollment = await Enrollment.findOne({ student: userId, course: course._id });
    if (!enrollment) {
      return res
        .status(403)
        .json({ message: "Enroll in this course to access its content" });
    }
  }

  course.sections.sort((a, b) => a.order - b.order);
  let totalDurationMinutes = 0;
  for (const section of course.sections) {
    section.lessons.sort((a, b) => a.order - b.order);
    for (const lesson of section.lessons) {
      totalDurationMinutes += lesson.durationMinutes || 0;
    }
  }

  let progress = null;
  if (enrollment) {
    const ordered = course.sections.flatMap((s) => s.lessons.map((l) => l._id.toString()));
    const last = enrollment.lastLesson?.toString();
    progress = {
      ...progressPayload(course, enrollment),
      completedLessons: enrollment.completedLessons,
      // pichla lesson agar abhi bhi hai to wahi, nahi to pehla lesson
      resumeLessonId: last && ordered.includes(last) ? last : ordered[0] || null,
    };
  }

  res.json({ course: { ...course, totalDurationMinutes }, progress });
}

// ---------- Meri enrollment (ek course me) ----------
export async function getMyEnrollment(req, res) {
  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: req.params.courseId,
  });
  if (!enrollment) {
    return res.status(404).json({ message: "You are not enrolled in this course" });
  }
  const course = await Course.findById(req.params.courseId).select("sections");
  res.json({
    enrollment: {
      id: enrollment._id,
      course: enrollment.course,
      completedLessons: enrollment.completedLessons,
      ...progressPayload(course, enrollment),
    },
  });
}

// ---------- Lesson complete ----------
export async function completeLesson(req, res) {
  const loaded = await loadEnrollmentAndLesson(req, res);
  if (!loaded) return;
  const { enrollment, course, lessonId } = loaded;

  let updated = await Enrollment.findByIdAndUpdate(
    enrollment._id,
    { $addToSet: { completedLessons: lessonId }, $set: { lastLesson: lessonId } },
    { new: true }
  );

  const progress = computeProgress(course, updated);

  // saare lessons complete: certificate, sirf ek baar
  if (
    progress.totalLessons > 0 &&
    progress.completedCount === progress.totalLessons &&
    !updated.completedAt
  ) {
    const certificateId = "SH-" + crypto.randomBytes(5).toString("hex").toUpperCase();
    await Enrollment.updateOne(
      { _id: updated._id, completedAt: { $exists: false } }, // pehle se na ho tabhi
      { $set: { completedAt: new Date(), certificateId } }
    );
    updated = await Enrollment.findById(updated._id);
  }

  res.json({ progress: progressPayload(course, updated) });
}

// ---------- Lesson complete hata do (certificate nahi jaata) ----------
export async function uncompleteLesson(req, res) {
  const loaded = await loadEnrollmentAndLesson(req, res);
  if (!loaded) return;
  const { enrollment, course, lessonId } = loaded;

  const updated = await Enrollment.findByIdAndUpdate(
    enrollment._id,
    { $pull: { completedLessons: lessonId } },
    { new: true }
  );

  res.json({ progress: progressPayload(course, updated) });
}

// ---------- Resume: kahan ruke ----------
export async function setLastLesson(req, res) {
  const loaded = await loadEnrollmentAndLesson(req, res);
  if (!loaded) return;
  const { enrollment, course, lessonId } = loaded;

  const updated = await Enrollment.findByIdAndUpdate(
    enrollment._id,
    { $set: { lastLesson: lessonId } },
    { new: true }
  );

  res.json({ progress: progressPayload(course, updated) });
}