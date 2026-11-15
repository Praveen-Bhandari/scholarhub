import Course from "../models/Course.js";

// ---------- Instructor: review ke liye bhejo ----------
export async function submitCourse(req, res) {
  const course = req.course; // ownership middleware ne pehle hi check kar liya

  if (!["draft", "rejected"].includes(course.status)) {
    return res
      .status(409)
      .json({ message: `Course is already ${course.status}` });
  }

  const hasLesson = course.sections.some((s) => s.lessons.length > 0);
  if (!hasLesson) {
    return res.status(400).json({
      message: "Add at least one section with a lesson before submitting",
    });
  }

  course.status = "submitted";
  course.rejectionReason = "";
  await course.save();

  res.json({
    message: "Course submitted for review",
    course: { id: course._id, status: course.status },
  });
}

// ---------- Admin: review list ----------
export async function listForReview(req, res) {
  const status = req.query.status || "submitted";
  if (!["submitted", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status filter" });
  }

  const courses = await Course.find({ status })
    .select("-sections")
    .populate("instructor", "name email")
    .sort({ updatedAt: 1 });

  res.json({ courses });
}

// ---------- Admin: approve ----------
export async function approveCourse(req, res) {
  const { id } = req.params;

  // check aur update ek hi query me
  const course = await Course.findOneAndUpdate(
    { _id: id, status: "submitted" },
    { status: "approved", rejectionReason: "" },
    { new: true }
  ).select("-sections");

  if (!course) {
    const exists = await Course.exists({ _id: id });
    return res.status(exists ? 409 : 404).json({
      message: exists
        ? "Only submitted courses can be approved"
        : "Course not found",
    });
  }

  res.json({ message: "Course approved", course });
}

// ---------- Admin: reject ----------
export async function rejectCourse(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  const course = await Course.findOneAndUpdate(
    { _id: id, status: "submitted" },
    { status: "rejected", rejectionReason: reason },
    { new: true }
  ).select("-sections");

  if (!course) {
    const exists = await Course.exists({ _id: id });
    return res.status(exists ? 409 : 404).json({
      message: exists
        ? "Only submitted courses can be rejected"
        : "Course not found",
    });
  }

  res.json({ message: "Course rejected", course });
}