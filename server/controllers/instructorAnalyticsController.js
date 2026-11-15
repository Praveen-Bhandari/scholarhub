import {
  overviewStats,
  courseStats,
  monthlyStats,
} from "../aggregations/instructorAnalytics.js";

// instructor ki ID hamesha login se (req.user.id), URL ya body se kabhi nahi
export async function overview(req, res) {
  res.json({ overview: await overviewStats(req.user.id) });
}

export async function courses(req, res) {
  res.json({ courses: await courseStats(req.user.id) });
}

export async function monthly(req, res) {
  const months = parseInt(req.query.months, 10) || 6;
  res.json({ months: await monthlyStats(req.user.id, months) });
}