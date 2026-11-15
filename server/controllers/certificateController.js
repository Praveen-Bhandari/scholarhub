import Enrollment from "../models/Enrollment.js";

function buildCertificate(enrollment) {
  return {
    certificateId: enrollment.certificateId,
    studentName: enrollment.student.name, // sirf naam, email nahi
    courseTitle: enrollment.course.title,
    instructorName: enrollment.course.instructor?.name || null,
    completedAt: enrollment.completedAt,
  };
}

const populateAll = [
  { path: "student", select: "name" },
  {
    path: "course",
    select: "title instructor sections",
    populate: { path: "instructor", select: "name" },
  },
];

// ---------- Apna certificate ----------
export async function getMyCertificate(req, res) {
  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: req.params.courseId,
  }).populate(populateAll);

  if (!enrollment) {
    return res.status(404).json({ message: "You are not enrolled in this course" });
  }

  if (!enrollment.completedAt || !enrollment.certificateId) {
    return res
      .status(409)
      .json({ message: "Complete all lessons to get your certificate" });
  }

  const lessons = enrollment.course.sections.flatMap((s) => s.lessons);
  res.json({
    certificate: {
      ...buildCertificate(enrollment),
      totalLessons: lessons.length,
      totalDurationMinutes: lessons.reduce((n, l) => n + (l.durationMinutes || 0), 0),
    },
  });
}

// ---------- Public verify (bina login) ----------
export async function verifyCertificate(req, res) {
  const certificateId = req.params.certificateId.toUpperCase();

  const enrollment = await Enrollment.findOne({ certificateId }).populate(populateAll);
  if (!enrollment) {
    return res.status(404).json({ valid: false, message: "Certificate not found" });
  }

  res.json({ valid: true, certificate: buildCertificate(enrollment) });
}