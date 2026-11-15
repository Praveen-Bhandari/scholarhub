import Course from "../models/Course.js";

const EDITABLE_FIELDS = ["title", "description", "category", "level", "price"];

export async function createCourse(req, res) {
  const { title, description, category, level, price } = req.body;

  const course = await Course.create({
    title,
    description,
    category,
    level,
    price,
    instructor: req.user.id, // body se kabhi nahi, hamesha login hue user se
    // status default "draft" hai, body se nahi liya
  });

  res.status(201).json({ course });
}

// sirf apne courses (sections ke bina, list halki rahe)
export async function getMyCourses(req, res) {
  const courses = await Course.find({ instructor: req.user.id })
    .select("-sections")
    .sort({ createdAt: -1 });
  res.json({ courses });
}

// apna ek course poora (ownership middleware ne pehle hi check kar liya)
export async function getMyCourse(req, res) {
  res.json({ course: req.course });
}

export async function updateCourse(req, res) {
  const course = req.course;

  if (course.status === "submitted") {
    return res
      .status(409)
      .json({ message: "Course is under review and cannot be edited" });
  }

  // sirf chuni hui fields, status/instructor body se kabhi nahi
  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) {
      course[field] = req.body[field];
    }
  }

  // reject hua course edit ho to wapas draft me
  if (course.status === "rejected") {
    course.status = "draft";
    course.rejectionReason = "";
  }

  await course.save();
  res.json({ course });
}

export async function deleteCourse(req, res) {
  const course = req.course;

  if (!["draft", "rejected"].includes(course.status)) {
    return res.status(409).json({
      message: "Only draft or rejected courses can be deleted",
    });
  }

  await course.deleteOne();
  res.json({ message: "Course deleted" });
}