import {
  overviewStats,
  topCourses,
  topInstructors,
  monthlyStats,
} from "../aggregations/adminAnalytics.js";

export async function overview(req, res) {
  res.json({ overview: await overviewStats() });
}

export async function topCoursesList(req, res) {
  const by = req.query.by || "enrollments";
  const limit = parseInt(req.query.limit, 10) || 5;
  res.json({ courses: await topCourses(by, limit) });
}

export async function topInstructorsList(req, res) {
  const limit = parseInt(req.query.limit, 10) || 5;
  res.json({ instructors: await topInstructors(limit) });
}

export async function monthly(req, res) {
  const months = parseInt(req.query.months, 10) || 6;
  res.json({ months: await monthlyStats(months) });
}