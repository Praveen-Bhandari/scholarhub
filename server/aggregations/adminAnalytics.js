import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import User from "../models/User.js";
import { monthWindow, monthKey } from "./monthSeries.js";

// completedAt me date hai to 1, nahi to 0
const isCompleted = {
  $cond: [{ $eq: [{ $type: "$completedAt" }, "date"] }, 1, 0],
};

// ---------- Overview ----------
export async function overviewStats() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [userFacet, courseFacet, enrollmentFacet] = await Promise.all([
    User.aggregate([
      {
        $facet: {
          byRole: [{ $group: { _id: "$role", count: { $sum: 1 } } }],
          total: [{ $count: "n" }],
          recent: [{ $match: { createdAt: { $gte: since } } }, { $count: "n" }],
        },
      },
    ]),
    Course.aggregate([
      {
        $facet: {
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          total: [{ $count: "n" }],
          ratings: [
            { $match: { status: "approved" } },
            {
              $group: {
                _id: null,
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
      {
        $facet: {
          all: [
            {
              $group: {
                _id: null,
                enrollments: { $sum: 1 },
                revenue: { $sum: "$pricePaid" },
                completed: { $sum: isCompleted },
              },
            },
            {
              $project: {
                _id: 0,
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
          ],
          recent: [
            { $match: { createdAt: { $gte: since } } },
            { $group: { _id: null, enrollments: { $sum: 1 }, revenue: { $sum: "$pricePaid" } } },
            { $project: { _id: 0, enrollments: 1, revenue: { $round: ["$revenue", 2] } } },
          ],
        },
      },
    ]),
  ]);

  const uf = userFacet[0];
  const cf = courseFacet[0];
  const ef = enrollmentFacet[0];

  const roles = { student: 0, instructor: 0, admin: 0 };
  for (const r of uf.byRole) roles[r._id] = r.count;

  const status = { draft: 0, submitted: 0, approved: 0, rejected: 0 };
  for (const r of cf.byStatus) status[r._id] = r.count;

  return {
    users: {
      ...roles,
      total: uf.total[0]?.n ?? 0,
      newLast30Days: uf.recent[0]?.n ?? 0,
    },
    courses: {
      ...status,
      total: cf.total[0]?.n ?? 0,
      pendingReview: status.submitted,
    },
    enrollments: {
      total: ef.all[0]?.enrollments ?? 0,
      last30Days: ef.recent[0]?.enrollments ?? 0,
      completed: ef.all[0]?.completed ?? 0,
      completionRate: ef.all[0]?.completionRate ?? 0,
    },
    revenue: {
      total: ef.all[0]?.revenue ?? 0,
      last30Days: ef.recent[0]?.revenue ?? 0,
    },
    ratings: {
      averageRating: cf.ratings[0]?.averageRating ?? 0,
      totalReviews: cf.ratings[0]?.reviews ?? 0,
    },
  };
}

// ---------- Top courses ----------
const SORTS = {
  enrollments: { enrollments: -1, revenue: -1, _id: 1 },
  revenue: { revenue: -1, enrollments: -1, _id: 1 },
  rating: { averageRating: -1, reviewCount: -1, _id: 1 },
};

export function topCourses(by, limit) {
  const match = { status: "approved" };
  if (by === "rating") match.reviewCount = { $gt: 0 };

  return Course.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "enrollments",
        let: { cid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$course", "$$cid"] } } },
          { $group: { _id: null, enrollments: { $sum: 1 }, revenue: { $sum: "$pricePaid" } } },
        ],
        as: "stats",
      },
    },
    { $unwind: { path: "$stats", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        enrollments: { $ifNull: ["$stats.enrollments", 0] },
        revenue: { $round: [{ $ifNull: ["$stats.revenue", 0] }, 2] },
      },
    },
    { $sort: SORTS[by] },
    { $limit: limit }, // pehle top chuno, phir naam jodo
    {
      // users se sirf naam (email ya password hash pipeline me aata hi nahi)
      $lookup: {
        from: "users",
        let: { uid: "$instructor" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
          { $project: { _id: 0, name: 1 } },
        ],
        as: "inst",
      },
    },
    {
      $project: {
        title: 1,
        category: 1,
        price: 1,
        averageRating: 1,
        reviewCount: 1,
        enrollments: 1,
        revenue: 1,
        instructorName: { $ifNull: [{ $arrayElemAt: ["$inst.name", 0] }, null] },
      },
    },
  ]);
}

// ---------- Top instructors ----------
export function topInstructors(limit) {
  return Enrollment.aggregate([
    // 1. course ke hisaab se
    {
      $group: {
        _id: "$course",
        enrollments: { $sum: 1 },
        revenue: { $sum: "$pricePaid" },
      },
    },
    // 2. har course ka instructor
    {
      $lookup: {
        from: "courses",
        let: { cid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$cid"] } } },
          { $project: { _id: 0, instructor: 1 } },
        ],
        as: "course",
      },
    },
    { $unwind: "$course" },
    // 3. instructor ke hisaab se
    {
      $group: {
        _id: "$course.instructor",
        enrollments: { $sum: "$enrollments" },
        revenue: { $sum: "$revenue" },
        coursesWithEnrollments: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1, enrollments: -1, _id: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        let: { uid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
          { $project: { _id: 0, name: 1 } },
        ],
        as: "inst",
      },
    },
    {
      $project: {
        _id: 0,
        instructorId: "$_id",
        name: { $ifNull: [{ $arrayElemAt: ["$inst.name", 0] }, null] },
        enrollments: 1,
        revenue: { $round: ["$revenue", 2] },
        coursesWithEnrollments: 1,
      },
    },
  ]);
}

export async function monthlyStats(months) {
  const { start, labels } = monthWindow(months);

  const [users, enrollments] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: monthKey("$createdAt"), newUsers: { $sum: 1 } } },
    ]),
    Enrollment.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: monthKey("$createdAt"),
          enrollments: { $sum: 1 },
          revenue: { $sum: "$pricePaid" },
        },
      },
      { $addFields: { revenue: { $round: ["$revenue", 2] } } },
    ]),
  ]);

  const userByMonth = new Map(users.map((r) => [r._id, r.newUsers]));
  const enrollByMonth = new Map(enrollments.map((r) => [r._id, r]));

  return labels.map((month) => ({
    month,
    newUsers: userByMonth.get(month) ?? 0,
    enrollments: enrollByMonth.get(month)?.enrollments ?? 0,
    revenue: enrollByMonth.get(month)?.revenue ?? 0,
  }));
}