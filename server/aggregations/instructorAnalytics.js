import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";

const oid = (id) => new mongoose.Types.ObjectId(id);

// completedAt me date hai to 1, nahi to 0
const isCompleted = {
  $cond: [{ $eq: [{ $type: "$completedAt" }, "date"] }, 1, 0],
};

// ---------- Overview ----------
export async function overviewStats(instructorId) {
  // is instructor ke course IDs (enrollments isi se filter honge)
  const courseIds = await Course.distinct("_id", { instructor: instructorId });

  const [courseFacet, enrollmentRows] = await Promise.all([
    Course.aggregate([
      { $match: { instructor: oid(instructorId) } },
      {
        // $facet: ek hi pass me kai hisaab
        $facet: {
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          total: [{ $count: "n" }],
          ratings: [
            { $match: { status: "approved" } },
            {
              $group: {
                _id: null,
                // har course ki rating ko uske reviews se tolke (weighted average)
                weighted: { $sum: { $multiply: ["$averageRating", "$reviewCount"] } },
                reviews: { $sum: "$reviewCount" },
              },
            },
            {
              $project: {
                _id: 0,
                reviews: 1,
                averageRating: {
                  $cond: [
                    { $gt: ["$reviews", 0] },
                    { $round: [{ $divide: ["$weighted", "$reviews"] }, 1] },
                    0,
                  ],
                },
              },
            },
          ],
        },
      },
    ]),
    Enrollment.aggregate([
      { $match: { course: { $in: courseIds } } },
      // pehle student ke hisaab se, phir total: unique students bina bade array ke
      {
        $group: {
          _id: "$student",
          enrollments: { $sum: 1 },
          revenue: { $sum: "$pricePaid" },
          completed: { $sum: isCompleted },
        },
      },
      {
        $group: {
          _id: null,
          students: { $sum: 1 },
          enrollments: { $sum: "$enrollments" },
          revenue: { $sum: "$revenue" },
          completed: { $sum: "$completed" },
        },
      },
      {
        $project: {
          _id: 0,
          students: 1,
          enrollments: 1,
          completed: 1,
          revenue: { $round: ["$revenue", 2] },
          completionRate: {
            $cond: [
              { $gt: ["$enrollments", 0] },
              { $round: [{ $multiply: [{ $divide: ["$completed", "$enrollments"] }, 100] }, 0] },
              0,
            ],
          },
        },
      },
    ]),
  ]);

  const facet = courseFacet[0];
  const byStatus = { draft: 0, submitted: 0, approved: 0, rejected: 0 };
  for (const row of facet.byStatus) byStatus[row._id] = row.count;

  const e = enrollmentRows[0];
  const r = facet.ratings[0];

  return {
    courses: { ...byStatus, total: facet.total[0]?.n ?? 0 },
    students: e?.students ?? 0,
    enrollments: e?.enrollments ?? 0,
    revenue: e?.revenue ?? 0,
    completedEnrollments: e?.completed ?? 0,
    completionRate: e?.completionRate ?? 0,
    averageRating: r?.averageRating ?? 0,
    totalReviews: r?.reviews ?? 0,
  };
}

// ---------- Har course ke numbers ----------
export function courseStats(instructorId) {
  return Course.aggregate([
    { $match: { instructor: oid(instructorId) } },
    {
      // har course ke enrollments ka hisaab andar ki pipeline me
      $lookup: {
        from: "enrollments",
        let: { cid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$course", "$$cid"] } } },
          {
            $group: {
              _id: null,
              students: { $sum: 1 },
              revenue: { $sum: "$pricePaid" },
              completed: { $sum: isCompleted },
            },
          },
        ],
        as: "stats",
      },
    },
    { $unwind: { path: "$stats", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        title: 1,
        status: 1,
        price: 1,
        averageRating: 1,
        reviewCount: 1,
        createdAt: 1,
        students: { $ifNull: ["$stats.students", 0] },
        revenue: { $round: [{ $ifNull: ["$stats.revenue", 0] }, 2] },
        completed: { $ifNull: ["$stats.completed", 0] },
      },
    },
    {
      $addFields: {
        completionRate: {
          $cond: [
            { $gt: ["$students", 0] },
            { $round: [{ $multiply: [{ $divide: ["$completed", "$students"] }, 100] }, 0] },
            0,
          ],
        },
      },
    },
    { $sort: { revenue: -1, students: -1, _id: 1 } },
  ]);
}

// ---------- Mahine ke hisaab se ----------
export async function monthlyStats(instructorId, months) {
  const courseIds = await Course.distinct("_id", { instructor: instructorId });

  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)
  );

  const rows = await Enrollment.aggregate([
    { $match: { course: { $in: courseIds }, createdAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } },
        enrollments: { $sum: 1 },
        revenue: { $sum: "$pricePaid" },
      },
    },
    { $addFields: { revenue: { $round: ["$revenue", 2] } } },
    { $sort: { _id: 1 } },
  ]);
  const byMonth = new Map(rows.map((r) => [r._id, r]));

  // sirf formatting: jin mahino me kuch nahi hua unhe 0 ke saath jodo (chart ke liye)
  const result = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const label = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const r = byMonth.get(label);
    result.push({
      month: label,
      enrollments: r?.enrollments ?? 0,
      revenue: r?.revenue ?? 0,
    });
  }
  return result;
}