import mongoose from "mongoose";
import Course from "../models/Course.js";

// URL ke :id wale course ko load karta hai aur check karta hai ki
// wo login hue instructor ka hi hai
export default async function loadOwnedCourse(req, res, next) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid course id" });
  }

  const course = await Course.findById(id);
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  // ObjectId aur string ki seedhi tulna galat hoti hai, isliye toString()
  if (course.instructor.toString() !== req.user.id) {
    return res
      .status(403)
      .json({ message: "You can only access your own courses" });
  }

  req.course = course;
  next();
}