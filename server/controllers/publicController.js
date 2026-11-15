import mongoose from "mongoose";
import Course from "../models/Course.js";
import { buildCourseQuery } from "../utils/courseQuery.js";

// ---------- List ----------
export async function listCourses(req, res) {
  const { filter, sort, relevance, page, limit, skip } = buildCourseQuery(req.query);

  const fields = {
    title: 1,
    category: 1,
    level: 1,
    price: 1,
    thumbnail: 1,
    instructor: 1,
    averageRating: 1,
    reviewCount: 1,
    createdAt: 1,
  };
  if (relevance) fields.score = { $meta: "textScore" };

  const [courses, total] = await Promise.all([
    Course.find(filter, fields)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("instructor", "name")
      .lean(),
    Course.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);
  res.json({
    courses,
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages },
  });
}

// ---------- Detail ----------
export async function getCourse(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid course id" });
  }

  const course = await Course.findOne({ _id: id, status: "approved" })
    .select("-rejectionReason -sections.lessons.content -sections.lessons.attachments")
    .populate("instructor", "name")
    .lean();

  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  course.sections.sort((a, b) => a.order - b.order);
  let totalLessons = 0;
  let totalDurationMinutes = 0;
  for (const section of course.sections) {
    section.lessons.sort((a, b) => a.order - b.order);
    for (const lesson of section.lessons) {
      totalLessons += 1;
      totalDurationMinutes += lesson.durationMinutes || 0;
    }
  }

  res.json({ course: { ...course, totalLessons, totalDurationMinutes } });
}

// ---------- Categories (aggregation) ----------
export async function listCategories(req, res) {
  const rows = await Course.aggregate([
    { $match: { status: "approved" } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);

  res.json({ categories: rows.map((r) => ({ category: r._id, count: r.count })) });
}